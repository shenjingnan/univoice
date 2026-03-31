import { Buffer } from 'node:buffer';
import WebSocket from 'ws';
import { BaseTTS } from '@/tts/base';
import {
  collectAudioData,
  concatArrays,
  createTaskContinueMessage,
  createTaskFinishMessage,
  createTaskStartMessage,
  receiveAudioOrEvent,
  sendMessage,
  waitForConnected,
  waitForTaskStarted,
} from '@/tts/protocols/minimax';
import { normalizeTextStream } from '@/tts/utils/normalize-text-stream';
import type {
  MinimaxTTSOptions,
  TextStream,
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
 * Minimax TTS 提供商
 * 基于 Minimax WebSocket API 实现语音合成
 *
 * 支持的模型:
 * - speech-2.8-hd (推荐：精准还原真实语气)
 * - speech-2.6-hd (超低延时)
 * - speech-2.8-turbo (更快更优惠)
 * - speech-2.6-turbo (极速版)
 * - speech-02-hd (高音质)
 * - speech-02-turbo (高性能)
 *
 * 参考文档: https://platform.minimaxi.com/docs/api-reference/speech-t2a-websocket
 */
export class MinimaxTTS extends BaseTTS {
  name = 'minimax';

  /** 采样率 */
  public sampleRate?: number;
  /** 比特率 */
  public bitrate?: number;

  constructor(options: MinimaxTTSOptions) {
    super(options);
    // WebSocket API 地址
    this.baseUrl = options.baseUrl || 'wss://api.minimaxi.com/ws/v1/t2a_v2';
    // 默认使用 speech-2.8-hd（精准还原真实语气）
    this.model = options.model || 'speech-2.8-hd';
    // 默认使用青春男声
    this.voice = options.voice || 'male-qn-qingse';
    // 默认格式
    this.format = options.format || 'mp3';
    // 采样率
    this.sampleRate = options.sampleRate;
    // 比特率
    this.bitrate = options.bitrate;
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

    // 等待 connected_success 事件
    await waitForConnected(ws);

    return ws;
  }

  /**
   * 合成语音
   * WebSocket 交互流程：
   * 1. 建立 WebSocket 连接 -> 等待 connected_success 事件
   * 2. 发送 task_start 事件
   * 3. 等待 task_started 事件
   * 4. 发送 task_continue 事件（包含文本）
   * 5. 收集音频数据直到 is_final 标志
   * 6. 发送 task_finish 事件关闭任务
   */
  async synthesize(request: TTSRequest): Promise<TTSResponse> {
    const text = request.text;
    const opts = this.buildRequestOptions(request);

    // 创建 WebSocket 连接
    const ws = await this.createConnection();

    try {
      // 1. 发送 task_start 消息
      const taskStartMsg = createTaskStartMessage({
        model: opts.model || this.model,
        voiceId: opts.voice || this.voice,
        format: opts.format || this.format,
        sampleRate: this.sampleRate,
        bitrate: this.bitrate,
        speed: opts.speed,
        volume: opts.volume,
        pitch: opts.pitch,
      });
      await sendMessage(ws, taskStartMsg);

      // 2. 等待 task_started 事件
      await waitForTaskStarted(ws);

      // 3. 发送 task_continue 消息（包含文本）
      const taskContinueMsg = createTaskContinueMessage(text);
      await sendMessage(ws, taskContinueMsg);

      // 4. 收集音频数据
      const audioChunks = await collectAudioData(ws);

      if (audioChunks.length === 0) {
        throw new Error('No audio received from Minimax TTS service');
      }

      // 合并音频数据
      const audio = concatArrays(audioChunks);

      // 5. 发送 task_finish 消息
      const taskFinishMsg = createTaskFinishMessage();
      await sendMessage(ws, taskFinishMsg);

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

    // 等待 connected_success 事件
    await waitForConnected(ws);

    // 启动 WebSocket 处理流程（后台并发执行）
    const processPromise = (async () => {
      try {
        // 1. 发送 task_start 消息
        const taskStartMsg = createTaskStartMessage({
          model: this.model,
          voiceId: this.voice,
          format: this.format,
          sampleRate: this.sampleRate,
          bitrate: this.bitrate,
          speed: this.speed,
          volume: this.volume,
          pitch: this.pitch,
        });
        await sendMessage(ws, taskStartMsg);

        // 2. 等待 task_started 事件
        await waitForTaskStarted(ws);

        // 3. 并发执行发送和接收 - 边发边收
        await Promise.all([
          this.sendTextStreamFlow(ws, textStream),
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
    textStream: AsyncGenerator<string>
  ): Promise<void> {
    // 从文本流读取并发送
    let _chunkIndex = 0;
    let textSent = false;
    for await (const chunk of textStream) {
      if (chunk) {
        _chunkIndex++;
        const taskContinueMsg = createTaskContinueMessage(chunk);
        await sendMessage(ws, taskContinueMsg);
        textSent = true;
      }
    }

    // 如果没有发送任何文本，发送空字符串
    if (!textSent) {
      const taskContinueMsg = createTaskContinueMessage('');
      await sendMessage(ws, taskContinueMsg);
    }

    // 发送 task_finish 指令
    const taskFinishMsg = createTaskFinishMessage();
    await sendMessage(ws, taskFinishMsg);
  }

  /**
   * 接收音频数据并推入队列
   * 使用主动拉取模式：循环调用 receiveAudioOrEvent 获取音频或事件
   * 注意：receiveAudioOrEvent 在收到 task_finished 或 task_failed 时返回 null
   */
  private async receiveAudioFlowToQueue(
    ws: WebSocket,
    enqueue: (item: QueueItem) => void
  ): Promise<void> {
    while (true) {
      const result = await receiveAudioOrEvent(ws);

      // 收到 task_finished 或 task_failed，结束接收
      if (result === null) {
        enqueue({ type: 'end' });
        return;
      }

      if (result.type === 'audio') {
        // 收到音频数据
        enqueue({ type: 'audio', chunk: result.data });
      }
      // 如果是其他事件，忽略继续等待
    }
  }
}
