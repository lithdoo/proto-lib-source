import { ActionData, findOptimalPosition, LinkMapState, NodeFullData, NodeViewData, ViewPort } from "@proto-lib/linkmap"
import { RelationData, StructData, UDBController, UDBMetaData } from "./base"
import { v4 } from "uuid"
import { WsConnection, WsConnectionStatus, WsRPCServer } from "@proto-lib/jsrpc/wss"
import { RPCMethod, RPCRequest } from "@proto-lib/jsrpc/base"
import { readFileSync } from "fs"
import { resolve } from "path"



enum UDBNodeType {
    Struct = 'struct-node',
    Relation = 'relaction-node'
}


const UDBNodeTemlate: {
    [key in UDBNodeType]: string
} = {
    [UDBNodeType.Struct]: readFileSync(resolve(__dirname, './struct-node.xml')).toString(),
    [UDBNodeType.Relation]: readFileSync(resolve(__dirname, './struct-node.xml')).toString()
}





export type FieldData<Type extends string> = {
    name: string
    desc: string
    type: Type
}

export interface StructMapData extends StructData {
    id: string
    type: 'struct-node'
}


export interface RelationMapData extends RelationData {
    id: string
    type: 'relaction-node'
}




export class ErMapState implements LinkMapState<StructMapData | RelationMapData> {
    viewprot: ViewPort = {
        pos: { x: 0, y: 0 }, zoom: 1
    }
    nodes: NodeFullData<StructMapData | RelationMapData>[] = []
    timestamp: number = new Date().getTime()
    templates: { [key: string]: string } = UDBNodeTemlate

    snapshot(): LinkMapState<StructMapData | RelationMapData> {
        const { viewprot, nodes, timestamp } = this
        return JSON.parse(JSON.stringify({ viewprot, nodes, timestamp }))
    }

    apply<T>(fn: (state: ErMapState) => T, timestamp: number): ActionData<T> {
        const from = this.timestamp
        const data = fn(this)
        const to = timestamp
        this.timestamp = to
        return { data, from, to }
    }

    changeViewPort(viewprot: ViewPort, timestamp: number) {
        const actionData = this.apply((state) => {
            this.viewprot = viewprot
            return viewprot
        }, timestamp)
        console.log('onViewPortChanged')
        console.log(this.onViewPortChanged)
        this.onViewPortChanged?.(actionData)
        return actionData
    }

    updateNode(entity: StructMapData | RelationMapData, timestamp: number) {

        // if (this.nodes.find(v => v.data.id === entity.id)) {
        //     const actionData = this.apply((state) => {
        //         const node = state.nodes.find(v => v.data.id === entity.id)
        //         if (!node) throw new Error('broadcastEntityUpdate')
        //         node.data = entity
        //         return {
        //             id: node.view.id,
        //             data: entity
        //         }
        //     }, timestamp)
        //     this.onDataUpdate?.(actionData)

        // } else {
        //     const actionData = this.apply((state) => {
        //         const node = state.nodes.find(v => v.data.id === entity.id)
        //         if (node) throw new Error('broadcastNodeInsert')
        //         const view: NodeViewData = {
        //             x: state.nodes.length * 400, y: 0, width: 100, height: 100, id: entity.id
        //         }
        //         state.nodes = state.nodes.concat([{ data: entity, view, type: 'entity' }])
        //         return { data: entity, view, type: 'entity' }
        //     }, timestamp)
        //     this.onNodeInsert?.(actionData)
        // }

    }

    moveNode(view: NodeViewData, timestamp: number) {
        const node = this.nodes.find(v => v.view.id === view.id)
        if (!node) return null

        const action = this.apply(state => {
            state.nodes = state.nodes.map(v => v.view.id === view.id ? {
                ...v, view
            } : v)
            return view
        }, timestamp)
        this.onNodeMove?.(action)
    }

    onViewPortChanged?: (data: ActionData<ViewPort>) => void
    onDataUpdate?: (data: ActionData<{ id: string, data: StructMapData | RelationMapData }>) => void
    onNodeInsert?: (data: ActionData<NodeFullData<StructMapData | RelationMapData>>) => void
    onNodeMove?: (data: ActionData<NodeViewData>) => void
    onNodeDelete?: (data: ActionData<string>) => void
    onFullChanged?: (timestamp: number) => void


    fetchTemplates() {
        const { templates } = this
        return { templates }
    }

    fetchState() {
        const { viewprot, nodes, timestamp } = this
        return { viewprot, nodes, timestamp }
    }


