import { EntityData, EntityRenderData } from "./base"

export interface ViewPort { pos: { x: number, y: number }, zoom: number }



export interface ViewState {
    viewprot: ViewPort,
    nodes: { entity: EntityData, render: EntityRenderData }[],
    timestamp: number
}

export type EntityNodeData = {
    entity: EntityData, render: EntityRenderData
}

export type ActionData<T> = {
    data: T,
    from: number
    to: number
}


export class ErdViewState implements ViewState {
    viewprot: ViewPort = {
        pos: { x: 0, y: 0 }, zoom: 1
    }
    nodes: EntityNodeData[] = []
    timestamp: number = new Date().getTime()

    snapshot(): ViewState {
        const { viewprot, nodes, timestamp } = this
        return JSON.parse(JSON.stringify({ viewprot, nodes, timestamp }))
    }

    action<T>(fn: (state: ViewState) => T): ActionData<T> {
        const from = this.timestamp
        const data = fn(this)
        const to = new Date().getTime()
        this.timestamp = to
        return { data, from, to }
    }

    onViewChanged?: (data: ActionData<ViewPort>) => void
    viewChanged(viewprot: ViewPort) {
        const actionData = this.action((state) => {
            this.viewprot = viewprot
            return viewprot
        })
        this.onViewChanged?.(actionData)
        return actionData
    }
    onNodeInsert?: (data: ActionData<EntityNodeData>) => void
    onEntityUpdate?: (data: ActionData<EntityData>) => void
    onNodeDelete?: (data: ActionData<string>) => void
    onNodeMove?: (data: ActionData<EntityRenderData>) => void
    updateNode(entity: EntityData) {

        if (this.nodes.find(v => v.entity.id === entity.id)) {
            const actionData = this.action((state) => {
                const node = state.nodes.find(v => v.entity.id === entity.id)
                if (!node) throw new Error('broadcastEntityUpdate')
                node.entity = entity
                return entity
            })
            this.onEntityUpdate?.(actionData)

        } else {
            const actionData = this.action((state) => {
                const node = state.nodes.find(v => v.entity.id === entity.id)
                if (node) throw new Error('broadcastNodeInsert')
                const render: EntityRenderData = {
                    x: state.nodes.length * 400, y: 0, width: 100, height: 100, id: entity.id
                }
                state.nodes = state.nodes.concat([{ entity, render }])
                return { entity, render }
            })
            this.onNodeInsert?.(actionData)
        }

    }
    moveNode(renderData: EntityRenderData) {
        const actionData = this.action((state) => {
            const node = state.nodes.find(v => v.entity.id === renderData.id)
            if (node) {
                node.render = renderData
            }
            return renderData
        })
        this.onNodeMove?.(actionData)
        return actionData
    }
    deleteNode(id: string) {
        const actionData = this.action((state) => {
            state.nodes = state.nodes.filter(v => v.entity.id !== id)
            return id
        })
        this.onNodeDelete?.(actionData)
    }
}