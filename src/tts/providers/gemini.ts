import type { TTSOptions, TTSRequest, TTSResponse } from '../../../types/tts.js';
import { BaseTTS } from '../base.js';
import { registerTTSProvider } from '../factory.js';

export class GeminiTTS extends BaseTTS {
  name = 'gemini';

  constructor(options: TTSOptions) {
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

registerTTSProvider('gemini', GeminiTTS);
