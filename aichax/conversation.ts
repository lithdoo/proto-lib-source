import { AIChatMessage, AIChatRecord, DeepSeekMessage } from "./base"
import { DeepSeekRequest, DeepSeekStreamResponse, streamDeepSeekAPI } from "./node"
import { AIChatDataStore  } from "./store"




export interface ChatMsgContext {
    chunk(chunk: DeepSeekStreamResponse): void
    complete(): void
    error(e: Error): void
}



export abstract class AIConversationBase {
    abstract store: AIChatDataStore
    constructor(public record: AIChatRecord) { }

    history() {
        const msgList = this.store.fetchRecordMessage(this.record.recordId)
        return msgList.map<DeepSeekMessage>(v => ({
            role: v.role,
            content: this.store.fetchMsgContent(v.msgId),
        })).reverse()
    }

    abstract context(): ChatMsgContext
    abstract beforeAskAi?(): void

    appendMsg(msg: AIChatMessage, content: string) {
        const msgList = this.store.fetchRecordMessage(this.record.recordId)
        if (msgList.find(v => v.msgId === msg.msgId)) {
            throw new Error()
        }
        this.store.updateRecordMessage(this.record.recordId,msg)
        this.store.updateMsgContent(msg.msgId,content)
    }

    askAI() {
        this.beforeAskAi?.()
        const request: DeepSeekRequest = {
            model: 'deepseek-reasoner', // 可以替换为其他可用模型
            messages: this.history(),
            temperature: 0.7,
            max_tokens: 5000
        };
        console.log('start deepseek')
        return new Promise(async (res, rej) => {
            const context = this.context()
            await streamDeepSeekAPI(
                'sk-5069284b93a7481db08a15f65628906a',
                request,
                (chunk) => {
                    context.chunk(chunk)
                },
                () => {
                    context.complete()
                    res(null)
                },
                (error) => {
                    context.error(error)
                    res(null)
                }
            );
        })
    }

}