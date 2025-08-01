export enum RPCErrorCode {
    ParseError = -32700,
    InvalidRequest = -32600,
    MethodNotFound = -32601,
    InvalidParams = -32602,
    InternalError = -32603,
    ServerError = -32000
}


export class RPCError extends Error {
    timestamp: number = new Date().getTime()
    constructor(
        public code: RPCErrorCode,
        public message: string = '',
        public data?: any,
    ) {
        super(message)
    }
}


export interface RPCMethod {
    name: string,
    params?: string[],
    call: (...argus: any[]) => Promise<any>
}

export abstract class RPCRequestHandler {
    static jsonrpc = "2.0"

    id: string | null = null
    json: { [key: string]: any } = {}
    method: RPCMethod
    params: string[] = []


    constructor(
        public raw: string
    ) {

        try {
            this.json = JSON.parse(raw)
            if (!this.json || typeof this.json !== 'object') {
                throw new Error()
            }
        } catch (e) {

            throw this.error(new RPCError(RPCErrorCode.ParseError))
        }

        const { jsonrpc, id, method, params } = this.json

        this.id = id ?? null

        if (!jsonrpc || jsonrpc !== RPCRequestHandler.jsonrpc) {
            throw this.error(new RPCError(RPCErrorCode.InvalidRequest))
        }

        const rpcMethod = this.getMethod(method)

        if (!rpcMethod) {
            throw this.error(new RPCError(RPCErrorCode.MethodNotFound))
        } else {
            this.method = method
        }

        if (params instanceof Array) {
            if (params.length < (this.method.params?.length ?? 0)) {
                throw this.error(new RPCError(RPCErrorCode.InvalidParams))
            }
            this.params = params
        } else if (params instanceof Object) {
            const argus = (this.method.params ?? [])
                .map(name => params[name])
            if (argus.includes(undefined)) {
                throw this.error(new RPCError(RPCErrorCode.InvalidParams))
            }
            this.params = argus
        } else if (!this.method.params || this.method.params.length === 0) {
            this.params = []
        } else {
            throw this.error(new RPCError(RPCErrorCode.InvalidParams))
        }

    }


    async deal() {
        try {
            const res = await this.method.call(...this.params)
            this.success(res)
        } catch (e) {
            const error = new RPCError(RPCErrorCode.ServerError)
            this.error(error)
            throw error
        }
    }

    abstract getMethod(name: string): RPCMethod | undefined

    abstract error(error: RPCError): RPCError

    abstract success(res: any): void

}

export interface RPCRequest {
    method: string
    params: { [key: string]: any }
    timeout?: number
}


export interface RPCConnectClient {
    send(request: RPCRequest): Promise<any>
}


export interface RPCConnectServer {
    methods: { [key: string]: RPCMethod }
}
