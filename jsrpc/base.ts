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
        console.log('message', message)
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
    method?: RPCMethod
    params: string[] = []


    constructor(
        public raw: string
    ) { }


    async parse() {
        try {
            this.json = JSON.parse(this.raw)
            console.log('json',this.json)
            if ((!this.json) || (typeof this.json !== 'object') || (typeof this.json.method !== 'string')) {
                if (!this.dealOthers) {
                    throw new Error()
                } else {
                    Promise.resolve(
                        this.dealOthers(this.json)
                    ).then(err => {
                        if (err) throw (err)
                    }).catch(err => {
                        throw this.error(err)
                    })

                }
            }
        } catch (e:any) {
            throw this.error(new RPCError(RPCErrorCode.ParseError,e.message))
        }
        const { jsonrpc, id, method, params } = this.json

        this.id = id ?? null

        if (!jsonrpc || jsonrpc !== RPCRequestHandler.jsonrpc) {
            throw this.error(new RPCError(RPCErrorCode.InvalidRequest))
        }

        this.method = this.getMethod(method)


        if (!this.method) {
            throw this.error(new RPCError(RPCErrorCode.MethodNotFound))
        }

        if (params instanceof Array) {
            // if (params.length < (this.method.params?.length ?? 0)) {
            //     throw this.error(new RPCError(RPCErrorCode.InvalidParams))
            // }
            this.params = params
        } else if (params instanceof Object) {
            const argus = (this.method.params ?? [])
                .map(name => params[name])
            // if (argus.includes(undefined)) {
            //     throw this.error(new RPCError(RPCErrorCode.InvalidParams))
            // }
            this.params = argus
        } else
        //if (!this.method.params || this.method.params.length === 0) 
        {
            this.params = []
        }
        // else {
        //     throw this.error(new RPCError(RPCErrorCode.InvalidParams))
        // }

    }


    async deal() {
        try {
            await this.parse()
            if (!this.method) {
                throw this.error(new RPCError(RPCErrorCode.MethodNotFound))
            }
            const res = await this.method.call(...this.params)
            this.success(res)
        } catch (e: any) {
            if (e instanceof RPCError) {
                console.error(e)
                this.error(e)
            } else {
                const error = new RPCError(RPCErrorCode.ServerError, e.message)
                console.error(error)
                this.error(error)
            }

        }
    }

    abstract getMethod(name: string): RPCMethod | undefined

    abstract error(error: RPCError): RPCError  | undefined

    abstract success(res: any): void

    dealOthers(json: any): RPCError | Promise<RPCError> | undefined {
        return new RPCError(RPCErrorCode.ParseError)
    }

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
