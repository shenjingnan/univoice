import { Buffer } from 'node:buffer';
import type {
  SpeakInstanceOptions,
  TextStream,
  TTSOptions,
  TTSProvider,
  TTSRequest,
  TTSResponse,
  TTSStreamChunk,
  TTSVoice,
} from '@/types/tts';

export abstract class BaseTTS implements TTSProvider {
  abstract name: string;
  public apiKey: string;
  public baseUrl: string;
  public model: string;
  public voice: string;
  public speed: number;
  public volume: number;
  public pitch: number;
  public format: 'mp3' | 'wav' | 'ogg' | 'flac' | 'pcm';
  public language: string;

  constructor(options: TTSOptions) {
    this.apiKey = options.apiKey || '';
    this.baseUrl = options.baseUrl || '';
    this.model = options.model || 'default';
    this.voice = options.voice || 'default';
    this.speed = options.speed || 1.0;
    this.volume = options.volume || 1.0;
    this.pitch = options.pitch || 1.0;
    this.format = options.format || 'mp3';
    this.language = options.language || 'zh-CN';
  }

  abstract synthesize(request: TTSRequest): Promise<TTSResponse>;

  /**
   * 默认模式（非流式）- 返回完整音频
   */
  speak(input: string | TextStream): Promise<TTSResponse>;

  /**
   * 流式模式 - 返回音频流
   */
  speak(
    input: string | TextStream,
    options: SpeakInstanceOptions & { stream: true }
  ): AsyncIterable<TTSStreamChunk>;

  /**
   * 非流式模式 - 返回完整音频
   */
  speak(
    input: string | TextStream,
    options: SpeakInstanceOptions & { stream: false }
  ): Promise<TTSResponse>;

  /**
   * speak 实现
   * 支持"边发边收"模式，适合 LLM 流式输出转语音等场景
   *
   * @param input 文本输入，可以是字符串或文本流（AsyncIterable<string>）
   * @param options 选项，stream 为 true 时返回流式音频块，否则默认返回完整音频
   */
  speak(
    input: string | TextStream,
    options?: SpeakInstanceOptions
  ): Promise<TTSResponse> | AsyncIterable<TTSStreamChunk> {
    // 只有明确指定 stream: true 时才返回流式模式
    if (options?.stream === true) {
      return this.createSpeakStreamIterable(input);
    }
    return this.collectTTSResponse(input);
  }

  /**
   * 创建流式迭代器
   */
  private async *createSpeakStreamIterable(
    input: string | TextStream
  ): AsyncIterable<TTSStreamChunk> {
    yield* this.speakStream(input);
  }

  /**
   * 收集完整音频响应
   */
  private async collectTTSResponse(input: string | TextStream): Promise<TTSResponse> {
    const chunks: Uint8Array[] = [];

    for await (const chunk of this.speakStream(input)) {
      chunks.push(chunk.audioChunk);
    }

    return {
      audio: Buffer.concat(chunks),
      format: this.format,
    };
  }

  /**
   * 流式语音合成（子类可选实现）
   * 支持"边发边收"模式，适合 LLM 流式输出转语音等场景
   * 默认实现：不支持，子类可以覆盖此方法提供支持
   *
   * @param input 文本输入，可以是字符串或文本流（AsyncIterable<string>）
   * @returns 流式音频块
   */
  speakStream(_input: string | TextStream): AsyncIterable<TTSStreamChunk> {
    throw new Error(
      `Provider ${this.name} does not support streaming input mode (speakStream method)`
    );
  }

  async listVoices(): Promise<TTSVoice[]> {
    return [];
  }

  public buildRequestOptions(request: TTSRequest): TTSOptions {
    return {
      provider: this.constructor.name,
      apiKey: this.apiKey,
      baseUrl: this.baseUrl,
      model: this.model,
      voice: this.voice,
      speed: this.speed,
      volume: this.volume,
      pitch: this.pitch,
      format: this.format,
      language: this.language,
      ...request.options,
    };
  }
}
