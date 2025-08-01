import type { RPCError, RPCRequest } from "./base"


export interface RPCLog {
    type: 'send' | 'recevied'
    msg: RPCRequest
    status: RPCMsgStatus
}

export type RPCMsgStatus = {
    type: 'pending',
    detail?: string
} | {
    type: 'error',
    detail: RPCError
} | {
    type: 'success'
    detail: {
        result: any,
        timestamp: number
    }
}