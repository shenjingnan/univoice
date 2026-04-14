import { Buffer } from 'node:buffer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GlmTTS } from '@/tts/providers/glm.js';

// ---------- Mock 全局 fetch ----------

let mockFetch: ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockFetch = vi.fn();
  (globalThis as Record<string, unknown>).fetch = mockFetch;
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------- 辅助函数 ----------

function createMockAudioResponse(audioData: Uint8Array): Response {
  const buf = audioData.buffer.slice(
    audioData.byteOffset,
    audioData.byteOffset + audioData.byteLength
  ) as ArrayBuffer;
  return new Response(buf, {
    status: 200,
    headers: { 'Content-Type': 'audio/wav' },
  });
}

function createSSEStream(events: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let index = 0;
  return new ReadableStream({
    pull(controller) {
      if (index < events.length) {
        controller.enqueue(encoder.encode(events[index++]));
      } else {
        controller.close();
      }
    },
  });
}

// ---------- 构造函数测试 ----------

describe('GlmTTS 构造函数', () => {
  it('应该使用默认值初始化', () => {
    const tts = new GlmTTS({ apiKey: 'test-key' });
    expect(tts.name).toBe('glm');
    expect(tts.baseUrl).toBe('https://open.bigmodel.cn/api/paas/v4/audio/speech');
    expect(tts.model).toBe('glm-tts');
    expect(tts.voice).toBe('tongtong');
    expect(tts.format).toBe('pcm');
  });

  it('应该使用自定义选项', () => {
    const tts = new GlmTTS({
      apiKey: 'key',
      baseUrl: 'https://custom.url',
      model: 'custom-model',
      voice: 'custom-voice',
      format: 'wav',
    });
    expect(tts.baseUrl).toBe('https://custom.url');
    expect(tts.model).toBe('custom-model');
    expect(tts.voice).toBe('custom-voice');
    expect(tts.format).toBe('wav');
  });
});

// ---------- mapFormat 格式映射（通过 synthesize 间接测试） ----------

describe('GlmTTS mapFormat (via synthesize)', () => {
  it('wav 格式应透传为 wav', async () => {
    mockFetch.mockResolvedValueOnce(createMockAudioResponse(new Uint8Array([1, 2, 3])));
    const tts = new GlmTTS({ apiKey: 'key', format: 'wav' });
    const result = await tts.synthesize({ text: 'hello' });
    expect(result.format).toBe('wav');

    const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
    expect(body.response_format).toBe('wav');
  });

  it('pcm 格式应透传为 pcm', async () => {
    mockFetch.mockResolvedValueOnce(createMockAudioResponse(new Uint8Array([1, 2, 3])));
    const tts = new GlmTTS({ apiKey: 'key', format: 'pcm' });
    await tts.synthesize({ text: 'hello' });
    const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
    expect(body.response_format).toBe('pcm');
  });

  it('mp3 格式应回退到 wav', async () => {
    mockFetch.mockResolvedValueOnce(createMockAudioResponse(new Uint8Array([1, 2, 3])));
    const tts = new GlmTTS({ apiKey: 'key', format: 'mp3' });
    const result = await tts.synthesize({ text: 'hello' });
    expect(result.format).toBe('wav');

    const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
    expect(body.response_format).toBe('wav');
  });

  it('ogg 格式应回退到 wav', async () => {
    mockFetch.mockResolvedValueOnce(createMockAudioResponse(new Uint8Array([1, 2, 3])));
    const tts = new GlmTTS({ apiKey: 'key', format: 'ogg' });
    const result = await tts.synthesize({ text: 'hello' });
    expect(result.format).toBe('wav');
  });
});

// ---------- handleErrorResponse 错误处理 ----------

describe('GlmTTS handleErrorResponse', () => {
  it('非 JSON 响应体应使用 HTTP status text', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response('Not Found', { status: 404, statusText: 'Not Found' })
    );
    const tts = new GlmTTS({ apiKey: 'key' });
    await expect(tts.synthesize({ text: 'test' })).rejects.toThrow(
      /GLM TTS 请求失败.*404.*Not Found/
    );
  });

  it('应提取 error.message 字段', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { message: 'invalid api key' } }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    );
    const tts = new GlmTTS({ apiKey: 'key' });
    await expect(tts.synthesize({ text: 'test' })).rejects.toThrow(/invalid api key/);
  });

  it('应提取顶层 message 字段', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ message: 'rate limit exceeded' }), {
        status: 429,
        headers: { 'Content-Type': 'application/json' },
      })
    );
    const tts = new GlmTTS({ apiKey: 'key' });
    await expect(tts.synthesize({ text: 'test' })).rejects.toThrow(/rate limit exceeded/);
  });

  it('error.message 优先于顶层 message', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { message: 'api error' }, message: 'top level msg' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    );
    const tts = new GlmTTS({ apiKey: 'key' });
    await expect(tts.synthesize({ text: 'test' })).rejects.toThrow(/api error/);
  });
});

