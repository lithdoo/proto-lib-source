import { Snapshot } from "@renderer/utils"
import { isMVTemplateApply, isMVTemplateCond, isMVTemplateContext, isMVTemplateElement, isMVTemplateLoop, isMVTemplateRoot, isMVTemplateText, MVTemplateNode } from "../mutv-template"
import { MVFileMod, MVFileState, MVRenderMod } from "./base"
import { fixReactive } from "@renderer/fix"
import { MVRenderValueStore } from "./store"
import { Mut, MutBase, MutVal } from "../mutv/mut"
import { EvalRef } from "../mutv-eval"
import { MutViewCondition, MutViewElement, MutViewFragment, MutViewLoop, MutViewNode, MutViewText } from "../mutv/vnode"
import { RenderContext } from "./context"
export type MVTemplateTreeData = {
    last_mod_ts: number
    template_node: TemplateNodeTable
    template_tree: TemplateNodeTree
}

export type TemplateNodeTable = {
    [key: string]: MVTemplateNode
}

export type TemplateNodeTree = {
    [key: string]: string[]
}


export class MVModTemplate extends MVFileMod<MVTemplateTreeData> {
    static namespace: 'TEMPLATE_TREE_NODE' = 'TEMPLATE_TREE_NODE'
    static blank(): MVTemplateTreeData {
        return {
            last_mod_ts: new Date().getTime(),
            template_node: {},
            template_tree: {},
        }
    }

    readonly namespace: 'TEMPLATE_TREE_NODE' = MVModTemplate.namespace

    private readonly snapNodes: Map<string, Snapshot<MVTemplateNode>> = fixReactive(new Map())
    private readonly snapTree: Snapshot<TemplateNodeTree> = fixReactive(new Snapshot({}))


    constructor(file: MVFileState) {
        super(file)
        this.reload()
    }



    reload() {
        const data = this.getData() ?? MVModTemplate.blank()
        const { template_node, template_tree } = data

        this.snapNodes.clear()

        Array.from(Object.values(template_node)).forEach((node) => {
            this.snapNodes.set(node.id, new Snapshot(node))
        })

        this.snapTree.init(template_tree)
    }


    insertNode(node: MVTemplateNode) {
        if (this.snapNodes.has(node.id)) {
            throw new Error(`Node ${node.id} is exist!!!`)
        }
        this.snapNodes.set(node.id, new Snapshot(node))
        this.update()
    }

    replaceNode(sourceId: string, target: MVTemplateNode) {

        if (this.snapNodes.has(target.id)) {
            throw new Error(`Node ${target.id} is exist!!!`)
        }
        this.snapNodes.set(target.id, new Snapshot(target))

        this.snapTree.update(tree => {
            const newTree = [...Object.entries(tree)]
                .map(([id, list]) => {
                    const newId = id === sourceId ? target.id : id
                    const newList = list.map(v => v === sourceId ? target.id : v)
                    return { newId, newList }
                })
                .reduce((res, current) => {
                    return { ...res, [current.newId]: current.newList }
                }, {} as TemplateNodeTree)

            if (newTree[target.id] && target.isLeaf) {
                delete newTree[target.id]
            }

            return newTree
        })

        this.snapNodes.delete(sourceId)

        this.update()
    }

    removeNode(nodeId: string) {

        const tree = this.snapTree.current()
        const children = tree[nodeId] ?? []

        this.snapTree.update(tree => {
            if (tree[nodeId]) {
                delete tree[nodeId]
            }
            return [...Object.entries(tree)].map(([id, children]) => {
                return { id, children }
            }).reduce((res, { id, children }) => {
                return { ...res, [id]: children.filter(v => v !== nodeId) }
            }, {} as { [key: string]: string[] })
        })
        children.forEach(v => this.removeNode(v))
        if (this.snapNodes.has(nodeId)) {
            this.snapNodes.delete(nodeId)
        }
        this.update()
    }

    updateNode<T extends MVTemplateNode>(id: string, updateFn: (node: T) => void) {
        const snapshot = this.snapNodes.get(id)
        if (!snapshot) {
            throw new Error(`Node ${id} not found!!!`)
        }
        snapshot.update(updateFn as any)
        this.update()
    }

    updateTree(updateFn: (tree: TemplateNodeTree) => void) {
        this.snapTree.update(updateFn)
        this.update()
    }

    hasNode(id: string) {
        return this.snapNodes.has(id)
    }


    tree() {
        return this.snapTree.current()
    }

    table() {
        return [...this.snapNodes.entries()].reduce((res, [id, snap]) => {
            return { ...res, [id]: snap.current() }
        }, {} as TemplateNodeTable)
    }

    node(id: string) {
        const node = this.snapNodes.get(id)
        if (!node) {
            throw new Error(`Node ${id} not found!!!`)
        }
        return node.current()
    }

    children(id: string) {
        return this.snapTree.current()[id] ?? []
    }

    allChildren() {
        return Array.from(Object.entries(this.snapTree.current()))

    }

    private update() {
        this.setData({
            last_mod_ts: new Date().getTime(),
            template_node: this.table(),
            template_tree: this.tree(),
        })
    }



}

export class MVRenderTemplate extends MVRenderMod<MVTemplateTreeData> {
    readonly namespace: 'TEMPLATE_TREE_NODE' = MVModTemplate.namespace
    constructor(
        public file: MVFileState,
        public store: MVRenderValueStore
    ) {
        super(file)
    }

    private get nodes() {
        return this.getData()?.template_node ?? {}
    }

    private get tree() {
        return this.getData()?.template_tree ?? {}
    }

    attrTransfer: Map<string,
        (
            source: Mut<{ [key: string]: any; }>,
            val: (ref: EvalRef) => MutVal<any>
        ) => Mut<{ [key: string]: any; }>
    > = new Map()



    renderRoot(rootId: string, scope: RenderContext) {
        console.log({ rootId, scope })
        const node = this.nodes[rootId]
        if (!node)
            throw new Error('error root id!')
        if (!isMVTemplateRoot(node))
            throw new Error('error root id!')

        return this.renderChildren(rootId, scope)
    }


    renderNode(id: string, context: RenderContext): MutViewNode {

        const node = this.nodes[id]
        try {
            if (!node)
                throw new Error('error node id!')

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
                const innerHTML = node.innerHTML ? context.val(node.innerHTML) :new MutVal(null)
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
                const table = context.getTable()

                console.warn({ node, bind, state })
                const newContext = new RenderContext(state, table)

                return this.renderChildren(node.id, newContext)
            }

            if (isMVTemplateApply(node)) {
                const rootId = node.rootId
                return this.renderRoot(rootId, context)
            }


        } catch (e) {
            console.error(node)
        }

        return new MutViewText(new MutVal('ERROR'))

    }

    renderChildren(id: string, context: RenderContext): MutViewFragment {
        const childIds = this.tree[id] ?? []
        const children = childIds.map(id => this.renderNode(id, context))
        const fragment = new MutViewFragment(new MutVal(children))
        return fragment
    }

    onBeforeRender() {
        this.attrTransfer = new Map()
    }

}