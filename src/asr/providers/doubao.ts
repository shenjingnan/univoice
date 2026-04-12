import { Buffer } from 'node:buffer';
import WebSocket from 'ws';
import { BaseASR } from '@/asr/base';
import {
  buildAudioOnlyRequest,
  buildAuthHeaders,
  buildFullClientRequest,
  type FullClientRequestParams,
  getErrorMessage,
  parseResponse,
} from '@/asr/protocols/sauc';
import { bufferToAudioStream, DEFAULT_SAMPLE_RATE } from '@/asr/utils/audio';
import type {
  ASRConnection,
  ASRConnectionState,
  ASRConnectOptions,
  ASRResponse,
  ASRSegment,
  ASRStreamChunk,
  AudioStream,
  AudioStreamInput,
  DoubaoASROptions,
  ListenInstanceOptions,
} from '@/types/asr';

/**
 * 豆包 ASR 提供商
 * 使用 WebSocket 二进制协议实现语音识别
 */
export class DoubaoASR extends BaseASR {
  name = 'doubao';

  // 豆包专用配置
  public appKey: string;
  public accessKey: string;
  public resourceId: string;
  public mode: 'streaming' | 'nostream' | 'async';

  // 音频配置
  public sampleRate: number;
  public bits: number;
  public channel: number;
  public segmentDuration: number;

  // 识别配置
  public enableItn: boolean;
  public enablePunc: boolean;
  public enableDdc: boolean;
  public showUtterances: boolean;

  // VAD 配置
  public endWindowSize?: number;
  public enableNonstream?: boolean;
  public vadSegmentDuration?: number;
  public forceToSpeechTime?: number;

  constructor(options: DoubaoASROptions) {
    super(options);

    // 豆包专用配置
    this.appKey = options.appKey || '';
    this.accessKey = options.accessKey || options.apiKey || '';
    this.resourceId = options.resourceId || 'volc.bigasr.sauc.duration';
    this.mode = options.mode || 'streaming';

    // 音频格式配置
    const audioFormat = options.audioFormat || {};
    this.sampleRate = audioFormat.sampleRate || DEFAULT_SAMPLE_RATE;
    this.bits = audioFormat.bits || 16;
    this.channel = audioFormat.channel || 1;
    this.segmentDuration = options.segmentDuration || 200;

    // 识别配置
    this.enableItn = options.enableItn ?? true;
    this.enablePunc = options.enablePunc ?? true;
    this.enableDdc = options.enableDdc ?? false;
    this.showUtterances = options.showUtterances ?? true;

    // VAD 配置
    this.endWindowSize = options.endWindowSize;
    this.enableNonstream = options.enableNonstream;
    this.vadSegmentDuration = options.vadSegmentDuration;
    this.forceToSpeechTime = options.forceToSpeechTime;

    // WebSocket 基础 URL
    this.baseUrl = options.baseUrl || 'wss://openspeech.bytedance.com/api/v3/sauc';
  }

  /**
   * 获取 WebSocket URL
   */
  private getWebSocketUrl(): string {
    switch (this.mode) {
      case 'streaming':
        return `${this.baseUrl}/bigmodel`;
      case 'async':
        return `${this.baseUrl}/bigmodel_async`;
      default:
        return `${this.baseUrl}/bigmodel_nostream`;
    }
  }

  /**
   * 等待 WebSocket 连接建立
   */
  private waitForConnection(ws: WebSocket): Promise<void> {
    return new Promise((resolve, reject) => {
      ws.once('open', () => resolve());
      ws.once('error', (error) => reject(error));
    });
  }

