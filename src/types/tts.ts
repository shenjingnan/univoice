import type { OpenAIStream } from './llm-stream';
import type { CosyVoiceVoice, GlmVoice, QwenRealtimeVoice } from './voices/index.js';
import type { MinimaxVoice } from './voices/minimax.js';

/**
 * 同时接受预定义字面量和任意字符串的类型工具。
 * 使用 `string & {}` 防止 TypeScript 将字面量联合类型简化为 string，
 * 从而在 IDE 中保留字面量值的自动补全提示。
 */
type AcceptAnyString<T extends string> = T | (string & {});

/**
 * Qwen Realtime TTS 专用选项
 */
export interface QwenRealtimeOptions {
  /** 交互模式: server_commit (服务端自动判断，推荐) | commit (客户端手动触发) */
  mode?: 'server_commit' | 'commit';
  /** 语言类型 */
  languageType?: 'Auto' | 'Chinese' | 'English' | 'Japanese' | 'Korean';
  /** 指令文本（用于情感控制，仅 qwen3-tts-instruct-flash-realtime 支持） */
  instructions?: string;
  /** 是否启用指令优化 */
  optimizeInstructions?: boolean;
  /** 语速倍率 (0.5~2.0) */
  speechRate?: number;
  /** 音调倍率 (0.5~2.0) */
  pitchRate?: number;
  /** 比特率 */
  bitrate?: number;
}

/**
 * TTS 通用配置（不含 provider，用于直接实例化）
 */
export interface BaseTTSOptions {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  voice?: string;
  speed?: number;
  volume?: number;
  pitch?: number;
  format?: 'mp3' | 'wav' | 'ogg' | 'flac' | 'pcm' | 'opus' | 'ogg_opus';
  language?: string;
}

/**
 * 豆包 TTS 专属配置
 */
export interface DoubaoTTSOptions extends BaseTTSOptions {
  /** 火山引擎 App ID */
  appId?: string;
  /** 火山引擎 Access Token */
  accessToken?: string;
  /** 火山引擎 Resource ID */
  resourceId?: string;
  /** 采样率 (默认 24000) */
  sampleRate?: number;
  /** 是否启用时间戳 */
  enableTimestamp?: boolean;
}

/**
 * Minimax TTS 专属配置
 */
export interface MinimaxTTSOptions extends BaseTTSOptions {
  /** 音色（支持 Minimax 内置音色或自定义字符串） */
  voice?: AcceptAnyString<MinimaxVoice>;
  /** 采样率 */
  sampleRate?: number;
  /** 比特率 */
  bitrate?: number;
}

/**
 * 通义千问 TTS 专属配置
 */
export interface QwenTTSOptions extends BaseTTSOptions {
  /** 音色（支持 CosyVoice 内置音色或自定义字符串） */
  voice?: AcceptAnyString<CosyVoiceVoice>;
  /** 采样率 */
  sampleRate?: number;
  /** 指令文本（用于情感控制，如"请用温柔的语调朗读"） */
  instruction?: string;
}

/**
 * 通义千问 Realtime TTS 专属配置
 */
export interface QwenRealtimeTTSOptions extends BaseTTSOptions {
  /** 音色（支持 Qwen Realtime 内置音色或自定义字符串） */
  voice?: AcceptAnyString<QwenRealtimeVoice>;
  /** 采样率 */
  sampleRate?: number;
  /** Qwen Realtime 专用选项 */
  realtime?: QwenRealtimeOptions;
}

/**
 * TTS 工厂函数选项（判别联合类型）
 * 根据 provider 字段路由到对应 provider 的专属配置
 */
/**
 * GLM TTS 专属配置
 */
export interface GlmTTSOptions extends BaseTTSOptions {
  /** 音色（支持 GLM 内置音色或自定义字符串） */
  voice?: AcceptAnyString<GlmVoice>;
}

/**
 * TTS 工厂函数选项（判别联合类型）
 * 根据 provider 字段路由到对应 provider 的专属配置
 */
export type TTSOptions =
  | ({ provider: 'doubao' } & DoubaoTTSOptions)
  | ({ provider: 'minimax' } & MinimaxTTSOptions)
  | ({ provider: 'qwen' } & QwenTTSOptions)
  | ({ provider: 'qwen-realtime' } & QwenRealtimeTTSOptions)
  | ({ provider: 'openai' } & BaseTTSOptions)
  | ({ provider: 'gemini' } & BaseTTSOptions)
  | ({ provider: 'glm' } & GlmTTSOptions)
  | ({ provider: string } & BaseTTSOptions);

export interface TTSRequest {
  text: string;
  options?: Partial<BaseTTSOptions>;
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
