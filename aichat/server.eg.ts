import { v4 } from "uuid";
import { AIConversationBase, ChatMsgContext } from "./conversation";
import { AIChatServer, AIMsgEventCenter } from "./server";
import { AIChatStreamFileStore } from "./store";
import path from 'node:path'
import { DeepSeekStreamResponse } from "./node";

const store = new AIChatStreamFileStore(
    path.resolve(__dirname, '../../data-store/.aichat_data')
)

const event = new AIMsgEventCenter(store)


class Conversation extends AIConversationBase {
    store = store

    context(): ChatMsgContext {
        const msgId = v4()
        const conversation = this

        this.appendMsg({
            msgId: msgId,
            role: 'assistant',
            unfinished: true,
            visiableInClient: true,
        }, '')

        return new class {
            chunk(chunk: DeepSeekStreamResponse) {
                const content = chunk.choices[0].delta.content;
                if (!content) return
                conversation.store.loadChunk(msgId, content)
                process.stdout.write(content); // 实时输出
            }
            complete() {
                conversation.store.finishMessage(msgId, conversation.record.recordId)
            }
            error(e: Error) {
                conversation.store.finishMessage(msgId, conversation.record.recordId)
            }
        }
    }

    beforeAskAi(): void {

    }

    userAsk(conetnt: string) {
        this.appendMsg({
            msgId: v4(),
            role: 'user',
            visiableInClient: true,
        }, conetnt)
        this.askAI()

    }
}


const server = new class extends AIChatServer {
    store = store
    msgEvent = event
    constructor() {
        super()
        // 处理POST请求，解析JSON参数
        this.router.post('/ai/chat', async (ctx) => {
            try {
                // 解析后的JSON数据会存放在ctx.request.body中
                const requestData = ctx.request.body as {
                    recordId?: string,
                    content: string
                }

                // 验证请求体是否存在
                if (!requestData || !requestData.content?.trim()) {
                    ctx.status = 400;
                    ctx.body = {
                        success: false,
                        message: '请求体不能为空'
                    };
                    return;
                }

                const recordId = requestData.recordId
                const content = requestData.content
                const record = store.fetchRecordList().find(v => v.recordId === recordId)
                    ?? {
                    recordId: recordId ?? v4(),
                    createTimestamp: new Date().getTime(),
                    updateTimestamp: new Date().getTime(),
                    title: content.length < 18 ? content : (content.slice(0, 15) + '...')
                }
                record.updateTimestamp = new Date().getTime()
                store.updateRecord(record)
                const conversation = new Conversation(record)
                conversation.userAsk(content)


                // 业务逻辑处理（示例：返回接收到的数据）
                ctx.status = 200;
                ctx.body = {
                    recordId: record.recordId
                };

            } catch (error: any) {
                // 错误处理
                console.error(error)
                ctx.status = 500;
                ctx.body = {
                    success: false,
                    message: '服务器处理错误',
                    error: error.message
                };
            }
        });
    }
}



server.listen(7890)
