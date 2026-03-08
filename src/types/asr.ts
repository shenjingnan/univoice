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
}

export type ASRProviderType = 'doubao' | 'minimax' | 'qwen' | 'openai' | 'gemini' | string;
