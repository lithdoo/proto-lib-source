import { Shape } from "@antv/x6"
import { insertCss } from 'insert-css'
import { NodeFactory } from "./Ax6Handler"
import type { Cell } from "@antv/x6"
import { test } from "../mutv/xml/xmlParser";


console.log({test}); //
export type FieldData<Type extends string> = {
    name: string
    desc: string
    type: Type
}

export type EntityData<Type extends string = string> = {
    id: string
    name: string
    desc: string
    fields: FieldData<Type>[]
}

export type EntityRenderData = {
    id: string,
    x: number,
    y: number,
    width: number,
    height: number,
}

export type EntiryStatusData = {
    isSelected: boolean
    highlightFields: string[]
}

const EntityShapeKey = 'GH_SQLERD_ENTITY_NODE'

NodeFactory.register(new class extends NodeFactory {
    shapeKey = EntityShapeKey
    create(cell: Cell<Cell.Properties>) {
        const data = cell.getData() as {
            viewId: string,
            entity: EntityData
            renderData: EntityRenderData
        }
        const node = EntityNode.find(data.viewId, data.entity.id)
            ?? new EntityNode(data.viewId, data.entity, data.renderData)
        return node.container
    }
})

export interface EntityView {
    findNode(id: string): EntityNode | void
}

export class EntityNode {
    static views: Map<string, EntityView> = new Map()
    static find(viewId: string, id: string) {
        return this.views.get(viewId)?.findNode(id)
    }

    container = document.createElement('div')
    status: EntiryStatusData = { isSelected: false, highlightFields: [] }

    constructor(
        public viewId: string,
        public entity: EntityData,
        public renderData: EntityRenderData
    ) {
        this.updateSize()
    }

    updateSize() {
        this.container.style.height = this.height + 'px'
        this.container.style.width = this.width + 'px'
        this.container.style.background = '#fff'
    }

    get height() {
        const fieldLength = this.entity.fields.length
        const outerBorder = 6
        const fieldHeight = 30
        const colorBanner = 6
        const titleHeight = 32

        return outerBorder + titleHeight + colorBanner + fieldHeight * fieldLength + outerBorder
        // return Math.min(1200, Math.max(200, this.renderData.height))
    }

    get width() {
        return 240
        // return Math.min(1200, Math.max(200, this.renderData.width))
    }

    toView() {
        const x = this.renderData.x
        const y = this.renderData.y
        const width = this.width
        const height = this.height
        const data = {
            viewId: this.viewId,
            entity: this.entity,
            renderData: this.renderData
        }
        return { x, y, width, height, shape: EntityShapeKey, data }
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