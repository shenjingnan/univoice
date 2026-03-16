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
  sendMessage,
  waitForTaskStarted,
} from '@/tts/protocols/dashscope';
import type { TTSOptions, TTSRequest, TTSResponse } from '@/types/tts';

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

  constructor(options: TTSOptions) {
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
        sampleRate: opts.sampleRate,
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
}
