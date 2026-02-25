import type { ASROptions, ASRRequest, ASRResponse } from '../../../types/asr.js';
import { BaseASR } from '../base.js';
import { registerASRProvider } from '../factory.js';

export class QwenASR extends BaseASR {
  name = 'qwen';

  constructor(options: ASROptions) {
    super(options);
    this.baseUrl = options.baseUrl || 'https://dashscope.aliyuncs.com/api/v1';
    this.model = options.model || 'paraformer-v2';
  }

  async recognize(request: ASRRequest): Promise<ASRResponse> {
    const opts = this.buildRequestOptions(request);
    // TODO: Implement Qwen ASR API call
    return {
      text: '',
      language: opts.language,
    };
  }
}

registerASRProvider('qwen', QwenASR);