  /**
   * 接收 WebSocket 消息
   */
  private receiveMessage(ws: WebSocket): Promise<ReturnType<typeof parseResponse>> {
    return new Promise((resolve, reject) => {
      const handleMessage = (data: WebSocket.RawData) => {
        ws.off('message', handleMessage);
        ws.off('error', handleError);

        try {
          const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer);
          const response = parseResponse(buffer);
          resolve(response);
        } catch (error) {
          reject(error);
        }
      };

      const handleError = (error: Error) => {
        ws.off('message', handleMessage);
        ws.off('error', handleError);
        reject(error);
      };

      ws.on('message', handleMessage);
      ws.on('error', handleError);
    });
  }

  /**
   * 构建 Full Client Request 参数
   * 使用实例属性配置音频格式，支持 PCM、OGG/Opus 等格式
   */
  private buildFullClientRequestParams(): FullClientRequestParams {
    return {
      user: {
        uid: 'univoice-sdk',
      },
      audio: {
        format: this.format,
        codec: this.codec,
        rate: this.sampleRate,
        bits: this.bits,
        channel: this.channel,
        language: this.language,
      },
      request: {
        model_name: 'bigmodel',
        enable_itn: this.enableItn,
        enable_punc: this.enablePunc,
        enable_ddc: this.enableDdc,
        show_utterances: this.showUtterances,
        // VAD 参数：仅在有值时传递，未传则使用服务端默认值
        ...(this.endWindowSize !== undefined && { end_window_size: this.endWindowSize }),
        ...(this.enableNonstream !== undefined && { enable_nonstream: this.enableNonstream }),
        ...(this.vadSegmentDuration !== undefined && {
          vad_segment_duration: this.vadSegmentDuration,
        }),
        ...(this.forceToSpeechTime !== undefined && {
          force_to_speech_time: this.forceToSpeechTime,
        }),
      },
    };
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
        const response = parseResponse(buffer);

        if (response.code !== 0) {
          queue.error(new Error(`ASR error: ${getErrorMessage(response.code)}`));
          return;
        }

        if (response.payloadMsg?.result) {
          const result = response.payloadMsg.result;
          const chunk: ASRStreamChunk = {
            text: result.text,
            isFinal: response.isLastPackage,
          };

          if (result.utterances && result.utterances.length > 0) {
            const utt = result.utterances[0];
            chunk.segment = {
              id: 0,
              start: utt.start_time,
              end: utt.end_time,
              text: utt.text,
              confidence: utt.definite ? 1.0 : 0.8,
            };
          }

          queue.push(chunk);
        }

        if (response.isLastPackage) {
          queue.complete();
        }
      } catch (err) {
        queue.error(err instanceof Error ? err : new Error(String(err)));
      }
    };

    ws.on('message', handleMessage);

    return () => {
      ws.off('message', handleMessage);
    };
  }

  /**
   * 发送音频流
   * 作为后台任务运行，不阻塞主流程
   */
  private async sendAudioStream(
    ws: WebSocket,
    audio: AudioStream,
    initialSequence: number
  ): Promise<number> {
    let sequence = initialSequence;

    for await (const chunk of audio) {
      const data = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      const audioRequest = buildAudioOnlyRequest(sequence, data, false);
      ws.send(audioRequest);
      sequence++;
    }

    // 发送结束标记
    const lastRequest = buildAudioOnlyRequest(sequence, Buffer.alloc(0), true);
    ws.send(lastRequest);

    return sequence;
  }

  /**
   * 流式输入识别方法
   * 接收音频流进行识别，实现双向通信：边发边收
   */
  async *listenStream(audio: AudioStream): AsyncIterable<ASRStreamChunk> {
    // 验证必要参数
    if (!this.appKey) {
      throw new Error('appKey is required for Doubao ASR');
    }
    if (!this.accessKey) {
      throw new Error('accessKey is required for Doubao ASR');
    }

    // 创建 WebSocket 连接
    const url = this.getWebSocketUrl();
    const headers = buildAuthHeaders({
      appKey: this.appKey,
      accessKey: this.accessKey,
      resourceId: this.resourceId,
    });

    const ws = new WebSocket(url, { headers });

    try {
      // 等待连接建立
      await this.waitForConnection(ws);

      // 发送 Full Client Request 并等待确认
      let sequence = 1;
      const fullClientRequest = buildFullClientRequest(
        this.buildFullClientRequestParams(),
        sequence++
      );
      ws.send(fullClientRequest);

      const initResponse = await this.receiveMessage(ws);
      if (initResponse.code !== 0) {
        throw new Error(`Init failed: ${getErrorMessage(initResponse.code)}`);
      }

      yield* this.listenStreamOnConnection(ws, audio, { value: sequence });
    } finally {
      ws.close();
    }
  }

  /**
   * 预建立 WebSocket 连接
   * 建立 WebSocket 连接并发送 FullClientRequest（SAUC 协议的连接级别初始化）
   */
  override async connect(options?: ASRConnectOptions): Promise<ASRConnection> {
    if (!this.appKey) {
      throw new Error('appKey is required for Doubao ASR');
    }
    if (!this.accessKey) {
      throw new Error('accessKey is required for Doubao ASR');
    }

    const timeout = options?.timeout ?? 10000;

    const url = this.getWebSocketUrl();
    const headers = buildAuthHeaders({
      appKey: this.appKey,
      accessKey: this.accessKey,
      resourceId: this.resourceId,
    });

    const ws = new WebSocket(url, { headers });

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

    // 发送 FullClientRequest（连接级别初始化）
    let sequence = 1;
    const fullClientRequest = buildFullClientRequest(
      this.buildFullClientRequestParams(),
      sequence++
    );
    ws.send(fullClientRequest);

    // 等待初始化确认
    const initResponse = await this.receiveMessage(ws);
    if (initResponse.code !== 0) {
      ws.close();
      throw new Error(`Init failed: ${getErrorMessage(initResponse.code)}`);
    }

    return new DoubaoASRConnection(ws, this, sequence);
  }

  /**
   * 在已建立的 WebSocket 连接上进行流式识别
   * 不创建/关闭 WebSocket，不发送 FullClientRequest
   */
  async *listenStreamOnConnection(
    ws: WebSocket,
    audio: AudioStream,
    seqHolder: { value: number }
  ): AsyncIterable<ASRStreamChunk> {
    const queue = this.createResponseQueue();
    let cleanup: (() => void) | undefined;

    try {
      cleanup = this.setupMessageHandler(ws, queue);

      const sendPromise = this.sendAudioStream(ws, audio, seqHolder.value);

      while (true) {
        const chunk = await queue.next();

        if (chunk === null) {
          break;
        }

        yield chunk;

        if (chunk.isFinal) {
          break;
        }
      }

      const finalSeq = await sendPromise;
      // 更新序列号持有者，供下次 listen 使用
      seqHolder.value = finalSeq + 1;

      const queueError = queue.getError();
      if (queueError) {
        throw queueError;
      }
    } finally {
      cleanup?.();
    }
  }
}

