import { nanoid } from "nanoid"
import { MVFileMod, MVFileState, MVRenderMod } from "./base"
import { MVModTemplate, MVRenderTemplate } from "./template"
import { MVTemplateComponentType, MVTemplateRoot } from "../mutv-template"
import { Mut, MutBase } from "../mutv/mut"
import { RenderContext } from "./context"
import { MVRenderValueStore } from "./store"

export type MVComponent = {
    keyName: string
    rootId: string
}



export type MVComponentData = {
    last_mod_ts: number
    components: MVComponent[]
}

export class MVModComponent extends MVFileMod<MVComponentData> {
    static namespace: "COMPONENT" = 'COMPONENT'
    static blank(): MVComponentData {
        return {
            last_mod_ts: new Date().getTime(),
            components: []
        }
    }
    readonly namespace: "COMPONENT" = MVModComponent.namespace

    data: MVComponentData = MVModComponent.blank()

    constructor(
        file: MVFileState,
        private template: MVModTemplate
    ) {
        super(file)
        this.reload()
    }

    reload() {
        this.data = this.getData() ?? MVModComponent.blank()
    }

    allComponents() {
        return this.data.components
    }

    addComponent(keyName: string) {
        if (this.data.components.find(v => v.keyName === keyName)) {
            throw new Error(`component named "${keyName}" is exist!`)
        }

        const rootId = nanoid()
        const component = { keyName, rootId }
        const templateNode: MVTemplateRoot = {
            id: rootId, type: MVTemplateComponentType.Root, isLeaf: false, props: []
        }
        this.template.insertNode(templateNode)
        this.data.components = this.data.components.concat([component])
        this.update()
    }

    delComponent(rootId: string) {
        this.template.removeNode(rootId)
        this.data.components = this.data.components.filter(v => v.rootId !== rootId)
        this.update()
    }

    renameComponent(rootId: string, newName: string) {
        if (this.data.components.find(v => v.keyName === newName)) {
            throw new Error(`component named "${newName}" is exist!`)
        }

        const component = this.data.components.find(v => v.rootId === rootId)
        if (!component) {
            throw new Error(`component rootId "${rootId}" is not found!`)
        }

        this.data.components = this.data.components.map(v => {
            return v == component ? { ...v, keyName: newName } : v
        })

        this.update()
    }

    private update() {
        this.data.last_mod_ts = new Date().getTime()
        this.setData({
            last_mod_ts: this.data.last_mod_ts,
            components: [...this.data.components.map(v => ({ ...v }))]
        })
    }

}

export class MVRenderComponent extends MVRenderMod<MVComponentData> {

    readonly namespace: "COMPONENT" = MVModComponent.namespace

    constructor(
        public file: MVFileState,
        public template: MVRenderTemplate,
        public store: MVRenderValueStore
    ) {
        super(file)
    }


    allComponents() {
        return this.getData()?.components ?? []
    }


    render(rootId: string, prop: Mut<unknown>) {

        const state = MutBase.split(prop)
            .reduce((res, { name, value }) => {
                return { ...res, [name]: value }
            }, {} as Record<string, Mut<unknown>>)

        const table = this.store.table()
        const context = new RenderContext(state, table)
        return this.template.renderRoot(rootId, context)
    }




}