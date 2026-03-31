import { Buffer } from 'node:buffer';
import WebSocket from 'ws';
import { BaseTTS } from '@/tts/base';
import {
  createInputTextBufferAppendEvent,
  createSessionFinishEvent,
  createSessionUpdateEvent,
  isAudioEvent,
  isErrorEvent,
  isSessionCreatedEvent,
  isSessionFinishedEvent,
  isSessionUpdatedEvent,
  receiveEvent,
  sendEvent,
} from '@/tts/protocols/dashscope-realtime';
import { normalizeTextStream } from '@/tts/utils/normalize-text-stream';
import type {
  QwenRealtimeOptions,
  QwenRealtimeTTSOptions,
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
 * Qwen Realtime TTS 提供商
 * 基于阿里云 DashScope Realtime WebSocket API 实现语音合成
 *
 * 与 QwenTTS (CosyVoice) 的区别:
 * - 端点: wss://dashscope.aliyuncs.com/api-ws/v1/realtime
 * - 消息格式: 事件类型 + JSON 结构
 * - 支持 qwen3-tts-instruct-flash-realtime 模型
 * - 支持 instructions 指令控制功能
 *
 * 支持的模型:
 * - qwen3-tts-instruct-flash-realtime (支持 instructions 功能)
 * - qwen3-tts-flash-realtime
 */
export class QwenRealtimeTTS extends BaseTTS {
  name = 'qwen-realtime';

  /** Realtime 专用选项 */
  public realtimeOptions?: QwenRealtimeOptions;
  /** 采样率 */
  public sampleRate?: number;

  constructor(options: QwenRealtimeTTSOptions) {
    super(options);
    // Realtime API 端点
    this.baseUrl = options.baseUrl || 'wss://dashscope.aliyuncs.com/api-ws/v1/realtime';
    // 默认使用 qwen3-tts-instruct-flash-realtime
    this.model = options.model || 'qwen3-tts-instruct-flash-realtime';
    // 默认使用 Cherry 音色
    this.voice = options.voice || 'Cherry';
    // 默认格式为 pcm（Realtime API 常用）
    this.format = options.format || 'pcm';
    // 采样率
    this.sampleRate = options.sampleRate;
    // Realtime 专用选项
    this.realtimeOptions = options.realtime;
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
    // 在 URL 中添加模型参数
    const url = new URL(this.baseUrl);
    url.searchParams.set('model', this.model);
    console.log('[Qwen Realtime] 连接 URL:', url.toString());

    const ws = new WebSocket(url.toString(), {
      headers: this.buildAuthHeaders(),
    });

    await new Promise<void>((resolve, reject) => {
      ws.on('open', resolve);
      ws.on('error', reject);
    });

    return ws;
  }

  /**
   * 初始化会话：等待 session.created 并发送 session.update
   */
  private async initializeSession(ws: WebSocket): Promise<void> {
    // 1. 等待 session.created 事件
    const createdEvent = await receiveEvent(ws);
    if (!isSessionCreatedEvent(createdEvent)) {
      if (isErrorEvent(createdEvent)) {
        throw new Error(
          `TTS session creation failed: ${createdEvent.error.code} - ${createdEvent.error.message}`
        );
      }
      throw new Error(`Unexpected event: ${createdEvent.type}, expected session.created`);
    }
    console.log('[Qwen Realtime] 会话已创建:', createdEvent.session.id);

    // 2. 发送 session.update 事件配置会话
    const sessionUpdateEvent = createSessionUpdateEvent({
      voice: this.voice, // 必填：音色
      mode: this.realtimeOptions?.mode || 'server_commit',
      languageType: this.realtimeOptions?.languageType || 'Auto',
      format: this.format,
      sampleRate: this.sampleRate || 24000,
      bitrate: this.realtimeOptions?.bitrate,
      instructions: this.realtimeOptions?.instructions,
      optimizeInstructions: this.realtimeOptions?.optimizeInstructions,
      speechRate: this.realtimeOptions?.speechRate,
      pitchRate: this.realtimeOptions?.pitchRate,
    });
    await sendEvent(ws, sessionUpdateEvent);

    // 3. 等待 session.updated 事件
    const updatedEvent = await receiveEvent(ws);
    if (!isSessionUpdatedEvent(updatedEvent)) {
      if (isErrorEvent(updatedEvent)) {
        throw new Error(
          `TTS session update failed: ${updatedEvent.error.code} - ${updatedEvent.error.message}`
        );
      }
      throw new Error(`Unexpected event: ${updatedEvent.type}, expected session.updated`);
    }
    console.log('[Qwen Realtime] 会话已配置');
  }

  /**
   * 合成语音（非流式）
   * WebSocket 交互流程：
   * 1. 连接 WebSocket
   * 2. 等待 session.created
   * 3. 发送 session.update 配置
   * 4. 等待 session.updated
   * 5. 发送 input_text_buffer.append（包含文本）
   * 6. 发送 session.finish
   * 7. 收集音频数据直到 session.finished
   */
  async synthesize(request: TTSRequest): Promise<TTSResponse> {
    const text = request.text;

    // 创建 WebSocket 连接
    const ws = await this.createConnection();

    try {
      // 初始化会话
      await this.initializeSession(ws);

      // 发送文本
      const appendEvent = createInputTextBufferAppendEvent(text);
      await sendEvent(ws, appendEvent);

      // 发送 session.finish
      const finishEvent = createSessionFinishEvent();
      await sendEvent(ws, finishEvent);

      // 收集音频数据
      const audioChunks: Uint8Array[] = [];

      while (true) {
        const event = await receiveEvent(ws);

        if (isAudioEvent(event)) {
          const audioData = Buffer.from(event.delta, 'base64');
          audioChunks.push(new Uint8Array(audioData));
        } else if (isSessionFinishedEvent(event)) {
          console.log('[Qwen Realtime] 会话结束');
          break;
        } else if (isErrorEvent(event)) {
          throw new Error(`TTS error: ${event.error.code} - ${event.error.message}`);
        }
      }

      if (audioChunks.length === 0) {
        throw new Error('No audio received from Qwen Realtime TTS service');
      }

      // 合并音频数据
      const totalLength = audioChunks.reduce((sum, chunk) => sum + chunk.length, 0);
      const audio = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of audioChunks) {
        audio.set(chunk, offset);
        offset += chunk.length;
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
   * 流式语音合成
   * 支持流式文本输入，实时输出音频
   *
   * @param input 文本输入，可以是字符串或文本流（AsyncIterable<string>）
   * @returns 流式音频块
   * @internal
   */
  protected async *speakStream(input: string | TextStream): AsyncIterable<TTSStreamChunk> {
    const textStream = normalizeTextStream(input);

    console.log('[Qwen Realtime] ========== 开始流式输入处理 ==========');

    // 创建队列和同步机制
    const queue: QueueItem[] = [];
    const syncState = { resolveWait: null as (() => void) | null, finished: false };

    const enqueue = (item: QueueItem) => {
      queue.push(item);
      syncState.resolveWait?.();
      syncState.resolveWait = null;
    };

    // 创建 WebSocket 连接（包含模型参数）
    const url = new URL(this.baseUrl);
    url.searchParams.set('model', this.model);
    const ws = new WebSocket(url.toString(), {
      headers: this.buildAuthHeaders(),
    });

    await new Promise<void>((resolve, reject) => {
      ws.on('open', resolve);
      ws.on('error', reject);
    });
    console.log('[Qwen Realtime] WebSocket 已连接');

    // 启动处理流程（后台并发执行）
    const processPromise = (async () => {
      try {
        // 初始化会话
        await this.initializeSession(ws);

        // 并发执行发送和接收
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
    console.log('[Qwen Realtime 发送流程] 开始监听文本流...');

    let chunkIndex = 0;
    let textSent = false;
    for await (const chunk of textStream) {
      if (chunk) {
        chunkIndex++;
        console.log(`[Qwen Realtime 发送流程] 收到文本块 #${chunkIndex}: "${chunk}"`);
        const appendEvent = createInputTextBufferAppendEvent(chunk);
        await sendEvent(ws, appendEvent);
        textSent = true;
      }
    }

    // 如果没有发送任何文本，发送空字符串
    if (!textSent) {
      console.log('[Qwen Realtime 发送流程] 没有文本，发送空字符串');
      const appendEvent = createInputTextBufferAppendEvent('');
      await sendEvent(ws, appendEvent);
    }

    console.log('[Qwen Realtime 发送流程] 文本流结束，发送 session.finish');
    // 发送 session.finish
    const finishEvent = createSessionFinishEvent();
    await sendEvent(ws, finishEvent);
  }

  /**
   * 接收音频数据并推入队列
   */
  private async receiveAudioFlowToQueue(
    ws: WebSocket,
    enqueue: (item: QueueItem) => void
  ): Promise<void> {
    console.log('[Qwen Realtime 接收流程] 开始监听音频流...');
    let audioIndex = 0;

    while (true) {
      const event = await receiveEvent(ws);

      if (isAudioEvent(event)) {
        audioIndex++;
        const audioData = Buffer.from(event.delta, 'base64');
        console.log(
          `[Qwen Realtime 接收流程] 收到音频块 #${audioIndex}: ${audioData.length} bytes`
        );
        enqueue({ type: 'audio', chunk: new Uint8Array(audioData) });
      } else if (isSessionFinishedEvent(event)) {
        console.log('[Qwen Realtime 接收流程] 会话结束');
        enqueue({ type: 'end' });
        return;
      } else if (isErrorEvent(event)) {
        console.error(
          `[Qwen Realtime 接收流程] 错误: ${event.error.code} - ${event.error.message}`
        );
        enqueue({
          type: 'error',
          error: new Error(`${event.error.code}: ${event.error.message}`),
        });
        return;
      }
      // 其他事件忽略
    }
  }
}
