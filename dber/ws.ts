import { WsRPCClientConnection, type RPCMethod } from '@lib/jsrpc'
import type { ErGraphView } from './GraphView'
import type { MethodDocData } from '../jsrpc/doc'
import { EntityNode, type EntityData, type EntityRenderData } from './EntityNode'



export class RPCLogger {
    msglist: RPCLoggerItem[] = []
    onMsg(item: RPCLoggerItem) {
        this.msglist = this.msglist.concat([item])
    }
}


export abstract class ErdConnection {


    constructor(
        public ws: WsRPCClientConnection,
        public view: ErGraphView
    ) {

    }



    bindMethods() {
        const onNodeUpdate: RPCMethod = {
            name: 'dberServer/updateEntityNode',
            params: ['entity', 'render'],
            call: async (entity: EntityData, render: EntityRenderData) => {
                const node = new EntityNode(
                    this.view.id,
                    entity,
                    render
                )
                this.view.updateNode(node)
                return { success: true }
            }
        }


        const onGraphClear: RPCMethod = {
            name: 'dberServer/clearGraph',
            params: [],
            call: async () => {

                return { success: true }
            }
        }

            ;[onNodeUpdate].forEach(method => {
                this.ws.methods.set(method.name, method)
            })
    }
}