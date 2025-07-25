import type { Cell } from "@antv/x6"
import { Shape } from "@antv/x6"


// export interface 
export interface NodeRenderFactory {
    shapeKey: string
    create(cell: Cell<Cell.Properties>): HTMLElement
}


export abstract class NodeFactory implements NodeRenderFactory {
    abstract shapeKey: string
    abstract create(cell: Cell<Cell.Properties>): HTMLElement

    static all: Map<string, NodeRenderFactory> = new Map()
    static register(factory: NodeRenderFactory) {
        if (this.all.has(factory.shapeKey))
            throw new Error(`Node Factory: ${factory.shapeKey} is exist!`)

        this.all.set(factory.shapeKey, factory)
        Shape.HTML.register({
            shape: factory.shapeKey,
            html(cell) { return factory.create(cell) }
        })
    }
}