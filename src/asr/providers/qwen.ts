import { Buffer } from 'node:buffer';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import WebSocket from 'ws';
import { BaseASR } from '@/asr/base';
import {
  createFinishTaskMessage,
  createRunTaskMessage,
  isFailedEvent,
  isFinishedEvent,
  isResultGeneratedEvent,
  parseServerResponse,
  sendBinaryData,
  sendMessage,
  waitForTaskStarted,
} from '@/asr/protocols/dashscope';
import { detectSampleRate } from '@/asr/utils/audio';
import type {
  ASRConnection,
  ASRConnectionState,
  ASRConnectOptions,
  ASRResponse,
  ASRSegment,
  ASRStreamChunk,
  AudioStream,
  AudioStreamInput,
  ListenInstanceOptions,
  QwenASROptions,
} from '@/types/asr';

/**
 * Qwen ASR 提供商
 * 基于阿里云 DashScope Paraformer WebSocket API 实现语音识别
 *
 * 支持的模型:
 * - paraformer-realtime-v2 (推荐：支持多语言、任意采样率)
 * - paraformer-realtime-8k-v1 (支持 8kHz 采样率)
 * - paraformer-realtime-v1 (支持 16kHz 采样率)
 */
export class QwenASR extends BaseASR {
  name = 'qwen';

  /** 采样率 */
  public sampleRate?: number;
  /** 是否启用词级时间戳 */
  public enableWords?: boolean;
  /** 是否启用标点预测 */
  public enablePunctuationPrediction?: boolean;
  /** 是否启用逆文本规范化 */
  public enableInverseTextNormalization?: boolean;

  constructor(options: QwenASROptions) {
    super(options);
    // WebSocket API 地址
    this.baseUrl = options.baseUrl || 'wss://dashscope.aliyuncs.com/api-ws/v1/inference/';
    // 默认使用 paraformer-realtime-v2（支持多语言、任意采样率）
    this.model = options.model || 'paraformer-realtime-v2';

    // 音频配置
    this.sampleRate = options.audioFormat?.sampleRate;

    // 识别配置
    this.enableWords = options.enableWords;
    this.enablePunctuationPrediction = options.enablePunc;
    this.enableInverseTextNormalization = options.enableItn;
  }

