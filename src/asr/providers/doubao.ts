import type { ASROptions, ASRRequest, ASRResponse } from '@/types/asr.js';
import { BaseASR } from '../base.js';
import { registerASRProvider } from '../factory.js';

export class DoubaoASR extends BaseASR {
  name = 'doubao';

  constructor(options: ASROptions) {
    super(options);
    this.baseUrl = options.baseUrl || 'https://ark.cn-beijing.volces.com/api/v3';
    this.model = options.model || 'doubao-asr';
  }

  async recognize(request: ASRRequest): Promise<ASRResponse> {
    const opts = this.buildRequestOptions(request);
    // TODO: Implement Doubao ASR API call
    return {
      text: '',
      language: opts.language,
    };
  }
}

registerASRProvider('doubao', DoubaoASR);
