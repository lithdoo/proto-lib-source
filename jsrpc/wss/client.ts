import { RPCError, RPCRequestHandler, type RPCConnectClient, type RPCMethod, type RPCRequest } from "../base"
import type { RPCLoggerItem } from "../log"
import { type WsConnection, WsConnectionStatus } from "./base"
import type { CrossEnvWebSocket } from "./crossEnv"



class ManualPromise<T> {
    target: Promise<T>
    done: boolean = false
    reject: (e: Error) => void = null as any
    resolve: (val: T) => void = null as any
    constructor() {
        this.target = new Promise((res, rej) => {
            this.reject = (val) => {
                this.done = true
                rej(val)
            }

            this.resolve = (val) => {
                this.done = true
                res(val)
            }
        })
    }
}


export abstract class WsClientConnection {

    static createWebsocket(url: string): CrossEnvWebSocket {
        return new (globalThis as any).WebSocket(url)
    }

    ws: ManualPromise<CrossEnvWebSocket> = new ManualPromise()
    wst?: CrossEnvWebSocket

    constructor(
        public url: string
    ) {
        this.connect()
    }


    private async connect(timeout: Promise<void> = Promise.resolve()) {
        const wsp = this.ws.done ? this.ws : new ManualPromise<any>()
        this.ws = wsp
        await timeout
        const ws = WsClientConnection.createWebsocket(this.url)
        ws.onopen = () => {
            if (!this.ws.done) {
                this.onOpen(ws)
                this.ws.resolve(ws)
            }
        }
        ws.onmessage = (ev: any) => {
            this.onMessage(ws, ev)
        }
        ws.onclose = () => {
            this.onClose(ws)
            this.connect(new Promise(res => setTimeout(res, 5000)))
        }
    }


    protected abstract onOpen(ws: CrossEnvWebSocket): void

    protected abstract onMessage(ws: CrossEnvWebSocket, message: MessageEvent<any>): void

    protected abstract onClose(ws: CrossEnvWebSocket): void

}


export interface WsSendConnection extends WsConnection, RPCConnectClient {
}



export class WsRPCClientConnection extends WsClientConnection implements WsSendConnection {

    id: string = null as any

    wst?: CrossEnvWebSocket = undefined

    methods: Map<string, RPCMethod> = new Map()


    protected async onRequest(msg: string) {
        if (!this.wst) return

        const req = new WsPRCClientRequestHandler(
            msg,
            this.wst,
            this.methods
        )


        const mPromise = new ManualPromise()

        this.logger?.({
            type: 'recevied',
            method: req.json?.method ?? '<unknown>',
            params: req.json?.params ?? undefined,
            result: mPromise.target
        })

        await req.deal()

    }

    protected onOpen(ws: CrossEnvWebSocket): void {
        this.wst = ws
        this.send({
            method: 'connect/id',
            params: [this.id]
        })
            .then((data: any) => {
                if (data?.id) {
                    this.id = data.id
                    console.log(this.id)
                }
            })
    }

    protected onClose(_ws: CrossEnvWebSocket): void {
        this.wst = undefined
    }

    protected onMessage(_ws: CrossEnvWebSocket, message: MessageEvent<any>): void {
        const data = message.data

        if (typeof data !== 'string') {
            return
        }
        const json = JSON.parse(data)
        if (!json) return
        const { id, result, error, method } = json

        if (method) {
            this.onRequest(data)
        } else {
            const promise = this.reqTable.get(id)

            if (promise && error) {
                this.reqTable.delete(id)
                promise.reject(error)
            } else if (promise) {
                this.reqTable.delete(id)
                promise.resolve(result ?? null)
            }
        }
    }

    get status() {
        if (!this.wst) {
            return WsConnectionStatus.Pending
        }

        if (this.wst.raw().readyState !== 1) {
            return WsConnectionStatus.Pending
        }

        return WsConnectionStatus.Open
    }

    reqTable: Map<string, ManualPromise<unknown>> = new Map()

    async send(msg: RPCRequest) {
        const id = Math.random().toString()
        if (this.reqTable.has(id)) {
            throw new Error()
        }
        const promsie = new ManualPromise()
        this.reqTable.set(id, promsie)
        await this.request(id, msg)
        return promsie.target
    }

    private async request(id: string, msg: RPCRequest) {
        const data = { jsonrpc: "2.0", id, ...msg, }
        const ws = await this.ws.target
        ws.send(JSON.stringify(data))
    }


    logger?: (item: RPCLoggerItem) => void
}


export class WsPRCClientRequestHandler extends RPCRequestHandler {

    constructor(
        public message: string,
        public ws: CrossEnvWebSocket,
        public all: Map<string, RPCMethod>
    ) {
        super(message)
    }

    connectId?: string

    getMethod(name: string): RPCMethod | undefined {
        return this.all.get(name)
    }

    success(res: any): void {
        if (!this.id) return
        this.ws.send(JSON.stringify({
            id: this.id,
            result: res
        }))
    }

    error(error: RPCError): RPCError | undefined {
        if (!this.id) return undefined
        this.ws.send(JSON.stringify({
            id: this.id,

        }))
        return error
    }
}