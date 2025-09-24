import type { Mut, MutBase } from '../mut'
import { MutVal } from "../mut"
import { WarpedElement, WarpedText, WrapedNode } from "./wraped"

export abstract class MutViewNode {
    isDestoryed: boolean = false
    abstract readonly target: Mut<WrapedNode[]>
    destory() {
        this.isDestoryed = true
    }
}

export class MutViewFragment extends MutViewNode {

    current: Mut<WrapedNode[]>[]

    readonly target: MutVal<WrapedNode[]>
    readonly onListChanged: () => void
    readonly onCurrentChanged: () => void


    constructor(
        public list: Mut<MutViewNode[]>
    ) {
        super()
        this.current = this.list.val().map(v => v.target)
        this.target = new MutVal(this.current.flatMap(v => v.val()))

        this.onCurrentChanged = () => this.updateTarget()
        this.current.forEach(v => v.on(this.onCurrentChanged))
        this.list.on(this.onListChanged = () => { this.updateCurrent() })
    }

    private updateCurrent() {
        this.current.forEach(v => v.off(this.onCurrentChanged))
        this.current = this.list.val().map(v => v.target)
        this.current.forEach(v => v.on(this.onCurrentChanged))
        this.updateTarget()

    }

    private updateTarget() {
        this.target.update(this.current.flatMap(v => v.val()))
    }

    destory(): void {
        super.destory()
        this.current.forEach(v => v.off(this.onCurrentChanged))
        this.list.off(this.onListChanged)
        this.list.val().forEach(v => v.destory())
    }
}

export class MutViewElement extends MutViewNode {



    elementNode: WarpedElement
    readonly target: Mut<WrapedNode[]>
    readonly onChilrenChanged = () => { this.updateChildren() }
    readonly onAttrChanged = () => { this.updateAttr() }
    readonly onEventChanged = () => { this.updateEvent() }
    private currentChildren: WrapedNode[] = []

    emitter?: (
        payload: any,
        event: { $event: Event, name: string }
    ) => void

    constructor(
        public readonly tagName: string,
        public readonly attr: Mut<{ [key: string]: string | MutVal<string> }>,
        public readonly event: Mut<{ [key: string]: string }>,
        public readonly children: MutViewFragment,
        public readonly innerHTML: Mut<unknown>
    ) {
        super()
        this.elementNode = WrapedNode.element(tagName)
        this.target = new MutVal([this.elementNode])
        this.children.target.on(this.onChilrenChanged)
        this.innerHTML.on(this.onChilrenChanged)
        this.attr.on(this.onAttrChanged)
        this.event.on(this.onEventChanged)
        this.updateChildren()
        this.updateEvent()
        this.updateAttr()
    }


    private updateAttr() {
        const attr = this.attr.val()
        Object.entries(attr).map(([key, value]) => {
            console.log('key',key)
            console.log('value',value)
            console.log('value',(value as any)?.val)
            if ( (value as MutBase<string>).val) {
                this.elementNode.attr(key, (value as MutBase<string>).val());
                (value as MutBase<string>).on(() => { 
                    console.log('changed')    
                    this.elementNode.attr(key, (value as MutBase<string>).val()) 
                })
            } else {
                this.elementNode.attr(key, value as string)
            }
        })
    }

    private updateEvent() {
        const event = this.event.val()
        Object.entries(event).map(([key, value]) => {
            this.elementNode.event(key, ($event) => {
                this.emitter?.(value, { name: key, $event })
            })
        })
    }

    private updateChildren() {
        this.currentChildren.forEach(v => v.remove())
        const innerHTML = this.innerHTML.val()
        if (typeof innerHTML === 'string') {
            this.currentChildren = []
            this.elementNode.target.innerHTML = innerHTML
        } else {
            this.currentChildren = this.children.target.val()
            this.elementNode.appendChildren(this.currentChildren)
        }
    }
    destory(): void {
        super.destory()
        this.children.target.off(this.onChilrenChanged)
        this.attr.off(this.onAttrChanged)
        this.children.destory()
    }


}

export class MutViewText extends MutViewNode {
    target: Mut<WrapedNode[]> = new MutVal([])
    readonly onTextChanged = () => { this.onchangeText() }
    private textNode: WarpedText

    constructor(
        public text: Mut<string>
    ) {
        super()
        this.textNode = WrapedNode.text(text.val())
        this.target = new MutVal([this.textNode])
        this.text.on(this.onTextChanged)
    }

    private onchangeText() {
        this.textNode.changeText(this.text.val())
    }

    destory() {
        super.destory()
        this.text.off(this.onTextChanged)
    }
}

export class MutViewLoop extends MutViewNode {
    readonly target: MutVal<WrapedNode[]> = new MutVal([])
    current: MutViewFragment[] = []

    readonly onCurrentChanged = () => { this.updateTarget() }
    readonly onListChanged = () => { this.updateCurrent() }
    constructor(
        public readonly list: Mut<unknown[]>,
        public readonly render: (val: unknown, idx: number) => MutViewFragment
    ) {
        super()
        this.list.on(this.updateCurrent)
        this.updateCurrent()
    }

    private updateCurrent() {
        this.current.forEach(v => {
            v.target.off(this.onCurrentChanged)
            v.destory()
        })
        const list = this.list.val()
        this.current = list.map((v, i) => this.render(v, i))
        this.current.forEach(v => {
            v.target.on(this.onCurrentChanged)
        })
        this.updateTarget()
    }

    private updateTarget() {
        this.target.update(this.current.flatMap(v => v.target.val()))
    }

    destory(): void {
        super.destory()
        this.current.forEach(v => {
            v.target.off(this.onCurrentChanged)
            v.destory()
        })
        this.list.off(this.onListChanged)
    }
}

export class MutViewCondition extends MutViewNode {

    readonly target: MutVal<WrapedNode[]> = new MutVal([])
    current?: MutViewFragment

    readonly onCurrenChanged: () => void
    readonly onTestChanged: () => void

    constructor(
        public readonly test: Mut<boolean>,
        public readonly render: () => MutViewFragment
    ) {
        super()
        this.test.on(this.onTestChanged = () => {
            this.updateCurrent()
        })
        this.onCurrenChanged = () => {
            this.updateTarget()
        }
        this.updateCurrent()
    }

    private updateCurrent() {
        const res = this.test.val()
        if ((res && this.current)) return
        if (!(res || this.current)) return

        if (!res) {
            if (!this.current) return
            this.current.target.off(this.onCurrenChanged)
            this.current?.destory()
            this.current = undefined
            this.updateTarget()
        } else if (this.current) {
        } else {
            if (this.current) return
            this.current = this.render()
            this.current.target.on(this.onCurrenChanged)
            this.updateTarget()
        }

    }

    private updateTarget() {
        this.target.val().forEach(v => v.remove())
        if (!this.current) {
            this.target.update([])
        } else {
            const list = this.current.target.val()
            this.target.update(list)
        }
    }

    destory(): void {
        super.destory()
        this.test.off(this.onTestChanged)
        this.current?.target.off(this.onCurrenChanged)
        this.current?.destory()
        this.current = undefined
    }

}
