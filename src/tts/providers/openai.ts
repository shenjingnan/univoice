import { BaseTTS } from '@/tts/base';
import type { BaseTTSOptions, TTSRequest, TTSResponse } from '@/types/tts';

export class TTS1 extends BaseTTS {
  name = 'openai';

  constructor(options: BaseTTSOptions) {
    super(options);
    this.baseUrl = options.baseUrl || 'https://api.openai.com/v1';
    this.model = options.model || 'tts-1';
  }

  async synthesize(request: TTSRequest): Promise<TTSResponse> {
    const opts = this.buildRequestOptions(request);
    // TODO: Implement OpenAI TTS API call
    return {
      audio: new Uint8Array(0),
      format: opts.format || 'mp3',
      duration: 0,
    };
  }
}
