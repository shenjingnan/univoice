import { BaseASR } from '@/asr/base';
import type { ASROptions, ASRStreamChunk, AudioStream } from '@/types/asr';

export class QwenASR extends BaseASR {
  name = 'qwen';

  constructor(options: ASROptions) {
    super(options);
    this.baseUrl = options.baseUrl || 'https://dashscope.aliyuncs.com/api/v1';
    this.model = options.model || 'paraformer-v2';
  }

  // biome-ignore lint/correctness/useYield: TODO 待实现
  async *listenStream(_audio: AudioStream): AsyncIterable<ASRStreamChunk> {
    throw new Error('Qwen ASR listenStream method is not implemented yet');
  }
}
