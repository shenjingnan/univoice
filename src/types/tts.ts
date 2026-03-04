export interface TTSOptions {
  provider: string;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  voice?: string;
  speed?: number;
  volume?: number;
  pitch?: number;
  format?: 'mp3' | 'wav' | 'ogg' | 'flac';
  language?: string;

  /** 火山引擎 App ID (doubao 专用) */
  appId?: string;
  /** 火山引擎 Access Token (doubao 专用) */
  accessToken?: string;
  /** 火山引擎 Resource ID (doubao 专用) */
  resourceId?: string;
  /** 采样率 (默认 24000) */
  sampleRate?: number;
  /** 是否启用时间戳 */
  enableTimestamp?: boolean;
}

export interface TTSRequest {
  text: string;
  options?: Partial<TTSOptions>;
}

export interface TTSResponse {
  audio: Buffer | Uint8Array;
  format: string;
  duration?: number;
}

export interface TTSProvider {
  name: string;
  synthesize(request: TTSRequest): Promise<TTSResponse>;
  /** 流式输出音频数据（可选） */
  speak?(request: TTSRequest): AsyncIterable<Uint8Array>;
  listVoices?(): Promise<TTSVoice[]>;
}

export interface TTSVoice {
  id: string;
  name: string;
  language: string;
  gender?: 'male' | 'female' | 'neutral';
}

export type TTSProviderType = 'doubao' | 'minimax' | 'qwen' | 'openai' | 'gemini' | string;
