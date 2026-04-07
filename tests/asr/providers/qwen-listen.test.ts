import { Buffer } from 'node:buffer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QwenASR } from '@/asr/providers/qwen.js';
import type { AudioStream } from '@/types/asr.js';

// --- DashScope 消息构建辅助函数 ---

function makeTaskStartedEvent(taskId: string): Buffer {
  return Buffer.from(
    JSON.stringify({
      header: { task_id: taskId, event: 'task-started' },
      payload: {},
    })
  );
}

function makeResultGeneratedEvent(
  taskId: string,
  text: string,
  options: { sentenceEnd?: boolean; startTime?: number; endTime?: number } = {}
): Buffer {
  return Buffer.from(
    JSON.stringify({
      header: { task_id: taskId, event: 'result-generated', task_status: 'Running' },
      payload: {
        output: {
          sentence: {
            text,
            confidence: 0.95,
            sentence_end: options.sentenceEnd ?? true,
            ...(options.startTime !== undefined ? { start_time: options.startTime } : {}),
            ...(options.endTime !== undefined ? { end_time: options.endTime } : {}),
          },
        },
      },
    })
  );
}

function makeTaskFinishedEvent(taskId: string): Buffer {
  return Buffer.from(
    JSON.stringify({
      header: { task_id: taskId, event: 'task-finished', task_status: 'Completed' },
      payload: { output: {}, usage: { duration: 1 } },
    })
  );
}

// --- Mock crypto for randomUUID ---

const FIXED_TASK_ID = 'fixed-task-id-for-testing';

vi.mock('node:crypto', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:crypto')>();
  return {
    ...actual,
    randomUUID: () => FIXED_TASK_ID,
  };
});

// --- Mock WebSocket ---

