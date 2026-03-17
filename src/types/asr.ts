/**
 * 音频格式配置
 */
export interface AudioFormat {
  /** 采样率，默认 16000 */
  sampleRate?: number;
  /** 位深度，默认 16 */
  bits?: number;
  /** 声道数，默认 1 */
  channel?: number;
}

/**
 * 音频容器格式
 */
export type AudioContainerFormat = 'pcm' | 'wav' | 'ogg' | 'mp3';

/**
 * 音频编码格式
 */
export type AudioCodecFormat = 'raw' | 'opus';

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

  // 音频格式配置
  audioFormat?: AudioFormat;
  /** 音频容器格式 (pcm, wav, ogg, mp3) */
  format?: AudioContainerFormat;
  /** 音频编码格式 (raw, opus) */
  codec?: AudioCodecFormat;
  segmentDuration?: number;

  // 识别配置
  enableItn?: boolean;
  enablePunc?: boolean;
  enableDdc?: boolean;
  showUtterances?: boolean;
  /** 是否启用词级时间戳（Qwen ASR 专用） */
  enableWords?: boolean;
}

/**
 * ASR 实例方法 listen() 的选项
 */
export interface ListenInstanceOptions {
  /**
   * 是否启用流式模式
   * - true: 流式返回 AsyncIterable<ASRStreamChunk>
   * - false 或不传: 一次性返回 Promise<ASRResponse>
   * @default false
   */
  stream?: boolean;
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

/**
 * ASR 流式响应块
 * 用于 stream 方法的返回值，便于后续扩展更多字段
 */
export interface ASRStreamChunk {
  /** 本次识别的文本片段 */
  text: string;
  /** 是否为最终结果 */
  isFinal: boolean;
  /** 置信度（可选） */
  confidence?: number;
  /** 分段信息（可选） */
  segment?: ASRSegment;
}

export interface ASRProvider {
  name: string;
  /** 流式输入识别方法 - 接收音频流进行识别 */
  listenStream(audio: AudioStream): AsyncIterable<ASRStreamChunk>;
}

export type ASRProviderType = 'doubao' | 'minimax' | 'qwen' | 'openai' | 'gemini' | string;

/** 音频流类型（异步迭代器） */
export type AudioStream = AsyncIterable<Buffer | Uint8Array>;

/** 音频流输入类型：支持音频流、Buffer、Uint8Array 或音频文件路径 */
export type AudioStreamInput = AudioStream | Buffer | Uint8Array | string;
