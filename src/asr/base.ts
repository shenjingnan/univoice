import type {
  ASROptions,
  ASRProvider,
  ASRRequest,
  ASRResponse,
  ASRStreamChunk,
  AudioStream,
} from '@/types/asr';

export abstract class BaseASR implements ASRProvider {
  abstract name: string;
  public apiKey: string;
  public baseUrl: string;
  public model: string;
  public language: string;
  public prompt: string;
  public responseFormat: 'json' | 'text' | 'srt' | 'vtt' | 'verbose_json';

  constructor(options: ASROptions) {
    this.apiKey = options.apiKey || '';
    this.baseUrl = options.baseUrl || '';
    this.model = options.model || 'default';
    this.language = options.language || 'zh-CN';
    this.prompt = options.prompt || '';
    this.responseFormat = options.responseFormat || 'json';
  }

  abstract listen(request: ASRRequest): Promise<ASRResponse>;

  /**
   * 流式输入识别方法
   * 默认实现：暂未实现，子类应覆盖此方法
   *
   * @param _audio 音频流
   * @returns 流式识别结果
   */
  // biome-ignore lint/correctness/useYield: 空实现，等待子类覆盖
  async *streamFrom(_audio: AudioStream): AsyncIterable<ASRStreamChunk> {
    // TODO: 等待子类实现
    console.warn(`${this.name} ASR provider has not implemented streamFrom method yet`);
    return;
  }

  public buildRequestOptions(request: ASRRequest): ASROptions {
    return {
      provider: this.constructor.name,
      apiKey: this.apiKey,
      baseUrl: this.baseUrl,
      model: this.model,
      language: this.language,
      prompt: this.prompt,
      responseFormat: this.responseFormat,
      ...request.options,
    };
  }
}
