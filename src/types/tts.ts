export interface TTSOptions {
  provider: string;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  voice?: string;
  speed?: number;
  volume?: number;
  pitch?: number;
  format?: 'mp3' | 'wav' | 'ogg' | 'flac' | 'pcm';
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
  /** 边发边收模式 - 完整文本（可选） */
  stream?(text: string, callbacks: StreamingCallbacks): Promise<void>;
  /** 边发边收模式 - 流式文本输入（可选） */
  streamFrom?(input: string | TextStream, callbacks: StreamingCallbacks): Promise<void>;
  listVoices?(): Promise<TTSVoice[]>;
}

/**
 * 边发边收回调接口
 */
export interface StreamingCallbacks {
  /** 收到音频块时调用 */
  onAudioChunk: (chunk: Uint8Array) => void;
  /** 收到事件时调用（可选） */
  onEvent?: (event: string) => void;
  /** 发生错误时调用（可选） */
  onError?: (error: Error) => void;
}

/**
 * 流式文本输入接口
 * 支持 AsyncIterable<string> 或 AsyncGenerator<string>
 * 适用于 LLM 流式输出转语音等场景
 */
export type TextStream = AsyncIterable<string> | AsyncGenerator<string>;

export interface TTSVoice {
  id: string;
  name: string;
  language: string;
  gender?: 'male' | 'female' | 'neutral';
}

export type TTSProviderType = 'doubao' | 'minimax' | 'qwen' | 'openai' | 'gemini' | string;
