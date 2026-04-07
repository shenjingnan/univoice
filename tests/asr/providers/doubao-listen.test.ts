import { Buffer } from 'node:buffer';
import { gzipSync } from 'node:zlib';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DoubaoASR } from '@/asr/providers/doubao.js';
import type { AudioStream } from '@/types/asr.js';

// --- SAUC 协议常量 ---

const SAUC_V1 = 0b0001;
const SAUC_SERVER_FULL = 0b1001;
const SAUC_SERVER_ERROR = 0b1111;
const SAUC_JSON = 0b0001;
const SAUC_GZIP = 0b0001;

// --- SAUC 响应构建 ---

function buildSaucResponse(payload: object, isLast = false, sequence = 1): Buffer {
  const flags = isLast ? 0b0011 : 0b0001;
  const header = Buffer.alloc(4);
  header[0] = (SAUC_V1 << 4) | 0b0001;
  header[1] = (SAUC_SERVER_FULL << 4) | flags;
  header[2] = (SAUC_JSON << 4) | SAUC_GZIP;
  header[3] = 0x00;

  const seqBuf = Buffer.alloc(4);
  seqBuf.writeInt32BE(isLast ? -sequence : sequence, 0);

  const payloadBytes = Buffer.from(JSON.stringify(payload), 'utf-8');
  const compressed = gzipSync(payloadBytes);
  const sizeBuf = Buffer.alloc(4);
  sizeBuf.writeUInt32BE(compressed.length, 0);

  return Buffer.concat([header, seqBuf, sizeBuf, compressed]);
}

function buildSaucErrorResponse(code: number, message: string): Buffer {
  const header = Buffer.alloc(4);
  header[0] = (SAUC_V1 << 4) | 0b0001;
  header[1] = (SAUC_SERVER_ERROR << 4) | 0b0000;
  header[2] = (SAUC_JSON << 4) | SAUC_GZIP;
  header[3] = 0x00;

  const payloadBytes = Buffer.from(JSON.stringify({ message }), 'utf-8');
  const compressed = gzipSync(payloadBytes);
  const codeBuf = Buffer.alloc(4);
  codeBuf.writeInt32BE(code, 0);
  const sizeBuf = Buffer.alloc(4);
  sizeBuf.writeUInt32BE(compressed.length, 0);

  return Buffer.concat([header, codeBuf, sizeBuf, compressed]);
}

// --- Mock WebSocket ---

// biome-ignore lint/suspicious/noExplicitAny: test mock
const { instances } = vi.hoisted(() => ({ instances: [] as any[] }));

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

// ========== DoubaoASR connect() ==========

describe('DoubaoASR connect()', () => {
  beforeEach(() => {
    instances.length = 0;
  });
  afterEach(() => {
    instances.length = 0;
  });

  it('缺少 appKey 应该抛错', async () => {
    const asr = new DoubaoASR({ accessKey: 'a' });
    await expect(asr.connect()).rejects.toThrow('appKey is required');
  });

  it('缺少 accessKey 应该抛错', async () => {
    const asr = new DoubaoASR({ appKey: 'a' });
    await expect(asr.connect()).rejects.toThrow('accessKey is required');
  });

  it('应该创建 WebSocket 并完成握手', async () => {
    const asr = new DoubaoASR({ appKey: 'k', accessKey: 's' });
    const p = asr.connect();
    await flush();
    const ws = getLastWs();
    ws.emit('message', buildSaucResponse({ code_msg: 'success' }, false, 1));
    const conn = await p;
    expect(conn).toBeDefined();
    expect(conn.state).toBe('connected');
  });

  it('init response 非0 code 应该抛错', async () => {
    const asr = new DoubaoASR({ appKey: 'k', accessKey: 's' });
    const p = asr.connect();
    await flush();
    getLastWs().emit('message', buildSaucErrorResponse(45000001, 'err'));
    await expect(p).rejects.toThrow();
  });
});

// ========== DoubaoASR listenStream() ==========

describe('DoubaoASR listenStream()', () => {
  beforeEach(() => {
    instances.length = 0;
  });
  afterEach(() => {
    instances.length = 0;
  });

  it('缺少 appKey 应该抛错', async () => {
    const asr = new DoubaoASR({ accessKey: 'a' });
    const audio = audioFrom(Buffer.from('x'));
    await expect(
      (async () => {
        for await (const _ of asr.listenStream(audio)) {
          void _;
        }
      })()
    ).rejects.toThrow('appKey is required');
  });

  it('缺少 accessKey 应该抛错', async () => {
    const asr = new DoubaoASR({ appKey: 'a' });
    const audio = audioFrom(Buffer.from('x'));
    await expect(
      (async () => {
        for await (const _ of asr.listenStream(audio)) {
          void _;
        }
      })()
    ).rejects.toThrow('accessKey is required');
  });

  it('应该完成流式识别流程', async () => {
    const asr = new DoubaoASR({ appKey: 'k', accessKey: 's' });
    const audio = audioFrom(Buffer.from('audio-chunk-1'));
    const gen = asr.listenStream(audio);

    // 触发 generator body 开始执行（for-await 驱动）
    const collector = (async () => {
      // biome-ignore lint/suspicious/noExplicitAny: test mock
      const chunks: any[] = [];
      for await (const c of gen) chunks.push(c);
      return chunks;
    })();

    // 等待 ws 创建并 open
    await flush();
    const ws = getLastWs();

    // 模拟 init response
    ws.emit('message', buildSaucResponse({ code_msg: 'ok' }, false, 1));
    await flush();

    // 中间结果
    ws.emit(
      'message',
      buildSaucResponse(
        {
          result: {
            text: '你好',
            utterances: [{ text: '你好', start_time: 0, end_time: 500, definite: false }],
          },
        },
        false,
        2
      )
    );

    // 最终结果
    ws.emit(
      'message',
      buildSaucResponse(
        {
          result: {
            text: '你好世界',
            utterances: [{ text: '你好世界', start_time: 0, end_time: 1000, definite: true }],
          },
        },
        true,
        3
      )
    );
    await flush();

    const results = await collector;
    expect(results).toHaveLength(2);
    expect(results[0].text).toBe('你好');
    expect(results[0].isFinal).toBe(false);
    expect(results[0].segment.text).toBe('你好');
    expect(results[1].text).toBe('你好世界');
    expect(results[1].isFinal).toBe(true);
  });
});

// ========== DoubaoASRConnection ==========

describe('DoubaoASRConnection 实例方法', () => {
  beforeEach(() => {
    instances.length = 0;
  });
  afterEach(() => {
    instances.length = 0;
  });

  async function makeConn() {
    const asr = new DoubaoASR({ appKey: 'k', accessKey: 's' });
    const p = asr.connect();
    await flush();
    getLastWs().emit('message', buildSaucResponse({ ok: true }, false, 1));
    return p;
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

    await flush();
    await flush();

    // 中间结果
    ws.emit('message', buildSaucResponse({ result: { text: '测试' } }, false, 2));
    // 最终结果
    ws.emit('message', buildSaucResponse({ result: { text: '测试完成' } }, true, 3));
    await flush();

    const results = await collector;
    expect(results).toHaveLength(2);
    expect(results[0].text).toBe('测试');
    expect(results[1].text).toBe('测试完成');
    expect(results[1].isFinal).toBe(true);
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

  it('不支持文件路径输入', async () => {
    const conn = await makeConn();
    expect(() => conn.listen('/path/to/file.wav')).toThrow(
      'DoubaoASR connection does not support file path input'
    );
  });
});
