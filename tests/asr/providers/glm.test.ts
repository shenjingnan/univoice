import { Buffer } from 'node:buffer';
import { stat } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GlmASR } from '@/asr/providers/glm.js';

// ---------- 辅助函数（必须在 mock 之前定义） ----------

function createMockASRResponse(text: string): Response {
  return new Response(JSON.stringify({ text }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
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

function createTempFileStats(size: number) {
  return {
    isFile: () => true,
    isDirectory: () => false,
    isBlockDevice: () => false,
    isCharacterDevice: () => false,
    isSymbolicLink: () => false,
    isFIFO: () => false,
    isSocket: () => false,
    dev: 0,
    ino: 0,
    mode: 0,
    nlink: 0,
    uid: 0,
    gid: 0,
    rdev: 0,
    size,
    blksize: 0,
    blocks: 0,
    atimeMs: 0,
    mtimeMs: 0,
    ctimeMs: 0,
    birthtimeMs: 0,
    atime: new Date(0),
    mtime: new Date(0),
    ctime: new Date(0),
    birthtime: new Date(0),
  };
}

// ---------- Mock 外部依赖（必须用 vi.hoisted 因为 vi.mock 会被提升） ----------

const { mockReadFile, mockStat } = vi.hoisted(() => ({
  mockReadFile: vi.fn(),
  mockStat: vi.fn() as unknown as typeof stat,
}));

/** 辅助：设置 mockStat 返回指定大小的文件（回调风格，兼容 promisify） */
function setupMockStat(size: number = 1024) {
  (mockStat as unknown as ReturnType<typeof vi.fn>).mockImplementation(
    (
      _path: string,
      cb: (err: NodeJS.ErrnoException | null, stats?: Record<string, unknown>) => void
    ) => {
      cb(null, createTempFileStats(size) as unknown as Parameters<typeof cb>[1]);
    }
  );
}

let mockFetch: ReturnType<typeof vi.fn>;

vi.mock('node:fs/promises', () => ({
  readFile: mockReadFile,
}));

vi.mock('node:fs', async (importOriginal) => {
  const original = await importOriginal<typeof import('node:fs')>();
  return {
    ...original,
    stat: mockStat,
    unlinkSync: vi.fn(),
    writeFileSync: vi.fn(),
  };
});

beforeEach(() => {
  mockFetch = vi.fn();
  (globalThis as Record<string, unknown>).fetch = mockFetch;
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------- 构造函数测试 ----------

describe('GlmASR 构造函数', () => {
  it('应该使用默认值初始化', () => {
    const asr = new GlmASR({ apiKey: 'test-key' });
    expect(asr.name).toBe('glm');
    expect(asr.baseUrl).toBe('https://open.bigmodel.cn/api/paas/v4/audio/transcriptions');
    expect(asr.model).toBe('glm-asr-2512');
    expect(asr.hotwords).toBeUndefined();
    expect(asr.context).toBeUndefined();
  });

  it('应该使用自定义选项', () => {
    const asr = new GlmASR({
      apiKey: 'key',
      baseUrl: 'https://custom.url',
      model: 'custom-model',
      hotwords: ['人工智能', '大模型'],
      context: '这是一段关于技术的对话',
    });
    expect(asr.baseUrl).toBe('https://custom.url');
    expect(asr.model).toBe('custom-model');
    expect(asr.hotwords).toEqual(['人工智能', '大模型']);
    expect(asr.context).toBe('这是一段关于技术的对话');
  });
});

// ---------- isFilePath（通过 listen 间接测试） ----------

describe('GlmASR isFilePath (via listen)', () => {
  it('应识别 Unix 文件路径（含 /）', async () => {
    setupMockStat();
    mockReadFile.mockResolvedValue(Buffer.from([1, 2, 3]));
    mockFetch.mockResolvedValueOnce(createMockASRResponse('hello'));

    const asr = new GlmASR({ apiKey: 'key' });
    await asr.listen('/path/to/audio.wav');

    expect(mockStat).toHaveBeenCalledWith('/path/to/audio.wav', expect.any(Function));
  });

  it('应识别 Windows 文件路径（含 \\）', async () => {
    setupMockStat();
    mockReadFile.mockResolvedValue(Buffer.from([1, 2, 3]));
    mockFetch.mockResolvedValueOnce(createMockASRResponse('hello'));

    const asr = new GlmASR({ apiKey: 'key' });
    await asr.listen('C:\\Users\\audio.wav');

    expect(mockStat).toHaveBeenCalled();
  });

  it('应识别 .mp3 扩展名', async () => {
    setupMockStat();
    mockReadFile.mockResolvedValue(Buffer.from([1, 2, 3]));
    mockFetch.mockResolvedValueOnce(createMockASRResponse('hello'));

    const asr = new GlmASR({ apiKey: 'key' });
    await asr.listen('audio.mp3');

    expect(mockStat).toHaveBeenCalled();
  });

  it('应识别 .wav 扩展名', async () => {
    setupMockStat();
    mockReadFile.mockResolvedValue(Buffer.from([1, 2, 3]));
    mockFetch.mockResolvedValueOnce(createMockASRResponse('hello'));

    const asr = new GlmASR({ apiKey: 'key' });
    await asr.listen('audio.wav');

    expect(mockStat).toHaveBeenCalled();
  });

  it('Buffer 输入不应触发 stat 调用', async () => {
    mockFetch.mockResolvedValueOnce(createMockASRResponse('hello'));

    const asr = new GlmASR({ apiKey: 'key' });
    await asr.listen(Buffer.from([1, 2, 3]));

    expect(mockStat).not.toHaveBeenCalled();
  });
});

// ---------- validateFile（通过 listen 间接测试） ----------

describe('GlmASR validateFile (via listen)', () => {
  it('应在文件大小限制内通过验证', async () => {
    setupMockStat();
    mockReadFile.mockResolvedValue(Buffer.from([1, 2, 3]));
    mockFetch.mockResolvedValueOnce(createMockASRResponse('ok'));

    const asr = new GlmASR({ apiKey: 'key' });
    const result = await asr.listen('/path/to/audio.wav');
    expect(result.text).toBe('ok');
  });

  it('应拒绝超过 25MB 的文件', async () => {
    setupMockStat(26 * 1024 * 1024); // 26MB > 25MB

    const asr = new GlmASR({ apiKey: 'key' });
    await expect(asr.listen('/path/to/big.wav')).rejects.toThrow(/文件大小超出限制.*25 MB/);
  });

  it('应接受 .wav 格式文件', async () => {
    setupMockStat();
    mockReadFile.mockResolvedValue(Buffer.from([1, 2, 3]));
    mockFetch.mockResolvedValueOnce(createMockASRResponse('ok'));

    const asr = new GlmASR({ apiKey: 'key' });
    await asr.listen('/path/to/file.wav');
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('应接受 .mp3 格式文件', async () => {
    setupMockStat();
    mockReadFile.mockResolvedValue(Buffer.from([1, 2, 3]));
    mockFetch.mockResolvedValueOnce(createMockASRResponse('ok'));

    const asr = new GlmASR({ apiKey: 'key' });
    await asr.listen('/path/to/file.mp3');
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('应拒绝不支持的格式（.flac）', async () => {
    setupMockStat();
    const asr = new GlmASR({ apiKey: 'key' });
    await expect(asr.listen('/path/to/file.flac')).rejects.toThrow(/不支持的音频格式.*flac/);
  });
});

// ---------- buildFormData / recognize（通过 listen 间接测试） ----------

describe('GlmASR recognize (via listen)', () => {
  it('Buffer 输入应发送 FormData 并返回识别文本', async () => {
    mockFetch.mockResolvedValueOnce(createMockASRResponse('你好世界'));
    const testBuffer = Buffer.from([1, 2, 3]);

    const asr = new GlmASR({ apiKey: 'key' });
    const result = await asr.listen(testBuffer);

    expect(result.text).toBe('你好世界');
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [, options] = mockFetch.mock.calls[0];
    expect(options.body).toBeInstanceOf(FormData);
    expect(options.headers.Authorization).toBe('Bearer key');
  });

  it('文件路径输入应读取文件后发送 FormData', async () => {
    setupMockStat();
    const fileContent = Buffer.from([4, 5, 6]);
    mockReadFile.mockResolvedValue(fileContent);
    mockFetch.mockResolvedValueOnce(createMockASRResponse('ok'));

    const asr = new GlmASR({ apiKey: 'key' });
    await asr.listen('/path/to/test.wav');

    expect(mockReadFile).toHaveBeenCalledWith('/path/to/test.wav');
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('空文本结果应返回空字符串', async () => {
    mockFetch.mockResolvedValueOnce(createMockASRResponse(''));

    const asr = new GlmASR({ apiKey: 'key' });
    const result = await asr.listen(Buffer.from([1, 2, 3]));

    expect(result.text).toBe('');
  });

  it('应使用自定义 model 参数', async () => {
    mockFetch.mockResolvedValueOnce(createMockASRResponse('ok'));

    const asr = new GlmASR({ apiKey: 'key', model: 'custom-model' });
    await asr.listen(Buffer.from([1, 2, 3]));

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('流式模式应设置 Accept: text/event-stream header', async () => {
    const sseData = 'data: [DONE]\n\n';
    mockFetch.mockResolvedValueOnce(
      new Response(createSSEStream([sseData]), {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      })
    );

    const asr = new GlmASR({ apiKey: 'key' });
    const stream = asr.listen(Buffer.from([1, 2, 3]), { stream: true });

    for await (const _ of stream as AsyncIterable<unknown>) {
      // 消费流
    }

    const [, options] = mockFetch.mock.calls[0];
    expect(options.headers.Accept).toBe('text/event-stream');
  });

  it('应传递 hotwords 参数', async () => {
    mockFetch.mockResolvedValueOnce(createMockASRResponse('ok'));

    const asr = new GlmASR({
      apiKey: 'key',
      hotwords: ['人工智能', '机器学习'],
    });
    await asr.listen(Buffer.from([1, 2, 3]));

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('应传递 context 参数', async () => {
    mockFetch.mockResolvedValueOnce(createMockASRResponse('ok'));

    const asr = new GlmASR({
      apiKey: 'key',
      context: '技术讨论场景',
    });
    await asr.listen(Buffer.from([1, 2, 3]));

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});

// ---------- handleErrorResponse 错误处理 ----------

describe('GlmASR handleErrorResponse', () => {
  it('非 JSON 响应体应使用 HTTP status text', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response('Gateway Timeout', { status: 504, statusText: 'Gateway Timeout' })
    );

    const asr = new GlmASR({ apiKey: 'key' });
    await expect(asr.listen(Buffer.from([1, 2, 3]))).rejects.toThrow(/504.*Gateway Timeout/);
  });

  it('应提取 error.message 字段', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { message: 'authentication failed' } }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const asr = new GlmASR({ apiKey: 'key' });
    await expect(asr.listen(Buffer.from([1, 2, 3]))).rejects.toThrow(/authentication failed/);
  });

  it('应提取顶层 message 字段', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ message: 'quota exceeded' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const asr = new GlmASR({ apiKey: 'key' });
    await expect(asr.listen(Buffer.from([1, 2, 3]))).rejects.toThrow(/quota exceeded/);
  });
});

// ---------- recognizeStream 流式 SSE 解析 ----------

describe('GlmASR recognizeStream (Event Stream)', () => {
  it('应 yield 增量文本（transcript.text.delta）', async () => {
    const sseData = [
      'data: {"type":"transcript.text.delta","delta":"你"}\n\n',
      'data: {"type":"transcript.text.delta","delta":"好"}\n\n',
      'data: [DONE]\n\n',
    ].join('');

    mockFetch.mockResolvedValueOnce(
      new Response(createSSEStream([sseData]), {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      })
    );

    const asr = new GlmASR({ apiKey: 'key' });
    const stream = asr.listen(Buffer.from([1, 2, 3]), { stream: true }) as AsyncIterable<{
      text: string;
      isFinal: boolean;
    }>;
    const chunks: Array<{ text: string; isFinal: boolean }> = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }

    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toEqual({ text: '你', isFinal: false });
    expect(chunks[1]).toEqual({ text: '好', isFinal: false });
  });

  it('应 yield 最终结果（transcript.text.done）', async () => {
    const sseData = [
      'data: {"type":"transcript.text.done","text":"你好世界"}\n\n',
      'data: [DONE]\n\n',
    ].join('');

    mockFetch.mockResolvedValueOnce(
      new Response(createSSEStream([sseData]), {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      })
    );

    const asr = new GlmASR({ apiKey: 'key' });
    const stream = asr.listen(Buffer.from([1, 2, 3]), { stream: true }) as AsyncIterable<{
      text: string;
      isFinal: boolean;
    }>;
    const chunks: Array<{ text: string; isFinal: boolean }> = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }

    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toEqual({ text: '你好世界', isFinal: true });
  });

  it('应兼容旧格式（无 type 字段）', async () => {
    const sseData = ['data: {"text":"hello world","is_final":true}\n\n', 'data: [DONE]\n\n'].join(
      ''
    );

    mockFetch.mockResolvedValueOnce(
      new Response(createSSEStream([sseData]), {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      })
    );

    const asr = new GlmASR({ apiKey: 'key' });
    const stream = asr.listen(Buffer.from([1, 2, 3]), { stream: true }) as AsyncIterable<{
      text: string;
      isFinal: boolean;
    }>;
    const chunks: Array<{ text: string; isFinal: boolean }> = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }

    expect(chunks).toHaveLength(1);
    expect(chunks[0].text).toBe('hello world');
    expect(chunks[0].isFinal).toBe(true);
  });

  it('旧格式应包含 segment 信息（start_time/end_time）', async () => {
    const sseData = [
      'data: {"text":"segment","is_final":true,"start_time":0.5,"end_time":1.5}\n\n',
      'data: [DONE]\n\n',
    ].join('');

    mockFetch.mockResolvedValueOnce(
      new Response(createSSEStream([sseData]), {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      })
    );

    const asr = new GlmASR({ apiKey: 'key' });
    const stream = asr.listen(Buffer.from([1, 2, 3]), { stream: true }) as AsyncIterable<{
      text: string;
      isFinal: boolean;
      segment?: { id: number; start: number; end: number; text: string };
    }>;
    const chunks = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }

    expect(chunks).toHaveLength(1);
    expect(chunks[0].segment).toEqual({
      id: 0,
      start: 0.5,
      end: 1.5,
      text: 'segment',
    });
  });

  it('应在 [DONE] 处停止', async () => {
    const sseData = [
      'data: {"type":"transcript.text.delta","delta":"before"}\n\n',
      'data: [DONE]\n\n',
      'data: {"type":"transcript.text.delta","delta":"after"}\n\n',
    ].join('');

    mockFetch.mockResolvedValueOnce(
      new Response(createSSEStream([sseData]), {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      })
    );

    const asr = new GlmASR({ apiKey: 'key' });
    const stream = asr.listen(Buffer.from([1, 2, 3]), { stream: true }) as AsyncIterable<{
      text: string;
    }>;
    const chunks = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }

    expect(chunks).toHaveLength(1); // 只有 [DONE] 前的一个
    expect(chunks[0].text).toBe('before');
  });

  it('应跳过空行', async () => {
    const sseData = [
      '\n\n',
      'data: {"type":"transcript.text.delta","delta":"hi"}\n\n',
      '\n\n',
      'data: [DONE]\n\n',
    ].join('');

    mockFetch.mockResolvedValueOnce(
      new Response(createSSEStream([sseData]), {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      })
    );

    const asr = new GlmASR({ apiKey: 'key' });
    const stream = asr.listen(Buffer.from([1, 2, 3]), { stream: true }) as AsyncIterable<{
      text: string;
    }>;
    const chunks = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }

    expect(chunks).toHaveLength(1);
  });

  it('应忽略非法 JSON 数据行', async () => {
    const sseData = [
      'data: not valid json\n\n',
      'data: {"broken"\n\n',
      'data: {"type":"transcript.text.delta","delta":"valid"}\n\n',
      'data: [DONE]\n\n',
    ].join('');

    mockFetch.mockResolvedValueOnce(
      new Response(createSSEStream([sseData]), {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      })
    );

    const asr = new GlmASR({ apiKey: 'key' });
    const stream = asr.listen(Buffer.from([1, 2, 3]), { stream: true }) as AsyncIterable<{
      text: string;
    }>;
    const chunks = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }

    expect(chunks).toHaveLength(1);
    expect(chunks[0].text).toBe('valid');
  });

  it('response.body 为空时应抛错', async () => {
    mockFetch.mockResolvedValueOnce(new Response(undefined, { status: 200 }));

    const asr = new GlmASR({ apiKey: 'key' });
    const stream = asr.listen(Buffer.from([1, 2, 3]), { stream: true });
    await expect(async () => {
      for await (const _ of stream as AsyncIterable<unknown>) {
        // 消费流
      }
    }).rejects.toThrow('响应体为空');
  });
});

// ---------- listen 主入口（多种输入组合） ----------

describe('GlmASR listen() 多种输入', () => {
  it('文件路径 + 非流式 → Promise<ASRResponse>', async () => {
    setupMockStat();
    mockReadFile.mockResolvedValue(Buffer.from([1, 2, 3]));
    mockFetch.mockResolvedValueOnce(createMockASRResponse('file result'));

    const asr = new GlmASR({ apiKey: 'key' });
    const result = await asr.listen('/path/to/audio.wav');
    expect(result.text).toBe('file result');
  });

  it('文件路径 + 流式 → AsyncIterable', async () => {
    setupMockStat();
    const sseData = [
      'data: {"type":"transcript.text.delta","delta":"stream"}\n\n',
      'data: [DONE]\n\n',
    ].join('');
    mockReadFile.mockResolvedValue(Buffer.from([1, 2, 3]));
    mockFetch.mockResolvedValueOnce(
      new Response(createSSEStream([sseData]), {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      })
    );

    const asr = new GlmASR({ apiKey: 'key' });
    const result = asr.listen('/path/to/audio.wav', { stream: true });

    expect(typeof (result as AsyncIterable<unknown>)[Symbol.asyncIterator]).toBe('function');

    const chunks: string[] = [];
    for await (const chunk of result as AsyncIterable<{ text: string }>) {
      chunks.push(chunk.text);
    }
    expect(chunks).toEqual(['stream']);
  });

  it('Buffer + 非流式 → Promise<ASRResponse>', async () => {
    mockFetch.mockResolvedValueOnce(createMockASRResponse('buffer result'));

    const asr = new GlmASR({ apiKey: 'key' });
    const result = await asr.listen(Buffer.from([1, 2, 3]));
    expect(result.text).toBe('buffer result');
  });

  it('Buffer + 流式 → AsyncIterable', async () => {
    const sseData = [
      'data: {"type":"transcript.text.delta","delta":"buf"}\n\n',
      'data: [DONE]\n\n',
    ].join('');
    mockFetch.mockResolvedValueOnce(
      new Response(createSSEStream([sseData]), {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      })
    );

    const asr = new GlmASR({ apiKey: 'key' });
    const result = asr.listen(Buffer.from([1, 2, 3]), { stream: true });

    const chunks: string[] = [];
    for await (const chunk of result as AsyncIterable<{ text: string }>) {
      chunks.push(chunk.text);
    }
    expect(chunks).toEqual(['buf']);
  });

  it('AudioStream + 非流式 → Promise<ASRResponse>', async () => {
    mockFetch.mockResolvedValueOnce(createMockASRResponse('stream input result'));

    const asr = new GlmASR({ apiKey: 'key' });

    async function* audioGen(): AsyncIterable<Buffer> {
      yield Buffer.from([1, 2, 3]);
    }

    const result = await asr.listen(audioGen());
    expect(result.text).toBe('stream input result');
  });

  it('AudioStream + 流式 → AsyncIterable', async () => {
    const sseData = [
      'data: {"type":"transcript.text.delta","delta":"async"}\n\n',
      'data: [DONE]\n\n',
    ].join('');
    mockFetch.mockResolvedValueOnce(
      new Response(createSSEStream([sseData]), {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      })
    );

    const asr = new GlmASR({ apiKey: 'key' });

    async function* audioGen(): AsyncIterable<Buffer> {
      yield Buffer.from([1, 2, 3]);
    }

    const result = asr.listen(audioGen(), { stream: true });
    const chunks: string[] = [];
    for await (const chunk of result as AsyncIterable<{ text: string }>) {
      chunks.push(chunk.text);
    }
    expect(chunks).toEqual(['async']);
  });

  it('Uint8Array 输入应正常工作', async () => {
    mockFetch.mockResolvedValueOnce(createMockASRResponse('uint8 result'));

    const asr = new GlmASR({ apiKey: 'key' });
    const result = await asr.listen(new Uint8Array([1, 2, 3]));
    expect(result.text).toBe('uint8 result');
  });

  it('apiKey 为空时应抛错', () => {
    const asr = new GlmASR({ apiKey: '' });
    expect(() => asr.listen(Buffer.from([1, 2, 3]))).toThrow('apiKey 是 GLM ASR 必需的参数');
  });
});

// ---------- listenStream 流式输入 ----------

describe('GlmASR listenStream()', () => {
  it('应收集 AudioStream 并调用 recognizeStream', async () => {
    const sseData = [
      'data: {"type":"transcript.text.delta","delta":"collected"}\n\n',
      'data: [DONE]\n\n',
    ].join('');
    mockFetch.mockResolvedValueOnce(
      new Response(createSSEStream([sseData]), {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      })
    );

    const asr = new GlmASR({ apiKey: 'key' });

    async function* audioGen(): AsyncIterable<Buffer> {
      yield Buffer.from([10, 20, 30]);
    }

    const chunks: string[] = [];
    for await (const chunk of asr.listenStream(audioGen())) {
      chunks.push(chunk.text);
    }

    expect(chunks).toEqual(['collected']);
  });

  it('收集后音频超过 25MB 时应抛错', async () => {
    const asr = new GlmASR({ apiKey: 'key' });

    const bigBuffer = Buffer.alloc(26 * 1024 * 1024); // 26MB

    async function* bigAudioGen(): AsyncIterable<Buffer> {
      yield bigBuffer;
    }

    await expect(async () => {
      for await (const _ of asr.listenStream(bigAudioGen())) {
        // 消费流
      }
    }).rejects.toThrow(/音频数据大小超出限制.*25 MB/);
  });
});

// ---------- 大小限制验证 ----------

describe('GlmASR 大小限制', () => {
  it('prepareAudioData 应拒绝超过 25MB 的 AudioStream', async () => {
    const bigBuffer = Buffer.alloc(26 * 1024 * 1024); // 26MB

    async function* bigAudioGen(): AsyncIterable<Buffer> {
      yield bigBuffer;
    }

    const asr = new GlmASR({ apiKey: 'key' });
    await expect(asr.listen(bigAudioGen())).rejects.toThrow(/音频数据大小超出限制.*25 MB/);
  });

  it('prepareAudioData 应拒绝超过 25MB 的 Buffer', async () => {
    const bigBuffer = Buffer.alloc(26 * 1024 * 1024); // 26MB

    const asr = new GlmASR({ apiKey: 'key' });
    await expect(asr.listen(bigBuffer)).rejects.toThrow(/音频数据大小超出限制.*25 MB/);
  });
});
