import { Buffer } from 'node:buffer';
import { stat } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { promisify } from 'node:util';
import { BaseASR } from '@/asr/base';
import type {
  ASRResponse,
  ASRStreamChunk,
  AudioStream,
  AudioStreamInput,
  GlmASROptions,
  ListenInstanceOptions,
} from '@/types/asr';

const statAsync = promisify(stat);

/**
 * GLM ASR API 响应类型
 */
interface GlmASRResponse {
  text: string;
}

/**
 * GLM ASR 流式响应类型
 */
interface GlmASRStreamResponse {
  text?: string;
  delta?: string; // 增量文本
  type?: 'transcript.text.delta' | 'transcript.text.done';
  is_final?: boolean;
  isFinal?: boolean;
  start_time?: number;
  end_time?: number;
}

/**
 * GLM ASR 错误响应类型
 */
interface GlmASRErrorResponse {
  error?: {
    message?: string;
  };
  message?: string;
}

/**
 * GLM ASR 提供商
 * 基于智谱 AI GLM ASR HTTP REST API 实现语音识别
 *
 * API 特性：
 * - 端点: https://open.bigmodel.cn/api/paas/v4/audio/transcriptions
 * - 协议: HTTP REST (非 WebSocket)
 * - 模型: glm-asr-2512
 * - 音频格式: .wav / .mp3
 * - 文件限制: ≤ 25 MB，时长 ≤ 30 秒
 * - 流式模式: Event Stream (stream=true)
 *
 * 特殊参数:
 * - hotwords: 热词列表（提高特定词汇识别准确率）
 * - context: 上下文文本（长文本场景优化）
 */
export class GlmASR extends BaseASR {
  name = 'glm';

  /** 热词列表 */
  public hotwords?: string[];
  /** 上下文文本 */
  public context?: string;

  /** 最大文件大小（25 MB） */
  private readonly MAX_FILE_SIZE = 25 * 1024 * 1024;

  constructor(options: GlmASROptions) {
    super(options);
    // REST API 地址
    this.baseUrl = options.baseUrl || 'https://open.bigmodel.cn/api/paas/v4/audio/transcriptions';
    // 默认模型
    this.model = options.model || 'glm-asr-2512';

    // GLM 专用参数
    this.hotwords = options.hotwords;
    this.context = options.context;
  }

  /**
   * 判断输入是否为文件路径
   */
  private isFilePath(input: AudioStreamInput): input is string {
    if (typeof input !== 'string') return false;
    return (
      input.includes('/') ||
      input.includes('\\') ||
      input.endsWith('.mp3') ||
      input.endsWith('.wav')
    );
  }

  /**
   * 判断输入是否为音频流
   */
  private isGlmAudioStream(input: AudioStreamInput): input is AudioStream {
    return input !== null && typeof input === 'object' && Symbol.asyncIterator in input;
  }

  /**
   * 验证文件
   */
  private async validateFile(filePath: string): Promise<void> {
    const stats = await statAsync(filePath);

    // 检查文件大小
    if (stats.size > this.MAX_FILE_SIZE) {
      throw new Error(`文件大小超出限制: ${stats.size} bytes (最大 25 MB)`);
    }

    // 检查文件格式
    const ext = filePath.toLowerCase().slice(-4);
    if (ext !== '.wav' && ext !== '.mp3') {
      throw new Error(`不支持的音频格式: ${ext}，仅支持 .wav 和 .mp3`);
    }
  }

  /**
   * 将音频流收集为 Buffer
   * GLM ASR 不支持真正的流式输入，需要完整文件
   */
  private async collectStream(audio: AudioStream): Promise<Buffer> {
    const chunks: Buffer[] = [];
    for await (const chunk of audio) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  /**
   * 构建 FormData
   */
  private async buildFormData(
    data: Buffer | string,
    filename: string,
    stream: boolean
  ): Promise<FormData> {
    const formData = new FormData();

    // 添加文件
    if (typeof data === 'string') {
      // 文件路径 - 读取为 Buffer 后创建 Blob
      const fileBuffer = await readFile(data);
      const blob = new Blob([fileBuffer]);
      formData.append('file', blob, filename);
    } else {
      // Buffer - 创建新的 ArrayBuffer 副本以确保类型兼容
      const arrayBuffer = new ArrayBuffer(data.length);
      const view = new Uint8Array(arrayBuffer);
      view.set(data);
      const blob = new Blob([arrayBuffer]);
      formData.append('file', blob, filename);
    }

    // 添加模型参数
    formData.append('model', this.model);

    // 流式模式
    if (stream) {
      formData.append('stream', 'true');
    }

    // 热词
    if (this.hotwords && this.hotwords.length > 0) {
      formData.append('hotwords', this.hotwords.join(','));
    }

    // 上下文
    if (this.context) {
      formData.append('context', this.context);
    }

    return formData;
  }

  /**
   * 解析 API 错误响应
   */
  private async handleErrorResponse(response: Response): Promise<never> {
    let errorMessage = `HTTP ${response.status}: ${response.statusText}`;

    try {
      const errorData = (await response.json()) as GlmASRErrorResponse;
      if (errorData.error?.message) {
        errorMessage = errorData.error.message;
      } else if (errorData.message) {
        errorMessage = errorData.message;
      }
    } catch {
      // 忽略解析错误
    }

    throw new Error(`GLM ASR 请求失败: ${errorMessage}`);
  }

  /**
   * 非流式识别
   */
  private async recognize(audio: Buffer | string, filename: string): Promise<ASRResponse> {
    const formData = await this.buildFormData(audio, filename, false);

    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: formData,
    });

