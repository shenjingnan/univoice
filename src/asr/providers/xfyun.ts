import { Buffer } from 'node:buffer';
import WebSocket from 'ws';
import { BaseASR } from '@/asr/base';
import {
  buildAuthUrl,
  createFirstFrame,
  createLastFrame,
  createMiddleFrame,
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
 * 基于讯飞开放平台 IAT（语音听写）WebSocket JSON API v2 实现语音识别
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
  /** 会话热词 */
  public dhw?: string;
  /** 标点符号控制 */
  public ptt?: number;
  /** 语言区域 */
  public rlang?: string;
  /** 返回词级时间戳 */
  public vinfo?: number;
  /** 返回数值的阿拉伯数字格式 */
  public nunum?: number;
  /** 返回候选句子数量 */
  public nbest?: number;
  /** 自定义热词的权重信息 */
  public wbest?: number;
  /** 音频发送间隔（毫秒） */
  public sendInterval: number;

  constructor(options: XfyunASROptions) {
    super(options);
    this.appId = options.appId || '';
    this.apiSecret = options.apiSecret || '';

    // 音频配置：默认 PCM 16kHz
    this.sampleRate = options.sampleRate ?? 16000;

    // 识别配置
    this.domain = options.domain ?? 'iat';
    this.accent = options.accent ?? 'mandarin';
    this.eos = options.eos ?? 2000;
    this.dwa = options.dwa;
    this.ltc = options.ltc;
    this.dhw = options.dhw;
    this.ptt = options.ptt;
    this.rlang = options.rlang;
    this.vinfo = options.vinfo;
    this.nunum = options.nunum;
    this.nbest = options.nbest;
    this.wbest = options.wbest;
    this.sendInterval = options.sendInterval ?? 0;
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
      domain: this.domain,
      language: this.mapLanguage(this.language),
      accent: this.accent,
      eos: this.eos,
      dwa: this.dwa,
      ltc: this.ltc,
      dhw: this.dhw,
      ptt: this.ptt,
      rlang: this.rlang,
      vinfo: this.vinfo,
      nunum: this.nunum,
      nbest: this.nbest,
      wbest: this.wbest,
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
    // 累积结果数组：以 sn 为索引存储每个片段的文本，支持动态修正
    const iatResult: (string | null)[] = [];

    const handleMessage = (data: WebSocket.RawData) => {
      try {
        const response = parseResponse(data);

        // 检查错误响应
        if (!isSuccessResponse(response)) {
          queue.error(new Error(`Xfyun ASR error: ${response.code} - ${response.message}`));
          return;
        }

        // 处理包含识别结果的响应
        if (hasResultPayload(response) && response.data?.result) {
          const result = response.data.result;

          // 动态修正：当 pgs==='rpl' 时，清除 rg 范围内的旧结果
          if (result.pgs === 'rpl' && result.rg) {
            for (let i = result.rg[0]; i <= result.rg[1]; i++) {
              iatResult[i] = null;
            }
          }

          // 存储当前片段文本
          const snippetText = extractTextFromResult(result);
          iatResult[result.sn] = snippetText;

          // 拼接完整累积文本
          const fullText = iatResult.filter((t) => t !== null).join('');

          const isFinal = isFinishedResponse(response) || result.ls === true;

          queue.push({
            text: fullText,
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
   * 按 1280 字节分块，以 sendInterval 毫秒间隔发送
   */
  private async sendAudioStream(
    ws: WebSocket,
    audio: AudioStream,
    protocolOptions: XfyunProtocolOptions
  ): Promise<void> {
    const CHUNK_SIZE = 1280;
    const SEND_INTERVAL = this.sendInterval;
    let isFirst = true;

    for await (const chunk of audio) {
      const data = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array);

      // 按 CHUNK_SIZE 分块发送
      for (let offset = 0; offset < data.length; offset += CHUNK_SIZE) {
        const end = Math.min(offset + CHUNK_SIZE, data.length);
        const piece = data.subarray(offset, end);
        const audioBase64 = piece.toString('base64');

        if (isFirst) {
          const frame = createFirstFrame(protocolOptions, audioBase64);
          ws.send(frame);
          isFirst = false;
        } else {
          const frame = createMiddleFrame(protocolOptions, audioBase64);
          ws.send(frame);
        }

        // 发送间隔
        await new Promise((resolve) => setTimeout(resolve, SEND_INTERVAL));
      }
    }
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

    // 生成鉴权 URL（v2 基础版）
    const url = buildAuthUrl('iat-api.xfyun.cn', '/v2/iat', this.apiKey, this.apiSecret);

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
        let sendPromise: Promise<void> = Promise.resolve();
        sendPromise = this.sendAudioStream(ws, audio, protocolOptions).then(async () => {
          // 发送末帧
          const lastFrame = createLastFrame();
          ws.send(lastFrame);
        });

        // 从队列 yield 响应，同时监控发送和队列错误
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
