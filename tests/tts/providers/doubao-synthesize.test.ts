import { Buffer } from 'node:buffer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// --- Mock WebSocket ---

const { instances, getLastInstance, resetInstances } = vi.hoisted(() => {
  // biome-ignore lint/suspicious/noExplicitAny: test mock
  const arr: any[] = [];
  return {
    instances: arr,
    getLastInstance: () => arr[arr.length - 1],
    resetInstances: () => {
      arr.length = 0;
    },
  };
});

vi.mock('ws', async () => {
  const { EventEmitter } = await import('node:events');

  class MockWebSocket extends EventEmitter {
    static OPEN = 1;
    static CLOSED = 3;
    static CLOSING = 2;

    readyState = 1; // OPEN
    // biome-ignore lint/suspicious/noExplicitAny: test mock
    send = vi.fn((_data: any, callback?: (error?: Error) => void) => {
      if (typeof callback === 'function') {
        callback();
      }
    });
    close = vi.fn(() => {
      this.readyState = 3; // CLOSED
    });

    // biome-ignore lint/suspicious/noExplicitAny: test mock
    constructor(_url: string, _options?: any) {
      super();
      instances.push(this);
    }
  }
  return { default: MockWebSocket, WebSocket: MockWebSocket };
});

// --- 被测模块（放在 vi.mock 之后） ---

import { DoubaoTTS } from '@/tts/providers/doubao.js';
import type { DoubaoTTSOptions } from '@/types/tts.js';

// --- volcengine 协议常量（内联，避免 vi.hoisted 提升导致的循环依赖问题） ---

const EVENT_CONNECTION_STARTED = 50;
const EVENT_SESSION_STARTED = 150;
const EVENT_SESSION_FINISHED = 152;
const EVENT_CONNECTION_FINISHED = 52;

// --- 协议消息构建 ---

/**
 * 构建 volcengine FullServerResponse 消息
 * 必须手动构建，因为 marshalMessage/unmarshalMessage 对 connectId 的处理不对称
 */
function makeServerEvent(eventType: number, payload: object = {}, sessionId?: string): Buffer {
  const parts: Buffer[] = [];
  const needsConnectId =
    eventType === EVENT_CONNECTION_STARTED ||
    eventType === 51 || // ConnectionFailed
    eventType === EVENT_CONNECTION_FINISHED;

  // 基础头 (4 bytes)
  const header = Buffer.alloc(4);
  header[0] = (0b0001 << 4) | 0b0001; // version=1, headerSize=1 (4 bytes)
  header[1] = (0b1001 << 4) | 0b100; // FullServerResponse + WithEvent
  header[2] = (0b0001 << 4) | 0b0000; // JSON + None
  header[3] = 0x00;
  parts.push(header);

  // Event (4 bytes)
  const eventBuf = Buffer.alloc(4);
  eventBuf.writeInt32BE(eventType, 0);
  parts.push(eventBuf);

  // Session ID (4 bytes length + data)
  if (sessionId) {
    const sidBytes = Buffer.from(sessionId, 'utf8');
    const sidLen = Buffer.alloc(4);
    sidLen.writeUInt32BE(sidBytes.length, 0);
    parts.push(sidLen, sidBytes);
  } else {
    const sidLen = Buffer.alloc(4);
    sidLen.writeUInt32BE(0, 0);
    parts.push(sidLen);
  }

  // Connect ID (4 bytes length + data) - 仅 Connection 级别事件需要
  if (needsConnectId) {
    const cidLen = Buffer.alloc(4);
    cidLen.writeUInt32BE(0, 0);
    parts.push(cidLen);
  }

  // Payload (4 bytes length + data)
  const payloadBytes = Buffer.from(JSON.stringify(payload), 'utf8');
  const sizeBuf = Buffer.alloc(4);
  sizeBuf.writeUInt32BE(payloadBytes.length, 0);
  parts.push(sizeBuf, payloadBytes);

  return Buffer.concat(parts);
}

