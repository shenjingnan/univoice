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
  listVoices?(): Promise<TTSVoice[]>;
}

export interface TTSVoice {
  id: string;
  name: string;
  language: string;
  gender?: 'male' | 'female' | 'neutral';
}

export type TTSProviderType = 'doubao' | 'minimax' | 'qwen' | 'openai' | 'gemini' | string;
