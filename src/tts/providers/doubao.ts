import type { TTSOptions, TTSRequest, TTSResponse } from '../../../types/tts.js';
import { BaseTTS } from '../base.js';
import { registerTTSProvider } from '../factory.js';

export class DoubaoTTS extends BaseTTS {
  name = 'doubao';

  constructor(options: TTSOptions) {
    super(options);
    this.baseUrl = options.baseUrl || 'https://ark.cn-beijing.volces.com/api/v3';
    this.model = options.model || 'doubao-tts';
  }

  async synthesize(request: TTSRequest): Promise<TTSResponse> {
    const opts = this.buildRequestOptions(request);
    // TODO: Implement Doubao TTS API call
    return {
      audio: new Uint8Array(0),
      format: opts.format || 'mp3',
      duration: 0,
    };
  }
}

registerTTSProvider('doubao', DoubaoTTS);
