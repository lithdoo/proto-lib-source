
import xmlString from './test.xml?raw'

import type { RefStore, TemplateTree, GlobalDeclare } from '../render'
import { MVTemplateComponentType, MVTemplateHtmlType, type MVTemplateApply, type MVTemplateContext, type MVTemplateElement, type MVTemplateRoot, type MVTemplateText } from '../template';
import type { ValueGenerator } from '../base/store';
import type { EvalVal } from '../eval';


export class XMLParserTask {
    static domParser = new DOMParser();
    static mods: ParseMod[] = []
    root: HTMLElement

    mods: Map<string, ParseMod> = new Map()
    store: RefStore = { values: {} }
    template: TemplateTree = { values: {}, children: {} }
    gloal: GlobalDeclare = { components: {} }

    constructor(
        public xml: string,
    ) {
        const xmlDoc = XMLParserTask.domParser.parseFromString(xml, "text/xml");
        this.root = xmlDoc.documentElement
        this.dealRoot()
    }

    dealRoot() {
        const attrs = this.root.getAttributeNames()
        attrs.filter(v => v.includes('xmlns:'))
            .map(name => [name.replace('xmlns:', ''), this.root.getAttribute(name)])
            .reduce((res, [name, value]) => {
                const mod = XMLParserTask.mods.find(mod => mod.key === value)
                if (mod && name) res.set(name, mod)
                return res
            }, this.mods)

        const declares = [...this.root.children]
            .filter(v => v.tagName === 'declare')

        declares.forEach(declare => this.dealDeclare(declare))
    }

    dealDeclare(element: Element) {
        const name = element.getAttribute('name')
        if (!name) throw new Error()
        if (this.gloal.components[name]) throw new Error()

        const template: MVTemplateRoot = {
            id: Math.random().toString(),
            type: MVTemplateComponentType.Root,
            isLeaf: false,
            props: (element.getAttribute('props') ?? '')
                .split(',')
                .map(v => v.trim())
                .filter(v => !!v)
        }

        this.gloal.components[name] = {
            rootId: template.id,
        }
        this.template.values[template.id] = template
    }




}

export const test = new XMLParserTask(xmlString)

export class WarpedElement {
    constructor(
        public target: HTMLElement
    ) { }

    get namespace() {
        const tag = this.target.tagName.split(':')
        if (tag.length < 2) return ''
        else return tag[0]
    }
    get name() {
        const tag = this.target.tagName.split(':')
        return tag[1] ?? tag[0]
    }

    attr(name: string) {
        return this.target.getAttribute(name)
    }

    innerHTML() {
        return this.target.innerHTML
    }
}


export class WarpedAttr {
    constructor(
        public fullname: string,
        public value: string
    ) { }

    get namespace() {
        const tag = this.fullname.split(':')
        if (tag.length < 2) return ''
        else return tag[0]
    }
    get name() {
        const tag = this.fullname.split(':')
        return tag[1] ?? tag[0]
    }


}

export interface ParseMod {
    key: string

    dealElement?(context: {
        pid: string,
        element: WarpedElement,
        task: XMLParserTask,
        next: (id: string) => void
    }): void
}

const elementTag = new class implements ParseMod {
    key = "tag"

    dealElement(context: {
        pid: string,
        element: WarpedElement,
        task: XMLParserTask,
        next: (id: string) => void
    }) {
        const { element, task, pid, next } = context
        const tagName = element.name
        const template: MVTemplateElement = {
            id: Math.random().toString(),
            type: MVTemplateHtmlType.Element,
            isLeaf: false,
            tagName,
            attrs: [] // todo
        }

        task.template.children[pid] = (
            task.template.children[pid] ?? []
        ).concat([template.id])

        task.template.values[template.id] = template
        next(template.id)
    }
}


const elementRef = new class implements ParseMod {
    key = "ref"

    dealElement(context: {
        pid: string,
        element: WarpedElement,
        task: XMLParserTask,
        next: (id: string) => void
    }) {
        const { element, task, pid, next } = context
        const componentName = element.name


        const bind = element.attr('bind') ?? "{}"
        const value: EvalVal = {
            type: 'eval:js',
            content: `return ${bind}`
        }

        const ref = Object.entries(task.store.values)
            .find(([_key, val]) => {
                return value.type === val.type && value.content === val.content
            })?.[0]
        const refKey = ref ?? Math.random().toString()

        task.store.values[refKey] = value

        const templateContext: MVTemplateContext = {
            id: Math.random().toString(),
            type: MVTemplateComponentType.Context,
            isLeaf: false,
            bind: { '_VALUE_GENERATOR_REFERENCE_': refKey }
        }

        const templateApply: MVTemplateApply = {
            id: Math.random().toString(),
            type: MVTemplateComponentType.Apply,
            isLeaf: true,
            rootId: task.gloal.components[componentName].rootId
        }


        task.template.children[pid] = (
            task.template.children[pid] ?? []
        ).concat([templateContext.id])

        task.template.children[templateContext.id] = (
            task.template.children[pid] ?? []
        ).concat([templateApply.id])

        task.template.values[templateContext.id] = templateContext
        task.template.values[templateApply.id] = templateApply

        next(templateApply.id)
    }
}


const elementText = new class implements ParseMod {
    key = 'text'

    dealElement(context: { pid: string; element: WarpedElement; task: XMLParserTask; next: (id: string) => void; }): void {
        const { element, task, pid, next } = context
        const type = element.name
        if (type === 'js') {

            const value: EvalVal = {
                type: 'eval:js',
                content: element.innerHTML()
            }

            const ref = Object.entries(task.store.values)
                .find(([_key, val]) => {
                    return value.type === val.type && value.content === val.content
                })?.[0]
            const refKey = ref ?? Math.random().toString()

            task.store.values[refKey] = value

            const template: MVTemplateText = {
                id: Math.random().toString(),
                type: MVTemplateHtmlType.Text,
                text: { '_VALUE_GENERATOR_REFERENCE_': refKey },
                isLeaf: true,
            }

            task.template.children[pid] = (
                task.template.children[pid] ?? []
            ).concat([template.id])

            task.template.values[template.id] = template
        } else {
            throw new Error()
        }

    }
}

const elementFlow = new class implements ParseMod {
    key = 'flow'
}