/**
 * 豆包 ASR 连接实例
 * 通过 DoubaoASR.connect() 获取，持有已建立的 WebSocket 连接
 */
class DoubaoASRConnection implements ASRConnection {
  private _state: ASRConnectionState = 'connected';
  private seqHolder: { value: number };

  constructor(
    private ws: WebSocket,
    private provider: DoubaoASR,
    initialSequence: number
  ) {
    this.seqHolder = { value: initialSequence };
  }

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

    const audioStream = this.adaptAudioInput(audio);

    if (options?.stream === true) {
      return this.provider.listenStreamOnConnection(this.ws, audioStream, this.seqHolder);
    }
    return this.collectResponse(audioStream);
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

  private adaptAudioInput(audio: AudioStreamInput): AudioStream {
    if (audio !== null && typeof audio === 'object' && Symbol.asyncIterator in audio) {
      return audio;
    }
    if (typeof audio === 'string') {
      throw new Error('DoubaoASR connection does not support file path input');
    }
    return bufferToAudioStream(audio);
  }

  private async collectResponse(audioStream: AudioStream): Promise<ASRResponse> {
    const segments: ASRSegment[] = [];
    const textParts: string[] = [];

    for await (const chunk of this.provider.listenStreamOnConnection(
      this.ws,
      audioStream,
      this.seqHolder
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
