
// 定义 DeepSeek API 请求和响应的类型
export interface DeepSeekMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface AIChatMessage {
    msgId: string,
    role: DeepSeekMessage['role']
    visiableInClient: boolean
    unfinished?: boolean,
    error?: string
    // content(): Promise<string>
}


export interface AIChatRecord {
    recordId: string
    createTimestamp: number,
    updateTimestamp: number,
    title: string
}