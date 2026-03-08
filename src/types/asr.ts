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

/** 音频流类型 */
export type AudioStream = AsyncIterable<Uint8Array> | AsyncGenerator<Uint8Array>;

/** 流式音频输入选项（PCM 格式需要指定） */
export interface AudioStreamOptions {
  /** 音频格式，默认 'pcm' */
  format?: 'pcm' | 'wav';
  /** 采样率，默认 16000 */
  sampleRate?: number;
  /** 位深度，默认 16 */
  bits?: number;
  /** 声道数，默认 1 */
  channel?: number;
}

export interface ASRRequest {
  audio: Buffer | Uint8Array | string | AudioStream;
  /** 流式音频输入时需要指定格式参数 */
  streamOptions?: AudioStreamOptions;
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
  listen(request: ASRRequest): Promise<ASRResponse>;
  /** 流式识别方法（可选） - 实时返回识别结果 */
  stream?(request: ASRRequest): AsyncIterable<ASRStreamChunk>;
  /** 流式音频输入识别方法（可选） - 接收流式音频输入并实时返回识别结果 */
  listenStream?(
    audioStream: AudioStream,
    streamOptions?: AudioStreamOptions
  ): AsyncIterable<ASRStreamChunk>;
}

export type ASRProviderType = 'doubao' | 'minimax' | 'qwen' | 'openai' | 'gemini' | string;
