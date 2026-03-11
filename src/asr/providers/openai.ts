import { BaseASR } from '@/asr/base';
import { registerASRProvider } from '@/asr/factory';
import type { ASROptions, ASRStreamChunk, AudioStream } from '@/types/asr';

export class WhisperASR extends BaseASR {
  name = 'openai';

  constructor(options: ASROptions) {
    super(options);
    this.baseUrl = options.baseUrl || 'https://api.openai.com/v1';
    this.model = options.model || 'whisper-1';
  }

  // biome-ignore lint/correctness/useYield: TODO 待实现
  async *listenStream(_audio: AudioStream): AsyncIterable<ASRStreamChunk> {
    throw new Error('OpenAI ASR listenStream method is not implemented yet');
  }
}

registerASRProvider('openai', WhisperASR);
