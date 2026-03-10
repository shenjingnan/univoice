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
  /** 流式输入识别方法（可选） - 接收音频流进行识别 */
  streamFrom?(audio: AudioStream): AsyncIterable<ASRStreamChunk>;
}

export type ASRProviderType = 'doubao' | 'minimax' | 'qwen' | 'openai' | 'gemini' | string;

/** 音频流类型（异步迭代器） */
export type AudioStream = AsyncIterable<Buffer | Uint8Array>;

/** 音频流输入类型：支持音频流或音频文件路径 */
export type AudioStreamInput = AudioStream | string;
