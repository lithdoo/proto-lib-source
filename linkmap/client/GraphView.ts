import { Graph, Node } from '@antv/x6'
import { LinkMapState, NodeFullData, NodeViewData, ViewPort } from '../base'
import { LinkMapView, LinkNode } from './GraphNode'
import { XMLParserTask } from '@proto-lib/mutv/xml/xmlParser'
import { WsRPCClient } from '@proto-lib/jsrpc/wsc'

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


export class LinkMapGraphView<NodeData> extends GraphView implements LinkMapView<NodeData> {


  viewprot: ViewPort = {
    pos: { x: 0, y: 0 }, zoom: 1
  }
  nodes: NodeFullData<NodeData>[] = []
  graphNodes: Map<string, LinkNode<NodeData>> = new Map()
  timestamp: number = new Date().getTime()
  templates: { [key: string]: XMLParserTask } = {}
  id = Math.random().toString()

  constructor() {
    super()
    LinkNode.views.set(this.id, this)
  }


  node2x6(renderData: NodeFullData<NodeData>) {
    function height() {
      return Math.min(
        renderData.view.maxHeight ?? Infinity,
        Math.max(renderData.view.minHeight ?? 0, renderData.view.height)
      )
    }

    function width() {
      return Math.min(
        renderData.view.maxWidth ?? Infinity,
        Math.max(renderData.view.minWidth ?? 0, renderData.view.width)
      )
    }

    const x = renderData.view.x
    const y = renderData.view.y
    const data = { ...renderData, viewId: this.id }
    return { x, y, width: width(), height: height(), shape: LinkNode.ShapKey, data }
  }

  findNode(id: string) {
    const existNode = this.graphNodes.get(id)
    if (existNode) return existNode
    const data = this.nodes.find(v => v.view.id === id)
    const template = this.templates[data.type]
    if (data && template) {
      const linkNode = new LinkNode({
        ...data, viewId: this.id
      }, template)
      this.graphNodes.set(id, linkNode)
      return linkNode
    }
    return null
  }

  refresh(updateNodes?: string[]) {
    super.refresh()
    this.graph?.addNodes(this.nodes
      .map((node) => this.node2x6(node))
    )
  }


  
  protected blockViewPortEvent:boolean = false
  protected initGraph(): Graph {
    const graph = super.initGraph()

    const posChangeTimeout = new Map<string, any>()

    graph.on('node:change:position', ({ node, current }) => {
      console.log('node:change:position')
      const id = node.getData()?.view?.id
      console.log('node:change:position', { node, current, id })
      if (!current || !id) {
        return
      }
      const timeout = posChangeTimeout.get(id)
      if (timeout) clearTimeout(timeout)
      posChangeTimeout.set(id, setTimeout(() => {
        this.updateNodePos(id, current)
        posChangeTimeout.delete(id)
      }, 300))
    })

    let centerTimeout: any = null
    const center = () => {
      if(this.blockViewPortEvent) return
      const container = graph.container;
      const centerX = container.clientWidth / 2;
      const centerY = container.clientHeight / 2;
      // 将容器中心点转换为画布坐标
      const center = graph.graphToLocal(centerX, centerY);
      const zoom = graph.zoom()

      if (
        (this.viewprot.pos.x === center.x) &&
        (this.viewprot.pos.y === center.y) &&
        (this.viewprot.zoom === zoom) 
      ){
        return
      }

      if (centerTimeout) clearTimeout(centerTimeout)

      centerTimeout = setTimeout(() => {
        this.updateViewPort(center, zoom)
        centerTimeout = null
      }, 300)
    }

    graph.on('scale', (...args) => {
      console.log('scale', args)
      center()
    })
    graph.on('resize', (...args) => {
      console.log('resize', args)
      center()
    })
    graph.on('translate', (...args) => {
      console.log('translate', args)
      center()
    })
      ; (window as any).g = graph
    return graph
  }


  updateNodePos(id: string, current: { x: number, y: number }) {
    const node = this.nodes.find(v => v.view.id === id)
    if (node) {
      node.view.x = current.x
      node.view.y = current.y
    }
    const gnode = this.graphNodes.get(id)
    if (gnode) {
      gnode.renderData.view.x = current.x
      gnode.renderData.view.y = current.y
    }
  }

  updateViewPort(pos: { x: number, y: number }, zoom: number) {
    this.viewprot.pos = pos
    this.viewprot.zoom = zoom
  }
}

export class WsRPCLinkMapGraphView<NodeData> extends LinkMapGraphView<NodeData> {

  constructor(
    private rpc: WsRPCClient
  ) {
    super()
    this.initRPC()
    rpc.open.then(() => {
      this.loadTemplates()
      this.reloadFromRPC()
    })


    ;(window as any).wsr = this
  }

