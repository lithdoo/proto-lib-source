import { MutBase, MutTable, MutVal, type Mut } from "../base/mut";
import { MutViewCondition, MutViewElement, MutViewFragment, MutViewLoop, MutViewNode, MutViewText, WrapedNode } from "../base/vnode";
import { isEvalRef, StaticEvalVal, type EvalRef, type EvalVal } from "../eval";
import { isMVTemplateApply, isMVTemplateCond, isMVTemplateContext, isMVTemplateElement, isMVTemplateLoop, isMVTemplateRoot, isMVTemplateText, type MVTemplateNode } from "../template";
import type { RenderTemplateContext } from "../xml/base";



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

export interface InjectCSS {
    values: { [key: string]: { id: string, content: string } }
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
        return new MutVal(JSON.parse(json))
    }

    private getScriptVal(script: string) {

        try {
            const argus = Object.entries(this.getState())
            return new MutVal(
                new Function(...argus.map(([v]) => v), script)
                    .apply(null, argus.map(([_, v]) => v.val()))
            )
        } catch (e) {
            console.error({ this: this, script })
            throw e
        }
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
        public context: RenderTemplateContext
    ) { }

    get store() { return this.context.store }
    get template() { return this.context.template }
    get global() { return this.context.global }
    get css() { return this.context.css }

    createScope() { }


    attrTransfer: Map<string, (
        source: Mut<{ [key: string]: any; }>,
        val: (ref: EvalRef) => MutVal<any>
    ) => Mut<{ [key: string]: any; }>
    > = new Map()

    renderRoot(name: string, prop: Mut<unknown>,emitter:(payload:any,event:{$event:Event,name:string})=>void) {
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

        const css = [...Object.values(this.css.values)].map(v => {
            const { id, content } = v
            return new MutViewElement(
                'style',
                new MutVal({ id: id }),
                new MutVal({ }),
                new MutViewFragment(new MutVal([])),
                new MutVal(content)
            )
        }).concat([
            new MutViewElement(
                'style',
                new MutVal({ }),
                new MutVal({ }),
                new MutViewFragment(new MutVal([])),
                new MutVal('*{box-sizing:border-box}')
            )
        ])

        return new MutViewFragment(new MutVal([
            ...css, this.renderNode(node.id, scope,emitter)
        ]))

        // return this.renderNode(node.id, scope)
    }

    renderChildren(id: string, context: RenderContext,emitter:(payload:any,event:{$event:Event,name:string})=>void): MutViewFragment {
        const childIds = this.template.children[id] ?? []
        const children = childIds.map(id => this.renderNode(id, context,emitter))
        const fragment = new MutViewFragment(new MutVal(children))
        return fragment
    }

    renderNode(id: string, context: RenderContext,emitter:(payload:any,event:{$event:Event,name:string})=>void): MutViewNode {
        const node = this.template.values[id]
        try {
            if (!node)
                throw new Error('error node id!')
            if (isMVTemplateRoot(node)) {
                const state: Record<string, Mut<unknown>> = node.props
                    .reduce((res, current) => {
                        const val = context.state[current] ?? new MutVal(null)
                        return {
                            ...res, [current]: val
                        }
                    }, {})

                const scope = new RenderContext(
                    this.store, state
                )

                return this.renderChildren(node.id, scope,emitter)
            }

            if (isMVTemplateText(node)) {
                const text = context.val(node.text)
                const vnode = new MutViewText(text)
                return vnode
            }

            if (isMVTemplateElement(node)) {
                const tagName = node.tagName
                const attrs = context.attr(node.attrs)
                const events = context.attr(node.events)
                if(node.events.length) console.log({events})
                const trans = this.attrTransfer.get(id)
                const tranAttr = trans ? trans(attrs, (ref) => context.val(ref)) : attrs
                const innerHTML = node.innerHTML ? context.val(node.innerHTML) : new MutVal(null)
                const children = this.renderChildren(id, context,emitter)
                const vnode = new MutViewElement(tagName, tranAttr,events, children, innerHTML)
                vnode.emitter = emitter
                return vnode
            }

            if (isMVTemplateCond(node)) {
                const test = context.val(node.test)
                const render = () => this.renderChildren(id, context,emitter)
                const vnode = new MutViewCondition(test, render)
                return vnode
            }

            if (isMVTemplateLoop(node)) {
                const list = context.val(node.loopValue)
                const render = (val: unknown, idx: number) => this.renderChildren(
                    id, context.extend([
                        { name: node.indexField, value: new MutVal(idx) },
                        { name: node.valueField, value: new MutVal(val) }
                    ]),emitter
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

                return this.renderChildren(node.id, newContext,emitter)
            }

            if (isMVTemplateApply(node)) {
                const rootId = node.rootId
                return this.renderNode(rootId, context,emitter)
            }


        } catch (e) {
            console.error(e)
            console.error(node)
        }
        return new MutViewText(new MutVal('ERROR'))
    }

}

export class RenderRoot {
    shadow: ShadowRoot
    viewNode?: MutViewNode

    private updateFn = () => { this.update() }
    constructor(
        public cntr = document.createElement('div')
    ) {
        this.cntr.style.height = '100%'
        this.shadow = this.cntr.attachShadow({ mode: 'open' })
        const style = `<style class="iconfont-inject">.svgfont {display: inline-block;width: 1em;height: 1em;fill: currentColor;vertical-align: -0.1em;font-size:16px;}</style>`
        const s = document.createElement('div')
        s.innerHTML = style
        const nodes = [...document.querySelectorAll('.iconfont-inject'), ...document.head.querySelectorAll('.iconfont-inject')].map(v => v.cloneNode(true))
        nodes.forEach(v => this.shadow.appendChild(v))
        this.shadow.appendChild(s)
    }

    private caches: WrapedNode[] = []

    inject(viewNode: MutViewNode) {
        console.log({ viewNode })
        if (this.viewNode) {
            this.viewNode.target.off(this.updateFn)
        }
        this.viewNode = viewNode
        this.viewNode.target.on(this.updateFn)
        this.update()
    }

    update() {
        const blank = document.createElement('div')
        this.caches.forEach(node => node.appendTo(blank))
        this.caches = []
        this.viewNode?.target.val().forEach(node => {
            node.appendTo(this.shadow)
            this.caches.push(node)
        })
    }

    element() {
        return this.cntr
    }
}
