import { Graph, Node } from '@antv/x6'
import { EntityNode, type EntityView } from './EntityNode'

export class GraphView {
  outer: HTMLElement = document.createElement('div')
  inner: HTMLElement = document.createElement('div')
  graph?: Graph



  protected initGraph(): Graph {
    const container = this.inner
    const graph: Graph = new Graph({
      container,
      grid: {
        visible: true,
        type: 'dot',
        size: 20,
        args: {
          color: '#aaaaaa', // 网点颜色
          thickness: 1 // 网点大小
        }
      },
      panning: {
        enabled: true,
        eventTypes: ['leftMouseDown']
      },
      mousewheel: {
        enabled: true,
        zoomAtMousePosition: true,
        modifiers: null,
        factor: 1.1,
        maxScale: 2,
        minScale: 0.02
      },
      autoResize: true
    })

    // graph.on('node:change:position', ({ node, current }) => {
    //   if (!current) {
    //     return
    //   }
    //   this.state.updateNodePos(node.data.id, current.x, current.y)
    // })

    return graph
  }

  refresh() {
    this.graph?.removeCells(this.graph.getCells())
  }

  constructor() {
    const element = this.outer
    const container = this.inner
    element.style.display = 'flex'
    element.style.height = '100%'
    container.style.flex = '1'
    element.appendChild(container)
  }

  setNodeSize(id: string, size: { height: number; width: number }) {
    const node = this.graph?.getCellById(id)
    if (node instanceof Node) {
      node.setSize(size)
    }
  }

  loadContainer(outer: HTMLElement) {
    this.outer = outer
    const element = this.outer
    const container = this.inner
    element.style.display = 'flex'
    element.style.height = '100%'
    container.style.flex = '1'
    element.appendChild(container)
    this.graph = this.initGraph()
    this.refresh()
  }

  fitView() {
    this.graph?.zoomToFit()
  }
}


export class ErGraphView extends GraphView implements EntityView {

  nodes: EntityNode[] = []
  id = Math.random().toString()
  constructor() {
    super()
    EntityNode.views.set(this.id, this)
    const nodes = new Array(10).fill(0).map(v => Math.random().toString())
      .map((id, idx) => new EntityNode(this.id, {
        id,
        name: 'test_table_node 1',
        desc: '',
        fields: new Array(Math.floor(Math.random() * 10 + 1 ))
          .fill(0)
          .map((_,idx)=> ({
            name: `field ${idx}`,
            type: 'type',
            desc: ''
          }))
      }, {
        id,
        x: idx * 400,
        y: 0,
        width: 0,
        height: 0
      }))

    this.nodes = nodes
  }

  findNode(id: string) {
    return this.nodes.find(v => v.entity.id === id)
  }

  refresh() {
    super.refresh()
    this.graph?.addNodes(this.nodes
      .map((node) => node.toView())
    )
  }

}
// export class ChartGraphView extends GraphView {
//   static finder: WeakMap<ChartViewState, ChartGraphView> = new WeakMap()
//   static entity2View(entity: EntityData) {
//     const x = entity.render.pos_left
//     const y = entity.render.pos_top
//     const width = entity.render.size_width
//     const height = entity.render.size_height
//     return { x, y, width, height, shape: 'GH_SQLERD_ENTITY_NODE' }
//   }
//   constructor(public readonly state: ChartViewState) {
//     super()
//   }

//   dispose() {
//     this.graph?.dispose()
//     this.state.dispose()
//   }

//   refresh() {
//     this.graph?.removeCells(this.graph.getCells())
//     this.graph?.addNodes(
//       this.state
//         .getAllEntities()
//         .map((node) => Object.assign({}, ChartGraphView.entity2View(node), { data: node }))
//     )
//   }
// }
