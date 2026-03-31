import { BaseTTS } from '@/tts/base';
import type { BaseTTSOptions, TTSRequest, TTSResponse } from '@/types/tts';

export class GeminiTTS extends BaseTTS {
  name = 'gemini';

  constructor(options: BaseTTSOptions) {
    super(options);
    this.baseUrl = options.baseUrl || 'https://generativelanguage.googleapis.com/v1beta';
    this.model = options.model || 'gemini-tts';
  }

  async synthesize(request: TTSRequest): Promise<TTSResponse> {
    const opts = this.buildRequestOptions(request);
    // TODO: Implement Gemini TTS API call
    return {
      audio: new Uint8Array(0),
      format: opts.format || 'mp3',
      duration: 0,
    };
  }
}
