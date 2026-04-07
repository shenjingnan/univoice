import { Buffer } from 'node:buffer';
import WebSocket from 'ws';
import { BaseASR } from '@/asr/base';
import {
  buildAuthUrl,
  createFirstFrame,
  createLastFrame,
  createMiddleFrame,
  decodeResultText,
  extractTextFromResult,
  hasResultPayload,
  isFinishedResponse,
  isSuccessResponse,
  parseResponse,
  type XfyunProtocolOptions,
} from '@/asr/protocols/xfyun';
import type { ASRStreamChunk, AudioStream, XfyunASROptions } from '@/types/asr';

/**
 * 科大讯飞 ASR 提供商
 * 基于讯飞开放平台 IAT（语音听写）WebSocket JSON API 实现语音识别
 *
 * 支持中英文及 202 种方言识别，音频时长不超过 60 秒
 */
export class XfyunASR extends BaseASR {
  name = 'xfyun';

  /** 讯飞 AppID */
  public appId: string;
  /** 讯飞 APISecret（用于 HMAC-SHA256 签名） */
  public apiSecret: string;

  /** 音频采样率 */
  public sampleRate: number;
  /** 音频位深度 */
  public bitDepth: number;
  /** 音频声道数 */
  public channels: number;

  /** 识别领域 */
  public domain: string;
  /** 口音 */
  public accent: string;
  /** 静音超时时间（毫秒） */
  public eos: number;
  /** 动态修正控制 */
  public dwa?: string;
  /** 中英文筛选 */
  public ltc?: number;
  /** 应用级热词 ID */
  public resId?: string;
  /** 会话热词 */
  public dhw?: string;

  constructor(options: XfyunASROptions) {
    super(options);
    this.appId = options.appId || '';
    this.apiSecret = options.apiSecret || '';

    // 音频配置：默认 PCM 16kHz 16bit 单声道
    this.sampleRate = options.sampleRate ?? 16000;
    this.bitDepth = options.bitDepth ?? 16;
    this.channels = options.channels ?? 1;

    // 识别配置
    this.domain = options.domain ?? 'slm';
    this.accent = options.accent ?? 'mandarin';
    this.eos = options.eos ?? 6000;
    this.dwa = options.dwa;
    this.ltc = options.ltc;
    this.resId = options.resId;
    this.dhw = options.dhw;
  }

  /**
   * 将语言代码映射为科大讯飞格式
   * zh-CN -> zh_cn, en-US -> en_us
   */
  private mapLanguage(lang: string): string {
    const langMap: Record<string, string> = {
      'zh-CN': 'zh_cn',
      'zh-TW': 'zh_cn',
      'zh-HK': 'zh_cn',
      'en-US': 'en_us',
      'en-GB': 'en_us',
    };
    return langMap[lang] || 'zh_cn';
  }

  /**
   * 将音频格式映射为科大讯飞编码格式
   * pcm -> raw, mp3 -> lame
   */
  private mapEncoding(format: string): string {
    const encodingMap: Record<string, string> = {
      pcm: 'raw',
      mp3: 'lame',
    };
    return encodingMap[format] || 'raw';
  }

  /**
   * 构建协议配置选项
   */
  private buildProtocolOptions(): XfyunProtocolOptions {
    return {
      appId: this.appId,
      apiKey: this.apiKey,
      apiSecret: this.apiSecret,
      encoding: this.mapEncoding(this.format),
      sampleRate: this.sampleRate,
      bitDepth: this.bitDepth,
      channels: this.channels,
      domain: this.domain,
      language: this.mapLanguage(this.language),
      accent: this.accent,
      eos: this.eos,
      dwa: this.dwa,
      ltc: this.ltc,
      resId: this.resId,
      dhw: this.dhw,
    };
  }