function makeAudioChunk(data: Uint8Array): Buffer {
  const parts: Buffer[] = [];

  // 基础头 (4 bytes)
  const header = Buffer.alloc(4);
  header[0] = (0b0001 << 4) | 0b0001; // version=1, headerSize=1 (4 bytes)
  header[1] = (0b1011 << 4) | 0b00; // AudioOnlyServer + NoSeq
  header[2] = (0b0001 << 4) | 0b0000; // JSON + None
  header[3] = 0x00;
  parts.push(header);

  // Payload (4 bytes length + data)
  const sizeBuf = Buffer.alloc(4);
  sizeBuf.writeUInt32BE(data.length, 0);
  parts.push(sizeBuf, Buffer.from(data));

  return Buffer.concat(parts);
}

// --- 工具函数 ---

function flush() {
  return new Promise((r) => setTimeout(r, 0));
}

function createProvider(opts?: Partial<DoubaoTTSOptions>): DoubaoTTS {
  return new DoubaoTTS({
    appId: 'test-app-id',
    accessToken: 'test-access-token',
    apiKey: 'test-key',
    ...opts,
  });
}

// --- 测试 ---

describe('DoubaoTTS connect()', () => {
  beforeEach(() => {
    resetInstances();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('缺少 appId 应该抛错', async () => {
    const tts = createProvider({ appId: '' });
    await expect(tts.connect()).rejects.toThrow('appId is required');
  });

  it('缺少 accessToken 应该抛错', async () => {
    const tts = createProvider({ accessToken: '' });
    await expect(tts.connect()).rejects.toThrow('accessToken is required');
  });

  it('应该创建 WebSocket 并完成连接握手（open → ConnectionStarted）', async () => {
    const tts = createProvider();
    const connectPromise = tts.connect();

    await flush();
    const ws = getLastInstance();
    expect(ws).toBeDefined();

    // 触发 open 事件
    ws.emit('open');
    await flush();

    // startConnection 发送后，需要回复 ConnectionStarted 事件
    ws.emit('message', makeServerEvent(EVENT_CONNECTION_STARTED));
    await flush();

    const conn = await connectPromise;
    expect(conn).toBeDefined();
    expect(conn.state).toBe('connected');
  });

  it('连接超时应该抛错', async () => {
    const tts = createProvider();
    const connectPromise = tts.connect({ timeout: 50 });

    // 不触发 open，等待超时
    await expect(connectPromise).rejects.toThrow('Connection timed out');
  });

  it('连接错误应该抛错', async () => {
    const tts = createProvider();
    const connectPromise = tts.connect();

    await flush();
    const ws = getLastInstance();

    ws.emit('error', new Error('connection refused'));
    await expect(connectPromise).rejects.toThrow('connection refused');
  });
});

describe('DoubaoTTS synthesize()', () => {
  beforeEach(() => {
    resetInstances();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('应该完成完整合成流程', async () => {
    const tts = createProvider();
    const synthesizePromise = tts.synthesize({ text: '你好世界' });

    // 等待 WebSocket 创建和 open
    await flush();
    const ws = getLastInstance();
    expect(ws).toBeDefined();

    // 1. 触发 open 事件
    ws.emit('open');
    await flush();

    // 2. startConnection → 回复 ConnectionStarted
    ws.emit('message', makeServerEvent(EVENT_CONNECTION_STARTED));
    await flush();

    // 3. startSession → 回复 SessionStarted
    ws.emit('message', makeServerEvent(EVENT_SESSION_STARTED, { speaker: 'test' }, 'session-1'));
    await flush();

    // 4. taskRequest 已发送
    // 5. finishSession 已发送

    // 6. 发送音频数据
    ws.emit('message', makeAudioChunk(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8])));
    await flush();

    // 7. 发送更多音频数据
    ws.emit('message', makeAudioChunk(new Uint8Array([9, 10, 11, 12])));
    await flush();

    // 8. 发送 SessionFinished 事件
    ws.emit('message', makeServerEvent(EVENT_SESSION_FINISHED, {}, 'session-1'));
    await flush();

    // 9. finishConnection → 回复 ConnectionFinished
    ws.emit('message', makeServerEvent(EVENT_CONNECTION_FINISHED));
    await flush();

    const result = await synthesizePromise;
    expect(result).toBeDefined();
    expect(result.audio).toBeInstanceOf(Buffer);
    expect(result.audio.length).toBe(12);
    expect(result.format).toBe('mp3');
  });

  it('空音频应该抛错 "No audio received"', async () => {
    const tts = createProvider();
    const synthesizePromise = tts.synthesize({ text: '你好世界' });
    // 防止 Node.js 在 expect 捕获前报告 unhandled rejection
    synthesizePromise.catch(() => {});

    await flush();
    const ws = getLastInstance();

    // open
    ws.emit('open');
    await flush();

    // ConnectionStarted
    ws.emit('message', makeServerEvent(EVENT_CONNECTION_STARTED));
    await flush();

    // SessionStarted
    ws.emit('message', makeServerEvent(EVENT_SESSION_STARTED, {}, 'session-1'));
    await flush();

    // 不发送音频，直接发送 SessionFinished
    ws.emit('message', makeServerEvent(EVENT_SESSION_FINISHED, {}, 'session-1'));
    await flush();

    // ConnectionFinished
    ws.emit('message', makeServerEvent(EVENT_CONNECTION_FINISHED));
    await flush();

    await expect(synthesizePromise).rejects.toThrow('No audio received');
  });
});

describe('DoubaoTTS TTSConnection', () => {
  beforeEach(() => {
    resetInstances();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * 辅助函数：创建一个已经完成握手的连接
   */
  async function createConnectedConnection() {
    const tts = createProvider();
    const connectPromise = tts.connect();

    await flush();
    const ws = getLastInstance();

    ws.emit('open');
    await flush();

    ws.emit('message', makeServerEvent(EVENT_CONNECTION_STARTED));
    await flush();

    const conn = await connectPromise;
    return { conn, ws, tts };
  }

  it('speak(stream:true) 应该返回 AsyncIterable', async () => {
    const { conn, ws } = await createConnectedConnection();

    const iterable = conn.speak('测试文本', { stream: true });
    expect(iterable).toBeDefined();
    expect(typeof (iterable as AsyncIterable<unknown>)[Symbol.asyncIterator]).toBe('function');

    // 驱动流程完成以避免悬挂的 promise
    await flush();

    // startSession → SessionStarted
    ws.emit('message', makeServerEvent(EVENT_SESSION_STARTED, {}, 'session-1'));
    await flush();

    // 发送音频
    ws.emit('message', makeAudioChunk(new Uint8Array([1, 2, 3])));
    await flush();

    // SessionFinished
    ws.emit('message', makeServerEvent(EVENT_SESSION_FINISHED, {}, 'session-1'));
    await flush();

    // 消费迭代器
    const chunks: unknown[] = [];
    for await (const chunk of iterable) {
      chunks.push(chunk);
    }
    expect(chunks.length).toBeGreaterThan(0);
  });

  it('speak(stream:false) 应该返回 Promise', async () => {
    const { conn, ws } = await createConnectedConnection();

    const speakPromise = conn.speak('测试文本');

    await flush();

    // SessionStarted
    ws.emit('message', makeServerEvent(EVENT_SESSION_STARTED, {}, 'session-1'));
    await flush();

    // 音频数据
    ws.emit('message', makeAudioChunk(new Uint8Array([10, 20, 30])));
    await flush();

    // SessionFinished
    ws.emit('message', makeServerEvent(EVENT_SESSION_FINISHED, {}, 'session-1'));
    await flush();

    const result = await speakPromise;
    expect(result).toBeDefined();
    expect(result.audio).toBeInstanceOf(Buffer);
    expect(result.audio.length).toBe(3);
  });

  it('close() 应该关闭连接', async () => {
    const { conn } = await createConnectedConnection();

    expect(conn.state).toBe('connected');

    conn.close();
    expect(conn.state).toBe('closed');
  });

  it('closed 状态下调用 speak 应该抛错', async () => {
    const { conn } = await createConnectedConnection();

    conn.close();
    expect(conn.state).toBe('closed');

    expect(() => conn.speak('测试')).toThrow('Connection is closed');
    expect(() => conn.speak('测试', { stream: true })).toThrow('Connection is closed');
  });
});
