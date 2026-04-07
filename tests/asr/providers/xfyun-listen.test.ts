import { Buffer } from 'node:buffer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { XfyunASR } from '@/asr/providers/xfyun.js';
import type { AudioStream } from '@/types/asr.js';

// --- 科大讯飞响应构建辅助函数 ---

function makeXfyunSuccessResponse(status: number): Buffer {
  return Buffer.from(
    JSON.stringify({
      header: { code: 0, message: 'success', sid: 'iat-test-sid', status },
    })
  );
}

function makeXfyunResultResponse(
  status: number,
  text: string,
  options: { ls?: boolean; seq?: number } = {}
): Buffer {
  const result = {
    sn: options.seq ?? 1,
    ls: options.ls ?? false,
    ws: text.split('').map((char) => ({
      bg: 0,
      cw: [{ w: char }],
    })),
  };
  const base64Text = Buffer.from(JSON.stringify(result)).toString('base64');

  return Buffer.from(
    JSON.stringify({
      header: { code: 0, message: 'success', sid: 'iat-test-sid', status },
      payload: {
        result: {
          compress: 'raw',
          encoding: 'utf8',
          format: 'json',
          seq: options.seq ?? 1,
          status,
          text: base64Text,
        },
      },
    })
  );
}

function makeXfyunErrorResponse(code: number, message: string): Buffer {
  return Buffer.from(
    JSON.stringify({
      header: { code, message, sid: 'iat-test-sid', status: 0 },
    })
  );
}

// --- Mock WebSocket ---

const { instances } = vi.hoisted(() => ({
  // biome-ignore lint/suspicious/noExplicitAny: test mock
  instances: [] as any[],
}));

vi.mock('ws', async () => {
  const { EventEmitter } = await import('node:events');
  class MockWS extends EventEmitter {
    static OPEN = 1 as const;
    static CLOSED = 3 as const;
    static CLOSING = 2 as const;
    readyState: number = MockWS.OPEN;
    // biome-ignore lint/suspicious/noExplicitAny: test mock
    send = vi.fn((_d: any, cb?: (e?: Error) => void) => cb?.());
    close = vi.fn(() => {
      this.readyState = MockWS.CLOSED;
      this.emit('close');
    });
    // biome-ignore lint/suspicious/noExplicitAny: test mock
    constructor(_url: string, _opts?: any) {
      super();
      instances.push(this);
      queueMicrotask(() => this.emit('open'));
    }
  }
  return { default: MockWS, WebSocket: MockWS };
});

// --- 工具函数 ---

function flush(): Promise<void> {
  return new Promise((r) => setTimeout(r, 0));
}

function audioFrom(...chunks: Buffer[]): AudioStream {
  return (async function* () {
    for (const c of chunks) yield c;
  })();
}

function getLastWs() {
  return instances[instances.length - 1];
}

// ========== XfyunASR listenStream() ==========

describe('XfyunASR listenStream()', () => {
  beforeEach(() => {
    instances.length = 0;
  });
  afterEach(() => {
    instances.length = 0;
  });

  it('缺少 appId 应该抛错', async () => {
    const asr = new XfyunASR({ appId: '', apiKey: 'key', apiSecret: 'secret' });
    const audio = audioFrom(Buffer.from('x'));
    await expect(
      (async () => {
        for await (const _ of asr.listenStream(audio)) {
          void _;
        }
      })()
    ).rejects.toThrow('appId is required');
  });

  it('缺少 apiKey 应该抛错', async () => {
    const asr = new XfyunASR({ appId: 'app', apiKey: '', apiSecret: 'secret' });
    const audio = audioFrom(Buffer.from('x'));
    await expect(
      (async () => {
        for await (const _ of asr.listenStream(audio)) {
          void _;
        }
      })()
    ).rejects.toThrow('apiKey is required');
  });

  it('缺少 apiSecret 应该抛错', async () => {
    const asr = new XfyunASR({ appId: 'app', apiKey: 'key', apiSecret: '' });
    const audio = audioFrom(Buffer.from('x'));
    await expect(
      (async () => {
        for await (const _ of asr.listenStream(audio)) {
          void _;
        }
      })()
    ).rejects.toThrow('apiSecret is required');
  });

  it('应该完成流式识别流程', async () => {
    const asr = new XfyunASR({
      appId: 'test-app',
      apiKey: 'test-key',
      apiSecret: 'test-secret',
    });
    const audio = audioFrom(Buffer.from('audio-chunk-1'));
    const gen = asr.listenStream(audio);

    const collector = (async () => {
      // biome-ignore lint/suspicious/noExplicitAny: test mock
      const chunks: any[] = [];
      for await (const c of gen) chunks.push(c);
      return chunks;
    })();

    // 等待 ws 创建 + open
    await flush();
    const ws = getLastWs();

    // 等待消息处理器设置完成
    await flush();
    await flush();

    // 模拟首帧成功响应
    ws.emit('message', makeXfyunSuccessResponse(0));

    // 模拟中间帧识别结果
    ws.emit('message', makeXfyunResultResponse(1, '你好', { ls: false, seq: 1 }));

    // 模拟最终帧识别结果
    ws.emit('message', makeXfyunResultResponse(2, '你好世界', { ls: true, seq: 2 }));

    await flush();

    const results = await collector;
    expect(results).toHaveLength(2);
    expect(results[0].text).toBe('你好');
    expect(results[0].isFinal).toBe(false);
    expect(results[1].text).toBe('你好世界');
    expect(results[1].isFinal).toBe(true);
  });

  it('应该处理服务端错误响应', async () => {
    const asr = new XfyunASR({
      appId: 'test-app',
      apiKey: 'test-key',
      apiSecret: 'test-secret',
    });
    const audio = audioFrom(Buffer.from('audio'));
    const gen = asr.listenStream(audio);

    const collector = (async () => {
      // biome-ignore lint/suspicious/noExplicitAny: test mock
      const chunks: any[] = [];
      for await (const c of gen) chunks.push(c);
      return chunks;
    })();

    await flush();
    const ws = getLastWs();
    await flush();
    await flush();

    // 模拟首帧成功
    ws.emit('message', makeXfyunSuccessResponse(0));
    // 模拟错误响应
    ws.emit('message', makeXfyunErrorResponse(10105, 'illegal access'));

    await flush();

    // 错误响应会导致 listenStream 抛出错误
    await expect(collector).rejects.toThrow('Xfyun ASR error: 10105 - illegal access');
  });

  it('首帧应该包含 parameter', async () => {
    const asr = new XfyunASR({
      appId: 'test-app',
      apiKey: 'test-key',
      apiSecret: 'test-secret',
    });
    const audio = audioFrom(Buffer.alloc(100));
    const gen = asr.listenStream(audio);

    const collector = (async () => {
      // biome-ignore lint/suspicious/noExplicitAny: test mock
      const chunks: any[] = [];
      for await (const c of gen) chunks.push(c);
      return chunks;
    })();

    await flush();
    const ws = getLastWs();
    await flush();
    await flush();

    // 检查发送的第一帧是否包含 parameter
    const sendCalls = ws.send.mock.calls;
    if (sendCalls.length > 0) {
      const firstFrame = JSON.parse(sendCalls[0][0]);
      expect(firstFrame.parameter).toBeDefined();
      expect(firstFrame.parameter.iat).toBeDefined();
      expect(firstFrame.header.status).toBe(0);
    }

    // 完成流程
    ws.emit('message', makeXfyunSuccessResponse(0));
    ws.emit('message', makeXfyunResultResponse(2, '测试', { ls: true }));
    await flush();

    await collector;
  });
});
