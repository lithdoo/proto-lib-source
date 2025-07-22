import { nanoid } from "nanoid"
import { EvalRef, EvalVal, isEvalRef, isEvalVal, StaticEvalVal } from "../mutv-eval"
import { Mut, MutTable, MutVal } from "../mutv/mut"
import { MVFileMod, MVFileState, MVRenderMod } from "./base"
import { MVModValueStore, MVRenderValueStore } from "./store"
// import { MVFileMod, MVFileState } from "./base"
// import { MVModComponent } from "./Component"
// import { MVModValueStore } from "./store"


export type MVContextData = {
    last_mod_ts: number

    table: {
        id: string,
        name: string,
        value: EvalRef
        context: string[]
    }[]

}



export class MVModContext extends MVFileMod<MVContextData> {
    static namespace: 'CONTEXT_DATA' = 'CONTEXT_DATA'
    readonly namespace = MVModContext.namespace
    static blank(): MVContextData {
        return {
            last_mod_ts: new Date().getTime(),
            table: []
        }
    }

    data: MVContextData = MVModContext.blank()

    constructor(
        file: MVFileState,
    ) {
        super(file)
        this.reload()
    }

    reload() {
        this.data = this.getData() ?? MVModContext.blank()
    }


    allData() {
        return this.data.table
    }

    addData(data: MVContextData['table'][0] & { context: [] }) {
        if (this.data.table.find(v => v.id === data.id)) {
            throw new Error('')
        }
        if (this.data.table.find(v => v.name === data.name)) {
            throw new Error('')
        }

        if (data.context.length !== 0) {
            throw new Error('')
        }

        this.data.table = [...this.data.table, data]
        this.update()
    }

    renameData(id: string, newName: string) {
        if (!this.data.table.find(v => v.id === id)) {
            throw new Error('')
        }
        if (this.data.table.find(v => v.name === newName)) {
            throw new Error('')
        }

        this.data.table = this.data.table.map(data => ({
            ...data,
            name: data.id === id ? newName : data.name
        }))

        this.update()
    }

    updateValue(id: string, newValue: EvalRef) {
        if (!this.data.table.find(v => v.id === id)) {
            throw new Error('')
        }

        this.data.table = this.data.table.map(data => ({
            ...data,
            value: data.id === id ? newValue : data.value
        }))

        this.update()
    }

    delData(id: string) {
        if (!this.data.table.find(v => v.id === id)) {
            throw new Error('')
        }

        this.data.table = this.data.table.filter(v => v.id !== id)
            .map(data => ({
                ...data, scope: data.context.filter(v => v !== id)
            }))

        this.update()
    }

    updateScope(id: string, context: string[]) {
        if (!this.data.table.find(v => v.id === id)) {
            throw new Error('')
        }
        const all = new Set(this.data.table.map(v => v.id))
        if (context.find(v => !all.has(v))) {
            throw new Error('')
        }

        this.data.table = this.data.table.filter(data => ({
            ...data, scope: data.id === id ? context : data.context
        }))
        this.update()
    }

    private update() {
        this.data.last_mod_ts = new Date().getTime()
        this.setData({
            last_mod_ts: this.data.last_mod_ts,
            table: this.data.table.map(v => ({ ...v }))
        })
    }

}

type ValueField = {
    name: string
    value: EvalRef
}

type EvalRefId = string
type VarKeyName = string

export class RenderContext {

    constructor(
        private state: Record<VarKeyName, Mut<unknown>>,
        private table: Map<EvalRefId, EvalVal> = new Map(),
        private upper?: RenderContext
    ) { }


    extend(list: { name: string, value: EvalRef | Mut<unknown> }[]) {
        const state = list.map(({ name, value }) => {
            if (isEvalRef(value)) {
                return {
                    name, value: this.val(value)
                }
            } else {
                return {
                    name, value
                }
            }
        }).reduce((res, { name, value }) => {
            return { ...res, [name]: value }
        }, {} as Record<VarKeyName, Mut<unknown>>)

        return new RenderContext(state, new Map(), this)
    }

    getEvalValue(ref: EvalRef) {
        const vg = StaticEvalVal[ref._VALUE_GENERATOR_REFERENCE_]
            ?? this.table.get(ref._VALUE_GENERATOR_REFERENCE_)
            ?? this.upper?.getEvalValue(ref)
        if (!vg) { throw new Error('unknown ref key') }
        return vg
    }

    val(ref: EvalRef) {
        const vg = this.getEvalValue(ref)

        if (vg.type === 'json') {
            return this.getJsonVal(vg.content)
        }
        if (vg.type === 'eval:js') {
            return this.getScriptVal(vg.content)
        }
        throw new Error('unknown vg type')
    }

    attr(data: ValueField[]) {
        const val = data.reduce((res, cur) => {
            return { ...res, [cur.name]: this.val(cur.value) }
        }, {} as { [key: string]: Mut<any> })
        return new MutTable(val)
    }


    private getState(): Record<string, Mut<unknown>> {
        const upper = this.upper?.getState() ?? {}
        const target = this.state
        return { ...upper, ...target }
    }


    private getJsonVal(json: string) {
        console.log({ json })
        return new MutVal(JSON.parse(json))
    }

    private getScriptVal(script: string) {
        const argus = Object.entries(this.getState())
        return new MutVal(
            new Function(...argus.map(([v]) => v), script)
                .apply(null, argus.map(([_, v]) => v.val()))
        )
    }

    getTable(): Map<EvalRefId, EvalVal> {
        const upper = this.upper?.getTable() ?? new Map()

        return [...this.table.entries()].reduce((map, [key, val]) => {
            map.set(key, val)
            return map
        }, upper)
    }

}


export class MVRenderContext extends MVRenderMod<MVContextData> {
    readonly namespace = MVModContext.namespace


    constructor(file: MVFileState, public store: MVRenderValueStore) {
        super(file)
    }

    getContextData(contextId: string) {
        const data = this.getData()
        const context = data?.table.find(v => v.id === contextId)
        const scope = new RenderContext({}, this.store.table())
        if (!context) throw new Error()
        return scope.val(context.value)
    }
}


