import WebSocket from 'ws';
import { WsServerOption } from './createServer';
import { RPCError, RPCMethod, RPCRequestHandler } from '../base';
import { WsConnection, WsConnectionStatus, WsOpenRequest } from './base';


// ws 中间断联修复
export abstract class WsMsgRequest<Connection extends WsConnection> extends RPCRequestHandler {

    static close: RPCMethod = {
        name: 'connect/close',
        params: [],
        call: async () => { }
    }


    constructor(
        public ws: WebSocket,
        public data: WebSocket.RawData,
        public connection: Connection,
        public manager: WsConnectionManager<Connection>
    ) {
        super(data.toString())
    }

    connectId?: string

    getMethod(name: string): RPCMethod | undefined {
        if (name === WsMsgRequest.close.name) {
            return {
                ...WsMsgRequest.close,
                call: async () => { this.manager.closeConnect(this.ws) }
            }
        } else {
            return this.msgMethod(name)
        }
    }

    abstract msgMethod(name: string): RPCMethod | undefined

    success(res: any): void {
        this.ws.send(JSON.stringify({
            id: this.id,
            result:res
        }))
    }

    error(error: RPCError): RPCError {
        this.ws.send(JSON.stringify({
            id: this.id,

        }))
        return error
    }
}

export abstract class WsConnectionManager<Connection extends WsConnection>
    implements WsServerOption {
    abstract port: number
    all: Map<string, Connection> = new Map()
    socket: WeakMap<Connection, WebSocket> = new WeakMap()
    connection: WeakMap<WebSocket, Connection> = new WeakMap()

    clients = new Set<WebSocket>()

    abstract connect(id: string): Connection

    abstract request(option: {
        ws: WebSocket,
        data: WebSocket.RawData,
        connection: Connection,
        manager: WsConnectionManager<Connection>
    }): RPCRequestHandler


    closeConnect(ws: WebSocket) {
        const connection = this.connection.get(ws)
        if (connection) {
            connection.status = WsConnectionStatus.Closed
            this.connection.delete(ws)
            this.socket.delete(connection)
            this.all.delete(connection.id)
        }
    }

    onWsOpen(ws: WebSocket): void { }
    onWsClose(ws: WebSocket): void {
        const connection = this.connection.get(ws)
        if (!connection) return
        connection.status = WsConnectionStatus.Pending
    }
    async onWsMessage(ws: WebSocket, data: WebSocket.RawData) {
        const connection = this.connection.get(ws)
        if (!connection) {
            const request = new WsOpenRequest(ws as any, data, this)
            await request.deal()
            if (request.connectId) {
                const connection = this.connect(request.connectId)
                connection.status = WsConnectionStatus.Open
                this.all.set(connection.id, connection)
                this.socket.set(connection, ws)
                this.connection.set(ws, connection)
            }
        } else {
            const ws = this.socket.get(connection)
            if (!ws) return
            const request = this.request({
                ws, connection, manager: this, data
            })
            await request.deal()
        }

    }

}