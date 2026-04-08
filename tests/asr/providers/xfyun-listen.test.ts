import { Buffer } from 'node:buffer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { XfyunASR } from '@/asr/providers/xfyun.js';
import type { AudioStream } from '@/types/asr.js';

// --- 科大讯飞 v2 响应构建辅助函数 ---

function makeXfyunSuccessResponse(status: number): Buffer {
  return Buffer.from(
    JSON.stringify({
      code: 0,
      message: 'success',
      sid: 'iat-test-sid',
      data: { status },
    })
  );
}

function makeXfyunResultResponse(
  status: number,
  text: string,
  options: { ls?: boolean; sn?: number; pgs?: string; rg?: [number, number] } = {}
): Buffer {
  const result = {
    sn: options.sn ?? 1,
    ls: options.ls ?? false,
    bg: 0,
    ed: 0,
    ...(options.pgs ? { pgs: options.pgs } : {}),
    ...(options.rg ? { rg: options.rg } : {}),
    ws: text.split('').map((char) => ({
      bg: 0,
      cw: [{ w: char }],
    })),
  };

  return Buffer.from(
    JSON.stringify({
      code: 0,
      message: 'success',
      sid: 'iat-test-sid',
      data: {
        status,
        result,
      },
    })
  );
}

function makeXfyunErrorResponse(code: number, message: string): Buffer {
  return Buffer.from(
    JSON.stringify({
      code,
      message,
      sid: 'iat-test-sid',
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
    ws.emit('message', makeXfyunResultResponse(1, '你好', { ls: false, sn: 1 }));

    // 模拟最终帧识别结果
    ws.emit('message', makeXfyunResultResponse(2, '你好世界', { ls: true, sn: 2 }));

    await flush();

    const results = await collector;
    expect(results).toHaveLength(2);
    // 累积文本：sn=1 时为 "你好"，sn=2 时累积为 "你好你好世界"
    expect(results[0].text).toBe('你好');
    expect(results[0].isFinal).toBe(false);
    expect(results[1].text).toBe('你好你好世界');
    expect(results[1].isFinal).toBe(true);
  });

  it('应该处理服务端错误响应', async () => {
    const asr = new XfyunASR({
      appId: 'test-app',
      apiKey: 'test-key',
      apiSecret: 'test-secret',
      sendInterval: 40,
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

  it('首帧应该包含 common 和 business', async () => {
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

    // 检查发送的第一帧是否包含 common 和 business
    const sendCalls = ws.send.mock.calls;
    if (sendCalls.length > 0) {
      const firstFrame = JSON.parse(sendCalls[0][0]);
      expect(firstFrame.common).toBeDefined();
      expect(firstFrame.common.app_id).toBe('test-app');
      expect(firstFrame.business).toBeDefined();
      expect(firstFrame.business.domain).toBe('iat');
      expect(firstFrame.data.status).toBe(0);
    }

    // 完成流程
    ws.emit('message', makeXfyunSuccessResponse(0));
    ws.emit('message', makeXfyunResultResponse(2, '测试', { ls: true }));
    await flush();

    await collector;
  });

  it('应该正确处理动态修正结果（pgs=rpl 时替换旧结果）', async () => {
    const asr = new XfyunASR({
      appId: 'test-app',
      apiKey: 'test-key',
      apiSecret: 'test-secret',
      dwa: 'wpgs',
    });
    const audio = audioFrom(Buffer.from('audio-chunk-1'));
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

    // 模拟首帧成功响应
    ws.emit('message', makeXfyunSuccessResponse(0));

    // sn=1: 中间结果 "你好"
    ws.emit('message', makeXfyunResultResponse(1, '你好', { ls: false, sn: 1 }));

    // sn=2: 中间结果 "世" (累积: "你好世")
    ws.emit('message', makeXfyunResultResponse(1, '世', { ls: false, sn: 2 }));

    // sn=1: 动态修正 pgs=rpl, rg=[1,2]，清除 sn 1~2 的旧结果
    // 替换后 iatResult: [null, "今天", null]，累积为 "今天"
    ws.emit(
      'message',
      makeXfyunResultResponse(1, '今天', { ls: false, sn: 1, pgs: 'rpl', rg: [1, 2] })
    );

    // sn=3: 最终结果 "天气真好" (累积: "今天天气真好")
    ws.emit('message', makeXfyunResultResponse(2, '天气真好', { ls: true, sn: 3 }));

    await flush();

    const results = await collector;
    expect(results).toHaveLength(4);

    // sn=1: "你好"
    expect(results[0].text).toBe('你好');
    expect(results[0].isFinal).toBe(false);

    // sn=2: "你好世" (累积)
    expect(results[1].text).toBe('你好世');
    expect(results[1].isFinal).toBe(false);

    // sn=1(rpl): "今天" (rg=[1,2] 清除了 sn=1 和 sn=2 的旧结果)
    expect(results[2].text).toBe('今天');
    expect(results[2].isFinal).toBe(false);

    // sn=3: "今天天气真好" (最终累积)
    expect(results[3].text).toBe('今天天气真好');
    expect(results[3].isFinal).toBe(true);
  });
});
