import { Buffer } from 'node:buffer';
import { randomUUID } from 'node:crypto';
import { BaseTTS } from '@/tts/base';
import { registerTTSProvider } from '@/tts/factory';
import {
  EventType,
  MsgType,
  finishConnection,
  finishSession,
  receiveMessage,
  startConnection,
  startSession,
  taskRequest,
  waitForEvent,
} from '@/tts/protocols/volcengine';
import type { TTSOptions, TTSRequest, TTSResponse } from '@/types/tts';
import WebSocket from 'ws';

/**
 * 火山引擎 TTS 提供商
 * 基于 WebSocket 双向流式协议实现语音合成
 */
export class DoubaoTTS extends BaseTTS {
  name = 'doubao';

  /** 火山引擎 App ID */
  public appId: string;
  /** 火山引擎 Access Token */
  public accessToken: string;
  /** 火山引擎 Resource ID */
  public resourceId: string;
  /** 采样率 */
  public sampleRate: number;
  /** 是否启用时间戳 */
  public enableTimestamp: boolean;

  constructor(options: TTSOptions) {
    super(options);
    this.appId = options.appId || '';
    this.accessToken = options.accessToken || '';
    this.resourceId = options.resourceId || 'seed-tts-2.0';
    this.sampleRate = options.sampleRate || 24000;
    this.enableTimestamp = options.enableTimestamp ?? false;
    this.baseUrl = options.baseUrl || 'wss://openspeech.bytedance.com/api/v3/tts/bidirection';
    this.voice = options.voice || 'zh_female_tianmeixiaoyuan_moon_bigtts';
    this.format = options.format || 'mp3';
  }

  /**
   * 构建认证请求头
   */
  private buildAuthHeaders(): Record<string, string> {
    return {
      'X-Api-App-Key': this.appId,
      'X-Api-Access-Key': this.accessToken,
      'X-Api-Resource-Id': this.resourceId,
      'X-Api-Connect-Id': randomUUID(),
    };
  }

  /**
   * 构建会话请求 payload
   */
  private buildSessionPayload(): Uint8Array {
    const payload = {
      user: {
        uid: randomUUID(),
      },
      req_params: {
        speaker: this.voice,
        audio_params: {
          format: this.format,
          sample_rate: this.sampleRate,
          enable_timestamp: this.enableTimestamp,
        },
        additions: JSON.stringify({
          disable_markdown_filter: true,
        }),
      },
      event: EventType.StartSession,
    };
    return new TextEncoder().encode(JSON.stringify(payload));
  }

  /**
   * 构建任务请求 payload
   */
  private buildTaskPayload(text: string): Uint8Array {
    const payload = {
      user: {
        uid: randomUUID(),
      },
      req_params: {
        speaker: this.voice,
        audio_params: {
          format: this.format,
          sample_rate: this.sampleRate,
          enable_timestamp: this.enableTimestamp,
        },
        additions: JSON.stringify({
          disable_markdown_filter: true,
        }),
        text: text,
      },
      event: EventType.TaskRequest,
    };
    return new TextEncoder().encode(JSON.stringify(payload));
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
   * 流式输出音频数据
   * 通过 WebSocket 连接实时获取音频块并逐块产出
   */
  async *speak(request: TTSRequest): AsyncIterable<Uint8Array> {
    const text = request.text;

    // 1. 创建 WebSocket 连接
    const ws = new WebSocket(this.baseUrl, {
      headers: this.buildAuthHeaders(),
      skipUTF8Validation: true,
    });

    await new Promise<void>((resolve, reject) => {
      ws.on('open', resolve);
      ws.on('error', reject);
    });

    try {
      // 2. 启动连接
      await startConnection(ws);
      await waitForEvent(ws, MsgType.FullServerResponse, EventType.ConnectionStarted);

      // 3. 创建会话
      const sessionId = randomUUID();
      const sessionPayload = this.buildSessionPayload();
      await startSession(ws, sessionPayload, sessionId);
      await waitForEvent(ws, MsgType.FullServerResponse, EventType.SessionStarted);

      // 4. 发送文本任务
      const taskPayload = this.buildTaskPayload(text);
      await taskRequest(ws, taskPayload, sessionId);

      // 5. 结束会话
      await finishSession(ws, sessionId);

      // 6. 流式产出音频数据
      while (true) {
        const msg = await receiveMessage(ws);

        switch (msg.type) {
          case MsgType.AudioOnlyServer:
            // 直接产出音频块
            yield msg.payload;
            break;
          case MsgType.FullServerResponse:
            // FullServerResponse 消息，继续处理
            break;
          case MsgType.Error:
            throw new Error(
              `TTS error: ${msg.errorCode}, ${new TextDecoder().decode(msg.payload)}`
            );
          default:
            throw new Error(`Unexpected message type: ${msg.type}`);
        }

        if (msg.event === EventType.SessionFinished) {
          break;
        }
      }

      // 7. 结束连接
      await finishConnection(ws);
      await waitForEvent(ws, MsgType.FullServerResponse, EventType.ConnectionFinished);
    } finally {
      ws.close();
    }
  }

  /**
   * 合成语音
   */
  async synthesize(request: TTSRequest): Promise<TTSResponse> {
    const text = request.text;

    // 1. 创建 WebSocket 连接
    const ws = new WebSocket(this.baseUrl, {
      headers: this.buildAuthHeaders(),
      skipUTF8Validation: true,
    });

    await new Promise<void>((resolve, reject) => {
      ws.on('open', resolve);
      ws.on('error', reject);
    });

    try {
      // 2. 启动连接
      await startConnection(ws);
      await waitForEvent(ws, MsgType.FullServerResponse, EventType.ConnectionStarted);

      // 3. 创建会话
      const sessionId = randomUUID();
      const sessionPayload = this.buildSessionPayload();
      await startSession(ws, sessionPayload, sessionId);
      await waitForEvent(ws, MsgType.FullServerResponse, EventType.SessionStarted);

      // 4. 发送文本任务
      const taskPayload = this.buildTaskPayload(text);
      await taskRequest(ws, taskPayload, sessionId);

      // 5. 结束会话
      await finishSession(ws, sessionId);

      // 6. 收集音频数据
      const audioChunks: Uint8Array[] = [];
      while (true) {
        const msg = await receiveMessage(ws);

        switch (msg.type) {
          case MsgType.AudioOnlyServer:
            audioChunks.push(msg.payload);
            break;
          case MsgType.FullServerResponse:
            // FullServerResponse 消息，继续处理
            break;
          case MsgType.Error:
            throw new Error(
              `TTS error: ${msg.errorCode}, ${new TextDecoder().decode(msg.payload)}`
            );
          default:
            throw new Error(`Unexpected message type: ${msg.type}`);
        }

        if (msg.event === EventType.SessionFinished) {
          break;
        }
      }

      // 7. 结束连接
      await finishConnection(ws);
      await waitForEvent(ws, MsgType.FullServerResponse, EventType.ConnectionFinished);

      // 8. 返回结果
      const audio = this.concatArrays(audioChunks);
      if (audio.length === 0) {
        throw new Error('No audio received from TTS service');
      }

      return {
        audio: Buffer.from(audio),
        format: this.format,
      };
    } finally {
      ws.close();
    }
  }
}

registerTTSProvider('doubao', DoubaoTTS);
