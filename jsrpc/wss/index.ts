import { RPCMethod, RPCMsgHandler, RPCRequest } from "../base"
import WebSocket from "ws"
export * from './createServer'

const RPCConnectionMethod = {
    close: {
        name: 'connect/close',
        params: [],
        call: async () => { }
    } as RPCMethod,
    open: {
        name: 'connect/open',
        params: ['id'],
        call: async () => { }
    } as RPCMethod,
}


export enum WsConnectionStatus {
    Pending,
    Open,
    Closed,
}

export interface WsConnection {
    readonly id: string
    ws?: WebSocket
    status: WsConnectionStatus
}


export abstract class WsRPCServer<Connection extends WsConnection> {

    all: Map<string, Connection> = new Map()
    socket: WeakMap<Connection, WebSocket> = new WeakMap()
    connection: WeakMap<WebSocket, Connection> = new WeakMap()
    clients = new Set<WebSocket>()

    abstract connect(id: string): Connection

    abstract request(connection: Connection, name: string): RPCMethod | void

    abstract respond(connection: Connection, id: string, error: any, result: any): void

    private closeConnect(connection: Connection) {
        const ws = this.socket.get(connection)
        connection.status = WsConnectionStatus.Closed
        if (ws) { this.connection.delete(ws) }
        this.socket.delete(connection)
        this.all.delete(connection.id)
    }

    async onWsMessage(ws: WebSocket, data: WebSocket.RawData) {
        const connection = this.connection.get(ws)
        if (!connection) {
            const msg = new RPCMsgHandler(data.toString())
            const res = msg.respond(name => name === RPCConnectionMethod.open.name
                ? {
                    ...RPCConnectionMethod.open,
                    call: async (id: string | null) => {
                        const newId = id ?? Math.random().toString()
                        const connection = this.all.get(newId)
                        if (connection) this.closeConnect(connection)

                        const newConnection = this.connect(newId)
                        newConnection.status = WsConnectionStatus.Open
                        this.all.set(newConnection.id, newConnection)
                        this.socket.set(newConnection, ws)
                        this.connection.set(ws, newConnection)
                        return newId
                    }
                }
                : undefined
            )

            if (!res && msg.parseError) {
                this.error(ws, msg.id, msg.parseError)
            } else if (res) {
                res.then(result => {
                    this.success(ws, msg.id, result)
                }).catch(err => {
                    this.error(ws, msg.id, err)
                })
            }
        } else {
            const msg = new RPCMsgHandler(data.toString())
            // todo: 处理 CloseEvent
            const res = msg.respond((name) => {
                return this.request(connection, name)
            })

            if (res) {
                res.then(result => {
                    this.success(ws, msg.id, result)
                }).catch(err => {
                    this.error(ws, msg.id, err)
                })
            } else if (msg.id) {
                this.respond(connection, msg.id, msg.error, msg.result)
            }
        }

    }

    private success(ws: WebSocket, id: string | void, result: any) {
        ws.send(JSON.stringify({
            jsonrpc: '2.0',
            id, result
        }))
    }

    private error(ws: WebSocket, id: string | void, error: any) {
        ws.send(JSON.stringify({
            jsonrpc: '2.0',
            id, error
        }))
    }

    boradcast(request: RPCRequest) {
        Array.from(this.all.values()).forEach(connection => {
            connection.ws?.send(JSON.stringify({
                jsonrpc: '2.0',
                method: request.method,
                params: request.params
            }))
        })
    }

}