/**
 * 跨环境 WebSocket 客户端模块
 * 支持浏览器原生 WebSocket 和 Node.js (ws 库)
 */

// 定义统一的 WebSocket 接口，抽象两种环境的差异
export interface CrossEnvWebSocket {
  send(data: string | ArrayBufferLike | Blob | ArrayBufferView): void;
  close(code?: number, reason?: string): void;
  onopen: ((event: Event | { type: 'open' }) => void) | null;
  onmessage: ((event: { data: string | Buffer; type: 'message' }) => void) | null;
  onerror: ((event: Error | { type: 'error'; error: Error }) => void) | null;
  onclose: ((event: { type: 'close'; code: number; reason: string }) => void) | null;
  raw(): WebSocket
}

// 检测当前环境
const isBrowser = typeof window !== 'undefined' && typeof window.WebSocket !== 'undefined';

/**
 * 创建跨环境的 WebSocket 连接
 * @param url WebSocket 服务器地址
 * @returns 统一接口的 WebSocket 实例
 */
export async function createWebSocket(url: string): Promise<CrossEnvWebSocket> {
  if (isBrowser) {
    // 浏览器环境：使用原生 WebSocket
    return new Promise((resolve) => {
      const ws = new window.WebSocket(url);
      // 包装原生 WebSocket 以适配统一接口
      const wrapper: CrossEnvWebSocket = {
        send: (data) => ws.send(data),
        close: (code?, reason?) => ws.close(code, reason),
        raw: () => ws as any,
        onopen: null,
        onmessage: null,
        onerror: null,
        onclose: null,
      };

      ws.onopen = (event) => {
        if (wrapper.onopen) wrapper.onopen(event);
        resolve(wrapper);
      };

      ws.onmessage = (event) => {
        if (wrapper.onmessage) wrapper.onmessage({ data: event.data, type: 'message' });
      };

      ws.onerror = (event) => {
        if (wrapper.onerror) wrapper.onerror(event as unknown as Error);
      };

      ws.onclose = (event) => {
        if (wrapper.onclose) {
          wrapper.onclose({
            type: 'close',
            code: event.code,
            reason: event.reason
          });
        }
      };
    });
  } else {
    // Node.js 环境：使用 ws 库
    try {
      // 动态导入 ws 模块，避免浏览器环境打包时包含
      const { WebSocket } = await import('ws');

      return new Promise((resolve) => {
        const ws = new WebSocket(url);

        // 包装 ws 实例以适配统一接口
        const wrapper: CrossEnvWebSocket = {
          raw: () => ws as any,
          send: (data) => {
            if (typeof data === 'string') {
              ws.send(data);
            } else if (data instanceof Blob) {
              // 处理 Blob 类型（Node.js 中需要转换为 Buffer）
              const reader = new FileReader();
              reader.onload = () => {
                if (reader.result instanceof ArrayBuffer) {
                  ws.send(Buffer.from(reader.result));
                }
              };
              reader.readAsArrayBuffer(data);
            } else {
              ws.send(Buffer.from(data as any));
            }
          },
          close: (code?, reason?) => ws.close(code, reason),
          onopen: null,
          onmessage: null,
          onerror: null,
          onclose: null,
        };

        ws.on('open', (event: any) => {
          if (wrapper.onopen) wrapper.onopen(event);
          resolve(wrapper);
        });

        ws.on('message', (data) => {
          if (wrapper.onmessage) {
            wrapper.onmessage({ data: data.toString(), type: 'message' });
          }
        });

        ws.on('error', (error) => {
          if (wrapper.onerror) wrapper.onerror({ type: 'error', error });
        });

        ws.on('close', (code, reason) => {
          if (wrapper.onclose) {
            wrapper.onclose({ type: 'close', code, reason: reason.toString() });
          }
        });
      });
    } catch (error) {
      throw new Error('在 Node.js 环境中使用需安装 ws 库: npm install ws');
    }
  }
}

/**
 * 示例：使用跨环境 WebSocket 客户端
 */
export async function exampleUsage() {
  try {
    const ws = await createWebSocket('wss://echo.websocket.events');

    ws.onopen = () => {
      console.log('连接已建立');
      ws.send('Hello, WebSocket!');
    };

    ws.onmessage = (event) => {
      console.log('收到消息:', event.data);
      ws.close();
    };

    ws.onerror = (event) => {
      console.error('发生错误:', event);
    };

    ws.onclose = (event) => {
      console.log(`连接已关闭: ${event.code} ${event.reason}`);
    };
  } catch (error) {
    console.error('创建 WebSocket 失败:', error);
  }
}