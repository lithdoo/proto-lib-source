import { MutBase, MutTable, MutVal, type Mut } from "../base/mut";
import { MutViewCondition, MutViewElement, MutViewFragment, MutViewLoop, MutViewNode, MutViewText } from "../base/vnode";
import { isEvalRef, StaticEvalVal, type EvalRef, type EvalVal } from "../eval";
import { isMVTemplateApply, isMVTemplateCond, isMVTemplateContext, isMVTemplateElement, isMVTemplateLoop, isMVTemplateRoot, isMVTemplateText, type MVTemplateNode } from "../template";



export interface RefStore {
    values: { [key: string]: EvalVal }
}


export interface TemplateTree {
    children: { [key: string]: string[] }
    values: { [key: string]: MVTemplateNode }
}


export interface GlobalDeclare {
    components: {
        [key: string]: {
            rootId: string,
            private?: boolean
        }
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
        private store: RefStore,
        public state: Record<VarKeyName, Mut<unknown>>,
        private upper?: RenderContext
    ) { }


    extend(list: { name: string, value: EvalRef | Mut<unknown> }[]) {
        const state = list.map(({ name, value }) => {
            if (isEvalRef(value)) {
                return { name, value: this.val(value) }
            } else {
                return { name, value }
            }
        }).reduce((res, { name, value }) => {
            return { ...res, [name]: value }
        }, {} as Record<VarKeyName, Mut<unknown>>)

        return new RenderContext(this.store, state, this)
    }

    private getEvalValue(ref: EvalRef): EvalVal {
        const vg: EvalVal = (StaticEvalVal as any)[ref._VALUE_GENERATOR_REFERENCE_]
            ?? this.store.values[ref._VALUE_GENERATOR_REFERENCE_]
        // ?? this.upper?.getEvalValue(ref)
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

    // getTable(): Map<EvalRefId, EvalVal> {
    //     const upper = this.upper?.getTable() ?? new Map()

    //     return [...this.table.entries()].reduce((map, [key, val]) => {
    //         map.set(key, val)
    //         return map
    //     }, upper)
    // }

}



export class MVRenderer {

    constructor(
        public store: RefStore,
        public template: TemplateTree,
        public global: GlobalDeclare
    ) { }


    createScope() { }


    attrTransfer: Map<string, (
        source: Mut<{ [key: string]: any; }>,
        val: (ref: EvalRef) => MutVal<any>
    ) => Mut<{ [key: string]: any; }>
    > = new Map()

    renderRoot(name: string, prop: Mut<unknown>) {
        const component = this.global.components[name]
        if (!component) throw new Error('unknown')

        const node = this.template.values[component.rootId]
        if (!node) throw new Error('unknown')

        if (!isMVTemplateRoot(node))
            throw new Error('error root id!')

        const state = MutBase.split(prop)
            .reduce((res, { name, value }) => {
                return { ...res, [name]: value }
            }, {} as Record<string, Mut<unknown>>)

        const scope = new RenderContext(
            this.store, state
        )

        return this.renderNode(node.id, scope)
    }

    renderChildren(id: string, context: RenderContext): MutViewFragment {
        const childIds = this.template.children[id] ?? []
        const children = childIds.map(id => this.renderNode(id, context))
        const fragment = new MutViewFragment(new MutVal(children))
        return fragment
    }



    renderNode(id: string, context: RenderContext): MutViewNode {
        const node = this.template.values[id]
        try {
            if (!node)
                throw new Error('error node id!')


            if (isMVTemplateRoot(node)) {
                const state: Record<string, Mut<unknown>> = node.props
                    .reduce((res, current) => {
                        const val = context.state[current] ?? new MutVal(null)
                        return {
                            ...res ,[current]:val
                        }
                    }, {})

                const scope = new RenderContext(
                    this.store, state
                )

                return this.renderChildren(node.id, scope)
            }

            if (isMVTemplateText(node)) {
                const text = context.val(node.text)
                console.log({ text, node })
                const vnode = new MutViewText(text)
                return vnode
            }

            if (isMVTemplateElement(node)) {
                const tagName = node.tagName
                const attrs = context.attr(node.attrs)
                const trans = this.attrTransfer.get(id)
                const tranAttr = trans ? trans(attrs, (ref) => context.val(ref)) : attrs
                const innerHTML = node.innerHTML ? context.val(node.innerHTML) : new MutVal(null)
                const children = this.renderChildren(id, context)
                const vnode = new MutViewElement(tagName, tranAttr, children, innerHTML)
                return vnode
            }

            if (isMVTemplateCond(node)) {
                const test = context.val(node.test)
                const render = () => this.renderChildren(id, context)
                const vnode = new MutViewCondition(test, render)
                return vnode
            }

            if (isMVTemplateLoop(node)) {
                const list = context.val(node.loopValue)
                const render = (val: unknown, idx: number) => this.renderChildren(
                    id, context.extend([
                        { name: node.indexField, value: new MutVal(idx) },
                        { name: node.valueField, value: new MutVal(val) }
                    ])
                )
                const vnode = new MutViewLoop(list, render)
                return vnode
            }

            if (isMVTemplateContext(node)) {
                const bind = context.val(node.bind)
                const state = MutBase.split(bind)
                    .reduce((res, { name, value }) => {
                        return { ...res, [name]: value }
                    }, {} as Record<string, Mut<unknown>>)

                const store = this.store
                const newContext = new RenderContext(store, state)

                return this.renderChildren(node.id, newContext)
            }

            if (isMVTemplateApply(node)) {
                const rootId = node.rootId
                return this.renderNode(rootId, context)
            }


        } catch (e) {
            console.error(node)
        }

        return new MutViewText(new MutVal('ERROR'))

    }

}