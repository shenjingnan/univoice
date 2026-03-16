import type { OpenAIStream } from './llm-stream';

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
  /** Qwen 专用：指令文本（用于情感控制，如"请用温柔的语调朗读"） */
  instruction?: string;
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

/**
 * speak 方法的选项
 */
export interface SpeakInstanceOptions {
  /** 是否启用流式模式，默认 false */
  stream?: boolean;
}

export interface TTSProvider {
  name: string;
  synthesize(request: TTSRequest): Promise<TTSResponse>;
  /** 边发边收模式 - 流式文本输入（可选） */
  speak?(
    input: string | TextStream,
    options?: SpeakInstanceOptions
  ): AsyncIterable<TTSStreamChunk> | Promise<TTSResponse>;
  listVoices?(): Promise<TTSVoice[]>;
}

/**
 * TTS 流式音频块
 * 用于 speak 方法的返回值，便于后续扩展更多字段
 */
export interface TTSStreamChunk {
  /** 音频数据块 */
  audioChunk: Uint8Array;
}

/**
 * 流式文本输入接口
 * 支持 AsyncIterable<string> 或 AsyncGenerator<string>
 * 也支持 OpenAI SDK 的流式输出（Stream<ChatCompletionChunk>）
 * 适用于 LLM 流式输出转语音等场景
 */
export type TextStream = AsyncIterable<string> | AsyncGenerator<string> | OpenAIStream;

export interface TTSVoice {
  id: string;
  name: string;
  language: string;
  gender?: 'male' | 'female' | 'neutral';
}

export type TTSProviderType = 'doubao' | 'minimax' | 'qwen' | 'openai' | 'gemini' | string;
