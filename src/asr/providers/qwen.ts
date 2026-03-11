import { BaseASR } from '@/asr/base';
import { registerASRProvider } from '@/asr/factory';
import type { ASROptions, ASRRequest, ASRResponse, ASRStreamChunk, AudioStream } from '@/types/asr';

export class QwenASR extends BaseASR {
  name = 'qwen';

  constructor(options: ASROptions) {
    super(options);
    this.baseUrl = options.baseUrl || 'https://dashscope.aliyuncs.com/api/v1';
    this.model = options.model || 'paraformer-v2';
  }

  async listen(request: ASRRequest): Promise<ASRResponse> {
    const opts = this.buildRequestOptions(request);
    // TODO: Implement Qwen ASR API call
    return {
      text: '',
      language: opts.language,
    };
  }

  // biome-ignore lint/correctness/useYield: 空实现，等待后续完善
  async *streamFrom(_audio: AudioStream): AsyncIterable<ASRStreamChunk> {
    // TODO: 实现 Qwen ASR 流式识别
    console.warn('Qwen ASR streamFrom method is not implemented yet');
    return;
  }
}

registerASRProvider('qwen', QwenASR);