const { instances, shouldDelayOpen } = vi.hoisted(() => ({
  // biome-ignore lint/suspicious/noExplicitAny: test mock
  instances: [] as any[],
  shouldDelayOpen: { value: false },
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
      if (!shouldDelayOpen.value) {
        queueMicrotask(() => this.emit('open'));
      }
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

// ========== QwenASR connect() ==========

describe('QwenASR connect()', () => {
  beforeEach(() => {
    instances.length = 0;
    shouldDelayOpen.value = false;
  });
  afterEach(() => {
    instances.length = 0;
    shouldDelayOpen.value = false;
  });

  it('缺少 apiKey 应该抛错', async () => {
    const asr = new QwenASR({ apiKey: '' });
    await expect(asr.connect()).rejects.toThrow('apiKey is required');
  });

  it('应该创建 WebSocket 连接', async () => {
    const asr = new QwenASR({ apiKey: 'test-key' });
    const conn = await asr.connect();
    expect(instances.length).toBe(1);
    expect(conn).toBeDefined();
    expect(conn.state).toBe('connected');
  });

  it('连接超时应该抛错', async () => {
    shouldDelayOpen.value = true;
    const asr = new QwenASR({ apiKey: 'test-key' });

    vi.useFakeTimers();

    const p = asr.connect();
    // 防止 Node.js 在 try-catch 捕获前报告 unhandled rejection
    p.catch(() => {});

    // 先 flush 微任务让 ws 创建
    await vi.advanceTimersByTimeAsync(0);

    // 推进到超时
    await vi.advanceTimersByTimeAsync(10001);

    // 消费 rejection，避免 unhandled rejection
    try {
      await p;
    } catch (e) {
      expect((e as Error).message).toContain('Connection timed out');
    }

    vi.useRealTimers();
  });
});

// ========== QwenASR listenStream() ==========

describe('QwenASR listenStream()', () => {
  beforeEach(() => {
    instances.length = 0;
    shouldDelayOpen.value = false;
  });
  afterEach(() => {
    instances.length = 0;
  });

  it('缺少 apiKey 应该抛错', async () => {
    const asr = new QwenASR({ apiKey: '' });
    const audio = audioFrom(Buffer.from('x'));
    await expect(
      (async () => {
        for await (const _ of asr.listenStream(audio)) {
          void _;
        }
      })()
    ).rejects.toThrow('apiKey is required');
  });

  it('应该完成流式识别流程', async () => {
    const asr = new QwenASR({ apiKey: 'test-key' });
    const audio = audioFrom(Buffer.from('audio-chunk-1'));
    const gen = asr.listenStream(audio);

    // 用 for-await 触发 generator body 执行
    const collector = (async () => {
      // biome-ignore lint/suspicious/noExplicitAny: test mock
      const chunks: any[] = [];
      for await (const c of gen) chunks.push(c);
      return chunks;
    })();

    // 等待 ws 创建 + open
    await flush();
    const ws = getLastWs();

    // 等待 listenStreamOnConnection 启动 + run-task + waitForTaskStarted 注册 handler
    await flush();
    await flush();

    // 模拟 task-started
    ws.emit('message', makeTaskStartedEvent(FIXED_TASK_ID));
    await flush();

    // 模拟 result-generated 中间结果
    ws.emit(
      'message',
      makeResultGeneratedEvent(FIXED_TASK_ID, '你好', {
        sentenceEnd: false,
        startTime: 0,
        endTime: 500,
      })
    );

    // 模拟 result-generated 最终句子
    ws.emit(
      'message',
      makeResultGeneratedEvent(FIXED_TASK_ID, '你好世界', {
        sentenceEnd: true,
        startTime: 0,
        endTime: 1000,
      })
    );

    // 模拟 task-finished
    ws.emit('message', makeTaskFinishedEvent(FIXED_TASK_ID));
    await flush();

    const results = await collector;
    expect(results).toHaveLength(2);
    expect(results[0].text).toBe('你好');
    expect(results[0].isFinal).toBe(false);
    expect(results[0].segment).toBeDefined();
    expect(results[0].segment.start).toBe(0);
    expect(results[0].segment.end).toBe(500);
    expect(results[1].text).toBe('你好世界');
    expect(results[1].isFinal).toBe(true);
    expect(results[1].segment.start).toBe(0);
    expect(results[1].segment.end).toBe(1000);
  });
});

// ========== QwenASRConnection ==========

describe('QwenASRConnection 实例方法', () => {
  beforeEach(() => {
    instances.length = 0;
    shouldDelayOpen.value = false;
  });
  afterEach(() => {
    instances.length = 0;
  });

  async function makeConn() {
    const asr = new QwenASR({ apiKey: 'test-key' });
    return asr.connect();
  }

  it('listen(stream:true) 应该返回 AsyncIterable', async () => {
    const conn = await makeConn();
    const ws = getLastWs();
    const audio = audioFrom(Buffer.from('audio'));

    const iterable = conn.listen(audio, { stream: true });
    expect(typeof iterable[Symbol.asyncIterator]).toBe('function');

    const collector = (async () => {
      // biome-ignore lint/suspicious/noExplicitAny: test mock
      const chunks: any[] = [];
      for await (const c of iterable) chunks.push(c);
      return chunks;
    })();

    // 等待 listenStreamOnConnection 启动 + run-task + waitForTaskStarted
    await flush();
    await flush();
    await flush();
    await flush();

    // 模拟 task-started
    ws.emit('message', makeTaskStartedEvent(FIXED_TASK_ID));
    await flush();

    // 模拟结果
    ws.emit(
      'message',
      makeResultGeneratedEvent(FIXED_TASK_ID, '识别结果', {
        sentenceEnd: true,
        startTime: 0,
        endTime: 800,
      })
    );
    // 模拟 task-finished
    ws.emit('message', makeTaskFinishedEvent(FIXED_TASK_ID));
    await flush();

    const results = await collector;
    expect(results).toHaveLength(1);
    expect(results[0].text).toBe('识别结果');
    expect(results[0].isFinal).toBe(true);
  });

  it('close() 应该关闭连接', async () => {
    const conn = await makeConn();
    expect(conn.state).toBe('connected');
    conn.close();
    expect(conn.state).toBe('closed');
  });

  it('closed 状态下调用 listen 应该抛错', async () => {
    const conn = await makeConn();
    conn.close();
    expect(() => conn.listen(audioFrom(Buffer.from('x')))).toThrow('Connection is closed');
  });
});
