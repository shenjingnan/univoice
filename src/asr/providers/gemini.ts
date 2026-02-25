import type { ASROptions, ASRRequest, ASRResponse } from '@/types/asr';
import { BaseASR } from '@/asr/base';
import { registerASRProvider } from '@/asr/factory';

export class GeminiASR extends BaseASR {
  name = 'gemini';

  constructor(options: ASROptions) {
    super(options);
    this.baseUrl = options.baseUrl || 'https://generativelanguage.googleapis.com/v1beta';
    this.model = options.model || 'gemini-asr';
  }

  async recognize(request: ASRRequest): Promise<ASRResponse> {
    const opts = this.buildRequestOptions(request);
    // TODO: Implement Gemini ASR API call
    return {
      text: '',
      language: opts.language,
    };
  }
}

registerASRProvider('gemini', GeminiASR);
