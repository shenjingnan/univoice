export interface ASROptions {
  provider: string;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  language?: string;
  prompt?: string;
  responseFormat?: 'json' | 'text' | 'srt' | 'vtt' | 'verbose_json';
}

export interface ASRRequest {
  audio: Buffer | Uint8Array | string;
  options?: Partial<ASROptions>;
}

export interface ASRResponse {
  text: string;
  language?: string;
  duration?: number;
  segments?: ASRSegment[];
}

export interface ASRSegment {
  id: number;
  start: number;
  end: number;
  text: string;
  speaker?: string;
  confidence?: number;
}

export interface ASRProvider {
  name: string;
  recognize(request: ASRRequest): Promise<ASRResponse>;
}

export type ASRProviderType = 'doubao' | 'minimax' | 'qwen' | 'openai' | 'gemini' | string;