    if (!response.ok) {
      await this.handleErrorResponse(response);
    }

    const result = (await response.json()) as GlmASRResponse;

    // 解析响应
    return {
      text: result.text || '',
    };
  }

  /**
   * 流式识别（Event Stream）
   */
  private async *recognizeStream(
    audio: Buffer | string,
    filename: string
  ): AsyncIterable<ASRStreamChunk> {
    const formData = await this.buildFormData(audio, filename, true);

    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        Accept: 'text/event-stream',
      },
      body: formData,
    });

    if (!response.ok) {
      await this.handleErrorResponse(response);
    }

    if (!response.body) {
      throw new Error('响应体为空');
    }

    // 解析 Event Stream
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });

        // 按行解析
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // 保留未完成的行

        for (const line of lines) {
          const trimmedLine = line.trim();

          // 跳过空行
          if (!trimmedLine) {
            continue;
          }

          // 检查是否为数据行
          if (trimmedLine.startsWith('data:')) {
            const data = trimmedLine.slice(5).trim();

            // 检查是否结束
            if (data === '[DONE]') {
              return;
            }

            try {
              const parsed = JSON.parse(data) as GlmASRStreamResponse;

              // 处理增量文本
              if (parsed.type === 'transcript.text.delta' && parsed.delta) {
                yield {
                  text: parsed.delta,
                  isFinal: false,
                };
              }
              // 处理最终结果
              else if (parsed.type === 'transcript.text.done' && parsed.text) {
                yield {
                  text: parsed.text,
                  isFinal: true,
                };
              }
              // 兼容旧格式（无 type 字段）
              else if (parsed.text) {
                const chunk: ASRStreamChunk = {
                  text: parsed.text,
                  isFinal: parsed.is_final === true || parsed.isFinal === true,
                };

                // 如果有分段信息
                if (parsed.start_time !== undefined && parsed.end_time !== undefined) {
                  chunk.segment = {
                    id: 0,
                    start: parsed.start_time,
                    end: parsed.end_time,
                    text: parsed.text,
                  };
                }

                yield chunk;
              }
            } catch {
              // 忽略解析错误
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * 重写 listen 方法
   * GLM ASR 使用 HTTP REST API，不支持真正的流式输入
   */
  listen(
    audio: AudioStreamInput,
    options: ListenInstanceOptions & { stream: true }
  ): AsyncIterable<ASRStreamChunk>;

  listen(
    audio: AudioStreamInput,
    options?: ListenInstanceOptions & { stream?: false }
  ): Promise<ASRResponse>;

  listen(
    audio: AudioStreamInput,
    options?: ListenInstanceOptions
  ): Promise<ASRResponse> | AsyncIterable<ASRStreamChunk> {
    if (!this.apiKey) {
      throw new Error('apiKey 是 GLM ASR 必需的参数');
    }

    // 根据输入类型处理
    if (this.isFilePath(audio)) {
      // 文件路径
      if (options?.stream === true) {
        return this.createGlmStreamIterable(audio);
      }
      return this.collectGlmResponse(audio);
    }

    // AudioStream、Buffer 或 Uint8Array
    if (options?.stream === true) {
      return this.createGlmStreamIterableFromData(audio);
    }
    return this.collectGlmResponseFromData(audio);
  }

  /**
   * 创建流式迭代器（从文件路径）
   */
  private async *createGlmStreamIterable(filePath: string): AsyncIterable<ASRStreamChunk> {
    await this.validateFile(filePath);
    yield* this.recognizeStream(filePath, basename(filePath));
  }

  /**
   * 创建流式迭代器（从音频数据）
   */
  private async *createGlmStreamIterableFromData(
    audio: AudioStreamInput
  ): AsyncIterable<ASRStreamChunk> {
    const buffer = await this.prepareAudioData(audio);
    yield* this.recognizeStream(buffer, 'audio.mp3');
  }

  /**
   * 收集非流式识别结果（从文件路径）
   */
  private async collectGlmResponse(filePath: string): Promise<ASRResponse> {
    await this.validateFile(filePath);
    return this.recognize(filePath, basename(filePath));
  }

  /**
   * 收集非流式识别结果（从音频数据）
   */
  private async collectGlmResponseFromData(audio: AudioStreamInput): Promise<ASRResponse> {
    const buffer = await this.prepareAudioData(audio);
    return this.recognize(buffer, 'audio.mp3');
  }

  /**
   * 准备音频数据
   */
  private async prepareAudioData(audio: AudioStreamInput): Promise<Buffer> {
    if (this.isGlmAudioStream(audio)) {
      const buffer = await this.collectStream(audio);
      if (buffer.length > this.MAX_FILE_SIZE) {
        throw new Error(`音频数据大小超出限制: ${buffer.length} bytes (最大 25 MB)`);
      }
      return buffer;
    }

    // Buffer 或 Uint8Array
    const buffer = Buffer.isBuffer(audio) ? audio : Buffer.from(audio);
    if (buffer.length > this.MAX_FILE_SIZE) {
      throw new Error(`音频数据大小超出限制: ${buffer.length} bytes (最大 25 MB)`);
    }
    return buffer;
  }

  /**
   * 流式输入识别方法
   * GLM ASR 不支持真正的流式输入，这里将流收集后一次性发送
   */
  async *listenStream(audio: AudioStream): AsyncIterable<ASRStreamChunk> {
    const buffer = await this.collectStream(audio);

    if (buffer.length > this.MAX_FILE_SIZE) {
      throw new Error(`音频数据大小超出限制: ${buffer.length} bytes (最大 25 MB)`);
    }

    yield* this.recognizeStream(buffer, 'audio.mp3');
  }
}
