import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OpenAITTS, TTS1 } from '@/tts/providers/openai.js';

// ---------- Mock OpenAI SDK ----------

const mockSpeechCreate = vi.fn();
const mockChatCompletionsCreate = vi.fn();

vi.mock('openai', () => {
  return {
    default: class MockOpenAI {
      apiKey: string;
      baseURL: string;
      audio = {
        speech: {
          create: mockSpeechCreate,
        },
      };
      chat = {
        completions: {
          create: mockChatCompletionsCreate,
        },
      };
      constructor(options: { apiKey?: string; baseURL?: string }) {
        this.apiKey = options.apiKey || '';
        this.baseURL = options.baseURL || '';
      }
    },
  };
});

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------- 构造函数测试 ----------

describe('OpenAITTS 构造函数', () => {
  it('应该使用默认值初始化', () => {
    const tts = new OpenAITTS({ apiKey: 'test-key' });
    expect(tts.name).toBe('openai');
    expect(tts.baseUrl).toBe('https://api.openai.com/v1');
    expect(tts.model).toBe('tts-1');
    expect(tts.voice).toBe('alloy');
    expect(tts.apiMode).toBe('speech');
  });

  it('应该使用自定义选项', () => {
    const tts = new OpenAITTS({
      apiKey: 'key',
      baseUrl: 'https://custom.url',
      model: 'mimo-v2-tts',
      voice: 'default_zh',
      format: 'pcm',
    });
    expect(tts.baseUrl).toBe('https://custom.url');
    expect(tts.model).toBe('mimo-v2-tts');
    expect(tts.voice).toBe('default_zh');
    expect(tts.format).toBe('pcm');
  });

  it('应该根据 tts-1 模型自动推断 speech 模式', () => {
    const tts = new OpenAITTS({ apiKey: 'key', model: 'tts-1' });
    expect(tts.apiMode).toBe('speech');
  });

  it('应该根据 tts-1-hd 模型自动推断 speech 模式', () => {
    const tts = new OpenAITTS({ apiKey: 'key', model: 'tts-1-hd' });
    expect(tts.apiMode).toBe('speech');
  });

  it('应该根据 gpt-4o-mini-tts 模型自动推断 speech 模式', () => {
    const tts = new OpenAITTS({ apiKey: 'key', model: 'gpt-4o-mini-tts' });
    expect(tts.apiMode).toBe('speech');
  });

  it('应该根据 mimo-v2-tts 模型自动推断 chat 模式', () => {
    const tts = new OpenAITTS({ apiKey: 'key', model: 'mimo-v2-tts' });
    expect(tts.apiMode).toBe('chat');
  });

  it('应该允许手动指定 apiMode 覆盖自动推断', () => {
    const tts = new OpenAITTS({ apiKey: 'key', model: 'tts-1', apiMode: 'chat' });
    expect(tts.apiMode).toBe('chat');
  });
});

// ---------- 向后兼容测试 ----------

describe('TTS1 别名', () => {
  it('TTS1 应该与 OpenAITTS 相同', () => {
    expect(TTS1).toBe(OpenAITTS);
  });

  it('TTS1 应该能正常实例化', () => {
    const tts = new TTS1({ apiKey: 'key' });
    expect(tts.name).toBe('openai');
    expect(tts).toBeInstanceOf(OpenAITTS);
  });
});

// ---------- speech 模式 synthesize ----------

describe('OpenAITTS speech 模式 synthesize', () => {
  it('应该调用 audio.speech.create 并返回音频', async () => {
    const audioBuffer = Buffer.from([1, 2, 3, 4, 5]);
    mockSpeechCreate.mockResolvedValue({
      arrayBuffer: async () =>
        audioBuffer.buffer.slice(
          audioBuffer.byteOffset,
          audioBuffer.byteOffset + audioBuffer.byteLength
        ),
    });

    const tts = new OpenAITTS({ apiKey: 'key', model: 'tts-1' });
    const result = await tts.synthesize({ text: '你好世界' });

    expect(result.audio).toBeInstanceOf(Buffer);
    expect(result.format).toBe('mp3');
    expect(mockSpeechCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'tts-1',
        voice: 'alloy',
        input: '你好世界',
      })
    );
  });

  it('应该使用自定义 voice 和 format', async () => {
    mockSpeechCreate.mockResolvedValue({
      arrayBuffer: async () => new ArrayBuffer(0),
    });

    const tts = new OpenAITTS({
      apiKey: 'key',
      model: 'tts-1',
      voice: 'nova',
      format: 'wav',
    });
    await tts.synthesize({ text: 'test' });

    expect(mockSpeechCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        voice: 'nova',
        response_format: 'wav',
      })
    );
  });
});

// ---------- chat 模式 synthesize ----------

