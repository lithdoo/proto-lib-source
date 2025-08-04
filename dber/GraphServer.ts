import type { EntityData, EntityRenderData } from "./EntityNode"

export class GraphServer {
    nodes: {
        entity: EntityData,
        render: EntityRenderData
    }[] = []

    viewport: {
        center: { x: number, y: number }
        zoom: number
    } = { center: { x: 0, y: 0 }, zoom: 1 }

    constructor(){ }

    store() {
        const { nodes, viewport } = this
        const data = JSON.stringify({ nodes, viewport })
        window.localStorage.setItem('GraphServerData', data)
    }

    restore() {
        const data = window.localStorage.getItem('GraphServerData')
        if (!data) return
        const { nodes, viewport } = JSON.parse(data) ?? {}
        if(nodes && viewport){
            this.nodes = nodes
            this.viewport = viewport
        }
    }
}