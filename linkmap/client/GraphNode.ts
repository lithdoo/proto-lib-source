import { Shape } from "@antv/x6"
// import { insertCss } from 'insert-css'
import { NodeFactory } from "./Ax6Handler"
import type { Cell } from "@antv/x6"
import { XMLParserTask } from "@proto-lib/mutv/xml/xmlParser"
// import xmlString from './node.xml?raw'
import { MVRenderer, RenderRoot } from "@proto-lib/mutv/render"
import { MutVal } from "@proto-lib/mutv/base/mut"
import { LinkMapState, NodeFullData } from "../base"
// import { EntityData, EntityRenderData } from "./base"


// export const template = new XMLParserTask(xmlString)

export interface NodeRenderData<T> extends NodeFullData<T> {
    viewId: string
}

const createTextNode = (text: string) => {
    const div = document.createElement('div')
    div.innerText = text

    div.style.background = '#fff'
    div.style.padding = '20px'
    div.style.border = '2px solid #66ccff'
    div.style.height = '100%'
    return div
}

const EntityShapeKey = 'LINKMAP_CUSTOM_NODE'

NodeFactory.register(new class extends NodeFactory {
    shapeKey = EntityShapeKey
    create(cell: Cell<Cell.Properties>) {
        const data = cell.getData() as NodeRenderData<unknown>
        const existNode = LinkNode.find(data.viewId, data.view.id)
        if (existNode) {
            return existNode.container
        } else {
            return createTextNode('Unknown View Node')
        }
    }
})

export interface LinkMapView<T = unknown> extends LinkMapState<T> {
    // template: { [key: string]: XMLParserTask }
    findNode(id: string): LinkNode<T> | void
    onNodeEvent ?(payload: any, e: { name: string, $event: Event }) :void
    clientData?: MutVal<unknown>
}
export interface LinkNodeTemplate {
    template: XMLParserTask
}


export class LinkNode<T> {
    static ShapKey = EntityShapeKey
    static views: Map<string, LinkMapView> = new Map()
    static find(viewId: string, id: string) {
        return LinkNode.views.get(viewId)?.findNode(id)
    }

    container = document.createElement('div')
    renderRoot = new RenderRoot(this.container)

    constructor(
        public renderData: NodeRenderData<T>,
        private template: XMLParserTask
    ) {
        this.updateSize()
        this.render()
    }

    render() {
        const view = LinkNode.views.get(this.renderData.viewId)
        if (!view) return
        const fragment = new MVRenderer(this.template)
            .renderRoot('render-node', new MutVal({
                fullData: this.renderData,
                clientData: view.clientData
            }), (payload, e) => {
                view.onNodeEvent?.(payload, e)
            })
        this.renderRoot.inject(fragment)
    }

    updateSize() {
        this.container.style.height = this.height + 'px'
        this.container.style.width = this.width + 'px'
    }

    get height() {
        //     const fieldLength = this.entity.fields.length
        //     const outerBorder = 6
        //     const fieldHeight = 30
        //     const colorBanner = 6
        //     const titleHeight = 32

        //     return outerBorder + titleHeight + colorBanner + fieldHeight * fieldLength + outerBorder
        return Math.min(
            this.renderData.view.maxHeight ?? Infinity,
            Math.max(this.renderData.view.minHeight ?? 0, this.renderData.view.height)
        )
    }

    get width() {
        // return 240
        // return Math.min(1200, Math.max(200, this.renderData.width))
        return Math.min(
            this.renderData.view.maxWidth ?? Infinity,
            Math.max(this.renderData.view.minWidth ?? 0, this.renderData.view.width)
        )
    }


}



// export class ChartEntityNode {
//   static maxHeight(fieldLength: number) {
//     const outerBorder = 6
//     const fieldHeight = 30
//     const colorBanner = 6
//     const titleHeight = 32

//     return outerBorder + titleHeight + colorBanner + fieldHeight * fieldLength + outerBorder
//   }

//   static {
//     insertCss(/*css*/ `
//         .gh-sql-erd{
//             border: 3px solid rgb(51 65 85);
//             border-radius: 6px;
//             background: #2F3035;
//         }
//         .gh-sql-erd__color{
//             background: #66ccff;
//             height:6px;
//             border-radius: 3px 3px 0 0;
//         }
//         .gh-sql-erd__header{
//             display:flex;
//             align-items: center;
//             justify-content: start;
//             height: 32px;
//             line-height: 32px;
//             background: rgb(15 23 42);
//             font-size: 14px;
//             padding: 0 4px;
//             color: rgba(255,255,255,0.85);
//             font-weight: 800;
//         }

//         .gh-sql-erd__header-icon{
//             margin: 0 8px 0 4px;
//             display: flex;
//             align-items: center;
//         }
//         .gh-sql-erd__header-icon svg{
//             height:16px;
//             width:16px;
//             color:#fff;
//             fill: currentColor;
//         }

//         .gh-sql-erd__body{
//             background: rgb(2,6,32);
//             border-radius: 0 0 3px 3px;
//             overflow: auto;
//         }
//         .gh-sql-erd__field{
//             font-size: 14px;
//             color: rgba(255,255,255,0.85);
//             padding:0 12px;
//             display: flex;
//             flex-direction: row;
//             border-top: 1px solid rgb(30,41,59);
//             height: 30px;
//             display: flex;
//             align-items: center;
//         }