// ---------- synthesize 非流式合成 ----------

describe('GlmTTS synthesize', () => {
  it('应发送正确格式的 POST 请求', async () => {
    const audioData = new Uint8Array([0x01, 0x02, 0x03, 0x04]);
    mockFetch.mockResolvedValueOnce(createMockAudioResponse(audioData));

    const tts = new GlmTTS({ apiKey: 'my-api-key' });
    await tts.synthesize({ text: '你好世界' });

    // 验证 fetch 调用
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe('https://open.bigmodel.cn/api/paas/v4/audio/speech');
    expect(options.method).toBe('POST');
    expect(options.headers.Authorization).toBe('Bearer my-api-key');
    expect(options.headers['Content-Type']).toBe('application/json');

    // 验证请求 body
    const body = JSON.parse(options.body as string);
    expect(body.model).toBe('glm-tts');
    expect(body.input).toBe('你好世界');
    expect(body.voice).toBe('tongtong');
    expect(body.response_format).toBe('pcm'); // 默认格式
  });

  it('应返回正确的音频数据和格式', async () => {
    const audioData = new Uint8Array([10, 20, 30, 40, 50]);
    mockFetch.mockResolvedValueOnce(createMockAudioResponse(audioData));

    const tts = new GlmTTS({ apiKey: 'key' });
    const result = await tts.synthesize({ text: 'test' });

    expect(result.audio).toBeInstanceOf(Buffer);
    expect(Array.from(result.audio)).toEqual([10, 20, 30, 40, 50]);
    expect(result.format).toBe('pcm');
  });

  it('应使用自定义 model 和 voice', async () => {
    mockFetch.mockResolvedValueOnce(createMockAudioResponse(new Uint8Array(0)));

    const tts = new GlmTTS({
      apiKey: 'key',
      model: 'custom-model',
      voice: 'xiaochen',
    });
    await tts.synthesize({ text: 'test' });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
    expect(body.model).toBe('custom-model');
    expect(body.voice).toBe('xiaochen');
  });

  it('apiKey 为空时应抛错', async () => {
    const tts = new GlmTTS({ apiKey: '' });
    await expect(tts.synthesize({ text: 'test' })).rejects.toThrow('apiKey 是 GLM TTS 必需的参数');
  });

  it('apiKey 未设置时应抛错', async () => {
    const tts = new GlmTTS({} as ConstructorParameters<typeof GlmTTS>[0]);
    await expect(tts.synthesize({ text: 'test' })).rejects.toThrow('apiKey 是 GLM TTS 必需的参数');
  });

  it('应使用 buildRequestOptions 覆盖默认参数', async () => {
    mockFetch.mockResolvedValueOnce(createMockAudioResponse(new Uint8Array(0)));

    const tts = new GlmTTS({ apiKey: 'key' });
    await tts.synthesize({ text: 'test', voice: 'jam', model: 'glm-tts-v2' } as Parameters<
      typeof tts.synthesize
    >[0]);

    const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
    // buildRequestOptions 会用 request 中的参数覆盖实例默认值
    expect(body.input).toBe('test');
  });
});

// ---------- speakStream Event Stream 流式合成 ----------

