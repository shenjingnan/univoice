import type { ASROptions, ASRProvider, ASRRequest, ASRResponse } from '@/types/asr.js';

export abstract class BaseASR implements ASRProvider {
  abstract name: string;
  protected apiKey: string;
  protected baseUrl: string;
  protected model: string;
  protected language: string;
  protected prompt: string;
  protected responseFormat: 'json' | 'text' | 'srt' | 'vtt' | 'verbose_json';

  constructor(options: ASROptions) {
    this.apiKey = options.apiKey || '';
    this.baseUrl = options.baseUrl || '';
    this.model = options.model || 'default';
    this.language = options.language || 'zh-CN';
    this.prompt = options.prompt || '';
    this.responseFormat = options.responseFormat || 'json';
  }

  abstract recognize(request: ASRRequest): Promise<ASRResponse>;

  protected buildRequestOptions(request: ASRRequest): ASROptions {
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
