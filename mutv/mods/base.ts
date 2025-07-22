import type { EvalRef } from "../eval"


export class MVFileState {


    file: { [key: string]: unknown } = {}


    getModData<T>(namspace: string) {
        const data = this.file[namspace]
        console.log(data)
        if (!data) return null
        else return JSON.parse(JSON.stringify(data)) as T
    }

    setModData<T>(namespace: string, data: T | null) {
        if (!data) delete this.file[namespace]
        else this.file[namespace] = data
    }

    content() {
        return JSON.stringify(this.file, null, 2)
    }

    reload(content: string) {
        if (content && content.trim()) {
            try {
                const data = JSON.parse(content)
                if (data && typeof data === 'object') {
                    this.file = data
                }
            } catch (e) {
                console.error(e)
            }
        }
    }

    clone() {
        const newone = new MVFileState()
        newone.reload(JSON.stringify(this.file))
        return newone
    }
}

export abstract class MVFileMod<T> {
    abstract readonly namespace: string

    constructor(
        protected readonly file: MVFileState
    ) { }

    getData() {
        return this.file.getModData<T>(this.namespace)
    }

    setData(data: T | null) {
        return this.file.setModData(this.namespace, data)
    }

    getAllValueRef(): EvalRef[] {
        return []
    }

    abstract reload(): void
}

export abstract class MVRenderMod<T> {
    abstract readonly namespace: string
    constructor(
        protected readonly file: MVFileState
    ) { }

    getData() {
        return this.file.getModData<T>(this.namespace)
    }

    onBeforeRender() { }
    onRootCompleted(_root: ShadowRoot) { }
}
