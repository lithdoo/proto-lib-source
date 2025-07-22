import type { EvalRef } from "../eval"
import { MutComputed } from "../base/mut"
import { MVFileMod, MVFileState, MVRenderMod } from "./base"
import { MVRenderValueStore } from "./store"
import { MVRenderTemplate } from "./template"


export const BEM_STYLE_NAMESPACE: "BEM_STYLE" = "BEM_STYLE"

export type BlockTag = string
export type ElementTag = string
export type ModifierTag = string

export type BemTag = [BlockTag, ElementTag | null, ModifierTag | null]

export interface BEMStyleData {
    last_mod_ts: number
    list: {
        readonly tag: BemTag,
        targets: {
            templateId: string,
            cond: EvalRef
        }[],
        content: string
    }[]
}

export class MVModBEMStyle extends MVFileMod<BEMStyleData> {
    static tagClass(tag: BemTag) {
        const block = tag[0]
        const element = tag[1] ? `__${tag[1]}` : ''
        const modifier = tag[2] ? `--${tag[2]}` : ''
        return block + element + modifier
    }
    static equalTag(source: BemTag, target: BemTag) {
        return source[0] === target[0] && source[1] === target[1] && source[2] === target[2]
    }
    static namespace: 'BEM_STYLE' = 'BEM_STYLE'
    readonly namespace: "BEM_STYLE" = MVModBEMStyle.namespace
    static blankData(): BEMStyleData {
        return { last_mod_ts: new Date().getTime(), list: [] }
    }

    data: BEMStyleData = MVModBEMStyle.blankData()

    constructor(
        file: MVFileState
    ) {
        super(file)
        this.reload()
    }

    reload() {
        this.data = this.getData() ?? MVModBEMStyle.blankData()
    }

    private update() {
        this.data.last_mod_ts = new Date().getTime()
        this.setData({
            last_mod_ts: this.data.last_mod_ts,
            list: this.data.list.map(v => ({ ...v }))
        })
    }

    addTag(tag: BemTag, content: string = '') {
        console.log({ tag })
        const [block, element, modifier] = tag

        if (this.data.list.find(v => MVModBEMStyle.equalTag(v.tag, tag))) return


        if (block && element && modifier) {
            const ele = this.data.list.find(
                v => v.tag[0] === block && v.tag[1] === element
            )

            if (!ele) {
                throw new Error(`element "${block}__${element}" is not found!`)
            }
            const mod = this.data.list.find(v => MVModBEMStyle.equalTag(v.tag, tag))

            if (mod) {
                throw new Error(`modifier "${block}__${element}--${modifier}" is exist!`)
            }

            this.data.list = this.data.list.concat([{
                tag: [block, element, modifier], targets: [], content
            }])


        } else if (block && (element || modifier)) {
            const blk = this.data.list.find(
                v => v.tag[0] === block
            )

            if (!blk) {
                throw new Error(`block "${block}" is not found!`)
            }
            const mod = this.data.list.find(v => MVModBEMStyle.equalTag(v.tag, tag))

            if (mod) {
                throw new Error(`modifier "${block}__${element ?? ''}--${mod ?? ''}" is exist!`)
            }

        } else if (block) {

            const blk = this.data.list.find(
                v => v.tag[0] === block
            )

            if (blk) {
                throw new Error(`block "${block}" is exist!`)
            }

        } else {
            throw new Error('unknown tag')
        }


        this.data.list = this.data.list.concat([{
            tag: tag, targets: [], content
        }])

        this.update()
    }

    delTag(tag: BemTag) {
        const [block, element, modifier] = tag

        this.data.list = this.data.list.filter(item => {
            if (modifier) {
                return !MVModBEMStyle.equalTag(item.tag, tag)
            } else if (element) {
                return !(block === item.tag[0] && element === item.tag[1])
            } else {
                return !(block === item.tag[0])
            }
        })

        this.update()
    }

    addTagTemplate(tag: BemTag, templateId: string, cond: EvalRef = { '_VALUE_GENERATOR_REFERENCE_': 'true' }) {

        const tagItem = this.data.list.find(v => MVModBEMStyle.equalTag(v.tag, tag))
        if (tagItem) {
            tagItem.targets = tagItem.targets
                .filter((v: any) => v[0] !== templateId)
                .concat([{ templateId, cond }])
        }

        this.update()
    }

    delTagTemplate(tag: BemTag, templateId: string) {
        const tagItem = this.data.list.find(v => MVModBEMStyle.equalTag(v.tag, tag))
        if (tagItem) {
            tagItem.targets = tagItem.targets
                .filter(v => v.templateId !== templateId)
        }

        this.update()
    }

    getAllTag(): BemTag[] {
        return this.data.list.map(v => [...v.tag])
    }

