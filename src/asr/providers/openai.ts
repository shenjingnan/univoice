import { BaseASR } from '@/asr/base';
import { registerASRProvider } from '@/asr/factory';
import type { ASROptions, ASRRequest, ASRResponse, ASRStreamChunk, AudioStream } from '@/types/asr';

export class WhisperASR extends BaseASR {
  name = 'openai';

  constructor(options: ASROptions) {
    super(options);
    this.baseUrl = options.baseUrl || 'https://api.openai.com/v1';
    this.model = options.model || 'whisper-1';
  }

  async listen(request: ASRRequest): Promise<ASRResponse> {
    const opts = this.buildRequestOptions(request);
    // TODO: Implement OpenAI Whisper API call
    return {
      text: '',
      language: opts.language,
    };
  }

  // biome-ignore lint/correctness/useYield: 空实现，等待后续完善
  async *streamFrom(_audio: AudioStream): AsyncIterable<ASRStreamChunk> {
    // TODO: 实现 OpenAI ASR 流式识别
    console.warn('OpenAI ASR streamFrom method is not implemented yet');
    return;
  }
}

registerASRProvider('openai', WhisperASR);
