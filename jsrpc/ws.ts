import { RPCMethod, RPCRequest } from "./base"


export interface WsRPCRecevier {
    on(nme: string): RPCMethod
}

export interface WsRPCSender {
    send(request: RPCRequest): Promise<unknown>
}