import { EvalRef, EvalVal, EvalValStore } from "../mutv-eval"
import { MVFileMod, MVFileState, MVRenderMod } from "./base"

export type MVValueStoreData = {
    last_mod_ts: number
    data: { [key: string]: EvalVal }
}

export class MVModValueStore extends MVFileMod<MVValueStoreData> {

    static namespace = 'VALUE_STORE_V0'
    readonly namespace = MVModValueStore.namespace
    static blank() { return { last_mod_ts: new Date().getTime(), data: {} } }


    public store = new EvalValStore()

    constructor(
        file: MVFileState
    ) {
        super(file)
        this.reload()
    }

    reload(): void {
        const data = this.file.getModData<MVValueStoreData>(this.namespace)?.data ?? {}
        this.store = new EvalValStore(data)
    }

    add(val: EvalVal): EvalRef {
        const ref = { '_VALUE_GENERATOR_REFERENCE_': Math.random().toString() }
        this.store.set(ref, val)
        this.update()
        return ref
    }

    clear(refs: EvalRef[] = []) {
        this.store.clear(refs)
        this.update()
    }

    get(ref: EvalRef) {
        return this.store.val(ref)
    }

    private update() {
        this.setData({
            last_mod_ts: new Date().getTime(),
            data: { ...this.store.table() }
        })
    }
}


export class MVRenderValueStore extends MVRenderMod<MVValueStoreData> {
    readonly namespace = MVModValueStore.namespace

    public store = new EvalValStore()

    reload(): void {
        const data = this.file.getModData<MVValueStoreData>(this.namespace)?.data ?? {}
        this.store = new EvalValStore(data)
    }

    get(ref: EvalRef) {
        return this.store.val(ref)
    }

    table(){
        this.reload()
        return new Map(Object.entries(this.store.table()))
    }
    
}