  /**
   * 创建响应队列
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
   */
  private setupMessageHandler(ws: WebSocket, queue: ReturnType<typeof this.createResponseQueue>) {
    const handleMessage = (data: WebSocket.RawData) => {
      try {
        const response = parseResponse(data);

        // 检查错误响应
        if (!isSuccessResponse(response)) {
          queue.error(
            new Error(`Xfyun ASR error: ${response.header.code} - ${response.header.message}`)
          );
          return;
        }

        // 处理包含识别结果的响应
        if (hasResultPayload(response) && response.payload?.result?.text) {
          const resultText = response.payload.result.text;
          const decoded = decodeResultText(resultText);
          const text = extractTextFromResult(decoded);
          const isFinal = isFinishedResponse(response) || decoded.ls === true;

          queue.push({
            text,
            isFinal,
          });
        }

        // 如果是最后一帧，标记队列完成
        if (isFinishedResponse(response)) {
          queue.complete();
        }
      } catch (err) {
        queue.error(err instanceof Error ? err : new Error(String(err)));
      }
    };

    const handleClose = () => {
      if (!queue.getError()) {
        queue.complete();
      }
    };

    const handleError = (err: Error) => {
      queue.error(err);
    };

    ws.on('message', handleMessage);
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
   * 按 1280 字节分块，40ms 间隔发送
   */
  private async sendAudioStream(
    ws: WebSocket,
    audio: AudioStream,
    protocolOptions: XfyunProtocolOptions
  ): Promise<number> {
    const CHUNK_SIZE = 1280;
    const SEND_INTERVAL = 40;
    let seq = 0;
    let isFirst = true;

    for await (const chunk of audio) {
      const data = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array);

      // 按 CHUNK_SIZE 分块发送
      for (let offset = 0; offset < data.length; offset += CHUNK_SIZE) {
        const end = Math.min(offset + CHUNK_SIZE, data.length);
        const piece = data.subarray(offset, end);
        const audioBase64 = piece.toString('base64');
        seq++;

        if (isFirst) {
          const frame = createFirstFrame(protocolOptions, audioBase64, seq);
          ws.send(frame);
          isFirst = false;
        } else {
          const frame = createMiddleFrame(protocolOptions, audioBase64, seq);
          ws.send(frame);
        }

        // 40ms 间隔
        await new Promise((resolve) => setTimeout(resolve, SEND_INTERVAL));
      }
    }

    return seq;
  }

  /**
   * 流式输入识别方法
   */
  async *listenStream(audio: AudioStream): AsyncIterable<ASRStreamChunk> {
    // 验证凭据
    if (!this.appId) {
      throw new Error('appId is required for Xfyun ASR');
    }
    if (!this.apiKey) {
      throw new Error('apiKey is required for Xfyun ASR');
    }
    if (!this.apiSecret) {
      throw new Error('apiSecret is required for Xfyun ASR');
    }

    const protocolOptions = this.buildProtocolOptions();

    // 生成鉴权 URL
    const url = buildAuthUrl('iat.xf-yun.com', '/v1', this.apiKey, this.apiSecret);

    // 建立 WebSocket 连接
    const ws = new WebSocket(url);

    try {
      // 等待连接建立
      await new Promise<void>((resolve, reject) => {
        ws.on('open', resolve);
        ws.on('error', reject);
      });

      // 创建响应队列
      const queue = this.createResponseQueue();

      // 设置消息处理器
      const cleanup = this.setupMessageHandler(ws, queue);

      try {
        // 后台发送音频流
        const sendPromise = this.sendAudioStream(ws, audio, protocolOptions).then(
          async (lastSeq) => {
            // 发送末帧
            const lastFrame = createLastFrame(protocolOptions, lastSeq + 1);
            ws.send(lastFrame);
          }
        );

        // 从队列 yield 响应
        while (true) {
          const chunk = await queue.next();
          if (chunk === null) break;
          yield chunk;
        }

        // 等待发送完成
        await sendPromise;

        // 检查是否有错误
        const queueError = queue.getError();
        if (queueError) {
          throw queueError;
        }
      } finally {
        cleanup();
      }
    } finally {
      ws.close();
    }
  }
}
