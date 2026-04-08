import { Buffer } from 'node:buffer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildTTSAuthUrl,
  createRequestPayload,
  extractAudioFromResponse,
  isTTSFinishedResponse,
  isTTSSuccessResponse,
  mapAudioEncoding,
  parseTTSResponse,
  type XfyunTTSProtocolOptions,
} from '@/tts/protocols/xfyun';
import { XfyunTTS } from '@/tts/providers/xfyun.js';

// ========== 协议层测试 ==========

describe('xfyun TTS 协议', () => {
  describe('mapAudioEncoding', () => {
    it('应该将 mp3 映射为 lame', () => {
      expect(mapAudioEncoding('mp3')).toBe('lame');
    });

    it('应该将 pcm 映射为 raw', () => {
      expect(mapAudioEncoding('pcm')).toBe('raw');
    });

    it('应该将 opus 映射为 opus', () => {
      expect(mapAudioEncoding('opus')).toBe('opus');
    });

    it('未知格式应默认返回 lame', () => {
      expect(mapAudioEncoding('wav')).toBe('lame');
    });
  });

  describe('buildTTSAuthUrl', () => {
    it('应该生成包含正确 host 的鉴权 URL', () => {
      const url = buildTTSAuthUrl('test-key', 'test-secret');
      expect(url).toContain('cbm01.cn-huabei-1.xf-yun.com');
      expect(url).toContain('/v1/private/mcd9m97e6');
      expect(url).toContain('authorization=');
      expect(url).toContain('date=');
      expect(url).toContain('host=');
    });

    it('应该生成以 wss:// 开头的 URL', () => {
      const url = buildTTSAuthUrl('key', 'secret');
      expect(url).toMatch(/^wss:\/\//);
    });
  });

  describe('createRequestPayload', () => {
    const baseOptions: XfyunTTSProtocolOptions = {
      appId: 'test-app-id',
      vcn: 'x5_lingxiaoxuan_flow',
      speed: 50,
      volume: 50,
      pitch: 50,
      encoding: 'lame',
      sampleRate: 24000,
    };

    it('应该构建完整的请求体', () => {
      const payload = createRequestPayload(baseOptions, '你好世界', 2, 0);
      const parsed = JSON.parse(payload);

      expect(parsed.header.app_id).toBe('test-app-id');
      expect(parsed.header.status).toBe(2);
      expect(parsed.parameter.tts.vcn).toBe('x5_lingxiaoxuan_flow');
      expect(parsed.parameter.tts.speed).toBe(50);
      expect(parsed.parameter.tts.volume).toBe(50);
      expect(parsed.parameter.tts.pitch).toBe(50);
      expect(parsed.parameter.tts.audio.encoding).toBe('lame');
      expect(parsed.parameter.tts.audio.sample_rate).toBe(24000);
      expect(parsed.payload.text.status).toBe(2);
      expect(parsed.payload.text.seq).toBe(0);
    });

    it('应该将文本 base64 编码', () => {
      const payload = createRequestPayload(baseOptions, '你好', 2, 0);
      const parsed = JSON.parse(payload);
      const decodedText = Buffer.from(parsed.payload.text.text, 'base64').toString('utf8');
      expect(decodedText).toBe('你好');
    });

    it('应该在无 oral 参数时不生成 oral 节点', () => {
      const payload = createRequestPayload(baseOptions, '测试', 2, 0);
      const parsed = JSON.parse(payload);
      expect(parsed.parameter.oral).toBeUndefined();
    });

    it('应该在有 oralLevel 时生成 oral 节点', () => {
      const options: XfyunTTSProtocolOptions = {
        ...baseOptions,
        oralLevel: 'high',
      };
      const payload = createRequestPayload(options, '测试', 2, 0);
      const parsed = JSON.parse(payload);
      expect(parsed.parameter.oral).toBeDefined();
      expect(parsed.parameter.oral.oral_level).toBe('high');
    });

    it('应该正确处理所有 oral 参数', () => {
      const options: XfyunTTSProtocolOptions = {
        ...baseOptions,
        oralLevel: 'mid',
        sparkAssist: 1,
        stopSplit: 0,
        remain: 1,
      };
      const payload = createRequestPayload(options, '测试', 2, 0);
      const parsed = JSON.parse(payload);
      expect(parsed.parameter.oral.oral_level).toBe('mid');
      expect(parsed.parameter.oral.spark_assist).toBe(1);
      expect(parsed.parameter.oral.stop_split).toBe(0);
      expect(parsed.parameter.oral.remain).toBe(1);
    });
  });

  describe('parseTTSResponse', () => {
    it('应该解析 Buffer 类型数据', () => {
      const data = Buffer.from(
        JSON.stringify({
          header: { code: 0, message: 'success', sid: 'test', status: 2 },
        })
      );
      const response = parseTTSResponse(data);
      expect(response.header.code).toBe(0);
      expect(response.header.status).toBe(2);
    });

    it('应该解析字符串类型数据', () => {
      const data = JSON.stringify({
        header: { code: 0, message: 'success', sid: 'test', status: 1 },
      });
      const response = parseTTSResponse(data);
      expect(response.header.code).toBe(0);
    });

    it('应该解析 ArrayBuffer 类型数据', () => {
      const text = JSON.stringify({
        header: { code: 0, message: 'success', sid: 'test', status: 0 },
      });
      const data = new TextEncoder().encode(text).buffer;
      const response = parseTTSResponse(data);
      expect(response.header.code).toBe(0);
    });

    it('应该解析 Buffer[] 类型数据', () => {
      const json = JSON.stringify({
        header: { code: 0, message: 'success', sid: 'test', status: 1 },
      });
      // 模拟 WebSocket RawData 的 Buffer[] 情况
      const data = [Buffer.from(json.substring(0, 10)), Buffer.from(json.substring(10))];
      const response = parseTTSResponse(data);
      expect(response.header.code).toBe(0);
      expect(response.header.status).toBe(1);
    });
  });

  describe('extractAudioFromResponse', () => {
    it('应该提取音频 base64 数据', () => {
      const response = {
        header: { code: 0, message: 'success', sid: 'test', status: 1 },
        payload: {
          audio: {
            encoding: 'lame',
            sample_rate: 24000,
            channels: 1,
            bit_depth: 16,
            status: 1,
            seq: 0,
            frame_size: 0,
            audio: 'dGVzdGF1ZGlv',
          },
        },
      };
      expect(extractAudioFromResponse(response)).toBe('dGVzdGF1ZGlv');
    });

    it('应该在无音频数据时返回 null', () => {
      const response = {
        header: { code: 0, message: 'success', sid: 'test', status: 2 },
      };
      expect(extractAudioFromResponse(response)).toBeNull();
    });
  });

  describe('isTTSSuccessResponse', () => {
    it('应该在 code=0 时返回 true', () => {
      const response = {
        header: { code: 0, message: 'success', sid: 'test', status: 1 },
      };
      expect(isTTSSuccessResponse(response)).toBe(true);
    });

    it('应该在 code!=0 时返回 false', () => {
      const response = {
        header: { code: 10139, message: '参数错误', sid: 'test', status: 1 },
      };
      expect(isTTSSuccessResponse(response)).toBe(false);
    });
  });

  describe('isTTSFinishedResponse', () => {
    it('应该在 status=2 时返回 true', () => {
      const response = {
        header: { code: 0, message: 'success', sid: 'test', status: 2 },
      };
      expect(isTTSFinishedResponse(response)).toBe(true);
    });

    it('应该在 status!=2 时返回 false', () => {
      const response = {
        header: { code: 0, message: 'success', sid: 'test', status: 1 },
      };
      expect(isTTSFinishedResponse(response)).toBe(false);
    });
  });
});

// ========== 提供商层测试（原有用例） ==========

describe('XfyunTTS 构造函数', () => {
  it('应该使用默认值初始化', () => {
    const tts = new XfyunTTS({});
    expect(tts.name).toBe('xfyun');
    expect(tts.appId).toBe('');
    expect(tts.apiSecret).toBe('');
    expect(tts.sampleRate).toBe(24000);
    expect(tts.voice).toBe('x5_lingxiaoxuan_flow');
    expect(tts.format).toBe('mp3');
    expect(tts.speed).toBe(1.0);
    expect(tts.volume).toBe(1.0);
    expect(tts.pitch).toBe(1.0);
    expect(tts.oralLevel).toBeUndefined();
    expect(tts.sparkAssist).toBeUndefined();
    expect(tts.stopSplit).toBeUndefined();
    expect(tts.remain).toBeUndefined();
    expect(tts.reg).toBeUndefined();
    expect(tts.rdn).toBeUndefined();
    expect(tts.rhy).toBeUndefined();
    expect(tts.bgs).toBeUndefined();
  });

  it('应该使用自定义选项', () => {
    const tts = new XfyunTTS({
      appId: 'my-app-id',
      apiKey: 'my-api-key',
      apiSecret: 'my-api-secret',
      voice: 'x5_lingfeiyi_flow',
      sampleRate: 16000,
      speed: 1.5,
      volume: 0.8,
      pitch: 1.2,
      format: 'pcm',
      oralLevel: 'high',
      sparkAssist: 1,
      stopSplit: 1,
      remain: 0,
      reg: 1,
      rdn: 2,
      rhy: 1,
      bgs: 0,
    });
    expect(tts.appId).toBe('my-app-id');
    expect(tts.apiKey).toBe('my-api-key');
    expect(tts.apiSecret).toBe('my-api-secret');
    expect(tts.voice).toBe('x5_lingfeiyi_flow');
    expect(tts.sampleRate).toBe(16000);
    expect(tts.speed).toBe(1.5);
    expect(tts.volume).toBe(0.8);
    expect(tts.pitch).toBe(1.2);
    expect(tts.format).toBe('pcm');
    expect(tts.oralLevel).toBe('high');
    expect(tts.sparkAssist).toBe(1);
    expect(tts.stopSplit).toBe(1);
    expect(tts.remain).toBe(0);
    expect(tts.reg).toBe(1);
    expect(tts.rdn).toBe(2);
    expect(tts.rhy).toBe(1);
    expect(tts.bgs).toBe(0);
  });
});

describe('XfyunTTS 参数映射', () => {
  it('应该将 speed=1.0 映射为 50', () => {
    const tts = new XfyunTTS({ speed: 1.0 });
    // 通过 buildProtocolOptions 间接测试
    const protocolOptions = (
      tts as unknown as { buildProtocolOptions: () => XfyunTTSProtocolOptions }
    ).buildProtocolOptions();
    expect(protocolOptions.speed).toBe(50);
  });

  it('应该将 speed=2.0 映射为 100', () => {
    const tts = new XfyunTTS({ speed: 2.0 });
    const protocolOptions = (
      tts as unknown as { buildProtocolOptions: () => XfyunTTSProtocolOptions }
    ).buildProtocolOptions();
    expect(protocolOptions.speed).toBe(100);
  });

  it('应该将 volume=0.5 映射为 25', () => {
    const tts = new XfyunTTS({ volume: 0.5 });
    const protocolOptions = (
      tts as unknown as { buildProtocolOptions: () => XfyunTTSProtocolOptions }
    ).buildProtocolOptions();
    expect(protocolOptions.volume).toBe(25);
  });

  it('应该将 pitch=1.5 映射为 75', () => {
    const tts = new XfyunTTS({ pitch: 1.5 });
    const protocolOptions = (
      tts as unknown as { buildProtocolOptions: () => XfyunTTSProtocolOptions }
    ).buildProtocolOptions();
    expect(protocolOptions.pitch).toBe(75);
  });
});

describe('XfyunTTS synthesize', () => {
  it('应该在缺少 appId 时抛出错误', async () => {
    const tts = new XfyunTTS({ apiKey: 'key', apiSecret: 'secret' });
    await expect(tts.synthesize({ text: '你好' })).rejects.toThrow('appId is required');
  });

  it('应该在缺少 apiKey 时抛出错误', async () => {
    const tts = new XfyunTTS({ appId: 'id', apiSecret: 'secret' });
    await expect(tts.synthesize({ text: '你好' })).rejects.toThrow('apiKey is required');
  });

  it('应该在缺少 apiSecret 时抛出错误', async () => {
    const tts = new XfyunTTS({ appId: 'id', apiKey: 'key' });
    await expect(tts.synthesize({ text: '你好' })).rejects.toThrow('apiSecret is required');
  });
});

describe('XfyunTTS speakStream', () => {
  it('应该在缺少 appId 时抛出错误', async () => {
    const tts = new XfyunTTS({ apiKey: 'key', apiSecret: 'secret' });
    const generator = tts.speak('test', { stream: true });
    await expect(generator[Symbol.asyncIterator]().next()).rejects.toThrow('appId is required');
  });

  it('应该在缺少 apiKey 时抛出错误', async () => {
    const tts = new XfyunTTS({ appId: 'id', apiSecret: 'secret' });
    const generator = tts.speak('test', { stream: true });
    await expect(generator[Symbol.asyncIterator]().next()).rejects.toThrow('apiKey is required');
  });

  it('应该在缺少 apiSecret 时抛出错误', async () => {
    const tts = new XfyunTTS({ appId: 'id', apiKey: 'key' });
    const generator = tts.speak('test', { stream: true });
    await expect(generator[Symbol.asyncIterator]().next()).rejects.toThrow('apiSecret is required');
  });
});

// ========== Mock WebSocket 基础设施 ==========

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

// --- 讯飞协议消息构建 ---

function makeXfyunResponse(code: number, audioBase64?: string, status = 1) {
  return Buffer.from(
    JSON.stringify({
      header: { code, message: code === 0 ? 'success' : 'error', sid: 'test', status },
      payload: {
        audio: {
          encoding: 'lame',
          sample_rate: 24000,
          channels: 1,
          bit_depth: 16,
          status,
          seq: 0,
          frame_size: 0,
          audio: audioBase64 || '',
        },
      },
    })
  );
}

// --- 工具函数 ---

function flush() {
  return new Promise((r) => setTimeout(r, 0));
}

function createProvider(opts?: Record<string, unknown>) {
  return new XfyunTTS({
    appId: 'test-app-id',
    apiKey: 'test-api-key',
    apiSecret: 'test-api-secret',
    ...opts,
  });
}

// ========== synthesize 集成测试 ==========

describe('XfyunTTS synthesize (WebSocket)', () => {
  beforeEach(() => {
    resetInstances();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('应该完成完整非流式合成流程', async () => {
    const tts = createProvider();
    const audioData = Buffer.from([1, 2, 3, 4, 5, 6]);
    const audioBase64 = audioData.toString('base64');

    const synthesizePromise = tts.synthesize({ text: '你好世界' });

    await flush();
    const ws = getLastInstance();
    expect(ws).toBeDefined();

    // 触发 open
    ws.emit('open');
    await flush();

    // 发送音频数据（status=1 中间帧）
    ws.emit('message', makeXfyunResponse(0, audioBase64, 1));
    await flush();

    // 发送结束帧（status=2）
    ws.emit('message', makeXfyunResponse(0, '', 2));
    await flush();

    // 触发 close
    ws.emit('close');
    await flush();

    const result = await synthesizePromise;
    expect(result).toBeDefined();
    expect(result.audio).toBeInstanceOf(Buffer);
    expect(result.audio.length).toBe(6);
    expect(result.format).toBe('mp3');
  });

  it('WebSocket 连接错误应该 reject', async () => {
    const tts = createProvider();
    const synthesizePromise = tts.synthesize({ text: '你好' });
    synthesizePromise.catch(() => {});

    await flush();
    const ws = getLastInstance();

    ws.emit('error', new Error('connection refused'));

    await expect(synthesizePromise).rejects.toThrow('connection refused');
  });

  it('服务端返回错误码应该 reject', async () => {
    const tts = createProvider();
    const synthesizePromise = tts.synthesize({ text: '你好' });
    synthesizePromise.catch(() => {});

    await flush();
    const ws = getLastInstance();

    ws.emit('open');
    await flush();

    // 发送错误响应
    ws.emit('message', makeXfyunResponse(10139, '', 1));
    await flush();

    await expect(synthesizePromise).rejects.toThrow('Xfyun TTS error: 10139');
  });

  it('响应解析异常应该 reject', async () => {
    const tts = createProvider();
    const synthesizePromise = tts.synthesize({ text: '你好' });
    synthesizePromise.catch(() => {});

    await flush();
    const ws = getLastInstance();

    ws.emit('open');
    await flush();

    // 发送无效 JSON
    ws.emit('message', Buffer.from('invalid json'));
    await flush();

    await expect(synthesizePromise).rejects.toThrow();
  });

  it('未收到音频数据应该抛错', async () => {
    const tts = createProvider();
    const synthesizePromise = tts.synthesize({ text: '你好' });
    synthesizePromise.catch(() => {});

    await flush();
    const ws = getLastInstance();

    ws.emit('open');
    await flush();

    // 发送结束帧但无音频数据
    ws.emit('message', makeXfyunResponse(0, '', 2));
    await flush();

    ws.emit('close');
    await flush();

    await expect(synthesizePromise).rejects.toThrow('No audio received from Xfyun TTS service');
  });

  it('应该合并多个音频块', async () => {
    const tts = createProvider();
    const chunk1 = Buffer.from([1, 2, 3]);
    const chunk2 = Buffer.from([4, 5, 6, 7]);

    const synthesizePromise = tts.synthesize({ text: '你好' });
    synthesizePromise.catch(() => {});

    await flush();
    const ws = getLastInstance();

    ws.emit('open');
    await flush();

    // 发送多个音频块
    ws.emit('message', makeXfyunResponse(0, chunk1.toString('base64'), 1));
    await flush();

    ws.emit('message', makeXfyunResponse(0, chunk2.toString('base64'), 1));
    await flush();

    // 结束帧
    ws.emit('message', makeXfyunResponse(0, '', 2));
    await flush();

    ws.emit('close');
    await flush();

    const result = await synthesizePromise;
    expect(result.audio.length).toBe(7);
    expect(result.audio).toEqual(Buffer.from([1, 2, 3, 4, 5, 6, 7]));
  });
});

// ========== speakStream 集成测试 ==========

describe('XfyunTTS speakStream (WebSocket)', () => {
  beforeEach(() => {
    resetInstances();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('应该完成完整流式合成流程（字符串输入）', async () => {
    const tts = createProvider();
    const audioData = Buffer.from([10, 20, 30, 40]);
    const audioBase64 = audioData.toString('base64');

    const iterable = tts.speak('你好', { stream: true });
    const iterator = iterable[Symbol.asyncIterator]();

    // 启动 generator → 参数校验 → 创建 WebSocket → 等待 open
    const nextPromise = iterator.next();
    await flush();

    const ws = getLastInstance();
    expect(ws).toBeDefined();

    // 触发 open → speakStream 开始发送和接收
    ws.emit('open');
    await flush();

    // 发送音频块
    ws.emit('message', makeXfyunResponse(0, audioBase64, 1));
    await flush();

    // 结束帧
    ws.emit('message', makeXfyunResponse(0, '', 2));
    await flush();

    // 触发 close 让 processPromise 结束
    ws.emit('close');
    await flush();

    // 现在第一个 next() 应该返回音频数据
    const result = await nextPromise;
    expect(result.done).toBe(false);
    expect(result.value.audioChunk).toEqual(audioData);

    // 后续 next() 应该结束
    const finalResult = await iterator.next();
    expect(finalResult.done).toBe(true);
  });

  it('应该支持流式文本输入', async () => {
    const tts = createProvider();
    const audioData = Buffer.from([1, 2, 3]);
    const audioBase64 = audioData.toString('base64');

    // 创建文本流
    async function* textStream() {
      yield '你好';
      yield '世界';
    }

    const iterable = tts.speak(textStream(), { stream: true });
    const iterator = iterable[Symbol.asyncIterator]();

    const nextPromise = iterator.next();
    await flush();

    const ws = getLastInstance();

    ws.emit('open');
    await flush();

    // 发送音频响应
    ws.emit('message', makeXfyunResponse(0, audioBase64, 1));
    await flush();

    ws.emit('message', makeXfyunResponse(0, '', 2));
    await flush();

    ws.emit('close');
    await flush();

    const result = await nextPromise;
    expect(result.done).toBe(false);
    expect(result.value.audioChunk).toEqual(audioData);

    // 验证 ws.send 被调用了 3 次（首帧 + 中间帧 + 结束帧）
    expect(ws.send).toHaveBeenCalledTimes(3);

    await iterator.next();
  });

  it('应该跳过空文本块', async () => {
    const tts = createProvider();
    const audioData = Buffer.from([5, 6, 7]);
    const audioBase64 = audioData.toString('base64');

    async function* textStreamWithEmpty() {
      yield '';
      yield '你好';
      yield '';
    }

    const iterable = tts.speak(textStreamWithEmpty(), { stream: true });
    const iterator = iterable[Symbol.asyncIterator]();

    const nextPromise = iterator.next();
    await flush();

    const ws = getLastInstance();

    ws.emit('open');
    await flush();

    ws.emit('message', makeXfyunResponse(0, audioBase64, 1));
    await flush();

    ws.emit('message', makeXfyunResponse(0, '', 2));
    await flush();

    ws.emit('close');
    await flush();

    const result = await nextPromise;
    expect(result.done).toBe(false);
    expect(result.value.audioChunk).toEqual(audioData);

    // 验证空文本块被跳过：只发送了首帧 + 结束帧 = 2 次
    expect(ws.send).toHaveBeenCalledTimes(2);

    await iterator.next();
  });

  it('服务端错误应该通过 yield 抛出', async () => {
    const tts = createProvider();

    const iterable = tts.speak('你好', { stream: true });
    const iterator = iterable[Symbol.asyncIterator]();

    const nextPromise = iterator.next();
    nextPromise.catch(() => {});
    await flush();

    const ws = getLastInstance();

    ws.emit('open');
    await flush();

    // 发送错误响应
    ws.emit('message', makeXfyunResponse(10139, '', 1));
    await flush();

    ws.emit('close');
    await flush();

    // 消费迭代器应抛出错误
    let thrownError: Error | undefined;
    try {
      await nextPromise;
    } catch (err) {
      thrownError = err instanceof Error ? err : new Error(String(err));
    }

    expect(thrownError).toBeDefined();
    expect(thrownError?.message).toContain('Xfyun TTS error: 10139');
  });

  it('WebSocket 连接错误应该 reject', async () => {
    const tts = createProvider();

    const iterable = tts.speak('你好', { stream: true });
    const iterator = iterable[Symbol.asyncIterator]();

    const nextPromise = iterator.next();
    nextPromise.catch(() => {});
    await flush();

    const ws = getLastInstance();

    // 触发连接错误（speakStream 等待 open 时也会监听 error）
    ws.emit('error', new Error('ws connection failed'));
    await flush();

    let thrownError: Error | undefined;
    try {
      await nextPromise;
    } catch (err) {
      thrownError = err instanceof Error ? err : new Error(String(err));
    }

    expect(thrownError).toBeDefined();
    expect(thrownError?.message).toBe('ws connection failed');
  });

  it('接收过程异常应该抛出错误', async () => {
    const tts = createProvider();

    const iterable = tts.speak('你好', { stream: true });
    const iterator = iterable[Symbol.asyncIterator]();

    const nextPromise = iterator.next();
    nextPromise.catch(() => {});
    await flush();

    const ws = getLastInstance();

    ws.emit('open');
    await flush();

    // 发送无效 JSON 导致解析异常
    ws.emit('message', Buffer.from('not json'));
    await flush();

    ws.emit('close');
    await flush();

    let thrownError: Error | undefined;
    try {
      await nextPromise;
    } catch (err) {
      thrownError = err instanceof Error ? err : new Error(String(err));
    }

    expect(thrownError).toBeDefined();
  });
});
