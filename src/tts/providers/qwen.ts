import { Buffer } from 'node:buffer';
import { randomUUID } from 'node:crypto';
import WebSocket from 'ws';
import { BaseTTS } from '@/tts/base';
import {
  collectAudioData,
  concatArrays,
  createContinueTaskMessage,
  createFinishTaskMessage,
  createRunTaskMessage,
  receiveAudioOrEvent,
  sendMessage,
  waitForTaskStarted,
} from '@/tts/protocols/dashscope';
import { normalizeTextStream } from '@/tts/utils/normalize-text-stream';
import type {
  QwenTTSOptions,
  SpeakInstanceOptions,
  TextStream,
  TTSConnection,
  TTSConnectionState,
  TTSConnectOptions,
  TTSRequest,
  TTSResponse,
  TTSStreamChunk,
} from '@/types/tts';

/** 队列项类型，用于 speakStream 的推拉转换 */
type QueueItem =
  | { type: 'audio'; chunk: Uint8Array }
  | { type: 'error'; error: Error }
  | { type: 'end' };

/**
 * Qwen TTS 提供商
 * 基于阿里云 DashScope CosyVoice WebSocket API 实现语音合成
 *
 * 支持的模型:
 * - cosyvoice-v3-flash (推荐：速度快、成本低)
 * - cosyvoice-v3-plus (高质量版本)
 * - cosyvoice-v2
 * - cosyvoice-v1
 */
export class QwenTTS extends BaseTTS {
  name = 'qwen';

  /** Qwen 专用：指令文本（用于情感控制） */
  public instruction?: string;
  /** 采样率 */
  public sampleRate?: number;

