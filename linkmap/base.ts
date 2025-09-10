


export interface NodeViewData {
    id: string,
    x: number,
    y: number,
    width: number,
    height: number,
    maxHeight?: number,
    minHeight?: number,
    maxWidth?: number,
    minWidth?: number,
}

export interface ViewPort {
    pos: { x: number, y: number },
    zoom: number
}


export type NodeFullData<NodeData> = {
    view: NodeViewData,
    type: string,
    data: NodeData,
}

export interface LinkMapState<NodeData> {
    viewprot: ViewPort
    timestamp: number
    nodes: NodeFullData<NodeData>[]
}

export type ActionData<T> = {
    data: T,
    from: number
    to: number
}

