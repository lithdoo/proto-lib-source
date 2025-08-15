export type FieldData<Type extends string> = {
    name: string
    desc: string
    type: Type
}

export type EntityData<Type extends string = string> = {
    id: string
    name: string
    desc: string
    fields: FieldData<Type>[]
}

export type EntityRenderData = {
    id: string,
    x: number,
    y: number,
    width: number,
    height: number,
}

export type EntiryStatusData = {
    isSelected: boolean
    highlightFields: string[]
}