  constructor(options: QwenTTSOptions) {
    super(options);
    // WebSocket API 地址
    this.baseUrl = options.baseUrl || 'wss://dashscope.aliyuncs.com/api-ws/v1/inference/';
    // 默认使用 cosyvoice-v3-flash（速度快、成本低）
    this.model = options.model || 'cosyvoice-v3-flash';
    // 默认使用龙小淳（知性积极女）
    this.voice = options.voice || 'longxiaochun_v3';
    // 默认格式
    this.format = options.format || 'mp3';
    // 情感控制指令
    this.instruction = options.instruction;
    // 采样率
    this.sampleRate = options.sampleRate;
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
   * 创建 WebSocket 连接
   */
  private async createConnection(): Promise<WebSocket> {
    const ws = new WebSocket(this.baseUrl, {
      headers: this.buildAuthHeaders(),
    });

    await new Promise<void>((resolve, reject) => {
      ws.on('open', resolve);
      ws.on('error', reject);
    });

    return ws;
  }

  /**
   * 合成语音
   * WebSocket 交互流程：
   * 1. 发送 run-task 指令（input 为空对象）
   * 2. 等待 task-started 事件
   * 3. 发送 continue-task 指令（包含文本）
   * 4. 发送 finish-task 指令
   * 5. 收集音频数据直到 task-finished 事件
   */
  async synthesize(request: TTSRequest): Promise<TTSResponse> {
    const text = request.text;
    const opts = this.buildRequestOptions(request);

    // 创建 WebSocket 连接
    const ws = await this.createConnection();

    try {
      // 生成任务 ID
      const taskId = randomUUID();

      // 1. 发送 run-task 指令（input 为空对象）
      const runTaskMsg = createRunTaskMessage(taskId, {
        model: opts.model || this.model,
        voice: opts.voice || this.voice,
        format: opts.format || this.format,
        sampleRate: this.sampleRate,
        volume: opts.volume || 50,
        rate: opts.speed,
        pitch: opts.pitch,
      });
      await sendMessage(ws, runTaskMsg);

      // 2. 等待 task-started 事件
      await waitForTaskStarted(ws);

      // 3. 发送 continue-task 指令（包含文本）
      const continueTaskMsg = createContinueTaskMessage(taskId, text);
      await sendMessage(ws, continueTaskMsg);

      // 4. 发送 finish-task 指令
      const finishTaskMsg = createFinishTaskMessage(taskId);
      await sendMessage(ws, finishTaskMsg);

      // 5. 收集音频数据
      const audioChunks = await collectAudioData(ws);

      if (audioChunks.length === 0) {
        throw new Error('No audio received from Qwen TTS service');
      }

      // 合并音频数据
      const audio = concatArrays(audioChunks);

      return {
        audio: Buffer.from(audio),
        format: opts.format || this.format,
      };
    } finally {
      ws.close();
    }
  }

  /**
   * 流式语音合成（内部实现方法）
   * 边发边收模式：流式文本输入
   * 支持用户持续发送文本片段，适用于 LLM 流式输出转语音等场景
   *
   * @param input 文本输入，可以是字符串或文本流（AsyncIterable<string>）
   * @returns 流式音频块
   * @internal
   */
  protected async *speakStream(input: string | TextStream): AsyncIterable<TTSStreamChunk> {
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

    // 创建 WebSocket 连接
    const ws = new WebSocket(this.baseUrl, {
      headers: this.buildAuthHeaders(),
    });

    await new Promise<void>((resolve, reject) => {
      ws.on('open', resolve);
      ws.on('error', reject);
    });
    console.log('[双向流] WebSocket 已连接');

    // 启动 WebSocket 处理流程（后台并发执行）
    const processPromise = (async () => {
      try {
        // 生成任务 ID
        const taskId = randomUUID();

        // 1. 发送 run-task 指令
        const runTaskMsg = createRunTaskMessage(taskId, {
          model: this.model,
          voice: this.voice,
          format: this.format,
          sampleRate: this.sampleRate,
          volume: this.volume ? Math.round(this.volume * 100) : 50,
          rate: this.speed,
          pitch: this.pitch,
        });
        await sendMessage(ws, runTaskMsg);

        // 2. 等待 task-started 事件
        await waitForTaskStarted(ws);
        console.log('[双向流] 任务已启动 (task-started)');

        console.log('[双向流] 启动发送和接收并发流程...');

        // 3. 并发执行发送和接收 - 关键修改：边发边收
        await Promise.all([
          this.sendTextStreamFlow(ws, taskId, textStream),
          this.receiveAudioFlowToQueue(ws, enqueue),
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
      // 确保 WebSocket 被正确关闭
      await processPromise.catch(() => {});
    }
  }

  /**
   * 发送流程：从文本流读取并发送
   */
  private async sendTextStreamFlow(
    ws: WebSocket,
    taskId: string,
    textStream: AsyncGenerator<string>
  ): Promise<void> {
    console.log('[发送流程] 开始监听文本流...');

    // 从文本流读取并发送
    let chunkIndex = 0;
    let textSent = false;
    for await (const chunk of textStream) {
      if (chunk) {
        chunkIndex++;
        console.log(`[发送流程] 收到文本块 #${chunkIndex}: "${chunk}"`);
        const continueTaskMsg = createContinueTaskMessage(taskId, chunk);
        await sendMessage(ws, continueTaskMsg);
        textSent = true;
      }
    }

    // 如果没有发送任何文本，发送空字符串
    if (!textSent) {
      console.log('[发送流程] 没有文本，发送空字符串');
      const continueTaskMsg = createContinueTaskMessage(taskId, '');
      await sendMessage(ws, continueTaskMsg);
    }

    console.log('[发送流程] 文本流结束，发送 finish-task 指令');
    // 发送 finish-task 指令
    const finishTaskMsg = createFinishTaskMessage(taskId);
    await sendMessage(ws, finishTaskMsg);
  }

  /**
   * 接收音频数据并推入队列
   * 使用主动拉取模式：循环调用 receiveAudioOrEvent 获取音频或事件
   */
  private async receiveAudioFlowToQueue(
    ws: WebSocket,
    enqueue: (item: QueueItem) => void
  ): Promise<void> {
    console.log('[接收流程] 开始监听音频流...');
    let audioIndex = 0;

    while (true) {
      const result = await receiveAudioOrEvent(ws);

      // 收到 task-finished：正常结束
      if (result === null) {
        console.log('[接收流程] 收到结束事件，结束接收');
        enqueue({ type: 'end' });
        return;
      }

      // 收到 task-failed：输出错误信息
      if (result.type === 'failed') {
        const { error_code, error_message } = result.event.header;
        console.error(`[接收流程] 收到 task-failed 事件: ${error_code} - ${error_message}`);
        enqueue({
          type: 'error',
          error: new Error(`TTS task failed: ${error_code} - ${error_message}`),
        });
        return;
      }

      if (result.type === 'audio') {
        // 收到音频数据
        audioIndex++;
        console.log(`[接收流程] 收到音频块 #${audioIndex}: ${result.data.length} bytes`);
        enqueue({ type: 'audio', chunk: result.data });
      }
      // 如果是其他事件，忽略继续等待
    }
  }

  /**
   * 预建立 WebSocket 连接
   * 只建立连接，不发送协议级初始化（DashScope 的 run-task 是 task 级别，每次 speak 时才发送）
   */
  override async connect(options?: TTSConnectOptions): Promise<TTSConnection> {
    if (!this.apiKey) {
      throw new Error('apiKey is required for Qwen TTS');
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

    return new QwenTTSConnection(ws, this);
  }

  /**
   * 在已建立的 WebSocket 连接上进行流式合成
   * 从 speakStream 中提取的核心逻辑，不创建/关闭 WebSocket
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
        // 生成任务 ID
        const taskId = randomUUID();

        // 1. 发送 run-task 指令
        const runTaskMsg = createRunTaskMessage(taskId, {
          model: this.model,
          voice: this.voice,
          format: this.format,
          sampleRate: this.sampleRate,
          volume: this.volume ? Math.round(this.volume * 100) : 50,
          rate: this.speed,
          pitch: this.pitch,
        });
        await sendMessage(ws, runTaskMsg);

        // 2. 等待 task-started 事件
        await waitForTaskStarted(ws);
        console.log('[连接复用-双向流] 任务已启动 (task-started)');

        // 3. 并发执行发送和接收
        await Promise.all([
          this.sendTextStreamFlow(ws, taskId, textStream),
          this.receiveAudioFlowToQueue(ws, enqueue),
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
        // 不关闭 ws，由 TTSConnection 管理
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
   * 不创建/关闭 WebSocket
   */
  async synthesizeOnConnection(ws: WebSocket, text: string): Promise<TTSResponse> {
    const taskId = randomUUID();

    // 1. 发送 run-task 指令
    const runTaskMsg = createRunTaskMessage(taskId, {
      model: this.model,
      voice: this.voice,
      format: this.format,
      sampleRate: this.sampleRate,
      volume: this.volume ? Math.round(this.volume * 100) : 50,
      rate: this.speed,
      pitch: this.pitch,
    });
    await sendMessage(ws, runTaskMsg);

    // 2. 等待 task-started 事件
    await waitForTaskStarted(ws);

    // 3. 发送 continue-task 指令（包含文本）
    const continueTaskMsg = createContinueTaskMessage(taskId, text);
    await sendMessage(ws, continueTaskMsg);

    // 4. 发送 finish-task 指令
    const finishTaskMsg = createFinishTaskMessage(taskId);
    await sendMessage(ws, finishTaskMsg);

    // 5. 收集音频数据
    const audioChunks = await collectAudioData(ws);

    if (audioChunks.length === 0) {
      throw new Error('No audio received from Qwen TTS service');
    }

    const audio = concatArrays(audioChunks);

    return {
      audio: Buffer.from(audio),
      format: this.format,
    };
  }
}

/**
 * Qwen TTS 连接实例
 * 通过 QwenTTS.connect() 获取，持有已建立的 WebSocket 连接
 */
class QwenTTSConnection implements TTSConnection {
  private _state: TTSConnectionState = 'connected';

  constructor(
    private ws: WebSocket,
    private provider: QwenTTS
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
