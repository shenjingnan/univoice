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
import { DEFAULT_SAMPLE_RATE } from '@/asr/utils/audio';
import type { ASROptions, ASRStreamChunk, AudioStream } from '@/types/asr';

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

  constructor(options: ASROptions) {
    super(options);

    // 豆包专用配置
    this.appKey = options.appKey || '';
    this.accessKey = options.accessKey || options.apiKey || '';
    this.resourceId = options.resourceId || 'volc.bigasr.sauc.duration';
    this.mode = options.mode || 'nostream';

    // 音频配置
    this.sampleRate = options.sampleRate || DEFAULT_SAMPLE_RATE;
    this.bits = options.bits || 16;
    this.channel = options.channel || 1;
    this.segmentDuration = options.segmentDuration || 200;

    // 识别配置
    this.enableItn = options.enableItn ?? true;
    this.enablePunc = options.enablePunc ?? true;
    this.enableDdc = options.enableDdc ?? false;
    this.showUtterances = options.showUtterances ?? true;

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
   * 构建 Full Client Request 参数（PCM 格式）
   * 使用实例属性配置音频格式
   */
  private buildPcmFullClientRequestParams(): FullClientRequestParams {
    return {
      user: {
        uid: 'univoice-sdk',
      },
      audio: {
        format: 'pcm',
        codec: 'raw',
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

      // 创建响应队列
      const queue = this.createResponseQueue();

      // 设置消息处理器（事件驱动，不阻塞）
      let cleanup: (() => void) | undefined;

      try {
        cleanup = this.setupMessageHandler(ws, queue);

        // 初始化序列号
        let sequence = 1;

        // 发送 Full Client Request
        const fullClientRequest = buildFullClientRequest(
          this.buildPcmFullClientRequestParams(),
          sequence++
        );
        ws.send(fullClientRequest);

        // 等待初始化确认（使用 receiveMessage 确保同步）
        const initResponse = await this.receiveMessage(ws);
        if (initResponse.code !== 0) {
          throw new Error(`Init failed: ${getErrorMessage(initResponse.code)}`);
        }

        // 启动发送任务（不等待，让它在后台运行）
        const sendPromise = this.sendAudioStream(ws, audio, sequence);

        // 从队列 yield 响应（边发边收）
        while (true) {
          const chunk = await queue.next();

          if (chunk === null) {
            // 队列已完成
            break;
          }

          yield chunk;

          if (chunk.isFinal) {
            break;
          }
        }

        // 等待发送任务完成
        await sendPromise;

        // 检查是否有错误
        const queueError = queue.getError();
        if (queueError) {
          throw queueError;
        }
      } finally {
        cleanup?.();
      }
    } finally {
      ws.close();
    }
  }
}