//         .gh-sql-erd__field-name{
//             flex: 1 1 0;
//             width: 0 ;
//             overflow: hidden;
//         }
//         .gh-sql-erd__field-type{
//             color: rgba(255,255,255,0.45);
//         }
//         `)
//   }
// //   static template: MBaseElementTemplateNode<HTMLDivElement, Props>
//   static {
//     const renderIcon = (t: MTemplate<Props>) => {
//       return t.Div('gh-sql-erd__header-icon', {
//         created: (_, ele) =>
//           (ele.innerHTML = `
//                 <svg class="icon" aria-hidden="true">
//                     <use xlink:href="#vx-base-table"></use>
//                 </svg>
//                 `)
//       })
//     }

//     const renderHeader = (t: MTemplate<Props>) => {
//       return t.Div('gh-sql-erd__header')(
//         renderIcon(t),
//         t.Text((s) => {
//           const name = s.get('data').render.table_name
//           const label = s.get('data').table.label ?? ''
//           return name + (label ? ` ( ${label} )` : '')
//         })
//       )
//     }

//     const renderBody = (t: MTemplate<Props>) => {
//       return t.Div('gh-sql-erd__body')(
//         t.loop((s) => s.get('data').table.fieldList)((t) =>
//           t.prop((s) => ({
//             field: s.get('_item'),
//             data: s.get('data')
//           }))((t) => renderField(t))
//         )
//       )
//     }

//     const renderField = (
//       t: MTemplate<{
//         field: {
//           name: string
//           label: string
//           type: any // 类型
//           // foreignKey: boolean        // 是否外键
//           primaryKey: boolean // 是否主键
//           notNull: boolean
//           unique: boolean
//         }
//         data: EntityData
//       }>
//     ) => {
//       return t.Div('gh-sql-erd__field')(
//         t.Div('gh-sql-erd__field-name')(
//           t.Text((s) => {
//             const name = s.get('field').name
//             const label = s.get('field').label ?? ''
//             return name + (label ? ` ( ${label} )` : '')
//           })
//         ),
//         t.Div('gh-sql-erd__field-type')(
//           t.Text(
//             (s) =>
//               `${s.get('field').type}${s.get('field').unique ? ' UNIQUE' : ''}${s.get('field').notNull ? ' NOT NULL' : ''}`
//           )
//         )
//       )
//     }

//     const renderNode = (t: MTemplate<Props>) => {
//       return t.Div('gh-sql-erd')(t.Div('gh-sql-erd__color')(), renderHeader(t), renderBody(t))
//     }
//     ChartEntityNode.\ = renderNode(new MBaseTemplate()).build()
//   }
//   static finder: WeakMap<EntityData, ChartEntityNode> = new WeakMap()
//   static {
//     Shape.HTML.register({
//       shape: 'GH_SQLERD_ENTITY_NODE',
//       effect: [],
//       html(cell) {
//         const data = cell.getData() as EntityData
//         const node = ChartEntityNode.finder.get(data) ?? new ChartEntityNode(data)
//         return node.element
//       }
//     })
//   }

// //   template = ChartEntityNode.template
// //   data: EntityData
// //   state: GhJsonStructNodeState
// //   element: HTMLElement

// //   constructor(data: EntityData) {
// //     ChartEntityNode.finder.set(data, this)
// //     this.data = data
// //     this.state = {
// //       isSelected: new MBaseValue(false),
// //       highlightFields: new MBaseValue(new Set())
// //     }
// //     const scope = RenderScope.create({ state: this.state, data: this.data })
// //     const renderNode = render<Props>(this.template, scope)
// //     this.element = renderNode.nodes.getValue()[0] as HTMLElement
// //     this.element.oncontextmenu = (ev) => {
// //       this.oncontextmenu?.(ev)
// //     }
// //   }

// //   private getRecordService() {
// //     const state = ChartViewState.get(this.data.viewId)
// //     const url = state.service?.dbUrl
// //     return url ? new DBRecordsService(url) : null
// //   }

// //   private getControl() {
// //     const state = ChartViewState.get(this.data.viewId)
// //     return state.control
// //   }

//   oncontextmenu(ev: MouseEvent) {
//     // const service = this.getRecordService()
//     // if (!service) return
//     // contextMenu.open(
//     //   PopMenuListHandler.create([
//     //     Menu.button({
//     //       icon: 'del',
//     //       key: 'viewData',
//     //       label: '浏览数据',
//     //       action: async () => {
//     //         await this.getControl().emit('table:showDataGrid', this.data.table.name, 'view')
//     //       }
//     //     }),
//     //     Menu.button({
//     //       icon: 'del',
//     //       key: 'insertTable',
//     //       label: '添加数据',
//     //       action: async () => {
//     //         await this.getControl().emit('table:showDataGrid', this.data.table.name, 'insert')
//     //       }
//     //     }),
//     //     Menu.button({
//     //       icon: 'del',
//     //       key: 'deleteTable',
//     //       label: '删除',
//     //       action: async () => {
//     //         const control = this.getControl()
//     //         await control.emit('table:delete', this.data.table.name)
//     //       }
//     //     })
//     //   ]),
//     //   ev
//     // )
//   }
// }