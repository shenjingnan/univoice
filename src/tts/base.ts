import type {
  TTSOptions,
  TTSProvider,
  TTSRequest,
  TTSResponse,
  TTSStreamChunk,
  TTSVoice,
  TextStream,
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
   * 边发边收模式 - 流式文本输入
   * 默认实现：不支持流式输入，子类可以覆盖此方法提供支持
   *
   * @param input 文本输入，可以是字符串或文本流（AsyncIterable<string>）
   * @returns 流式音频块
   */
  speak(_input: string | TextStream): AsyncIterable<TTSStreamChunk> {
    throw new Error(`Provider ${this.name} does not support streaming input mode (speak method)`);
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
