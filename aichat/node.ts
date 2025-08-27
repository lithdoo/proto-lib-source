import fetch from 'node-fetch';
import { createInterface } from 'readline';
import { DeepSeekMessage } from './base';
export * from './base'

export interface DeepSeekRequest {
  model: string;
  messages: DeepSeekMessage[];
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
}

export interface DeepSeekStreamResponse {
  id: string;
  object: 'chat.completion.chunk';
  created: number;
  model: string;
  choices: [
    {
      index: number;
      delta: {
        content?: string;
        role?: string;
      };
      finish_reason: string | null;
    }
  ];
}

export interface DeepSeekErrorResponse {
  error: {
    message: string;
    type: string;
    param?: string;
    code?: string;
  };
}

/**
 * 流式调用 DeepSeek API
 * @param apiKey DeepSeek API 密钥
 * @param request 请求参数
 * @param onChunk 处理每个数据块的回调函数
 * @param onComplete 完成时的回调函数
 * @param onError 错误处理回调函数
 */
export async function streamDeepSeekAPI(
  apiKey: string,
  request: DeepSeekRequest,
  onChunk: (chunk: DeepSeekStreamResponse) => void,
  onComplete: () => void,
  onError: (error: Error) => void
): Promise<void> {
  // 确保启用流式传输
  const requestWithStream: DeepSeekRequest = {
    ...request,
    stream: true
  };

  try {
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(requestWithStream)
    });

    if (!response.ok) {
      let errorMessage = `API 请求失败: ${response.status} ${response.statusText}`;
      
      try {
        const errorData = await response.json() as DeepSeekErrorResponse;
        errorMessage += ` - ${errorData.error.message}`;
      } catch (e) {
        // 无法解析错误响应
      }
      
      throw new Error(errorMessage);
    }

    if (!response.body) {
      throw new Error('响应不包含可读取的流');
    }

    // 直接使用响应流，不进行转换
    const rl = createInterface({
      input: response.body,  // 直接使用 node-fetch 返回的流
      crlfDelay: Infinity,
      terminal: false
    });

    rl.on('line', (line) => {
      const trimmedLine = line.trim();
      if (!trimmedLine) return;
      
      if (trimmedLine.startsWith('data:')) {
        const data = trimmedLine.slice(5).trim();
        
        // 检查流结束标记
        if (data === '[DONE]') {
          rl.close();
          onComplete();
          return;
        }
        
        try {
          const json = JSON.parse(data) as DeepSeekStreamResponse;
          onChunk(json);
        } catch (e) {
          onError(new Error(`解析响应失败: ${(e as Error).message}, 数据: ${data}`));
        }
      }
    });

    rl.on('close', () => {
      onComplete();
    });

    rl.on('error', (error) => {
      onError(error);
    });

    // 监听流的错误事件
    response.body.on('error', (error) => {
      onError(error);
    });

  } catch (e) {
    onError(e as Error);
  }
}


