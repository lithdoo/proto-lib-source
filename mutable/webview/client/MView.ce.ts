import { MutWebViewClient } from "./MViewClient"





class MutWebViewElement extends HTMLElement {

    cntrEl: HTMLDivElement
    wsUrl?: string
    connectId?: string
    client?: MutWebViewClient

    constructor() {
        super()
        // 2. 创建 Shadow DOM
        const shadow = this.attachShadow({ mode: 'open' });

        // 3. 定义模板和样式
        const template = document.createElement('template');


        template.innerHTML = `
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

        // if (name === 'id') {
        //     this.connectId = newVal
        //     this.initGraph()
        // }
    }

    initGraph() {
        if (this.client) {
            this.client.destroy()
            this.client = undefined
        }
        if (!this.wsUrl) return
        this.client = new MutWebViewClient(
            this.wsUrl,
            this.cntrEl
        )
        
            console.log(this.client)
    }

}


customElements.define('mut-view', MutWebViewElement);