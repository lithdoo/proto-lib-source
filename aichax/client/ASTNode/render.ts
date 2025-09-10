
import type { Root, Node, Parent } from 'mdast';
import { parseMarkdownToAST } from './ast';

// 定义Markdown AST节点类型枚举
export enum MDNodeType {
    Root = 'root',
    Paragraph = 'paragraph',
    Heading = 'heading',
    Text = 'text',
    Strong = 'strong',
    Emphasis = 'emphasis',
    Delete = 'delete',
    Link = 'link',
    List = 'list',
    ListItem = 'listItem',
    Blockquote = 'blockquote',
    Code = 'code',
    InlineCode = 'inlineCode',
    Break = 'break',
    Image = 'image',
    ThematicBreak = 'thematicBreak'
}

export type MDNode = Node

// 类型定义 - 扩展mdast类型以包含我们需要的属性
export interface HeadingNode extends MDNode {
    type: MDNodeType.Heading;
    depth: number;
    children: Node[];
}

export interface LinkNode extends MDNode {
    type: MDNodeType.Link;
    url: string;
    title?: string;
    children: Node[];
}

export interface ImageNode extends MDNode {
    type: MDNodeType.Image;
    url: string;
    alt?: string;
    title?: string;
}

export interface CodeNode extends MDNode {
    type: MDNodeType.Code | MDNodeType.InlineCode;
    value: string;
    lang?: string;
}

export interface TextNode extends MDNode {
    type: MDNodeType.Text;
    value: string;
}

export interface ListNode extends MDNode {
    type: MDNodeType.List;
    ordered: boolean;
    children: Node[];
}


export interface MDViewNode<Target extends HTMLElement = HTMLElement, Node extends MDNode = MDNode> {
    target: Target
    initChildren(children: MDViewNode[]): void
    updateChildren(remove: MDViewNode[], append: MDViewNode[]): void
    update(node: Node): void

}


export type MarkdownTypeRenderer = {
    [key in MDNodeType]: (node: any) => MDViewNode
}

export class BaseViewNode<
    Node extends MDNode = MDNode,
    Target extends HTMLElement = HTMLElement> implements MDViewNode<Target, Node> {

    static getTagName(node: MDNode): string {
        switch (node.type) {
            case MDNodeType.Paragraph:
                return 'p';
            case MDNodeType.Heading:
                return `h${(node as HeadingNode).depth}`;
            case MDNodeType.Text:
                return 'span';
            case MDNodeType.Strong:
                return 'strong';
            case MDNodeType.Emphasis:
                return 'em';
            case MDNodeType.Delete:
                return 'del';
            case MDNodeType.Link:
                return 'a';
            case MDNodeType.List:
                return (node as ListNode).ordered ? 'ol' : 'ul';
            case MDNodeType.ListItem:
                return 'li';
            case MDNodeType.Blockquote:
                return 'blockquote';
            case MDNodeType.Code:
                return 'pre';
            case MDNodeType.InlineCode:
                return 'code';
            case MDNodeType.Break:
                return 'br';
            case MDNodeType.Image:
                return 'img';
            case MDNodeType.ThematicBreak:
                return 'hr';
            default:
                throw new Error(`未处理的节点类型: ${(node as MDNode).type}`);
        }
    }

    constructor(
        public node: Node
    ) {
        const tagName = BaseViewNode.getTagName(node)
        this.target = document.createElement(tagName) as Target
    }
    target: Target
    initChildren(children: MDViewNode[]) {
        this.target.innerHTML = ''
        children.map(v => v.target).forEach(child => this.target.appendChild(child))
    }
    updateChildren(remove: MDViewNode[], append: MDViewNode[]) {
        remove.map(v => v.target).forEach(child => {
            this.target.removeChild(child)
        })
        append.map(v => v.target).forEach(child => {
            this.target.appendChild(child)
        })

    }

    update(_node) { }
}



export class LinkViewNode extends BaseViewNode<LinkNode, HTMLLinkElement> {
    constructor(node: LinkNode) {
        super(node)
        this.update(node)
    }

    update(node: LinkNode): void {
        this.target.href = node.url
        if (node.title) {
            this.target.title = node.title;
        }
    }
}


export class ImageViewNode extends BaseViewNode<ImageNode, HTMLImageElement> {
    constructor(node: ImageNode) {
        super(node)
        this.update(node)
    }

    update(node: any): void {
        this.target.src = node.url
        this.target.alt = node.alt ?? ''
        if (node.title) {
            this.target.title = node.title;
        }
    }
}


export class CodeViewNode extends BaseViewNode<CodeNode, HTMLPreElement> {
    code = document.createElement('code')
    constructor(node: CodeNode) {
        super(node)
        this.target.appendChild(this.code);
        this.update(node)
    }

    update(node: any): void {
        const codeNode = node;
        this.code.textContent = codeNode.value;
        if (codeNode.lang) {
            this.code.className = `language-${codeNode.lang}`;
        }
    }
}



export class InlineCodeViewNode extends BaseViewNode<CodeNode, HTMLElement> {
    constructor(node: CodeNode) {
        super(node)
        this.target.className = 'inline-code';
        this.update(node)
    }
    update(node: any): void {
        this.target.textContent = node.value
    }
}



export class TextViewNode extends BaseViewNode<TextNode, HTMLSpanElement> {
    constructor(node: TextNode) {
        super(node)
        this.update(node)
    }

