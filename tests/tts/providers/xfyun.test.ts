import { Buffer } from 'node:buffer';
import { describe, expect, it } from 'vitest';
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

// ========== 提供商层测试 ==========

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
