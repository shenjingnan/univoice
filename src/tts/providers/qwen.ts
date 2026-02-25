import type { TTSOptions, TTSRequest, TTSResponse } from '../../../types/tts.js';
import { BaseTTS } from '../base.js';
import { registerTTSProvider } from '../factory.js';

export class QwenTTS extends BaseTTS {
  name = 'qwen';

  constructor(options: TTSOptions) {
    super(options);
    this.baseUrl = options.baseUrl || 'https://dashscope.aliyuncs.com/api/v1';
    this.model = options.model || 'paraformer-realtime-v2';
  }

  async synthesize(request: TTSRequest): Promise<TTSResponse> {
    const opts = this.buildRequestOptions(request);
    // TODO: Implement Qwen TTS API call
    return {
      audio: new Uint8Array(0),
      format: opts.format || 'mp3',
      duration: 0,
    };
  }
}

registerTTSProvider('qwen', QwenTTS);