describe('OpenAITTS chat 模式 synthesize', () => {
  it('应该调用 chat.completions.create 并从 message.audio 提取音频', async () => {
    const pcmData = Buffer.from([0, 1, 2, 3]).toString('base64');
    mockChatCompletionsCreate.mockResolvedValue({
      choices: [
        {
          message: {
            audio: { data: pcmData },
          },
        },
      ],
    });

    const tts = new OpenAITTS({ apiKey: 'key', model: 'mimo-v2-tts', format: 'pcm' });
    const result = await tts.synthesize({ text: '你好' });

    expect(result.audio).toBeInstanceOf(Buffer);
    expect(result.format).toBe('pcm');
    expect(mockChatCompletionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'mimo-v2-tts',
        messages: [{ role: 'assistant', content: '你好' }],
        audio: { voice: 'alloy', format: 'pcm16' },
      })
    );
  });

  it('应该在无音频数据时抛错', async () => {
    mockChatCompletionsCreate.mockResolvedValue({
      choices: [{ message: {} }],
    });

    const tts = new OpenAITTS({ apiKey: 'key', model: 'mimo-v2-tts' });
    await expect(tts.synthesize({ text: '你好' })).rejects.toThrow('chat 模式未返回音频数据');
  });
});

// ---------- 格式映射 ----------

describe('OpenAITTS 格式映射', () => {
  it('chat 模式应将 pcm 映射为 pcm16', async () => {
    const pcmData = Buffer.from([0]).toString('base64');
    mockChatCompletionsCreate.mockResolvedValue({
      choices: [{ message: { audio: { data: pcmData } } }],
    });

    const tts = new OpenAITTS({ apiKey: 'key', model: 'mimo-v2-tts', format: 'pcm' });
    await tts.synthesize({ text: 'test' });

    expect(mockChatCompletionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        audio: expect.objectContaining({ format: 'pcm16' }),
      })
    );
  });
});

// ---------- apiKey 校验 ----------

describe('OpenAITTS apiKey 校验', () => {
  it('apiKey 为空时 synthesize 应该抛错', async () => {
    const tts = new OpenAITTS({ apiKey: '' });
    await expect(tts.synthesize({ text: 'test' })).rejects.toThrow('OpenAI API key 是必填项');
  });

  it('apiKey 为空时流式 speakStream 应该抛错', async () => {
    const tts = new OpenAITTS({ apiKey: '' });
    const stream = tts.speak('test', { stream: true });
    await expect(async () => {
      for await (const _ of stream as AsyncIterable<unknown>) {
        // 消费流
      }
    }).rejects.toThrow('OpenAI API key 是必填项');
  });
});

// ---------- speech 模式流式 ----------

describe('OpenAITTS speech 模式流式', () => {
  it('应该按块 yield 音频数据', async () => {
    const chunk1 = new Uint8Array([1, 2, 3]);
    const chunk2 = new Uint8Array([4, 5, 6]);

    const reader = {
      read: vi.fn(),
      releaseLock: vi.fn(),
    };
    reader.read
      .mockResolvedValueOnce({ done: false, value: chunk1 })
      .mockResolvedValueOnce({ done: false, value: chunk2 })
      .mockResolvedValueOnce({ done: true, value: undefined });

    mockSpeechCreate.mockResolvedValue({
      body: { getReader: () => reader },
    });

    const tts = new OpenAITTS({ apiKey: 'key', model: 'tts-1' });
    const chunks: Uint8Array[] = [];
    const stream = tts.speak('你好', { stream: true });
    for await (const chunk of stream as AsyncIterable<{ audioChunk: Uint8Array }>) {
      chunks.push(chunk.audioChunk);
    }

    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toEqual(Buffer.from(chunk1));
    expect(chunks[1]).toEqual(Buffer.from(chunk2));
    expect(reader.releaseLock).toHaveBeenCalled();
  });
});

// ---------- chat 模式流式 ----------

describe('OpenAITTS chat 模式流式', () => {
  it('应该从 delta.audio.data 提取 base64 音频块并 yield', async () => {
    const audioBase64_1 = Buffer.from([10, 20, 30]).toString('base64');
    const audioBase64_2 = Buffer.from([40, 50, 60]).toString('base64');

    const mockStream = (async function* () {
      yield {
        choices: [{ delta: { audio: { data: audioBase64_1 } } }],
      };
      yield {
        choices: [{ delta: { audio: { data: audioBase64_2 } } }],
      };
      yield {
        choices: [],
      };
      yield {
        choices: [{ delta: { audio: null } }],
      };
    })();

    mockChatCompletionsCreate.mockResolvedValue(mockStream);

    const tts = new OpenAITTS({ apiKey: 'key', model: 'mimo-v2-tts', format: 'pcm' });
    const chunks: Uint8Array[] = [];
    const stream = tts.speak('你好', { stream: true });
    for await (const chunk of stream as AsyncIterable<{ audioChunk: Uint8Array }>) {
      chunks.push(chunk.audioChunk);
    }

    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toEqual(Buffer.from([10, 20, 30]));
    expect(chunks[1]).toEqual(Buffer.from([40, 50, 60]));
    expect(mockChatCompletionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'mimo-v2-tts',
        stream: true,
        audio: { voice: 'alloy', format: 'pcm16' },
      })
    );
  });
});
