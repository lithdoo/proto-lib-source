


import Koa from 'koa'
import Router from 'koa-router'
import bodyParser from 'koa-bodyparser'
import cors from '@koa/cors'
import { AiChartStreamStore, AIChatDataStore } from './store'
import { PassThrough } from 'node:stream'

export class SimServer {

    app = new Koa()
    router = new Router()
    cors: any = null

    dealError() {
        return async (
            ctx: Koa.ParameterizedContext<Koa.DefaultState, Koa.DefaultContext, any>,
            next: Koa.Next
        )=>{
             try {
                await next();
            } catch (err:any) {
                // 设置响应状态码
                ctx.status = err.status || 500;
                // 返回错误信息
                ctx.body = {
                    message: err.message
                };
                // 触发应用的error事件，可以用于记录日志
                // ctx.app.emit('error', err, ctx);
            }
        }
    }

    listen(port: number) {
        if (this.cors) {
            this.app.use(cors(this.cors))
        }


        this.app.use(this.dealError());
        this.app.use(bodyParser())
        this.app.use(this.router.routes())
        this.app.use(this.router.allowedMethods());
        this.app.listen(port)
    }
}

type AIMsgEventListener = (id: string, type: "init" | 'chunk' | 'done', content: string) => void

export class AIMsgEventCenter implements AIMsgEvent {

    map: Map<string, AIMsgEventListener[]> = new Map()

    constructor(public store: AiChartStreamStore) {
        store.onMsgChunk = (...argus) => this.onChunkUpdate(...argus)
    }

    onChunkUpdate(msgId: string, content: string, done: boolean) {
        const listners = this.map.get(msgId) ?? []
        if (content) {
            listners.forEach(v => {
                v(msgId, 'chunk', content)
            })
        }

        if (done) {
            listners.forEach(v => {
                v(msgId, 'done', '')
            })
            this.map.delete(msgId)
        }
    }

    addListener(msgId: string, cb: AIMsgEventListener) {
        try {
            const isProcessing = this.store.isProcessing(msgId)
            const content = this.store.fetchMsgContent(msgId)
            if (!isProcessing) {
                cb(msgId, 'done', '')
            } else {
                cb(msgId, 'init', content)
                this.map.set(msgId, (this.map.get(msgId) ?? []).concat(cb))
            }
        } catch (e) {
            console.error(e)
            cb(msgId, 'done', '')
        }

    }
}


export interface AIMsgEvent {
    addListener(msgId: string, cb: AIMsgEventListener): void
}


export abstract class AIChatServer extends SimServer {
    abstract store: AIChatDataStore
    abstract msgEvent: AIMsgEvent


    constructor() {
        super()


        this.router.get('/ai/record/list', (ctx) => {
            console.log('/ai/record/list')
            const list = this.store.fetchRecordList()
            ctx.body = list
        })

        this.router.get('/ai/message/list/:recordId', (ctx) => {
            const recordId = ctx.params.recordId
            if (!recordId) throw new Error()
            const list = this.store.fetchRecordMessage(recordId)
            ctx.body = list
        })

        this.router.get('/ai/message/content/:msgId', (ctx) => {
            const msgId = ctx.params.msgId
            if (!msgId) throw new Error()
            const content = this.store.fetchMsgContent(msgId)
            ctx.body = content
        })


        this.router.get('/ai/message/content/sse/:msgId', (ctx) => {
            console.log('/ai/message/content/sse/:msgId')
            const msgId = ctx.params.msgId
            if (!msgId) throw new Error()
            // 设置SSE响应头
            ctx.set({
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                'Access-Control-Allow-Origin': '*'
            });
            const stream = new PassThrough()

            ctx.type = 'text/event-stream'
            ctx.body = stream

            this.msgEvent.addListener(msgId, (_id, type, content: string) => {
                const data = { type, content }
                try {
                    ctx.res.write(`data: ${JSON.stringify(data)}\n\n`)
                } catch (e) {
                    console.log(e)
                }
            })

            ctx.respond = false;
        })

    }




}







