import { BaseASR } from '@/asr/base';
import { registerASRProvider } from '@/asr/factory';
import type { ASROptions, ASRRequest, ASRResponse, ASRStreamChunk, AudioStream } from '@/types/asr';

export class MinimaxASR extends BaseASR {
  name = 'minimax';

  constructor(options: ASROptions) {
    super(options);
    this.baseUrl = options.baseUrl || 'https://api.minimax.chat/v1';
    this.model = options.model || 'speech-01';
  }

  async listen(request: ASRRequest): Promise<ASRResponse> {
    const opts = this.buildRequestOptions(request);
    // TODO: Implement Minimax ASR API call
    return {
      text: '',
      language: opts.language,
    };
  }

  // biome-ignore lint/correctness/useYield: 空实现，等待后续完善
  async *streamFrom(_audio: AudioStream): AsyncIterable<ASRStreamChunk> {
    // TODO: 实现 Minimax ASR 流式识别
    console.warn('Minimax ASR streamFrom method is not implemented yet');
    return;
  }
}

registerASRProvider('minimax', MinimaxASR);
