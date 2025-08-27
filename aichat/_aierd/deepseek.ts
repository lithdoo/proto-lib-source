import fetch from 'node-fetch';
import { createInterface } from 'readline';
import { input } from '@inquirer/prompts';

// 定义 DeepSeek API 请求和响应的类型
export interface DeepSeekMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

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




// // 示例用法
// async function main() {
//   // 从环境变量获取 API 密钥，或直接替换为你的密钥
//   const apiKey = process.env.DEEPSEEK_API_KEY || 'sk-5069284b93a7481db08a15f65628906a';

//   if (apiKey === 'your-api-key-here') {
//     console.error('请设置 DEPPSEEK_API_KEY 环境变量或替换代码中的 API 密钥');
//     process.exit(1);
//   }

//   const request: DeepSeekRequest = {
//     model: 'deepseek-chat', // 可以替换为其他可用模型
//     messages: [
//       { role: 'system', content: '你是一个 helpful 的助手' },
//       { role: 'user', content: '请解释一下什么是人工智能？用简单的语言，分点说明。' }
//     ],
//     temperature: 0.7,
//     max_tokens: 500
//   };

//   console.log('正在发送请求到 DeepSeek API...');
//   console.log('响应内容:');

//   let fullResponse = '';

//   await streamDeepSeekAPI(
//     apiKey,
//     request,
//     (chunk) => {
//       // 处理每个数据块
//       const content = chunk.choices[0].delta.content;
//       if (content) {
//         process.stdout.write(content); // 实时输出
//         fullResponse += content;
//       }
//     },
//     () => {
//       console.log('\n\n流式响应已完成');
//     },
//     (error) => {
//       console.error('\n发生错误:', error.message);
//     }
//   );
// }

// // 运行示例
// main().catch(console.error);
