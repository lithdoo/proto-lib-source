import { RPCError, RPCErrorCode, type RPCMethod, RPCRequestHandler } from "../base"
import type { WsConnectionManager } from "./server"

type RawData = any


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
        public data: RawData,
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



