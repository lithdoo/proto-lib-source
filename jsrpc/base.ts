export enum RPCErrorCode {
    ParseError = -32700,
    InvalidRequest = -32600,
    MethodNotFound = -32601,
    InvalidParams = -32602,
    InternalError = -32603,
    ServerError = -32000
}


export class RPCError extends Error {

    static ParseError(msg: string = '') {
        return new RPCError(RPCErrorCode.ParseError)
    }
    static InvalidRequest(msg: string = '') {
        return new RPCError(RPCErrorCode.InvalidRequest)
    }
    static MethodNotFound(msg: string = '') {
        return new RPCError(RPCErrorCode.MethodNotFound)
    }
    static InvalidParams(msg: string = '') {
        return new RPCError(RPCErrorCode.InvalidParams)
    }
    static InternalError(msg: string = '') {
        return new RPCError(RPCErrorCode.InternalError)
    }
    static ServerError(msg: string = '') {
        return new RPCError(RPCErrorCode.ServerError)
    }

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



export class RPCMsgHandler {
    id?: string
    method?: string
    params?: any
    result: any
    error: any

    parseError?: RPCError

    constructor(public raw: string) { 
        this.parse()
    }

    async parse() {
        try {
            const json = JSON.parse(this.raw)
            if (!json || (typeof json !== 'object'))
                return

            if (json.jsonrpc !== '2.0')
                return

            this.id = json.id
            this.method = json.method
            this.params = json.params
            this.result = json.result
            this.error = json.error

        } catch (e) {
            console.error(e)
        }
    }

    respond(fetchMethod: (method: string) => RPCMethod | void) {
        console.log()
        if (!this.method || typeof this.method !== 'string') return
        const methodName = this.method

        return new Promise(async (res, rej) => {
            try {
                const method = fetchMethod(methodName)
                if (!method) throw RPCError.MethodNotFound()

                const { params } = this
                let argus = []
                if (params instanceof Array) {
                    argus = params
                } else if (!params) {
                    argus = []
                } else if (typeof params === 'object') {
                    argus = (method.params ?? [])
                        .map(name => params[name])
                } else {
                    argus = [params]
                }
                const result = await method.call(...argus)
                res(result)
            } catch (e: unknown) {
                if (e instanceof RPCError) {
                    rej(e)
                } else {
                    rej(RPCError.ServerError())
                }
            }
        })
    }
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
            console.log('json', this.json)
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
        } catch (e: any) {
            throw this.error(new RPCError(RPCErrorCode.ParseError, e.message))
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

    abstract error(error: RPCError): RPCError

    abstract success(res: any): void

    dealOthers(json: any): RPCError | Promise<RPCError> | undefined {
        return new RPCError(RPCErrorCode.ParseError)
    }

}

export interface RPCRequest {
    method: string
    params: { [key: string]: any }
    withoutResult?: boolean
    timeout?: number
}


export interface RPCConnectClient {
    send(request: RPCRequest): Promise<any>
}


export interface RPCConnectServer {
    methods: { [key: string]: RPCMethod }
}