    readFromMetaData(data: UDBMetaData) {
        const calcuHeight = (fieldLength: number) => {
            const outerBorder = 6
            const fieldHeight = 30
            const colorBanner = 6
            const titleHeight = 32

            return outerBorder + titleHeight + colorBanner + fieldHeight * fieldLength + outerBorder
        }

        const oldList: NodeFullData<StructMapData | RelationMapData>[] = this.nodes
        const newList: NodeFullData<StructMapData | RelationMapData>[] = []

        const { structs, relations } = data


        const insert = (
            data: StructData | RelationData,
            old?: NodeFullData<StructMapData | RelationMapData>
        ) => {
            if (old && newList.find(v => v.view.id === old.view.id)) {
                throw new Error('exist')
            }
            if (newList.find(v => v.data.keyName === data.keyName)) {
                throw new Error('exist')
            }

            const type = (data as any).relations ? 'relaction-node' : 'struct-node'
            if (old) {
                const node = { ...old, data: { ...data, id: old.view.id, type } }
                newList.push(node as any)
            } else {
                const id = v4()
                const type = (data as any).relations ? 'relaction-node' : 'struct-node'
                const view = {
                    id,
                    ...findOptimalPosition(newList.map(v => v.view), { width: 100, height: 400 }),
                    width: 260, height: calcuHeight(data.fields.length)
                }

                const node = { type, view, data: { ...data, id, type } }
                newList.push(node as any)
            }
        }


            ;[...structs, ...relations]
                .map(data => ({
                    data, old: oldList.find(v => v.data.keyName === data.keyName)
                }))
                .map(v => {
                    if (v.old) insert(v.data, v.old)
                    return v
                })
                .map(v => {
                    if (!v.old) insert(v.data)
                    return v
                })

        this.nodes = newList
        this.timestamp = new Date().getTime()
        this.onFullChanged?.(this.timestamp)

    }

    saveToTextFile() {
        const { viewprot, nodes, timestamp } = this
        const text = JSON.stringify({ viewprot, nodes, timestamp }, null, 2)
        return text
    }
}



class WsRunConnection implements WsConnection {
    status = WsConnectionStatus.Pending
    constructor(public id: string) { }
}




export class UDBLinkMapServer extends WsRPCServer<WsRunConnection> {

    port = 6678

    connect(id: string): WsConnection {
        return new WsRunConnection(id)
    }

    request(_connection: WsConnection, name: string): RPCMethod | void {
        const list: RPCMethod[] = [{
            name: 'linkmap/client/nodeViewDataChanged',
            params: ['data', 'timestamp'],
            call: async (data: NodeViewData, timestamp: number) => {
                if (timestamp !== this.state.timestamp) { return null }
                const newStamp = new Date().getTime()
                this.state.moveNode(data, newStamp)
                return newStamp
            }
        }, {
            name: 'linkmap/client/viewPortChanged',
            params: ['pos', 'zoom', 'timestamp'],
            call: async (pos: { x: number, y: number }, zoom: number, timestamp: number) => {
                if (timestamp !== this.state.timestamp) { return null }
                const newStamp = new Date().getTime()
                this.state.changeViewPort({ pos, zoom }, newStamp)
                return newStamp
            }
        }, {
            name: 'linkmap/client/fetchState',
            params: [],
            call: async () => {
                return this.state.fetchState()
            }
        }, {
            name: 'linkmap/client/fetchTemplates',
            params: [],
            call: async () => {
                return this.state.fetchTemplates()
            }
        }, {
            name: 'linkmap/client/checkIsLatest',
            params: ['timestamp'],
            call: async (timestamp: number) => {
                return this.state.timestamp === timestamp
            }
        }]

        return list.find(v => v.name === name)
    }


    respond(connection: WsConnection, id: string, error: any, result: any): void {

    }

    constructor(
        private state: ErMapState,
        private metadata: UDBMetaData,
    ) {
        super()
        this.init()
    }

    init() {

        this.state.onFullChanged = timestamp => {
            this.boradcast({
                method: 'linkmap/broadcast/reloaded',
                params: { timestamp }
            })
        }


        this.state.onNodeDelete = actionData => {
            this.broadcast({
                method: 'linkmap/broadcast/nodeDelete',
                params: actionData
            })
        }

        this.state.onViewPortChanged = actionData => {
            this.broadcast({
                method: 'linkmap/broadcast/viewPortChanged',
                params: actionData
            })
        }


        this.state.onNodeMove = actionData => {
            this.broadcast({
                method: 'linkmap/broadcast/nodeViewChanged',
                params: actionData
            })
        }


        this.state.onNodeInsert = actionData => {
            this.broadcast({
                method: 'linkmap/broadcast/nodeInsert',
                params: actionData
            })
        }

        //

        this.state.onDataUpdate = actionData => {
            this.broadcast({
                method: 'linkmap/broadcast/nodeDataChanged',
                params: actionData
            })
        }

        if (this.metadata) {
            this.state.readFromMetaData(this.metadata)
        }
    }
    allSocket() {
        const connections = Array.from(this.all.values())
        const sockets = connections.map(v => this.socket.get(v))
            .filter(v => !!v)
        return sockets
    }

    async broadcast(msg: RPCRequest) {
        console.log('broadcast', msg)
        return new Promise(res => {
            setTimeout(() => {
                this.allSocket().forEach(socket => {
                    socket.send(JSON.stringify({
                        ...msg,
                        jsonrpc: '2.0'
                    }))
                })
                res(null)
            })
        })
    }


}