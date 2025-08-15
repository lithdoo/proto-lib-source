import { Graph, Node } from '@antv/x6'
import { EntityNode, type EntityData, type EntityRenderData, type EntityView } from './EntityNode'

export class GraphView {
  outer: HTMLElement = document.createElement('div')
  inner: HTMLElement = document.createElement('div')
  graph?: Graph


  log: (type: 'send' | 'recevied', method: string, params: any) => void = () => { }



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

  protected initGraph(): Graph {
    const graph = super.initGraph()
    graph.on('node:change:position', ({ node, current }) => {
      const id = node.getData()?.entity?.id
      if (!current || !id) {
        return
      }
      this.onClientUpdateNodePos(id, current)
    })

    const center = () => {
      const container = graph.container;
      const centerX = container.clientWidth / 2;
      const centerY = container.clientHeight / 2;
      // 将容器中心点转换为画布坐标
      const center = graph.graphToLocal(centerX, centerY);
      const zoom = graph.zoom()
      this.onClinentViewportChanged(center, zoom)
    }

    graph.on('scale', (...args) => {
      console.log('scale')
      console.log(args)
      center()
    })
    graph.on('resize', (...args) => {
      console.log('resize')
      console.log(args)
      center()
    })
    graph.on('translate', (...args) => {
      console.log('translate')
      console.log(args)
      center()
    })
      ; (window as any).g = graph
    return graph
  }


  messageTimeout: Map<string, any> = new Map()
  onClientUpdateNodePos(id: string, pos: { x: number, y: number }) {
    const node = this.nodes.find(v => v.entity.id === id)
    if (node) {
      node.renderData.x = pos.x
      node.renderData.y = pos.y
    }

    const timeout = this.messageTimeout.get(id)
    if (timeout) { clearTimeout(timeout) }
    this.messageTimeout.set(id, setTimeout(() => {
      this.log('send', 'clientUpdateNodePostion', { id, x: pos.x, y: pos.y })
      this.messageTimeout.delete(id)
    }, 100))
  }


  autoFocusTimeout: any = null


  onServerUpdateNode(entity: EntityData, autoFocus: boolean) {
    const oldone = this.nodes.find(v => v.entity.id == entity.id)
    if (!oldone) return
    const node = new EntityNode(this.id, entity, oldone.renderData)
    this.updateNode(node)
    this.log('recevied', 'serverUpdateNode', { entity })
    if (autoFocus) {
      if (this.autoFocusTimeout) clearTimeout(this.autoFocusTimeout)
      this.autoFocusTimeout = setTimeout(() => {
        const node = this.graph?.getNodes().find(node => {
          const data = node.getData()
          return data.entity.id === entity.id
        })
        console.log({ node })
        if (node) {
          this.graph?.centerCell(node, { animation: true } as any)
        }
      }, 0)
    }
  }

  onServerCreateNode(entity: EntityData, render: EntityRenderData, autoFocus: boolean) {
    const node = new EntityNode(this.id, entity, render)
    this.updateNode(node)
    this.log('recevied', 'serverAddNode', { entity, render })
    if (autoFocus) {
      if (this.autoFocusTimeout) clearTimeout(this.autoFocusTimeout)
      this.autoFocusTimeout = setTimeout(() => {
        const node = this.graph?.getNodes().find(node => {
          const data = node.getData()
          return data.entity.id === entity.id
        })
        console.log({ node })
        if (node) {
          this.graph?.centerCell(node, { animation: true } as any)
        }
      }, 0)
    }
  }

  onClinentViewportChanged(center: { x: number, y: number }, zoom: number) {
    const id = 'onClinentViewportChanged'
    const timeout = this.messageTimeout.get(id)
    if (timeout) { clearTimeout(timeout) }
    this.messageTimeout.set(id, setTimeout(() => {
      this.log('send', 'clinentViewportChanged', { center, zoom })
      this.messageTimeout.delete(id)
    }, 100))
  }

  onServerClearGraph() {
    this.nodes = []
    this.refresh()
    this.log('recevied', 'serverClearGraph', [])
  }

  updateNode(node: EntityNode) {
    this.nodes = this.nodes.filter(v => v.entity.id !== node.entity.id)
      .concat(node)
    this.refresh()
  }
}
