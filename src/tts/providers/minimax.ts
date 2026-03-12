import { BaseTTS } from '@/tts/base';
import type { TTSOptions, TTSRequest, TTSResponse } from '@/types/tts';

export class MinimaxTTS extends BaseTTS {
  name = 'minimax';

  constructor(options: TTSOptions) {
    super(options);
    this.baseUrl = options.baseUrl || 'https://api.minimax.chat/v1';
    this.model = options.model || 'speech-01-turbo';
  }

  async synthesize(request: TTSRequest): Promise<TTSResponse> {
    const opts = this.buildRequestOptions(request);
    // TODO: Implement Minimax TTS API call
    return {
      audio: new Uint8Array(0),
      format: opts.format || 'mp3',
      duration: 0,
    };
  }
}
