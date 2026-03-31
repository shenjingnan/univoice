import { BaseASR } from '@/asr/base';
import type { ASRStreamChunk, AudioStream, BaseASROptions } from '@/types/asr';

export class MinimaxASR extends BaseASR {
  name = 'minimax';

  constructor(options: BaseASROptions) {
    super(options);
    this.baseUrl = options.baseUrl || 'https://api.minimax.chat/v1';
    this.model = options.model || 'speech-01';
  }

  // biome-ignore lint/correctness/useYield: TODO 待实现
  async *listenStream(_audio: AudioStream): AsyncIterable<ASRStreamChunk> {
    throw new Error('Minimax ASR listenStream method is not implemented yet');
  }
}
