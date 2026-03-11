import { BaseASR } from '@/asr/base';
import { registerASRProvider } from '@/asr/factory';
import type { ASROptions, ASRRequest, ASRResponse, ASRStreamChunk, AudioStream } from '@/types/asr';

export class GeminiASR extends BaseASR {
  name = 'gemini';

  constructor(options: ASROptions) {
    super(options);
    this.baseUrl = options.baseUrl || 'https://generativelanguage.googleapis.com/v1beta';
    this.model = options.model || 'gemini-asr';
  }

  async listen(request: ASRRequest): Promise<ASRResponse> {
    const opts = this.buildRequestOptions(request);
    // TODO: Implement Gemini ASR API call
    return {
      text: '',
      language: opts.language,
    };
  }

  // biome-ignore lint/correctness/useYield: 空实现，等待后续完善
  async *streamFrom(_audio: AudioStream): AsyncIterable<ASRStreamChunk> {
    // TODO: 实现 Gemini ASR 流式识别
    console.warn('Gemini ASR streamFrom method is not implemented yet');
    return;
  }
}

registerASRProvider('gemini', GeminiASR);
