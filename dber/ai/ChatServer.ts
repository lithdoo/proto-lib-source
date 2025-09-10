import { EntityData, EntityRenderData } from "../base.js";
import { createServer, WsConnection, WsConnectionStatus, WsRPCServer } from "../../jsrpc/wss";

import { ErdViewState, ViewPort } from "../GraphServer.js";
import { RPCMethod, RPCRequest } from "@proto-lib/jsrpc/base.js";
import { DeepSeekMessage, DeepSeekStreamResponse } from "@proto-lib/aichax/node.js";
import { ChatMsgContext, ConsoleAiChat } from "@proto-lib/aichax/console.js";
import { findNodesByType, parseMarkdownToAST } from "@proto-lib/aichax/MarkdownAst.js";
import { parseXMLToEntity } from "../xml.js";

const log = (text: string) => {
    // console.log(text)
    // appendFileSync(path.resolve(__dirname, './log.txt'), text)
    // appendFileSync(path.resolve(__dirname, './log.txt'), '\r\n')
}

class WsRunConnection implements WsConnection {
    status = WsConnectionStatus.Pending
    constructor(public id: string) { }
}

class ChatRespond implements ChatMsgContext {


    fullResponse = ''
    data: {
        xml: string,
        entity?: EntityData,
    }[] = []

    done = new Set<string>()

    constructor(public state: ErdViewState) { }

    complete(): void {
        console.log(this.data)
    }

    error(e: Error): void {
        
    }

    chunk(chunk: DeepSeekStreamResponse) {
        const content = chunk.choices[0].delta.content;
        if (!content) return
        process.stdout.write(content); // 实时输出
        this.fullResponse += content;
        this.parse()
        this.send()
    }

    parse() {
        const ast = parseMarkdownToAST(this.fullResponse)
        const codes = findNodesByType(ast, 'code')
            .filter(v => (v as any).lang === 'xml:entitiy-update')

        try {
            // writeFileSync(path.resolve(__dirname, './log/codes.txt'), JSON.stringify(codes, null, 2))
            // writeFileSync(path.resolve(__dirname, './log/ast.txt'), JSON.stringify(ast, null, 2))
        } catch (e) {

        }
        this.data = codes.map(v => {
            const xml = (v as any).value ?? ''
            try {
                const entity = parseXMLToEntity(xml)
                return { xml, entity }
            } catch (e) {
                return { xml }
            }
        })
    }

    send() {
        this.data.forEach((data) => {
            if (data.entity) {
                try {
                    // writeFileSync(path.resolve(__dirname, './entity', data.entity.name + '.xml'), data.xml)
                    // writeFileSync(path.resolve(__dirname, './entity', data.entity.name + '.json'), JSON.stringify(data.entity, null, 2))
                } catch (e) {

                }
            }

            if (!data.entity) return
            if (this.done.has(data.xml)) return
            this.done.add(data.xml)
            this.state.updateNode(data.entity)
        })
    }
}


const prompt = `
我们设计了一个XML结构，其中：
  - 根元素是 \`entity\`。
  - 每个实体用一个\`entity\`元素表示。
  - 每个实体有一个\`name\`属性来指定名称。
  - 每个实体有一个\`id\`属性来指定全局唯一的id，值为 uuid 的格式。
  - 每个实体包含多个\`attribute\`元素，每个属性有一个\`name\`和\`type\`（可选），还可以有其他特征（如是否为主键、是否唯一、是否可为空等）。
  
此外，属性不需要包含子属性

当你生成或修改一个实体的时候，需要用 lang 为 "xml:entitiy-update" 的代码块包裹起来，注意修改一个实体的时候需要输出完整的结构。
每一个 lang 为 xml:entitiy-update  代码块只能 包裹一个实体,且不含任何注释等额外信息。
当你需要生成多个实体时，需要用多个代码块包裹。
当你每次输出一个实体的结构时，都需要说明这个实体的设计思路或修改方案。
当你需要删除一个实体的时候需要用需要用 lang 为 xml:entitiy-delete 的代码块，其内容为对应实体的 id
当你产生一个需要修改一个实体的时候，特别要记住保持 id 的一致性
我每次在对话前会将当前所有的实体告诉你，你千万要根据当前的实体状态来回答问题
`



