import { BaseASR } from '@/asr/base';
import { registerASRProvider } from '@/asr/factory';
import type { ASROptions, ASRRequest, ASRResponse } from '@/types/asr';

export class MinimaxASR extends BaseASR {
  name = 'minimax';

  constructor(options: ASROptions) {
    super(options);
    this.baseUrl = options.baseUrl || 'https://api.minimax.chat/v1';
    this.model = options.model || 'speech-01';
  }

  async recognize(request: ASRRequest): Promise<ASRResponse> {
    const opts = this.buildRequestOptions(request);
    // TODO: Implement Minimax ASR API call
    return {
      text: '',
      language: opts.language,
    };
  }
}

registerASRProvider('minimax', MinimaxASR);
