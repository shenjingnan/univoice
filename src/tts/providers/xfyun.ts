import { Buffer } from 'node:buffer';
import WebSocket from 'ws';
import { BaseTTS } from '@/tts/base';
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
import { normalizeTextStream } from '@/tts/utils/normalize-text-stream';
import type {
  TextStream,
  TTSRequest,
  TTSResponse,
  TTSStreamChunk,
  XfyunTTSOptions,
} from '@/types/tts';

/** 队列项类型，用于 speakStream 的推拉转换 */
type QueueItem =
  | { type: 'audio'; chunk: Uint8Array }
  | { type: 'error'; error: Error }
  | { type: 'end' };

/**
 * 讯飞超拟人语音合成 TTS 提供商
 * 基于 WebSocket 双向流式协议实现语音合成
 *
 * 支持流式文本输入和流式音频输出，适用于 LLM 流式输出转语音等场景
 */
export class XfyunTTS extends BaseTTS {
  name = 'xfyun';

  /** 讯飞 AppID */
  public appId: string;
  /** 讯飞 APISecret（用于 HMAC-SHA256 签名） */
  public apiSecret: string;
  /** 音频采样率 */
  public sampleRate: number;
  /** 口语化等级（仅 x4 系列发音人支持） */
  public oralLevel?: 'high' | 'mid' | 'low';
  /** 是否通过大模型进行口语化（仅 x4 系列发音人支持） */
  public sparkAssist?: number;
  /** 是否关闭服务端拆句（仅 x4 系列发音人支持） */
  public stopSplit?: number;
  /** 是否保留原书面语（仅 x4 系列发音人支持） */
  public remain?: number;
  /** 英文发音方式 */
  public reg?: number;
  /** 数字发音方式 */
  public rdn?: number;
  /** 是否返回拼音标注 */
  public rhy?: number;
  /** 背景音 */
  public bgs?: number;

  constructor(options: XfyunTTSOptions) {
    super(options);
    this.appId = options.appId || '';
    this.apiSecret = options.apiSecret || '';
    this.sampleRate = options.sampleRate ?? 24000;
    this.oralLevel = options.oralLevel;
    this.sparkAssist = options.sparkAssist;
    this.stopSplit = options.stopSplit;
    this.remain = options.remain;
    this.reg = options.reg;
    this.rdn = options.rdn;
    this.rhy = options.rhy;
    this.bgs = options.bgs;
    this.voice = options.voice || 'x5_lingxiaoxuan_flow';
    this.format = options.format || 'mp3';
  }

  /**
   * 将 BaseTTS 的 speed/volume/pitch (0-2 范围) 映射为讯飞的 0-100 范围
   * BaseTTS 默认 1.0 → xfyun 50
   */
  private mapParam(value: number): number {
    return Math.round(value * 50);
  }

  /**
   * 构建协议配置选项
   */
  private buildProtocolOptions(): XfyunTTSProtocolOptions {
    return {
      appId: this.appId,
      vcn: this.voice,
      speed: this.mapParam(this.speed),
      volume: this.mapParam(this.volume),
      pitch: this.mapParam(this.pitch),
      encoding: mapAudioEncoding(this.format),
      sampleRate: this.sampleRate,
      oralLevel: this.oralLevel,
      sparkAssist: this.sparkAssist,
      stopSplit: this.stopSplit,
      remain: this.remain,
      reg: this.reg,
      rdn: this.rdn,
      rhy: this.rhy,
      bgs: this.bgs,
    };
  }

