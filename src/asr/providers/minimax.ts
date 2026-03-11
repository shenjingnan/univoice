import { BaseASR } from '@/asr/base';
import { registerASRProvider } from '@/asr/factory';
import type { ASROptions, ASRStreamChunk, AudioStream } from '@/types/asr';

export class MinimaxASR extends BaseASR {
  name = 'minimax';

  constructor(options: ASROptions) {
    super(options);
    this.baseUrl = options.baseUrl || 'https://api.minimax.chat/v1';
    this.model = options.model || 'speech-01';
  }

  // biome-ignore lint/correctness/useYield: TODO 待实现
  async *listen(_audio: AudioStream): AsyncIterable<ASRStreamChunk> {
    throw new Error('Minimax ASR listen method is not implemented yet');
  }
}

registerASRProvider('minimax', MinimaxASR);
