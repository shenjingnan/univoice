import { Buffer } from 'node:buffer';
import { BaseTTS } from '@/tts/base';
import { normalizeTextStream } from '@/tts/utils/normalize-text-stream';
import type {
  GlmTTSOptions,
  TextStream,
  TTSRequest,
  TTSResponse,
  TTSStreamChunk,
} from '@/types/tts';

/**
 * GLM TTS API 响应类型
 */
interface GlmTTSResponse {
  id?: string;
  choices?: Array<{
    index: number;
    delta?: {
      content?: string;
    };
    finish_reason?: string;
  }>;
}

/**
 * GLM TTS 错误响应类型
 */
interface GlmTTSErrorResponse {
  error?: {
    message?: string;
    code?: string;
  };
  message?: string;
}

/**
 * GLM TTS 提供商
 * 基于智谱 AI GLM TTS HTTP REST API 实现语音合成
 *
 * API 特性：
 * - 端点: https://open.bigmodel.cn/api/paas/v4/audio/speech
 * - 协议: HTTP POST (非 WebSocket)
 * - 模型: glm-tts
 * - 音频格式: wav / pcm
 * - 流式支持: Event Stream (stream=true)
 *
 * 可用音色：
 * - tongtong (默认): 童童
 * - xiaochen: 小晨
 * - chuichui: 吹吹
 * - jam: jam
 * - kazi: 卡子
 * - douji: 豆汁
 * - luodo: 螺蛳
 * - female: 女声
 * - male: 男声
 */
export class GlmTTS extends BaseTTS {
  name = 'glm';

  constructor(options: GlmTTSOptions) {
    super(options);
    // REST API 地址
    this.baseUrl = options.baseUrl || 'https://open.bigmodel.cn/api/paas/v4/audio/speech';
    // 默认模型
    this.model = options.model || 'glm-tts';
    // 默认音色
    this.voice = options.voice || 'tongtong';
    // 默认格式
    this.format = options.format || 'pcm';
  }

  /**
   * 格式映射
   * GLM TTS 只支持 wav / pcm，其他格式回退到 wav
   */
  private mapFormat(format: string): 'wav' | 'pcm' {
    const supportedFormats = ['wav', 'pcm'] as const;
    if (supportedFormats.includes(format as (typeof supportedFormats)[number])) {
      return format as (typeof supportedFormats)[number];
    }
    // GLM TTS 只支持 wav/pcm，其他格式回退到 wav
    return 'wav';
  }

  /**
   * 解析 API 错误响应
   */
  private async handleErrorResponse(response: Response): Promise<never> {
    let errorMessage = `HTTP ${response.status}: ${response.statusText}`;

    try {
      const errorData = (await response.json()) as GlmTTSErrorResponse;
      if (errorData.error?.message) {
        errorMessage = errorData.error.message;
      } else if (errorData.message) {
        errorMessage = errorData.message;
      }
    } catch {
      // 忽略解析错误
    }

    throw new Error(`GLM TTS 请求失败: ${errorMessage}`);
  }

  /**
   * 非流式合成
   * 直接发送 HTTP POST 请求，返回完整音频数据
   */
  async synthesize(request: TTSRequest): Promise<TTSResponse> {
    if (!this.apiKey) {
      throw new Error('apiKey 是 GLM TTS 必需的参数');
    }

    const opts = this.buildRequestOptions(request);
    const format = this.mapFormat(opts.format || this.format);

    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: opts.model || this.model,
        input: request.text,
        voice: opts.voice || this.voice,
        response_format: format,
      }),
    });

    if (!response.ok) {
      await this.handleErrorResponse(response);
    }

    // 响应直接是音频数据
    const audioBuffer = await response.arrayBuffer();

    return {
      audio: Buffer.from(audioBuffer),
      format,
    };
  }

  /**
   * 流式语音合成（内部实现方法）
   * 使用 Event Stream 接收 base64 编码的音频块
   *
   * @param input 文本输入，可以是字符串或文本流
   * @returns 流式音频块
   * @internal
   */
  protected async *speakStream(input: string | TextStream): AsyncIterable<TTSStreamChunk> {
    if (!this.apiKey) {
      throw new Error('apiKey 是 GLM TTS 必需的参数');
    }

    // 收集所有文本
    const textStream = normalizeTextStream(input);
    const textChunks: string[] = [];
    for await (const chunk of textStream) {
      textChunks.push(chunk);
    }
    const text = textChunks.join('');

    // 流式模式只支持 PCM 格式
    // 参考: docs/content/glm/文字转语音.md - 流式生成音频时，仅支持返回 pcm 格式的文件
    const format = 'pcm';

    // 发送请求
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      },
      body: JSON.stringify({
        model: this.model,
        input: text,
        voice: this.voice,
        response_format: format,
        stream: true,
        encode_format: 'base64',
      }),
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
              const parsed = JSON.parse(data) as GlmTTSResponse;

              // 提取 base64 音频数据
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                // Base64 解码
                const audioChunk = Buffer.from(content, 'base64');
                yield { audioChunk };
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
}