  /**
   * 合并多个 Uint8Array
   */
  private concatArrays(arrays: Uint8Array[]): Uint8Array {
    const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const arr of arrays) {
      result.set(arr, offset);
      offset += arr.length;
    }
    return result;
  }

  /**
   * 合成语音（非流式）
   * 建立 WebSocket → 发送请求（status=2 一次性发送）→ 收集所有音频块 → 合并返回
   */
  async synthesize(request: TTSRequest): Promise<TTSResponse> {
    if (!this.appId) {
      throw new Error('appId is required for Xfyun TTS');
    }
    if (!this.apiKey) {
      throw new Error('apiKey is required for Xfyun TTS');
    }
    if (!this.apiSecret) {
      throw new Error('apiSecret is required for Xfyun TTS');
    }

    const protocolOptions = this.buildProtocolOptions();
    const url = buildTTSAuthUrl(this.apiKey, this.apiSecret);
    const ws = new WebSocket(url);

    await new Promise<void>((resolve, reject) => {
      ws.on('open', resolve);
      ws.on('error', reject);
    });

    try {
      // 一次性发送所有文本（status=2）
      const payload = createRequestPayload(protocolOptions, request.text, 2, 0);
      ws.send(payload);

      // 收集音频数据
      const audioChunks: Uint8Array[] = [];
      await new Promise<void>((resolve, reject) => {
        ws.on('message', (data: WebSocket.RawData) => {
          try {
            const response = parseTTSResponse(data);

            if (!isTTSSuccessResponse(response)) {
              reject(
                new Error(`Xfyun TTS error: ${response.header.code} - ${response.header.message}`)
              );
              return;
            }

            const audioBase64 = extractAudioFromResponse(response);
            if (audioBase64) {
              audioChunks.push(Buffer.from(audioBase64, 'base64'));
            }

            if (isTTSFinishedResponse(response)) {
              resolve();
            }
          } catch (err) {
            reject(err instanceof Error ? err : new Error(String(err)));
          }
        });

        ws.on('error', reject);
        ws.on('close', () => resolve());
      });

      const audio = this.concatArrays(audioChunks);
      if (audio.length === 0) {
        throw new Error('No audio received from Xfyun TTS service');
      }

      return {
        audio: Buffer.from(audio),
        format: this.format,
      };
    } finally {
      ws.close();
    }
  }

  /**
   * 流式语音合成（内部实现方法）
   * 支持双向流式：流式文本输入，流式音频输出
   *
   * @param input 文本输入，可以是字符串或文本流
   * @returns 流式音频块
   * @internal
   */
  protected async *speakStream(input: string | TextStream): AsyncIterable<TTSStreamChunk> {
    if (!this.appId) {
      throw new Error('appId is required for Xfyun TTS');
    }
    if (!this.apiKey) {
      throw new Error('apiKey is required for Xfyun TTS');
    }
    if (!this.apiSecret) {
      throw new Error('apiSecret is required for Xfyun TTS');
    }

    const textStream = normalizeTextStream(input);
    const protocolOptions = this.buildProtocolOptions();
    const url = buildTTSAuthUrl(this.apiKey, this.apiSecret);

    // 创建队列和同步机制
    const queue: QueueItem[] = [];
    const syncState = { resolveWait: null as (() => void) | null, finished: false };

    const enqueue = (item: QueueItem) => {
      queue.push(item);
      syncState.resolveWait?.();
      syncState.resolveWait = null;
    };

    // 建立 WebSocket 连接
    const ws = new WebSocket(url);

    await new Promise<void>((resolve, reject) => {
      ws.on('open', resolve);
      ws.on('error', reject);
    });

    // 启动发送和接收流程
    const processPromise = (async () => {
      try {
        // 并发执行发送和接收
        await Promise.all([
          sendTextStream(ws, protocolOptions, textStream),
          receiveAudioToQueue(ws, enqueue),
        ]);
      } catch (error) {
        enqueue({
          type: 'error',
          error: error instanceof Error ? error : new Error(String(error)),
        });
      } finally {
        syncState.finished = true;
        syncState.resolveWait?.();
        syncState.resolveWait = null;
        ws.close();
      }
    })();

    // Generator 主循环：从队列中取出数据
    try {
      while (!syncState.finished || queue.length > 0) {
        // 等待队列有数据
        while (queue.length === 0 && !syncState.finished) {
          await new Promise<void>((resolve) => {
            syncState.resolveWait = resolve;
          });
        }

        if (queue.length === 0) break;

        const item = queue.shift();
        if (!item) break;

        switch (item.type) {
          case 'audio':
            yield { audioChunk: item.chunk };
            break;
          case 'error':
            throw item.error;
          case 'end':
            return;
        }
      }
    } finally {
      await processPromise.catch(() => {});
    }
  }
}

/**
 * 发送文本流：逐块发送文本，最后发送结束帧
 */
async function sendTextStream(
  ws: WebSocket,
  protocolOptions: XfyunTTSProtocolOptions,
  textStream: AsyncIterable<string>
): Promise<void> {
  let seq = 0;
  let isFirst = true;

  for await (const chunk of textStream) {
    if (!chunk) continue;

    if (isFirst) {
      // 首帧：status=0
      const payload = createRequestPayload(protocolOptions, chunk, 0, seq);
      ws.send(payload);
      isFirst = false;
    } else {
      // 中间帧：status=1
      const payload = createRequestPayload(protocolOptions, chunk, 1, seq);
      ws.send(payload);
    }
    seq++;
  }

  // 结束帧：status=2，发送空文本标记结束
  const endPayload = createRequestPayload(protocolOptions, '', 2, seq);
  ws.send(endPayload);
}

/**
 * 接收音频流并推入队列
 */
async function receiveAudioToQueue(
  ws: WebSocket,
  enqueue: (item: QueueItem) => void
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    ws.on('message', (data: WebSocket.RawData) => {
      try {
        const response = parseTTSResponse(data);

        if (!isTTSSuccessResponse(response)) {
          enqueue({
            type: 'error',
            error: new Error(
              `Xfyun TTS error: ${response.header.code} - ${response.header.message}`
            ),
          });
          resolve();
          return;
        }

        const audioBase64 = extractAudioFromResponse(response);
        if (audioBase64) {
          enqueue({ type: 'audio', chunk: Buffer.from(audioBase64, 'base64') });
        }

        if (isTTSFinishedResponse(response)) {
          enqueue({ type: 'end' });
          resolve();
        }
      } catch (err) {
        enqueue({
          type: 'error',
          error: err instanceof Error ? err : new Error(String(err)),
        });
        resolve();
      }
    });

    ws.on('error', (err) => {
      reject(err);
    });

    ws.on('close', () => {
      resolve();
    });
  });
}
