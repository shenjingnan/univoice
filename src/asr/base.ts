import type { ASROptions, ASRProvider, ASRRequest, ASRResponse, ASRStreamChunk } from '@/types/asr';

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
   * 流式识别方法
   * 默认实现：不支持流式输出，子类可以覆盖此方法提供支持
   *
   * @param request 语音识别请求
   * @returns 流式识别结果
   */
  stream(_request: ASRRequest): AsyncIterable<ASRStreamChunk> {
    throw new Error(`Provider ${this.name} does not support streaming output`);
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
