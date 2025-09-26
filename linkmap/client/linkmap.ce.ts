import { WsRPCClient } from "@proto-lib/jsrpc/wsc";
import { WsRPCLinkMapGraphView } from "./GraphView";
import x6css from '@antv/x6/dist/index.css?raw'

// 1. 定义类并继承 HTMLElement
class MVLinkMapElement extends HTMLElement {
    cntrEl: HTMLDivElement
    wsUrl?: string
    connectId: string
    graphView?: WsRPCLinkMapGraphView<any>
    constructor() {
        super();

        // 2. 创建 Shadow DOM
        const shadow = this.attachShadow({ mode: 'open' });

        // 3. 定义模板和样式
        const template = document.createElement('template');
        // template.innerHTML = `
        //   <style>
        //     button { padding: 8px 12px; background: #3B82F6; color: white; border: none; border-radius: 4px; cursor: pointer; }
        //     button:hover { background: #2563EB; }
        //     span { margin: 0 10px; }
        //   </style>
        //   <button id="decrement">-</button>
        //   <span id="count">0</span>
        //   <button id="increment">+</button>
        // `;

        template.innerHTML = `
        <style>${x6css}</style>
        <div id="container" style="height:100%;width:100%;min-height:200px;min-width:400px;background:#333"></div>
        `

        // 4. 克隆模板并添加到 Shadow DOM
        shadow.appendChild(template.content.cloneNode(true));

        // 5. 获取元素引用
        this.cntrEl = shadow.getElementById('container') as HTMLDivElement
    }

    // 8. 属性变化观察器
    static get observedAttributes() {
        return ['ws-url', 'connecti-id'];
    }

    attributeChangedCallback(name: string, oldVal: string, newVal: string) {
        if (name === 'ws-url') {
            this.wsUrl = newVal
            this.initGraph()
        }

        if (name === 'id') {
            this.connectId = newVal
            this.initGraph()
        }
    }

    initGraph() {
        if (this.graphView) {
            this.graphView.destroy()
            this.graphView = undefined
        }
        if (!this.wsUrl) return

        const erdWS = new WsRPCClient(this.wsUrl)
        erdWS.id = this.connectId

        const graphView = new class extends WsRPCLinkMapGraphView<any> {
            constructor() { super(erdWS) }
        }
        graphView.loadContainer(this.cntrEl)
        this.graphView = graphView
    }

}

// 10. 注册自定义元素
customElements.define('mv-linkmap', MVLinkMapElement);