  /**
   * 构建认证请求头
   */
  private buildAuthHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.apiKey}`,
    };
  }

  /**
   * 将语言代码转换为 language_hints 格式
   * 例如: 'zh-CN' -> ['zh'], 'en-US' -> ['en']
   */
  private getLanguageHints(): string[] | undefined {
    if (!this.language) return undefined;

    // 提取语言主代码
    const langMap: Record<string, string> = {
      'zh-CN': 'zh',
      'zh-TW': 'zh',
      'zh-HK': 'zh',
      'en-US': 'en',
      'en-GB': 'en',
      'ja-JP': 'ja',
      'ko-KR': 'ko',
      'de-DE': 'de',
      'fr-FR': 'fr',
      'es-ES': 'es',
      'ru-RU': 'ru',
      'pt-BR': 'pt',
      'it-IT': 'it',
      'nl-NL': 'nl',
      'pl-PL': 'pl',
      'tr-TR': 'tr',
      'vi-VN': 'vi',
      'th-TH': 'th',
      'ar-SA': 'ar',
    };

    const hint = langMap[this.language] || this.language.split('-')[0];
    return [hint];
  }

  /**
   * 创建响应队列
   * 用于解耦发送和接收逻辑
   */
  private createResponseQueue() {
    const queue: {
      items: ASRStreamChunk[];
      resolve: ((value: ASRStreamChunk | null) => void) | null;
      done: boolean;
      error: Error | null;
    } = {
      items: [],
      resolve: null,
      done: false,
      error: null,
    };

    return {
      push: (item: ASRStreamChunk) => {
        if (queue.resolve) {
          queue.resolve(item);
          queue.resolve = null;
        } else {
          queue.items.push(item);
        }
      },
      next: async (): Promise<ASRStreamChunk | null> => {
        if (queue.items.length > 0) {
          const item = queue.items.shift();
          return item ?? null;
        }
        if (queue.done) {
          return null;
        }
        return new Promise((resolve) => {
          queue.resolve = resolve;
        });
      },
      complete: () => {
        queue.done = true;
        if (queue.resolve) {
          queue.resolve(null);
          queue.resolve = null;
        }
      },
      error: (err: Error) => {
        queue.error = err;
        if (queue.resolve) {
          queue.resolve(null);
          queue.resolve = null;
        }
      },
      getError: () => queue.error,
    };
  }

  /**
   * 设置 WebSocket 消息处理器
   * 事件驱动模式，不阻塞主流程
   */
  private setupMessageHandler(ws: WebSocket, queue: ReturnType<typeof this.createResponseQueue>) {
    const handleMessage = (data: WebSocket.RawData) => {
      try {
        const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer);
        const event = parseServerResponse(buffer);

        // 处理失败事件
        if (isFailedEvent(event)) {
          queue.error(
            new Error(`ASR task failed: ${event.header.error_code} - ${event.header.error_message}`)
          );
          return;
        }

        // 处理完成事件
        if (isFinishedEvent(event)) {
          // 可能有最后一个句子
          if (event.payload.output?.sentence) {
            const sentence = event.payload.output.sentence;
            const chunk: ASRStreamChunk = {
              text: sentence.text,
              isFinal: true,
              confidence: sentence.confidence,
            };

            if (sentence.start_time !== undefined && sentence.end_time !== undefined) {
              chunk.segment = {
                id: 0,
                start: sentence.start_time,
                end: sentence.end_time,
                text: sentence.text,
                confidence: sentence.confidence,
              };
            }

            queue.push(chunk);
          }
          queue.complete();
          return;
        }

        // 处理结果生成事件
        if (isResultGeneratedEvent(event)) {
          const sentence = event.payload.output.sentence;
          const chunk: ASRStreamChunk = {
            text: sentence.text,
            // 使用 sentence_end 字段判断是否为最终结果
            isFinal: sentence.sentence_end === true,
            confidence: sentence.confidence,
          };

          // 构建分段信息
          if (sentence.start_time !== undefined && sentence.end_time !== undefined) {
            chunk.segment = {
              id: 0,
              start: sentence.start_time,
              end: sentence.end_time,
              text: sentence.text,
              confidence: sentence.confidence,
            } as ASRSegment;
          }

          queue.push(chunk);
        }
      } catch (err) {
        queue.error(err instanceof Error ? err : new Error(String(err)));
      }
    };

    ws.on('message', handleMessage);

    // 处理连接关闭事件
    const handleClose = (_code: number, _reason: Buffer) => {
      // 如果队列还没有完成，说明连接意外关闭
      if (!queue.getError()) {
        queue.complete();
      }
    };

    // 处理连接错误事件
    const handleError = (err: Error) => {
      queue.error(err);
    };

    ws.on('close', handleClose);
    ws.on('error', handleError);

    return () => {
      ws.off('message', handleMessage);
      ws.off('close', handleClose);
      ws.off('error', handleError);
    };
  }

  /**
   * 发送音频流
   * 作为后台任务运行，不阻塞主流程
   */
  private async sendAudioStream(ws: WebSocket, audio: AudioStream): Promise<void> {
    for await (const chunk of audio) {
      const data = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      await sendBinaryData(ws, data);
    }
  }

  /**
   * 流式输入识别方法
   * 接收音频流进行识别，实现双向通信：边发边收
   *
   * @param audio 音频流
   * @param detectedSampleRate 可选的检测到的采样率（优先于实例的 sampleRate）
   */
  async *listenStream(
    audio: AudioStream,
    detectedSampleRate?: number
  ): AsyncIterable<ASRStreamChunk> {
    // 验证必要参数
    if (!this.apiKey) {
      throw new Error('apiKey is required for Qwen ASR');
    }

    // 使用传入的采样率或实例的采样率
    const sampleRate = detectedSampleRate ?? this.sampleRate;

    // 创建 WebSocket 连接
    const ws = new WebSocket(this.baseUrl, {
      headers: this.buildAuthHeaders(),
    });

    try {
      // 等待连接建立
      await new Promise<void>((resolve, reject) => {
        ws.on('open', resolve);
        ws.on('error', reject);
      });

      yield* this.listenStreamOnConnection(ws, audio, sampleRate);
    } finally {
      ws.close();
    }
  }

  /**
   * 预建立 WebSocket 连接
   * 只建立连接，不发送协议级初始化（DashScope 的 run-task 是 task 级别，每次 listen 时才发送）
   */
  override async connect(options?: ASRConnectOptions): Promise<ASRConnection> {
    if (!this.apiKey) {
      throw new Error('apiKey is required for Qwen ASR');
    }

    const timeout = options?.timeout ?? 10000;

    const ws = new WebSocket(this.baseUrl, {
      headers: this.buildAuthHeaders(),
    });

    // 带超时的连接等待
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Connection timed out after ${timeout}ms`));
        ws.close();
      }, timeout);

      ws.once('open', () => {
        clearTimeout(timer);
        resolve();
      });

      ws.once('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });

    return new QwenASRConnection(ws, this);
  }

  /**
   * 在已建立的 WebSocket 连接上进行流式识别
   * 从 listenStream 中提取的核心逻辑，不创建/关闭 WebSocket
   */
  async *listenStreamOnConnection(
    ws: WebSocket,
    audio: AudioStream,
    detectedSampleRate?: number
  ): AsyncIterable<ASRStreamChunk> {
    const sampleRate = detectedSampleRate ?? this.sampleRate;

    // 创建响应队列
    const queue = this.createResponseQueue();

    // 设置消息处理器（事件驱动，不阻塞）
    let cleanup: (() => void) | undefined;

    try {
      cleanup = this.setupMessageHandler(ws, queue);

      // 生成任务 ID
      const taskId = randomUUID();

      // 发送 run-task 指令
      const runTaskMsg = createRunTaskMessage(taskId, {
        model: this.model,
        format: this.format || 'mp3',
        sampleRate,
        languageHints: this.getLanguageHints(),
        enableWords: this.enableWords,
        enablePunctuationPrediction: this.enablePunctuationPrediction,
        enableInverseTextNormalization: this.enableInverseTextNormalization,
      });
      await sendMessage(ws, runTaskMsg);

      // 等待 task-started 事件
      await waitForTaskStarted(ws);

      // 启动发送任务，完成后发送 finish-task
      const sendWithFinishPromise = this.sendAudioStream(ws, audio).then(async () => {
        const finishTaskMsg = createFinishTaskMessage(taskId);
        await sendMessage(ws, finishTaskMsg);
      });

      // 从队列 yield 响应（边发边收）
      while (true) {
        const chunk = await queue.next();

        if (chunk === null) {
          break;
        }

        yield chunk;
      }

      // 等待发送任务和 finish-task 完成
      await sendWithFinishPromise;

      // 检查是否有错误
      const queueError = queue.getError();
      if (queueError) {
        throw queueError;
      }
    } finally {
      cleanup?.();
    }
  }

  /**
   * 将音频文件路径转换为原始音频流
   * Qwen ASR 原生支持 mp3、wav、pcm 等格式，直接发送原始数据即可
   */
  async *fileToRawAudioStream(filePath: string): AudioStream {
    const buffer = await readFile(filePath);
    // 分块发送，每块约 4KB
    const chunkSize = 4096;
    for (let i = 0; i < buffer.length; i += chunkSize) {
      yield buffer.subarray(i, Math.min(i + chunkSize, buffer.length));
    }
  }

  /**
   * 判断输入是否为文件路径
   */
  isFilePath(input: AudioStreamInput): input is string {
    if (typeof input !== 'string') return false;
    // 简单判断：如果字符串看起来像路径就尝试作为文件处理
    return (
      input.includes('/') ||
      input.includes('\\') ||
      input.endsWith('.mp3') ||
      input.endsWith('.wav')
    );
  }

  /**
   * 重写 listen 方法以支持原始音频文件
   * Qwen ASR 原生支持 mp3、wav、pcm 等格式，不需要转换为 PCM
   */
  listen(
    audio: AudioStreamInput,
    options: ListenInstanceOptions & { stream: true }
  ): AsyncIterable<ASRStreamChunk>;

  listen(
    audio: AudioStreamInput,
    options?: ListenInstanceOptions & { stream?: false }
  ): Promise<ASRResponse>;

  listen(
    audio: AudioStreamInput,
    options?: ListenInstanceOptions
  ): Promise<ASRResponse> | AsyncIterable<ASRStreamChunk> {
    // 如果是文件路径，使用原始音频流，并自动检测采样率
    if (this.isFilePath(audio)) {
      // 检测文件采样率
      const detectedRate = detectSampleRate(audio);
      const effectiveSampleRate = detectedRate ?? this.sampleRate;

      const rawStream = this.fileToRawAudioStream(audio);
      if (options?.stream === true) {
        return this.listenStream(rawStream, effectiveSampleRate);
      }
      return this.collectQwenResponse(rawStream, effectiveSampleRate);
    }

    // 其他情况：自行处理
    if (options?.stream === true) {
      return this.createQwenStreamIterable(audio);
    }
    return this.collectQwenResponse(this.adaptQwenAudioInput(audio), this.sampleRate);
  }

  /**
   * 判断输入是否为音频流（Qwen 专用）
   */
  private isQwenAudioStream(input: AudioStreamInput): input is AudioStream {
    return input !== null && typeof input === 'object' && Symbol.asyncIterator in input;
  }

  /**
   * 判断输入是否为字符串（Qwen 专用）
   */
  private isQwenString(input: AudioStreamInput): input is string {
    return typeof input === 'string';
  }

  /**
   * 适配音频输入为音频流（Qwen 专用）
   */
  adaptQwenAudioInput(audio: AudioStreamInput): AudioStream {
    if (this.isQwenAudioStream(audio)) return audio;
    // 对于非文件路径的字符串，使用父类的 PCM 转换
    if (this.isQwenString(audio) && !this.isFilePath(audio)) {
      // 这里返回一个空的音频流，实际不应该走到这个分支
      // 因为 isFilePath 应该已经匹配了所有文件路径
      throw new Error('Invalid audio input: expected file path or audio stream');
    }
    // Buffer 或 Uint8Array：分块发送，每块约 4KB
    const buffer = Buffer.isBuffer(audio) ? audio : Buffer.from(audio);
    const chunkSize = 4096;
    return (async function* () {
      for (let i = 0; i < buffer.length; i += chunkSize) {
        yield buffer.subarray(i, Math.min(i + chunkSize, buffer.length));
      }
    })();
  }

  /**
   * 创建流式迭代器（Qwen 专用）
   */
  private async *createQwenStreamIterable(audio: AudioStreamInput): AsyncIterable<ASRStreamChunk> {
    // 对于文件路径，检测采样率
    const sampleRate = this.isFilePath(audio)
      ? (detectSampleRate(audio) ?? this.sampleRate)
      : this.sampleRate;
    const audioStream = this.isFilePath(audio)
      ? this.fileToRawAudioStream(audio)
      : this.adaptQwenAudioInput(audio);
    yield* this.listenStream(audioStream, sampleRate);
  }

  /**
   * 收集非流式识别结果（Qwen 专用）
   */
  private async collectQwenResponse(
    audio: AudioStream,
    detectedSampleRate?: number
  ): Promise<ASRResponse> {
    const segments: ASRSegment[] = [];
    const textParts: string[] = [];

    for await (const chunk of this.listenStream(audio, detectedSampleRate)) {
      if (chunk.isFinal && chunk.text) {
        textParts.push(chunk.text);
      }
      if (chunk.segment) {
        segments.push(chunk.segment);
      }
    }

    return {
      text: textParts.join(''),
      segments: segments.length > 0 ? segments : undefined,
    };
  }
}

