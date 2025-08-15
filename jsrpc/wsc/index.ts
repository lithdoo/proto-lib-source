import { RPCConnectClient, RPCError, RPCMethod, RPCMsgHandler, RPCRequest } from "../base"
import { CrossEnvWebSocket } from "./crossEnv"
import { ManualPromise } from "./utils"

export abstract class WsClient {

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
        const ws = WsClient.createWebsocket(this.url)
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
            this.ws = new ManualPromise<any>()
            this.connect(new Promise(res => setTimeout(res, 5000)))
        }
    }


    protected abstract onOpen(ws: CrossEnvWebSocket): void

    protected abstract onMessage(ws: CrossEnvWebSocket, message: MessageEvent<any>): void

    protected abstract onClose(ws: CrossEnvWebSocket): void

}

export class WsRPCClient extends WsClient implements RPCConnectClient {

    id?: string

    protected onOpen(ws: CrossEnvWebSocket): void {
        console.log("WsRPCClient OPEN")
        this.wst = ws
        this.send({
            method: 'connect/open',
            params: { id: this.id ?? null }
        })
            .then((data: any) => {
                if (data) {
                    this.id = data
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
        const msg = new RPCMsgHandler(data.toString())

        const res = msg.respond((name) => {
            return this.methodTable.get(name)
        })

        if (res) {
            res.then(result => {
                this.success(msg.id, result)
            }).catch(err => {
                this.error(msg.id, err)
            })
        } else if (msg.id) {
            // deal respond
            const id = msg.id
            const error = msg.error
            const result = msg.result
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

    reqTable: Map<string, ManualPromise<unknown>> = new Map()
    methodTable: Map<string, RPCMethod> = new Map()

    apply(method: RPCMethod) {
        this.methodTable.set(method.name, method)
        return this
    }

    async send(msg: RPCRequest) {
        if (msg.withoutResult) {
            this.request(null, msg)
        } else {
            const id = Math.random().toString()
            if (this.reqTable.has(id)) {
                throw new Error()
            }
            const promsie = new ManualPromise()
            this.reqTable.set(id, promsie)
            await this.request(id, msg)
            return promsie.target
        }
    }

    private async request(id: string | null, msg: RPCRequest) {
        const data = { jsonrpc: "2.0", id, ...msg }
        const ws = await this.ws.target
        ws.send(JSON.stringify(data))
    }


    private success(id: string | void, data: any) {
        if (!id) return
        this.wst?.send(JSON.stringify({
            jsonrpc: '2.0',
            id: id,
            result: data
        }))
    }
    private error(id: string | void, error: RPCError) {
        if (!id) return
        this.wst?.send(JSON.stringify({
            jsonrpc: '2.0',
            id: this.id,
            error: error
        }))
    }

}