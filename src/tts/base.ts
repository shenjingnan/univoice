import type {
  BaseTTSOptions,
  SpeakInstanceOptions,
  TextStream,
  TTSConnection,
  TTSConnectOptions,
  TTSProvider,
  TTSRequest,
  TTSResponse,
  TTSStreamChunk,
  TTSVoice,
} from '@/types/tts';
import { normalizeTextStream } from './utils/normalize-text-stream';

export abstract class BaseTTS implements TTSProvider {
  abstract name: string;
  public apiKey: string;
  public baseUrl: string;
  public model: string;
  public voice: string;
  public speed: number;
  public volume: number;
  public pitch: number;
  public format: 'mp3' | 'wav' | 'ogg' | 'flac' | 'pcm' | 'opus' | 'ogg_opus';
  public language: string;

  constructor(options: BaseTTSOptions) {
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
    // 流式输出模式：使用 speakStream（需要 provider 支持）
    if (options?.stream === true) {
      return this.createSpeakStreamIterable(input);
    }

    // 非流式输出模式：使用 synthesize（所有 provider 支持）
    return this.synthesizeFromInput(input);
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
   * 使用 synthesize 处理输入（非流式输出）
   * 字符串输入直接调用，流式输入先收集再调用
   */
  private async synthesizeFromInput(input: string | TextStream): Promise<TTSResponse> {
    // 使用 normalizeTextStream 统一处理输入（支持字符串、AsyncIterable<string>、OpenAIStream）
    const textChunks: string[] = [];
    for await (const chunk of normalizeTextStream(input)) {
      textChunks.push(chunk);
    }

    return this.synthesize({ text: textChunks.join('') });
  }

  /**
   * 流式语音合成（内部实现方法，子类可选覆盖）
   *
   * 此方法为内部实现细节，仅供 speak 方法调用。
   * 子类可以覆盖此方法以提供流式语音合成支持。
   * 用户应使用 speak(input, { stream: true }) 获取流式音频。
   *
   * @param input 文本输入，可以是字符串或文本流（AsyncIterable<string>）
   * @returns 流式音频块
   * @internal
   */
  protected speakStream(_input: string | TextStream): AsyncIterable<TTSStreamChunk> {
    throw new Error(
      `Provider ${this.name} 不支持流式输出模式。` +
        `请使用 speak('text') 或 synthesize({ text: 'text' }) 进行非流式语音合成。`
    );
  }

  async listVoices(): Promise<TTSVoice[]> {
    return [];
  }

  /**
   * 预建立 WebSocket 连接
   * 默认不支持，子类可以覆盖以提供连接复用能力
   */
  connect(_options?: TTSConnectOptions): Promise<TTSConnection> {
    throw new Error(
      `${this.name} does not support connection pre-establishment. Use speak() or synthesize() directly.`
    );
  }

  public buildRequestOptions(request: TTSRequest): BaseTTSOptions & { provider: string } {
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