export class ErdConsoleChartServer extends WsRPCServer<WsRunConnection> {
    port = 6678

    state: ErdViewState
    console: ConsoleAiChat
    connect(id: string): WsConnection {
        return new WsRunConnection(id)
    }

    start() {
        createServer(this)
        this.console.start()
    }

    constructor() {
        super()
        this.state = new ErdViewState()
        const server = this
        this.console = new class extends ConsoleAiChat {
            history: DeepSeekMessage[] = [{role:'system',content:prompt}]
            context(): ChatMsgContext {
                return new ChatRespond(server.state)
            }
            beforeAskAi() {
                this.history.push({ role: 'system', content: server.promptState() })
            }
        }

        this.state.onNodeMove = (actionData) => {
            this.broadcast({
                method: 'dber/broadcastNodeRenderChanged',
                params: actionData
            })
        }
        this.state.onViewChanged = (actionData) => {
            this.broadcast({
                method: 'dber/broadcastViewChanged',
                params: actionData
            })
        }
        this.state.onEntityUpdate = (actionData) => {
            this.broadcast({
                method: 'dber/broadcastEntityUpdate',
                params: actionData
            })
        }
        this.state.onNodeInsert = (actionData) => {
            this.broadcast({
                method: 'dber/broadcastNodeInsert',
                params: actionData
            })
        }
        this.state.onNodeDelete = (actionData) => {
            this.broadcast({
                method: 'dber/broadcastNodeDelete',
                params: actionData
            })
        }
    }

    promptState() {
        if (this.state.nodes.length === 0) {
            return '当前没有任何一个实体'
        }

        else {
            let content = '\r\n'

            this.state.nodes.forEach((node) => {
                const entity = node.entity
                content = content + '```xml:entitiy-update \r\n'
                content = content +
                    `<entity name="${entity.name}" id="${entity.id}">\r\n`

                entity.fields.forEach(field => {
                    content = content + `  <attribute name="${field.name}" type="${field.type}"/>\r\n`
                })


                content = content + "</entity>\r\n"
                content = content + "```\r\n"
            })

            return `当前所有的实体如下：  ${content} `
        }
    }

    request(connection: WsConnection, name: string): RPCMethod | void {
        const list: RPCMethod[] = [{
            name: 'dber/nodeMove',
            params: ['data'],
            call: async (data: EntityRenderData) => {
                return this.nodeMove(data)
            }
        }, {
            name: 'dber/viewChanged',
            params: ['pos', 'zoom'],
            call: async (pos: { x: number, y: number }, zoom: number) => {
                return this.viewChanged({ pos, zoom })
            }
        }, {
            name: 'dber/fetchState',
            params: [],
            call: async () => {
                return this.fetchState()
            }
        }, {
            name: 'dber/checkUpdate',
            params: ['timestamp'],
            call: async (timestamp: number) => {
                return this.checkUpdate(timestamp)
            }
        }]

        return list.find(v => v.name === name)
    }

    fetchState() {
        return this.state.snapshot()
    }
    checkUpdate(timestamp: number) {
        return this.state.timestamp === timestamp
    }
    viewChanged(viewport: ViewPort) {
        return this.state.viewChanged(viewport)
    }
    nodeMove(data: EntityRenderData) {
        return this.state.moveNode(data)
    }

    respond(connection: WsConnection, id: string, error: any, result: any): void {

    }

    allSocket() {
        const connections = Array.from(this.all.values())
        const sockets = connections.map(v => this.socket.get(v))
            .filter(v => !!v)
        return sockets
    }

    broadcast(msg: RPCRequest) {
        log(`broadcast: connection(${this.allSocket().length})`)
        log(JSON.stringify(msg, null, 2))
        this.allSocket().forEach(socket => {
            socket.send(JSON.stringify({
                ...msg,
                jsonrpc: '2.0'
            }))
        })

    }

}





