import { BaseASR } from '@/asr/base';
import { registerASRProvider } from '@/asr/factory';
import type { ASROptions, ASRRequest, ASRResponse } from '@/types/asr';

export class WhisperASR extends BaseASR {
  name = 'openai';

  constructor(options: ASROptions) {
    super(options);
    this.baseUrl = options.baseUrl || 'https://api.openai.com/v1';
    this.model = options.model || 'whisper-1';
  }

  async recognize(request: ASRRequest): Promise<ASRResponse> {
    const opts = this.buildRequestOptions(request);
    // TODO: Implement OpenAI Whisper API call
    return {
      text: '',
      language: opts.language,
    };
  }
}

registerASRProvider('openai', WhisperASR);