    getTagsByTemplateId(templateId:string) {
        return this.data.list.flatMap(({ tag, targets }) => targets.map(({ templateId, cond }) => ({
            templateId, cond, tag
        }))).filter(v => v.templateId === templateId)
    }

    fetchContent(tag: BemTag) {

        const item = this.data.list.find(v => MVModBEMStyle.equalTag(tag, v.tag))
        if (item) {
            return item.content
        } else {
            throw new Error('error tag')
        }
    }

    updateContent(tag: BemTag, content: string) {
        const item = this.data.list.find(v => MVModBEMStyle.equalTag(tag, v.tag))
        if (item) {
            item.content = content
            this.update()
        }
    }
}



export class MVRenderBEMStyle extends MVRenderMod<BEMStyleData> {

    static replace(cssText: string, tag: BemTag) {
        return cssText.replace(/([^{]+?)(\s*\{)/g, (_match, selectors, rest) => {
            const replacedSelectors = selectors.replace(/&/g, `.${MVModBEMStyle.tagClass(tag)}`);
            return replacedSelectors + rest;
        });
    }

    readonly namespace = MVModBEMStyle.namespace

    constructor(
        file: MVFileState,
        public template: MVRenderTemplate,
        public stroe: MVRenderValueStore
    ) {
        super(file)
    }


    css() {
        const data = this.getData() ?? MVModBEMStyle.blankData()
        const { list } = data

        return list.map(({ tag, content }) => {
            return MVRenderBEMStyle.replace(content, tag)
        })
    }



    onBeforeRender() {
        const data = this.getData() ?? MVModBEMStyle.blankData()
        const { list } = data

        list.flatMap(({ tag, targets }) => targets.map(val => ({ ...val, tag })))
            .forEach(({ tag, templateId, cond }) => {
                const trans = this.template.attrTransfer.get(templateId)
                const className = MVModBEMStyle.tagClass(tag)
                if (trans) {
                    // todo
                } else {
                    this.template.attrTransfer.set(templateId, (upper, val) => {
                        const condtion = val(cond)
                        return new MutComputed<[{ [key: string]: any; }, any], any>
                            ([upper, condtion], (attr, cond) => {
                                return {
                                    ...attr,
                                    class: `${attr?.class ?? ''} ${cond ? className : ''}`
                                }
                            })
                    })
                }
            })
    }

    onRootCompleted(root: ShadowRoot) {
        this.css()
            .map(cssHtml => {
                console.log({ cssHtml })
                const style = document.createElement('style')
                style.innerHTML = cssHtml
                return style
            })
            .forEach(style => {
                root.appendChild(style)
            })
    }

    


}// export class JthRenderModBEMStyle extends JthRenderMod<BEMStyleData> {

//     static replace(cssText: string, tag: BemTag) {
//         return cssText.replace(/([^{]+?)(\s*\{)/g, (_match, selectors, rest) => {
//             const replacedSelectors = selectors.replace(/&/g, `.${MVModBEMStyle.tagClass(tag)}`);
//             return replacedSelectors + rest;
//         });
//     }

//     readonly namespace: "BEM_STYLE" = MVModBEMStyle.namespace

//     constructor(
//         file: JthFileState,
//         public template: JthRenderModlTemplateTree,
//         public stroe: JthRenderModValueStore
//     ) {
//         super(file)
//     }


//     css() {
//         const data = this.getData() ?? MVModBEMStyle.blankData()
//         const { list } = data

//         return list.map(({ tag, content }) => {
//             return JthRenderModBEMStyle.replace(content, tag)
//         })
//     }



//     [JthRenderMod.preRender]() {
//         const data = this.getData() ?? MVModBEMStyle.blankData()
//         const { list } = data

//         list.flatMap(({ tag, targets }) => targets.map(val => ({ ...val, tag })))
//             .forEach(({ tag, templateId, cond }) => {
//                 const trans = this.template.transElementAttr.get(templateId)
//                 const className = MVModBEMStyle.tagClass(tag)
//                 if (trans) {
//                     // todo
//                 } else {
//                     this.template.transElementAttr.set(templateId, (upper, val) => {
//                         const condtion = val(cond)
//                         return new MutComputed<[{ [key: string]: any; }, any], any>
//                             ([upper, condtion], (attr, cond) => {
//                                 return {
//                                     ...attr,
//                                     class: `${attr?.class ?? ''} ${cond ? className : ''}`
//                                 }
//                             })

//                     })
//                 }
//             })
//     }

//     [JthRenderMod.dealRoot](root) {
//         this.css()
//             .map(cssHtml => {
//                 console.log({cssHtml})
//                 const style = document.createElement('style')
//                 style.innerHTML = cssHtml
//                 return style
//             })
//             .forEach(style => {
//                 root.appendChild(style)
//             })
//     }


// }