/**
 * Qwen ASR 连接实例
 * 通过 QwenASR.connect() 获取，持有已建立的 WebSocket 连接
 */
class QwenASRConnection implements ASRConnection {
  private _state: ASRConnectionState = 'connected';

  constructor(
    private ws: WebSocket,
    private provider: QwenASR
  ) {}

  get state(): ASRConnectionState {
    if (this.ws.readyState === WebSocket.CLOSED || this.ws.readyState === WebSocket.CLOSING) {
      return 'closed';
    }
    return this._state;
  }

  listen(
    audio: AudioStreamInput,
    options: ListenInstanceOptions & { stream: true }
  ): AsyncIterable<ASRStreamChunk>;

  listen(
    audio: AudioStreamInput,
    options?: ListenInstanceOptions & { stream?: false }
  ): Promise<ASRResponse>;

  listen(
    audio: AudioStreamInput,
    options?: ListenInstanceOptions
  ): Promise<ASRResponse> | AsyncIterable<ASRStreamChunk> {
    this.ensureConnected();

    const { audioStream, sampleRate } = this.adaptAudioInput(audio);

    if (options?.stream === true) {
      return this.streamOnConnection(audioStream, sampleRate);
    }
    return this.collectResponse(audioStream, sampleRate);
  }

  close(): void {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.close();
    }
    this._state = 'closed';
  }

  private ensureConnected(): void {
    if (this.state !== 'connected') {
      throw new Error('Connection is closed');
    }
  }

  private adaptAudioInput(audio: AudioStreamInput): {
    audioStream: AudioStream;
    sampleRate?: number;
  } {
    if (this.provider.isFilePath(audio)) {
      const sampleRate = detectSampleRate(audio) ?? this.provider.sampleRate;
      return {
        audioStream: this.provider.fileToRawAudioStream(audio),
        sampleRate,
      };
    }
    return {
      audioStream: this.provider.adaptQwenAudioInput(audio),
      sampleRate: this.provider.sampleRate,
    };
  }

  private async *streamOnConnection(
    audioStream: AudioStream,
    sampleRate?: number
  ): AsyncIterable<ASRStreamChunk> {
    yield* this.provider.listenStreamOnConnection(this.ws, audioStream, sampleRate);
  }

  private async collectResponse(
    audioStream: AudioStream,
    sampleRate?: number
  ): Promise<ASRResponse> {
    const segments: ASRSegment[] = [];
    const textParts: string[] = [];

    for await (const chunk of this.provider.listenStreamOnConnection(
      this.ws,
      audioStream,
      sampleRate
    )) {
      if (chunk.isFinal && chunk.text) {
        textParts.push(chunk.text);
      }
      if (chunk.segment) {
        segments.push(chunk.segment);
      }
    }

    return {
      text: textParts.join(''),
      segments: segments.length > 0 ? segments : undefined,
    };
  }
}
