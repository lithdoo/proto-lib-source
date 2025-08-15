import { DeepSeekMessage, DeepSeekRequest, DeepSeekStreamResponse, streamDeepSeekAPI } from "./node"
import { input } from '@inquirer/prompts'



export interface ChatMsgContext {
    chunk(chunk: DeepSeekStreamResponse): void
    complete():void
    error(e:Error):void
}

export abstract class ConsoleAiChat {
    history: DeepSeekMessage[] = []
    apiKey = process.env.DEEPSEEK_API_KEY || 'sk-5069284b93a7481db08a15f65628906a'
    async start() {
        while (true) {
            await this.userInput()
            await this.askAi()
        }
    }
    async userInput() {
        let content = ''

        while (!content) {
            content = (await input({
                message: '请输入你的问题',
            }))?.trim();
        }

        this.history.push({ role: 'user', content })
    }

    abstract context(): ChatMsgContext
    abstract beforeAskAi?(): void
    async askAi() {
        this.beforeAskAi?.()
        const request: DeepSeekRequest = {
            model: 'deepseek-reasoner', // 可以替换为其他可用模型
            messages: this.history,
            temperature: 0.7,
            max_tokens: 5000
        };


        return new Promise(async (res, rej) => {
            let fullResponse = '';
            const context = this.context()
            await streamDeepSeekAPI(
                this.apiKey,
                request,
                (chunk) => {
                    context.chunk(chunk)
                },
                () => {
                    console.log('\n\n流式响应已完成');
                    this.history.push({
                        role: 'assistant', content: fullResponse
                    })
                    context.complete()
                    res(null)
                },
                (error) => {
                    console.error('\n发生错误:', error.message);
                    context.error(error)
                    rej(error)
                }
            );
        })
    }
};