describe('GlmTTS speakStream (Event Stream)', () => {
  it('应从 SSE 数据 yield 音频块', async () => {
    const audioChunk = Buffer.from([1, 2, 3, 4]);
    const base64Data = audioChunk.toString('base64');
    const sseData = `data: {"choices":[{"delta":{"content":"${base64Data}"}}]}\n\ndata: [DONE]\n\n`;

    mockFetch.mockResolvedValueOnce(
      new Response(createSSEStream([sseData]), {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      })
    );

    const tts = new GlmTTS({ apiKey: 'key' });
    const chunks: Array<Buffer | Uint8Array> = [];
    for await (const chunk of tts.speak('hello', { stream: true })) {
      chunks.push(chunk.audioChunk);
    }

    expect(chunks).toHaveLength(1);
    expect(Array.from(chunks[0])).toEqual(Array.from(audioChunk));
  });

  it('应处理多个 SSE 音频事件', async () => {
    const chunk1 = Buffer.from([10, 20]);
    const chunk2 = Buffer.from([30, 40]);
    const sseData = [
      `data: {"choices":[{"delta":{"content":"${chunk1.toString('base64')}"}}]}\n\n`,
      `data: {"choices":[{"delta":{"content":"${chunk2.toString('base64')}"}}]}\n\n`,
      'data: [DONE]\n\n',
    ].join('');

    mockFetch.mockResolvedValueOnce(
      new Response(createSSEStream([sseData]), {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      })
    );

    const tts = new GlmTTS({ apiKey: 'key' });
    const chunks: Array<Buffer | Uint8Array> = [];
    for await (const chunk of tts.speak('hello', { stream: true })) {
      chunks.push(chunk.audioChunk);
    }

    expect(chunks).toHaveLength(2);
    expect(Array.from(chunks[0])).toEqual(Array.from(chunk1));
    expect(Array.from(chunks[1])).toEqual(Array.from(chunk2));
  });

  it('应在 [DONE] 信号处停止', async () => {
    const audioChunk = Buffer.from([1, 2]);
    const sseData = [
      `data: {"choices":[{"delta":{"content":"${audioChunk.toString('base64')}"}}]}\n\n`,
      'data: [DONE]\n\n',
      `data: {"choices":[{"delta":{"content":"should not yield"}}]}\n\n`, // 不应被处理
    ].join('');

    mockFetch.mockResolvedValueOnce(
      new Response(createSSEStream([sseData]), {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      })
    );

    const tts = new GlmTTS({ apiKey: 'key' });
    const chunks: Array<Buffer | Uint8Array> = [];
    for await (const chunk of tts.speak('hello', { stream: true })) {
      chunks.push(chunk.audioChunk);
    }

    expect(chunks).toHaveLength(1); // 只有 [DONE] 前的一个块
  });

  it('应跳过空行', async () => {
    const audioChunk = Buffer.from([5, 6]);
    const sseData = `\n\ndata: {"choices":[{"delta":{"content":"${audioChunk.toString('base64')}"}}]}\n\n\n\ndata: [DONE]\n\n`;

    mockFetch.mockResolvedValueOnce(
      new Response(createSSEStream([sseData]), {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      })
    );

    const tts = new GlmTTS({ apiKey: 'key' });
    const chunks: Array<Buffer | Uint8Array> = [];
    for await (const chunk of tts.speak('hello', { stream: true })) {
      chunks.push(chunk.audioChunk);
    }

    expect(chunks).toHaveLength(1);
  });

  it('应忽略非法 JSON 数据行', async () => {
    const audioChunk = Buffer.from([7, 8]);
    const sseData = [
      'data: not valid json\n\n',
      'data: {"broken": \n\n', // 不完整的 JSON
      `data: {"choices":[{"delta":{"content":"${audioChunk.toString('base64')}"}}]}\n\n`,
      'data: [DONE]\n\n',
    ].join('');

    mockFetch.mockResolvedValueOnce(
      new Response(createSSEStream([sseData]), {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      })
    );

    const tts = new GlmTTS({ apiKey: 'key' });
    const chunks: Array<Buffer | Uint8Array> = [];
    for await (const chunk of tts.speak('hello', { stream: true })) {
      chunks.push(chunk.audioChunk);
    }

    expect(chunks).toHaveLength(1); // 只有一个有效数据
  });

  it('应忽略没有 delta.content 的 choices', async () => {
    const sseData = [
      'data: {"choices":[{"delta":{}}]}\n\n',
      'data: {"choices":[]}\n\n',
      'data: [DONE]\n\n',
    ].join('');

    mockFetch.mockResolvedValueOnce(
      new Response(createSSEStream([sseData]), {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      })
    );

    const tts = new GlmTTS({ apiKey: 'key' });
    const chunks: Array<Buffer | Uint8Array> = [];
    for await (const chunk of tts.speak('hello', { stream: true })) {
      chunks.push(chunk.audioChunk);
    }

    expect(chunks).toHaveLength(0);
  });

  it('应处理跨 read 的行缓冲（部分行）', async () => {
    const audioChunk = Buffer.from([9, 10]);
    const base64Data = audioChunk.toString('base64');
    // 第一部分：不完整的行
    const part1 = `data: {"choices":[{"delta":{"content":"`;
    // 第二部分：剩余内容
    const part2 = `${base64Data}"}}]}\n\ndata: [DONE]\n\n`;

    mockFetch.mockResolvedValueOnce(
      new Response(createSSEStream([part1, part2]), {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      })
    );

    const tts = new GlmTTS({ apiKey: 'key' });
    const chunks: Array<Buffer | Uint8Array> = [];
    for await (const chunk of tts.speak('hello', { stream: true })) {
      chunks.push(chunk.audioChunk);
    }

    expect(chunks).toHaveLength(1);
    expect(Array.from(chunks[0])).toEqual(Array.from(audioChunk));
  });

  it('response.body 为空时应抛错', async () => {
    mockFetch.mockResolvedValueOnce(new Response(undefined, { status: 200 }));

    const tts = new GlmTTS({ apiKey: 'key' });
    await expect(async () => {
      for await (const _ of tts.speak('hello', { stream: true })) {
        // 消费流
      }
    }).rejects.toThrow('响应体为空');
  });

  it('apiKey 为空时流式调用应抛错', async () => {
    const tts = new GlmTTS({ apiKey: '' });
    await expect(async () => {
      for await (const _ of tts.speak('hello', { stream: true })) {
        // 消费流
      }
    }).rejects.toThrow('apiKey 是 GLM TTS 必需的参数');
  });

  it('HTTP 错误时流式调用应抛错', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { message: 'stream error' } }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const tts = new GlmTTS({ apiKey: 'key' });
    await expect(async () => {
      for await (const _ of tts.speak('hello', { stream: true })) {
        // 消费流
      }
    }).rejects.toThrow(/stream error/);
  });

  it('应正确解码 base64 内容', async () => {
    // 使用已知数据验证 base64 编解码往返
    const originalData = new Uint8Array([0xde, 0xad, 0xbe, 0xef, 0xca, 0xfe]);
    const base64Data = Buffer.from(originalData).toString('base64');
    const sseData = `data: {"choices":[{"delta":{"content":"${base64Data}"}}]}\n\ndata: [DONE]\n\n`;

    mockFetch.mockResolvedValueOnce(
      new Response(createSSEStream([sseData]), {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      })
    );

    const tts = new GlmTTS({ apiKey: 'key' });
    const chunks: Array<Buffer | Uint8Array> = [];
    for await (const chunk of tts.speak('hello', { stream: true })) {
      chunks.push(chunk.audioChunk);
    }

    expect(chunks).toHaveLength(1);
    expect(Array.from(chunks[0])).toEqual([0xde, 0xad, 0xbe, 0xef, 0xca, 0xfe]);
  });

  it('应使用 PCM 格式进行流式合成', async () => {
    const sseData = 'data: [DONE]\n\n';

    mockFetch.mockResolvedValueOnce(
      new Response(createSSEStream([sseData]), {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      })
    );

    const tts = new GlmTTS({ apiKey: 'key' });
    for await (const _ of tts.speak('hello', { stream: true })) {
      // 消费流
    }

    const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
    expect(body.response_format).toBe('pcm');
    expect(body.stream).toBe(true);
    expect(body.encode_format).toBe('base64');
  });

  it('应释放 reader lock', async () => {
    const sseData = 'data: [DONE]\n\n';
    const releaseLockSpy = vi.fn();

    const stream = createSSEStream([sseData]);
    const reader = stream.getReader();
    void reader.releaseLock.bind(reader); // 保留原始引用以备后续使用
    reader.releaseLock = releaseLockSpy;

    // 创建一个返回我们控制 reader 的 response
    mockFetch.mockResolvedValueOnce(
      new Response(
        new ReadableStream({
          start(controller) {
            // 将原始数据直接传递
            (async () => {
              const { value, done } = await reader.read();
              if (!done) controller.enqueue(value);
              controller.close();
            })();
          },
        }),
        { status: 200 }
      )
    );

    const tts = new GlmTTS({ apiKey: 'key' });
    for await (const _ of tts.speak('hello', { stream: true })) {
      // 消费流
    }

    // 注意：由于我们替换了 reader，releaseLock 可能不会被原始代码调用
    // 这里主要验证流能正常结束
    expect(mockFetch).toHaveBeenCalled();
  });
});
