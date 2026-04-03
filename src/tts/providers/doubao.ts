import { Buffer } from 'node:buffer';
import { randomUUID } from 'node:crypto';
import WebSocket from 'ws';
import { BaseTTS } from '@/tts/base';
import {
  EventType,
  finishConnection,
  finishSession,
  MsgType,
  receiveMessage,
  startConnection,
  startSession,
  taskRequest,
  waitForEvent,
} from '@/tts/protocols/volcengine';
import { normalizeTextStream } from '@/tts/utils/normalize-text-stream';
import type {
  DoubaoTTSOptions,
  SpeakInstanceOptions,
  TextStream,
  TTSConnection,
  TTSConnectionState,
  TTSConnectOptions,
  TTSRequest,
  TTSResponse,
  TTSStreamChunk,
} from '@/types/tts';

/** 队列项类型，用于 speak 的推拉转换 */
type QueueItem =
  | { type: 'audio'; chunk: Uint8Array }
  | { type: 'error'; error: Error }
  | { type: 'end' };

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

  constructor(options: DoubaoTTSOptions) {
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
   * 流式语音合成（内部实现方法）
   * 边发边收模式：流式文本输入
   * 支持用户持续发送文本片段，适用于 LLM 流式输出转语音等场景
   *
   * @param input 文本输入，可以是字符串、文本流（AsyncIterable<string>）或 OpenAI stream
   * @returns 流式音频块
   * @internal
   */
  protected async *speakStream(input: string | TextStream): AsyncIterable<TTSStreamChunk> {
    // 使用 normalizeTextStream 统一处理输入
    // 自动处理 string、AsyncIterable<string> 和 OpenAI stream
    const textStream = normalizeTextStream(input);

    console.log('[双向流] ========== 开始流式输入处理 ==========');

    // 创建队列和同步机制
    const queue: QueueItem[] = [];
    const syncState = { resolveWait: null as (() => void) | null, finished: false };

    const enqueue = (item: QueueItem) => {
      queue.push(item);
      syncState.resolveWait?.();
      syncState.resolveWait = null;
    };

    // 1. 创建 WebSocket 连接
    const ws = new WebSocket(this.baseUrl, {
      headers: this.buildAuthHeaders(),
      skipUTF8Validation: true,
    });

    await new Promise<void>((resolve, reject) => {
      ws.on('open', resolve);
      ws.on('error', reject);
    });
    console.log('[双向流] WebSocket 已连接');

    // 启动 WebSocket 处理流程（后台并发执行）
    const processPromise = (async () => {
      try {
        // 2. 启动连接
        await startConnection(ws);
        await waitForEvent(ws, MsgType.FullServerResponse, EventType.ConnectionStarted);
        console.log('[双向流] 连接已启动 (ConnectionStarted)');

        // 3. 创建会话
        const sessionId = randomUUID();
        const sessionPayload = this.buildSessionPayload();
        await startSession(ws, sessionPayload, sessionId);
        await waitForEvent(ws, MsgType.FullServerResponse, EventType.SessionStarted);
        console.log('[双向流] 会话已启动 (SessionStarted)');

        console.log('[双向流] 启动发送和接收并发流程...');

        // 4. 并发执行发送和接收
        await Promise.all([
          this.sendTextStreamFlow(ws, sessionId, textStream),
          this.receiveAudioFlowToQueue(ws, enqueue),
        ]);

        // 5. 结束连接
        await finishConnection(ws);
        await waitForEvent(ws, MsgType.FullServerResponse, EventType.ConnectionFinished);
        console.log('[双向流] 连接已结束 (ConnectionFinished)');
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
      // 确保 WebSocket 被正确关闭
      await processPromise.catch(() => {});
    }
  }

  /**
   * 发送流程：从文本流读取并发送
   */
  private async sendTextStreamFlow(
    ws: WebSocket,
    sessionId: string,
    textStream: TextStream
  ): Promise<void> {
    console.log('[发送流程] 开始监听文本流...');

    // 构建请求模板
    const requestTemplate = {
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
    };

    // 从文本流读取并发送
    let chunkIndex = 0;
    for await (const chunk of textStream) {
      chunkIndex++;
      console.log(`[发送流程] 收到文本块 #${chunkIndex}: "${chunk}"`);

      // 直接发送整个文本块
      const payload = new TextEncoder().encode(
        JSON.stringify({
          ...requestTemplate,
          req_params: { ...requestTemplate.req_params, text: chunk },
          event: EventType.TaskRequest,
        })
      );
      await taskRequest(ws, payload, sessionId);
    }

    console.log('[发送流程] 文本流结束，发送会话结束信号');
    // 结束会话
    await finishSession(ws, sessionId);
  }

  /**
   * 接收流程：持续监听并将音频数据推入队列
   * 用于 speak 方法的 AsyncGenerator 实现
   */
  private async receiveAudioFlowToQueue(
    ws: WebSocket,
    enqueue: (item: QueueItem) => void
  ): Promise<void> {
    console.log('[接收流程] 开始监听音频流...');
    let audioIndex = 0;

    while (true) {
      const msg = await receiveMessage(ws);

      switch (msg.type) {
        case MsgType.AudioOnlyServer:
          // 将音频块推入队列
          audioIndex++;
          console.log(`[接收流程] 收到音频块 #${audioIndex}: ${msg.payload.length} bytes`);
          enqueue({ type: 'audio', chunk: msg.payload });
          break;

        case MsgType.FullServerResponse:
          // 处理服务端响应事件
          if (msg.event === EventType.SessionStarted) {
            console.log('[接收流程] 会话已启动 (SessionStarted)');
          } else if (msg.event === EventType.SessionFinished) {
            console.log('[接收流程] 会话已结束 (SessionFinished)');
            enqueue({ type: 'end' });
            return;
          }
          break;

        case MsgType.Error: {
          const error = new Error(
            `TTS error: ${msg.errorCode}, ${new TextDecoder().decode(msg.payload)}`
          );
          console.log(`[接收流程] 错误: ${msg.errorCode}`);
          enqueue({ type: 'error', error });
          return;
        }

        default:
          enqueue({
            type: 'error',
            error: new Error(`Unexpected message type: ${msg.type}`),
          });
          return;
      }
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

  /**
   * 预建立 WebSocket 连接
   * 建立 WebSocket 连接并完成 Connection 级别握手（StartConnection → ConnectionStarted）
   */
  override async connect(options?: TTSConnectOptions): Promise<TTSConnection> {
    if (!this.appId) {
      throw new Error('appId is required for Doubao TTS');
    }
    if (!this.accessToken) {
      throw new Error('accessToken is required for Doubao TTS');
    }

    const timeout = options?.timeout ?? 10000;

    const ws = new WebSocket(this.baseUrl, {
      headers: this.buildAuthHeaders(),
      skipUTF8Validation: true,
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

    // 发送 StartConnection，等待 ConnectionStarted
    await startConnection(ws);
    await waitForEvent(ws, MsgType.FullServerResponse, EventType.ConnectionStarted);
    console.log('[连接预建立] 连接已启动 (ConnectionStarted)');

    return new DoubaoTTSConnection(ws, this);
  }

  /**
   * 在已建立的 WebSocket 连接上进行流式合成
   * 每次调用创建新的 Session：StartSession → TaskRequest → FinishSession
   */
  async *speakStreamOnConnection(
    ws: WebSocket,
    input: string | TextStream
  ): AsyncIterable<TTSStreamChunk> {
    const textStream = normalizeTextStream(input);

    console.log('[连接复用-双向流] ========== 开始流式输入处理 ==========');

    // 创建队列和同步机制
    const queue: QueueItem[] = [];
    const syncState = { resolveWait: null as (() => void) | null, finished: false };

    const enqueue = (item: QueueItem) => {
      queue.push(item);
      syncState.resolveWait?.();
      syncState.resolveWait = null;
    };

    // 启动处理流程（后台并发执行）
    const processPromise = (async () => {
      try {
        // 1. 创建会话
        const sessionId = randomUUID();
        const sessionPayload = this.buildSessionPayload();
        await startSession(ws, sessionPayload, sessionId);
        await waitForEvent(ws, MsgType.FullServerResponse, EventType.SessionStarted);
        console.log('[连接复用-双向流] 会话已启动 (SessionStarted)');

        // 2. 并发执行发送和接收
        await Promise.all([
          this.sendTextStreamFlow(ws, sessionId, textStream),
          this.receiveAudioFlowToQueue(ws, enqueue),
        ]);

        // 不关闭连接，由 TTSConnection 管理
      } catch (error) {
        enqueue({
          type: 'error',
          error: error instanceof Error ? error : new Error(String(error)),
        });
      } finally {
        syncState.finished = true;
        syncState.resolveWait?.();
        syncState.resolveWait = null;
      }
    })();

    // Generator 主循环：从队列中取出数据
    try {
      while (!syncState.finished || queue.length > 0) {
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

  /**
   * 在已建立的 WebSocket 连接上进行非流式合成
   * 每次调用创建新的 Session：StartSession → TaskRequest → FinishSession → 收集音频
   */
  async synthesizeOnConnection(ws: WebSocket, text: string): Promise<TTSResponse> {
    // 1. 创建会话
    const sessionId = randomUUID();
    const sessionPayload = this.buildSessionPayload();
    await startSession(ws, sessionPayload, sessionId);
    await waitForEvent(ws, MsgType.FullServerResponse, EventType.SessionStarted);

    // 2. 发送文本任务
    const taskPayload = this.buildTaskPayload(text);
    await taskRequest(ws, taskPayload, sessionId);

    // 3. 结束会话
    await finishSession(ws, sessionId);

    // 4. 收集音频数据
    const audioChunks: Uint8Array[] = [];
    while (true) {
      const msg = await receiveMessage(ws);

      switch (msg.type) {
        case MsgType.AudioOnlyServer:
          audioChunks.push(msg.payload);
          break;
        case MsgType.FullServerResponse:
          break;
        case MsgType.Error:
          throw new Error(`TTS error: ${msg.errorCode}, ${new TextDecoder().decode(msg.payload)}`);
        default:
          throw new Error(`Unexpected message type: ${msg.type}`);
      }

      if (msg.event === EventType.SessionFinished) {
        break;
      }
    }

    // 5. 返回结果
    const audio = this.concatArrays(audioChunks);
    if (audio.length === 0) {
      throw new Error('No audio received from TTS service');
    }

    return {
      audio: Buffer.from(audio),
      format: this.format,
    };
  }
}

/**
 * 豆包 TTS 连接实例
 * 通过 DoubaoTTS.connect() 获取，持有已建立的 WebSocket 连接
 */
class DoubaoTTSConnection implements TTSConnection {
  private _state: TTSConnectionState = 'connected';

  constructor(
    private ws: WebSocket,
    private provider: DoubaoTTS
  ) {}

  get state(): TTSConnectionState {
    if (this.ws.readyState === WebSocket.CLOSED || this.ws.readyState === WebSocket.CLOSING) {
      return 'closed';
    }
    return this._state;
  }

  speak(
    input: string | TextStream,
    options: SpeakInstanceOptions & { stream: true }
  ): AsyncIterable<TTSStreamChunk>;

  speak(
    input: string | TextStream,
    options?: SpeakInstanceOptions & { stream?: false }
  ): Promise<TTSResponse>;

  speak(
    input: string | TextStream,
    options?: SpeakInstanceOptions
  ): Promise<TTSResponse> | AsyncIterable<TTSStreamChunk> {
    this.ensureConnected();

    if (options?.stream === true) {
      return this.provider.speakStreamOnConnection(this.ws, input);
    }
    return this.collectResponse(input);
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

  private async collectResponse(input: string | TextStream): Promise<TTSResponse> {
    // 非流式模式：收集文本后调用 synthesizeOnConnection
    if (typeof input === 'string') {
      return this.provider.synthesizeOnConnection(this.ws, input);
    }

    // 流式文本输入：先收集全部文本
    const textChunks: string[] = [];
    for await (const chunk of normalizeTextStream(input)) {
      textChunks.push(chunk);
    }
    return this.provider.synthesizeOnConnection(this.ws, textChunks.join(''));
  }
}
