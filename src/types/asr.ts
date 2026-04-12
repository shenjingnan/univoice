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

/**
 * ASR 通用配置（不含 provider，用于直接实例化）
 */
export interface BaseASROptions {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  language?: string;
  prompt?: string;
  responseFormat?: 'json' | 'text' | 'srt' | 'vtt' | 'verbose_json';
  /** 音频容器格式 (pcm, wav, ogg, mp3) */
  format?: AudioContainerFormat;
  /** 音频编码格式 (raw, opus) */
  codec?: AudioCodecFormat;
}

/**
 * 豆包 ASR 专属配置
 */
export interface DoubaoASROptions extends BaseASROptions {
  /** 火山引擎 App Key */
  appKey?: string;
  /** 火山引擎 Access Key */
  accessKey?: string;
  /** 火山引擎 Resource ID */
  resourceId?: string;
  /** 识别模式 */
  mode?: 'streaming' | 'nostream' | 'async';
  /** 音频格式配置 */
  audioFormat?: AudioFormat;
  /** 分段时长 (ms) */
  segmentDuration?: number;
  /** 是否启用逆文本标准化 */
  enableItn?: boolean;
  /** 是否启用标点预测 */
  enablePunc?: boolean;
  /** 是否启用 DDC */
  enableDdc?: boolean;
  /** 是否显示话语级结果 */
  showUtterances?: boolean;
  // ===== VAD 端点检测相关 =====
  /** 强制判停时间（ms），静音超过此时长直接判停输出 definite。默认不传（服务端默认800）。最小200 */
  endWindowSize?: number;
  /** 开启二遍识别模式，开启后自动启用 VAD 分句（默认800ms判停） */
  enableNonstream?: boolean;
  /** 语义切分最大静音阈值（ms），默认3000。配合 endWindowSize 使用时失效 */
  vadSegmentDuration?: number;
  /** 强制语音时间（ms），音频超过此时长后才尝试判停。需配合 endWindowSize 使用 */
  forceToSpeechTime?: number;
}

/**
 * 通义千问 ASR 专属配置
 */
export interface QwenASROptions extends BaseASROptions {
  /** 音频采样率 */
  audioFormat?: { sampleRate?: number };
  /** 是否启用逆文本标准化 */
  enableItn?: boolean;
  /** 是否启用标点预测 */
  enablePunc?: boolean;
  /** 是否启用词级时间戳 */
  enableWords?: boolean;
}

/**
 * GLM ASR 专属配置
 */
export interface GlmASROptions extends BaseASROptions {
  /** 热词列表，提高特定词汇识别准确率 */
  hotwords?: string[];
  /** 上下文文本，用于长文本场景优化 */
  context?: string;
}

/**
 * 科大讯飞 ASR 专属配置
 */
export interface XfyunASROptions extends BaseASROptions {
  /** 讯飞开放平台 AppID */
  appId?: string;
  /** 讯飞开放平台 APISecret（用于 HMAC-SHA256 签名鉴权） */
  apiSecret?: string;
  /** 音频采样率，默认 16000 */
  sampleRate?: number;
  /** 识别领域，默认 'iat' */
  domain?: string;
  /** 口音，默认 'mandarin' */
  accent?: string;
  /** 静音超时时间（毫秒），默认 2000 */
  eos?: number;
  /** 动态修正控制，如 'wpgs' */
  dwa?: string;
  /** 中英文筛选：1-不筛选 2-只出中文 3-只出英文 */
  ltc?: number;
  /** 会话热词 */
  dhw?: string;
  /** 标点符号控制：0-不返回标点 1-返回中文标点 2-返回英文标点 */
  ptt?: number;
  /** 语言区域，如 'zh-cn' */
  rlang?: string;
  /** 返回结果中是否包含词级时间戳 */
  vinfo?: number;
  /** 返回数值的阿拉伯数字格式 */
  nunum?: number;
  /** 返回候选句子数量 */
  nbest?: number;
  /** 自定义热词的权重信息 */
  wbest?: number;
  /** 音频发送间隔（毫秒），默认 0（无间隔） */
  sendInterval?: number;
}

/**
 * ASR 工厂函数选项（判别联合类型）
 * 根据 provider 字段路由到对应 provider 的专属配置
 */
export type ASROptions =
  | ({ provider: 'doubao' } & DoubaoASROptions)
  | ({ provider: 'qwen' } & QwenASROptions)
  | ({ provider: 'glm' } & GlmASROptions)
  | ({ provider: 'minimax' } & BaseASROptions)
  | ({ provider: 'openai' } & BaseASROptions)
  | ({ provider: 'gemini' } & BaseASROptions)
  | ({ provider: 'xfyun' } & XfyunASROptions)
  | ({ provider: string } & BaseASROptions);

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
  options?: Partial<BaseASROptions>;
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

export type ASRProviderType =
  | 'doubao'
  | 'minimax'
  | 'qwen'
  | 'openai'
  | 'gemini'
  | 'xfyun'
  | string;

/** 音频流类型（异步迭代器） */
export type AudioStream = AsyncIterable<Buffer | Uint8Array>;

/** 音频流输入类型：支持音频流、Buffer、Uint8Array 或音频文件路径 */
export type AudioStreamInput = AudioStream | Buffer | Uint8Array | string;

/**
 * ASR 连接状态
 */
export type ASRConnectionState = 'connected' | 'closed' | 'error';

/**
 * ASR 连接预建立选项
 */
export interface ASRConnectOptions {
  /** 连接超时时间（毫秒），默认 10000ms */
  timeout?: number;
}

/**
 * ASR 连接实例
 * 通过 ASR 提供商的 connect() 方法获取，支持在已建立的连接上进行多次识别
 */
export interface ASRConnection {
  /** 当前连接状态 */
  readonly state: ASRConnectionState;

  /** 流式识别 */
  listen(
    audio: AudioStreamInput,
    options: ListenInstanceOptions & { stream: true }
  ): AsyncIterable<ASRStreamChunk>;

  /** 非流式识别 */
  listen(
    audio: AudioStreamInput,
    options?: ListenInstanceOptions & { stream?: false }
  ): Promise<ASRResponse>;

  /** 识别方法重载 */
  listen(
    audio: AudioStreamInput,
    options?: ListenInstanceOptions
  ): Promise<ASRResponse> | AsyncIterable<ASRStreamChunk>;

  /** 关闭连接（幂等） */
  close(): void;
}
