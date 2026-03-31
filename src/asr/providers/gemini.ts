import { BaseASR } from '@/asr/base';
import type { ASRStreamChunk, AudioStream, BaseASROptions } from '@/types/asr';

export class GeminiASR extends BaseASR {
  name = 'gemini';

  constructor(options: BaseASROptions) {
    super(options);
    this.baseUrl = options.baseUrl || 'https://generativelanguage.googleapis.com/v1beta';
    this.model = options.model || 'gemini-asr';
  }

  // biome-ignore lint/correctness/useYield: TODO 待实现
  async *listenStream(_audio: AudioStream): AsyncIterable<ASRStreamChunk> {
    throw new Error('Gemini ASR listenStream method is not implemented yet');
  }
}