  initRPC() {
    [
      {
        name: 'linkmap/broadcast/reloaded',
        params: ['timestamp'],
        call: async (timestamp: number) => {
          if (this.timestamp !== timestamp) return this.reloadFromRPC()
        }
      },

      {
        name: 'linkmap/broadcast/nodeDelete',
        params: ['from', 'to', 'data'],
        call: async (from: number, to: number, data: string) => {
          if (this.timestamp === to) return
          if (this.timestamp !== from) return this.reloadFromRPC()
          this.nodes = this.nodes.filter(v => v.view.id !== data)
          this.timestamp = to
          this.refresh()
        }
      },

      {
        name: 'linkmap/broadcast/viewPortChanged',
        params: ['from', 'to', 'data'],
        call: async (from: number, to: number, data: ViewPort) => {
          console.log('linkmap/broadcast/viewPortChanged')
          if (this.timestamp === to) return
          if (this.timestamp !== from) return this.reloadFromRPC()
          this.viewprot = data
          this.timestamp = to
          this.resetViewPort()
        }
      },


      {
        name: 'linkmap/broadcast/nodeViewChanged',
        params: ['from', 'to', 'data'],
        call: async (from: number, to: number, data: NodeViewData) => {
          console.log('linkmap/broadcast/nodeViewChanged')
          if (this.timestamp === to) return
          if (this.timestamp !== from) return this.reloadFromRPC()
          const node = this.nodes.find(v => v.view.id === data.id)
          if (!node) return this.reloadFromRPC()
          node.view = data
          this.timestamp = to
          this.graphNodes.delete(data.id)
          this.refresh()
        }
      },


      {
        name: 'linkmap/broadcast/nodeInsert',
        params: ['from', 'to', 'data'],
        call: async (from: number, to: number, data: NodeFullData<NodeData>) => {
          if (this.timestamp === to) return
          if (this.timestamp !== from) return this.reloadFromRPC()
          this.nodes = this.nodes.filter(v => v.view.id !== data.view.id).concat([data])
          this.graphNodes.delete(data.view.id)
          this.timestamp = to
          this.refresh()
        }
      },


      {
        name: 'linkmap/broadcast/nodeDataChanged',
        params: ['from', 'to', 'data'],
        call: async (from: number, to: number, data: { id: string, data: NodeData, view?: NodeViewData }) => {
          if (this.timestamp === to) return
          if (this.timestamp !== from) return this.reloadFromRPC()
          const node = this.nodes.find(v => v.view.id === data.id)
          if (!node) return this.reloadFromRPC()
          node.data = data.data
          if (data.view) node.view = data.view
          this.graphNodes.delete(node.view.id)
          this.timestamp = to
          this.refresh()
        }
      },


    ].forEach(method => this.rpc.apply(method))

  }

  async loadTemplates() {
    const { templates } = (await this.rpc.send({ method: 'linkmap/client/fetchTemplates', params: {} }) ?? {}) as any
      ;
    [...Object.entries(templates)].map(([name, value]) => {
      try {
        this.templates[name] = new XMLParserTask(value as string)
      } catch (e) {
        console.error(e)
        console.error(`XMLParserTask "${name}" Error`)
      }
    })
  }


  updateNodePos(id: string, current: { x: number; y: number }): void {
    super.updateNodePos(id, current)
    const data = this.nodes.find(v => v.view.id === id)?.view
    const timestamp = this.timestamp
    if (!data) return

    this.rpc.send({
      method: 'linkmap/client/nodeViewDataChanged',
      params: { data, timestamp }
    }).then((newStamp?: number) => {
      if (!newStamp) return this.reloadFromRPC()
      if (this.timestamp !== timestamp) return this.reloadFromRPC()
      this.timestamp = newStamp
    })
  }

  updateViewPort(pos: { x: number; y: number }, zoom: number): void {
    super.updateViewPort(pos, zoom)
    const data = this.viewprot
    const timestamp = this.timestamp

    this.rpc.send({
      method: 'linkmap/client/viewPortChanged',
      params: { pos: data.pos, zoom: data.zoom, timestamp }
    }).then((newStamp?: number) => {
      if (!newStamp) return this.reloadFromRPC()
      if (this.timestamp !== timestamp) return this.reloadFromRPC()
      this.timestamp = newStamp
    })
  }


  resetViewPort() {
    this.blockViewPortEvent  = true
    this.graph.zoomTo(this.viewprot.zoom)
    this.graph.centerPoint(this.viewprot.pos.x, this.viewprot.pos.y)
    this.blockViewPortEvent  = false
    console.log('after resetViewPort')
  }


  async reloadFromRPC() {
    const isLatest = await this.rpc.send({
      method: 'linkmap/client/checkIsLatest',
      params: { timestamp: this.timestamp }
    })

    if (isLatest) return

    const data: {
      viewprot: ViewPort;
      nodes: NodeFullData<NodeData>[];
      timestamp: number
    } = await this.rpc.send({
      method: 'linkmap/client/fetchState',
      params: {}
    }) as any

    this.viewprot = data.viewprot
    this.nodes = data.nodes
    this.timestamp = data.timestamp
    this.graphNodes = new Map()
    this.refresh()
    this.resetViewPort()
  }
}