import type {
  TTSOptions,
  TTSProvider,
  TTSRequest,
  TTSResponse,
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
  public format: 'mp3' | 'wav' | 'ogg' | 'flac';
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
