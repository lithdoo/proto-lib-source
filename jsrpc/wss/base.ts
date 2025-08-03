
import { RPCError, RPCErrorCode, RPCMethod, RPCRequestHandler } from '@proto-lib/jsrpc/index';
import WebSocket from 'ws';
import { WsServerOption } from './createServer';


export enum WsConnectionStatus {
    Pending,
    Open,
    Closed,
}


// 用于统一处理异常断联保留状态
export interface WsConnection {
    readonly id: string
    status: WsConnectionStatus
}


export class WsOpenRequest extends RPCRequestHandler {

    static connect: RPCMethod = {
        name: 'connect/id',
        params: ['id'],
        call: async () => { }
    }

    constructor(
        public ws: WebSocket,
        public data: WebSocket.RawData,
        public manager: WsConnectionManager<WsConnection>
    ) {
        super(data.toString())
    }

    connectId?: string

    getMethod(name: string): RPCMethod | undefined {
        if (name === WsOpenRequest.connect.name) {
            return {
                ...WsOpenRequest.connect,
                call: async (id: string | null) => {
                    if (id === null) {
                        const id = Math.random().toString()
                        this.connectId = id
                        return { id }
                    } else if (typeof id !== 'string') {
                        throw new RPCError(RPCErrorCode.InvalidParams)
                    } else {
                        const connection = this.manager.all.get(id)
                        if (connection?.status === WsConnectionStatus.Open) {
                            throw new RPCError(RPCErrorCode.InvalidParams)
                        } else {
                            this.id = id
                        }
                    }
                }
            }
        }
    }

    success(res: any): void {
        console.log('success',res)
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
            const request = new WsOpenRequest(ws, data, this)
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