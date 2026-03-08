export interface ASROptions {
  provider: string;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  language?: string;
  prompt?: string;
  responseFormat?: 'json' | 'text' | 'srt' | 'vtt' | 'verbose_json';

  // 豆包专用参数
  appKey?: string;
  accessKey?: string;
  resourceId?: string;
  mode?: 'streaming' | 'nostream' | 'async';

  // 音频配置
  sampleRate?: number;
  bits?: number;
  channel?: number;
  segmentDuration?: number;

  // 识别配置
  enableItn?: boolean;
  enablePunc?: boolean;
  enableDdc?: boolean;
  showUtterances?: boolean;
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
  listen(request: ASRRequest): Promise<ASRResponse>;
}

export type ASRProviderType = 'doubao' | 'minimax' | 'qwen' | 'openai' | 'gemini' | string;