    update(node: any): void {
        this.target.textContent = node.value;
    }
}



export class RootViewNode {

    static nodeIsParent(node: MDNode): node is Parent {
        return !!('children' in node && node.children && (node.children as any).length > 0
        )
    }
    target = document.createElement('div')
    ast: Root
    constructor(
        public renderer: MarkdownTypeRenderer,
        public content: string = ''
    ) {
        this.ast = parseMarkdownToAST(content)
        console.log(content.length)
        console.log(this.ast)
        this.target.className = 'markdown-container'
    }


    update(content: string) {
        this.ast = parseMarkdownToAST(content)
        this.renderChildren(this.ast.children)
    }

    private renderChildren(list: MDNode[], parent?: MDViewNode) {
        const children = list.map(node => {
            const viewNode = this.renderer[node.type as MDNodeType]
                ?.(node)

            if (RootViewNode.nodeIsParent(node) && viewNode) {
                this.renderChildren(node.children as any, viewNode)
            }
            return viewNode
        }).filter(v => !!v)

        if (parent) {
            parent.initChildren(children)
        } else {
            this.target.innerHTML = ''
            children.forEach(child => this.target.appendChild(child.target))
        }
    }
}


export class CacheRootViewNode extends RootViewNode {


    private cache: WeakMap<MDNode, MDViewNode> = new WeakMap()
    private cacheChildren: WeakMap<MDViewNode, MDViewNode[]> = new WeakMap()
    private cacheRootChildren: MDViewNode[] = []


    update(content: string): void {
        const newAst = parseMarkdownToAST(content)
        const oldAst = this.ast

        this.renderChildrenWithOld(newAst.children, oldAst.children)
        this.ast = newAst
    }

    private getCacheWithCompare(node: MDNode, old: MDNode | null) {
        if (!old) return null
        if (old.type !== node.type) return null
        const cache = this.cache.get(old)
        if (!cache) return null

        if ((old.position?.end.column !== node.position?.end.column)
            || (old.position?.end.line !== node.position?.end.line)
            || (old.position?.end.offset !== node.position?.end.offset)
            || (old.position?.start.column !== node.position?.start.column)
            || (old.position?.start.line !== node.position?.start.line)
            || (old.position?.start.offset !== node.position?.start.offset)) {
            cache.update(node)
        }
        return cache
    }

    private updateChildrenWithCache(children: MDViewNode[], parent?: MDViewNode) {


        const cache = (parent ? this.cacheChildren.get(parent) : this.cacheRootChildren)
            ?? []

        const removeStartIdx = cache.findIndex((v, idx) => v !== children[idx])
        const remove = removeStartIdx < 0 ? [] : cache.slice(removeStartIdx)

        const apppendStartIdx = children.findIndex((v, idx) => v !== cache[idx])
        const append = apppendStartIdx < 0 ? [] : children.slice(apppendStartIdx)


        if (parent) {
            parent.updateChildren(remove,append)
            this.cacheChildren.set(parent, children)
        } else {
            remove.forEach(child => this.target.removeChild(child.target))
            append.forEach(child => this.target.appendChild(child.target))
            this.cacheRootChildren = children
        }


    }

    private renderChildrenWithOld(list: MDNode[], oldList: MDNode[], parent?: MDViewNode) {
        const children = list.map((node, idx) => {
            const old = oldList[idx] ?? null
            const viewNode = this.getCacheWithCompare(node, old)
                || this.renderer[node.type as MDNodeType]?.(node)

            if (viewNode) this.cache.set(node, viewNode)

            if (RootViewNode.nodeIsParent(node) && viewNode) {
                const oldChildren = (old && RootViewNode.nodeIsParent(old) && old.children) || []
                this.renderChildrenWithOld(node.children as any, oldChildren, viewNode)
            }
            return viewNode
        }).filter(v => !!v)

        this.updateChildrenWithCache(children, parent)
    }

}


export const renderer = {
    [MDNodeType.Root]: (node: MDNode) => new BaseViewNode(node),
    [MDNodeType.Paragraph]: (node: MDNode) => new BaseViewNode(node),
    [MDNodeType.Heading]: (node: MDNode) => new BaseViewNode(node),
    [MDNodeType.Text]: (node: TextNode) => new TextViewNode(node),
    [MDNodeType.Strong]: (node: MDNode) => new BaseViewNode(node),
    [MDNodeType.Emphasis]: (node: MDNode) => new BaseViewNode(node),
    [MDNodeType.Delete]: (node: MDNode) => new BaseViewNode(node),
    [MDNodeType.Link]: (node: LinkNode) => new LinkViewNode(node),
    [MDNodeType.List]: (node: MDNode) => new BaseViewNode(node),
    [MDNodeType.ListItem]: (node: MDNode) => new BaseViewNode(node),
    [MDNodeType.Blockquote]: (node: MDNode) => new BaseViewNode(node),
    [MDNodeType.Code]: (node: CodeNode) => new CodeViewNode(node),
    [MDNodeType.InlineCode]: (node: CodeNode) => new InlineCodeViewNode(node),
    [MDNodeType.Break]: (node: MDNode) => new BaseViewNode(node),
    [MDNodeType.Image]: (node: ImageNode) => new ImageViewNode(node),
    [MDNodeType.ThematicBreak]: (node: MDNode) => new BaseViewNode(node),
}