import type { RPCConnectServer } from "./base";

export type DataType = string | StrctTypeRef | ArrayTypeRef | TupleTypeRef | UnionTypeRef

export type UnionTypeRef = {
    types: DataType[]
    isUnion: true
}

export type ArrayTypeRef = {
    type: DataType,
    isArray: true,
}

export type TupleTypeRef = {
    types: DataType[]
    isTuple: true
}

export type StrctTypeRef = {
    name: string,
    isStruct: true,
}

export type StructDocData = {
    name: string,
    fields: {
        name: string,
        type: DataType
    }[]
}

export interface ParamDocData {
    name: string
    desc: string
}

export interface MethodDocData {
    name: string,
    desc?: string
    params?: ParamDocData[],
    result?: DataType
}

export interface ServerDocData {
    structs: StructDocData[]
    methods: MethodDocData[]
    name: string,
    desc?: string
}


export class ServerDoc {
    static table: WeakMap<RPCConnectServer, ServerDocData> = new WeakMap()

    static unionRef(...types: DataType[]): UnionTypeRef { return { types, isUnion: true } }
    static tupleRef(...types: DataType[]): TupleTypeRef { return { types, isTuple: true } }
    static structRef(name: string): StrctTypeRef { return { name, isStruct: true } }
    static arrayRef(type: DataType): ArrayTypeRef { return { type, isArray: true } }

    constructor(public server: RPCConnectServer) {
        ServerDoc.table.set(server, this)
    }

    private target: ServerDocData = { name: '', methods: [], structs: [] }

    get name() { return this.target.name }
    get desc() { return this.target.desc }
    get methods() { return this.target.methods }
    get structs() { return this.target.structs }


    setName(name: string) {
        this.target.name = name
    }
    setDesc(desc: string) {
        this.target.desc = desc
    }
    addStruct(struct: StructDocData) {
        this.target.structs = this.target.structs.filter(v => v.name !== struct.name)
            .concat([struct])
    }
    addMethod(method: MethodDocData) {
        this.target.methods = this.target.methods.filter(v => v.name !== method.name)
            .concat([method])
    }

    checkStructRef(ref: StrctTypeRef) {
        if (!this.structs.map(v => v.name).includes(ref.name)) {
            console.error(`Server "${this.name}" has not struct named "${ref.name}"`)
        }
    }
}