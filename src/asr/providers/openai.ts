import type { ASROptions, ASRRequest, ASRResponse } from '../../../types/asr.js';
import { BaseASR } from '../base.js';
import { registerASRProvider } from '../factory.js';

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
