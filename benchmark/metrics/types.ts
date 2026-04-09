/**
 * Benchmark 性能测试类型定义
 */

/**
 * 单个数据块的详细信息
 * 用于分析流式输出的实时性能
 */
export interface ChunkDetail {
  /** 接收时间戳（绝对时间，毫秒） */
  timestamp: number;
  /** 相对时间（相对于测试开始，毫秒） */
  relativeTime: number;
  /** 块大小（字节） */
  size: number;
}

/**
 * 准确性指标（ASR 专用）
 * 用于最终报告展示
 */
export interface AccuracyMetrics {
  /** 准确率 (0-1) */
  accuracy: number;
  /** 字符错误率 (0-1+) */
  cer: number;
  /** 原始文本 */
  expectedText?: string;
  /** 识别结果 */
  actualText?: string;
}

/**
 * 原始准确率数据（执行阶段存储）
 * 只包含原始文本，不包含计算后的指标
 */
export interface RawAccuracyData {
  /** 预期文本 */
  expectedText?: string;
  /** 实际识别结果 */
  actualText?: string;
}

/**
 * 单次测试结果
 */
export interface BenchmarkResult {
  /** 唯一标识符 */
  id: string;
  /** 时间戳 ISO 8601 格式 */
  timestamp: string;
  /** 提供商标识 */
  provider: string;
  /** 模型名称 */
  model: string;
  /** 测试类型 */
  testType: 'tts' | 'asr';
  /** 测试场景 */
  scenario: string;

  /** 测试配置 */
  config: BenchmarkConfig;

  /** 测试开始时间戳（毫秒） */
  startTime: number;

  /** 吞吐量指标 */
  throughput: ThroughputMetrics;

  /** 质量指标 */
  quality: QualityMetrics;

  /** 准确性指标（ASR 专用，支持原始数据和计算后的指标） */
  accuracy?: AccuracyMetrics | RawAccuracyData;

  /** 测试状态 */
  status: 'success' | 'error' | 'timeout';

  /** 错误信息（如果失败） */
  error?: string;
}

/**
 * 测试配置
 */
export interface BenchmarkConfig {
  /** 输入模式 */
  inputMode: 'stream' | 'non-stream';
  /** 输出模式 */
  outputMode: 'stream' | 'non-stream';
  /** 音频格式 */
  format: string;
  /** 文本长度（TTS 专用） */
  textLength?: number;
  /** 音频时长（ASR 专用，秒） */
  audioDuration?: number;
  /** 音色 */
  voice?: string;
  /** 采样率 (Hz) */
  sampleRate?: number;
}

/**
 * 延迟指标
 */
export interface LatencyMetrics {
  /** 首包延迟（ms） */
  firstChunk: number;
  /** 总延迟（ms） */
  total: number;
  /** 平均每字符延迟（ms，TTS 专用） */
  perChar?: number;
  /** 实时率 RTF（ASR 专用，< 1 表示快于实时） */
  rtf?: number;
}

/**
 * 吞吐量指标
 */
export interface ThroughputMetrics {
  /** 数据速率（bytes/ms） */
  dataRate: number;
  /** 数据块数量 */
  chunkCount: number;
  /** 平均块大小（bytes） */
  avgChunkSize: number;
  /** 每个 chunk 的详细信息 */
  chunks?: ChunkDetail[];
}

/**
 * 质量指标
 */
export interface QualityMetrics {
  /** 数据大小（bytes） */
  dataSize: number;
  /** 文本长度（ASR 专用） */
  textLength?: number;
  /** 音频时长（TTS 专用，秒） */
  audioDuration?: number;
  /** 音频码率（TTS 专用，kbps） */
  bitrate?: number;
}

/**
 * 提供商能力
 */
export interface ProviderCapabilities {
  /** 提供商标识 */
  provider: string;
  /** 显示名称 */
  displayName: string;
  /** 是否支持流式输入 */
  streamInput: boolean;
  /** 是否支持流式输出 */
  streamOutput: boolean;
  /** 协议类型 */
  protocol: 'websocket' | 'http';
}

/**
 * 提供商汇总
 */
export interface ProviderSummary {
  /** 提供商标识 */
  provider: string;
  /** 能力信息 */
  capabilities: ProviderCapabilities;
  /** 性能统计 */
  performance: {
    /** 平均首包延迟 */
    avgFirstChunkLatency: number;
    /** 成功率 */
    successRate: number;
    /** 样本数 */
    sampleCount: number;
  };
}

/**
 * 测试场景配置
 */
export interface ScenarioConfig {
  /** 场景名称 */
  name: string;
  /** 场景描述 */
  description: string;
  /** 测试类型 */
  testType: 'tts' | 'asr';
  /** 输入模式 */
  inputMode: 'stream' | 'non-stream';
  /** 输出模式 */
  outputMode: 'stream' | 'non-stream';
  /** 重复次数 */
  iterations: number;
  /** 超时时间（ms） */
  timeout: number;
}

/**
 * 单次测试结果（用于原子化存储）
 * 每次测试执行生成一个独立的 JSON 文件
 */
export interface SingleTestResult {
  /** 唯一标识符 */
  id: string;
  /** 时间戳 ISO 8601 格式 */
  timestamp: string;
  /** 提供商标识 */
  provider: string;
  /** 模型名称 */
  model: string;
  /** 测试类型 */
  testType: 'tts' | 'asr';
  /** 测试场景 */
  scenario: string;
  /** 迭代序号（同一次批量测试中的序号） */
  iteration: number;
  /** 测试配置 */
  config: BenchmarkConfig;
  /** 测试开始时间戳（毫秒） */
  startTime: number;
  /** 吞吐量指标 */
  throughput: ThroughputMetrics;
  /** 质量指标 */
  quality: QualityMetrics;
  /** 原始准确率数据（ASR 专用，分析阶段计算指标） */
  accuracy?: RawAccuracyData;
  /** 测试状态 */
  status: 'success' | 'error' | 'timeout';
  /** 错误信息（如果失败） */
  error?: string;
}

/**
 * 测试报告
 */
export interface BenchmarkReport {
  /** 报告生成时间 */
  generatedAt: string;
  /** 测试环境信息 */
  environment: {
    node: string;
    platform: string;
    arch: string;
  };
  /** TTS 提供商汇总 */
  ttsProviders: ProviderSummary[];
  /** ASR 提供商汇总 */
  asrProviders: ProviderSummary[];
  /** 原始测试结果 */
  results: BenchmarkResult[];
  /** 矩阵覆盖率 */
  matrixCoverage?: MatrixCoverageSummary;
}

/**
 * 文本测试数据
 */
export interface TextFixture {
  /** 名称 */
  name: string;
  /** 文本内容 */
  text: string;
  /** 分类：short/medium/long */
  category: 'short' | 'medium' | 'long';
}

/**
 * 流式输入配置
 */
export interface StreamInputConfig {
  /** 名称 */
  name: string;
  /** 发送间隔（ms） */
  interval: number;
  /** 描述 */
  description: string;
}

/**
 * 音频格式配置
 */
export interface AudioFormatConfig {
  /** 格式类型 */
  format: 'mp3' | 'wav' | 'pcm' | 'ogg';
  /** 采样率 */
  sampleRate: number;
  /** 声道数 */
  channels: number;
  /** 位深度（可选，WAV/PCM 使用） */
  bitDepth?: number;
}

/**
 * 音频测试数据
 */
export interface AudioFixture {
  /** 名称 */
  name: string;
  /** 文件路径 */
  path: string;
  /** 时长（秒） */
  duration: number;
  /** 格式 */
  format: string;
  /** 对应的文本 fixture 名称 */
  textFixture?: string;
  /** 预期文本（用于准确率计算） */
  expectedText?: string;
  /** 音频格式详情（PCM 格式使用） */
  audioFormat?: {
    sampleRate: number;
    channels: number;
    bitDepth: number;
  };
}

/**
 * 提供商性能汇总（扩展版）
 */
export interface ProviderPerformanceSummary {
  /** 提供商标识 */
  provider: string;
  /** 显示名称 */
  displayName: string;
  /** 平均首包延迟 */
  avgFirstChunkLatency: number;
  /** 平均总延迟 */
  avgTotalLatency: number;
  /** 成功率 */
  successRate: number;
  /** 样本数 */
  sampleCount: number;
  /** 平均准确率（ASR 专用） */
  avgAccuracy?: number;
  /** 平均 CER（ASR 专用） */
  avgCER?: number;
  /** 平均 RTF（ASR 专用） */
  avgRTF?: number;
  /** 平均每字符延迟（TTS 专用） */
  avgPerCharLatency?: number;
}

/**
 * 增量测试结果
 * 用于存储每次测试的历史记录
 */
export interface IncrementalTestResult {
  /** 测试时间戳 */
  timestamp: string;
  /** 测试环境信息 */
  environment: {
    node: string;
    platform: string;
    arch: string;
  };
  /** TTS 提供商信息 */
  ttsProviders: Array<{
    provider: string;
    displayName: string;
    streamInput: boolean;
    streamOutput: boolean;
  }>;
  /** ASR 提供商信息 */
  asrProviders: Array<{
    provider: string;
    displayName: string;
    streamInput: boolean;
    streamOutput: boolean;
  }>;
  /** 测试结果 */
  results: BenchmarkResult[];
}

/**
 * 提供商详细统计（用于新表格格式）
 */
export interface ProviderDetailedStats {
  /** 提供商标识 */
  provider: string;
  /** 显示名称 */
  displayName: string;
  /** 输入音频格式 */
  inputFormat: string;
  /** 首次耗时（ms） */
  firstLatency: number;
  /** 平均耗时（ms，排除首次） */
  avgLatency: number;
  /** 总耗时（ms，所有测试平均值） */
  totalLatency: number;
  /** 识别准确率 */
  accuracy?: number;
  /** 实时率 RTF */
  rtf?: number;
  /** 字符错误率 CER */
  cer?: number;
  /** 样本数 */
  sampleCount: number;
}

/**
 * 结果筛选条件
 */
export interface ResultFilter {
  /** 提供商列表 */
  providers?: string[];
  /** 测试类型 */
  testType?: 'tts' | 'asr';
  /** 场景名称 */
  scenario?: string;
  /** 开始日期（包含） */
  fromDate?: string;
  /** 结束日期（包含） */
  toDate?: string;
}

/**
 * 场景统计汇总
 */
export interface ScenarioSummary {
  /** 提供商 */
  provider: string;
  /** 场景名称 */
  scenario: string;
  /** 测试类型 */
  testType: 'tts' | 'asr';
  /** 样本数 */
  sampleCount: number;
  /** 成功样本数 */
  successCount: number;
  /** 成功率 */
  successRate: number;
  /** 平均首包延迟（ms） */
  avgFirstChunkLatency: number;
  /** 中位数首包延迟（ms） */
  medianFirstChunkLatency: number;
  /** P95 首包延迟（ms） */
  p95FirstChunkLatency: number;
  /** 平均总延迟（ms） */
  avgTotalLatency: number;
  /** 中位数总延迟（ms） */
  medianTotalLatency: number;
  /** P50 总延迟（ms） */
  p50TotalLatency: number;
  /** P95 总延迟（ms） */
  p95TotalLatency: number;
  /** 总延迟标准差（ms） */
  stdDevTotalLatency: number;
  /** 最小总延迟（ms） */
  minTotalLatency: number;
  /** 最大总延迟（ms） */
  maxTotalLatency: number;
  /** 吞吐量（TTS: chars/s） */
  throughput?: number;
  /** 平均准确率（ASR） */
  avgAccuracy?: number;
  /** 平均 RTF（ASR） */
  avgRTF?: number;
  /** 平均 CER（ASR） */
  avgCER?: number;
  /** 平均每字符延迟（TTS） */
  avgPerCharLatency?: number;
}

/**
 * TTS 矩阵测试项
 * 每个项代表一个完整的测试场景配置
 */
export interface MatrixItem {
  /** 提供商标识 */
  provider: 'qwen' | 'qwen-realtime' | 'doubao' | 'glm' | 'minimax' | 'xfyun' | 'mimo';
  /** 模型名称 */
  model: string;
  /** 音色名称 */
  voice: string;
  /** 音频编码格式 */
  format: 'pcm' | 'opus' | 'ogg_opus';
  /** 采样率 (Hz) */
  sampleRate: 8000 | 16000 | 22050 | 24000 | 32000 | 44100 | 48000;
}

/**
 * ASR 矩阵测试项
 * 使用 language 替代 TTS 的 voice 作为矩阵维度
 */
export interface ASRMatrixItem {
  /** 提供商标识 */
  provider: 'qwen' | 'doubao' | 'glm' | 'minimax' | 'xfyun';
  /** 模型名称 */
  model: string;
  /** 语言 */
  language: string;
  /** 音频格式 */
  format: 'pcm' | 'wav' | 'mp3';
  /** 采样率 (Hz，可选) */
  sampleRate?: number;
}

/**
 * TTS 矩阵测试过滤器
 * 用于筛选特定的矩阵测试项
 */
export interface MatrixFilter {
  /** 模型名称过滤（支持逗号分隔多个） */
  model?: string[];
  /** 音色名称过滤（支持逗号分隔多个） */
  voice?: string[];
  /** 音频编码格式过滤（支持逗号分隔多个） */
  format?: string[];
  /** 采样率过滤（支持逗号分隔多个） */
  sampleRate?: number[];
}

/**
 * ASR 矩阵测试过滤器
 * 用于筛选特定的 ASR 矩阵测试项
 */
export interface ASRMatrixFilter {
  /** 模型名称过滤 */
  model?: string[];
  /** 语言过滤 */
  language?: string[];
  /** 音频格式过滤 */
  format?: string[];
  /** 采样率过滤 */
  sampleRate?: number[];
}

/**
 * Qwen TTS 矩阵测试配置
 * 用于测试不同模型、音色、编码、采样率的组合
 */
export type QwenMatrixConfig = MatrixItem;

/**
 * Doubao TTS 矩阵测试配置
 * 用于测试不同模型、音色、编码、采样率的组合
 */
export type DoubaoMatrixConfig = MatrixItem;

/**
 * GLM TTS 矩阵测试配置
 * 用于测试不同模型、音色、编码、采样率的组合
 */
export type GlmMatrixConfig = MatrixItem;

/**
 * Minimax TTS 矩阵测试配置
 * 用于测试不同模型、音色、编码、采样率的组合
 */
export type MinimaxMatrixConfig = MatrixItem;

/**
 * Xfyun TTS 矩阵测试配置
 * 用于测试不同模型、音色、编码、采样率的组合
 */
export type XfyunMatrixConfig = MatrixItem;

/**
 * 小米 Mimo TTS 矩阵测试配置
 * 用于测试不同模型、音色、编码、采样率的组合
 */
export type MimoMatrixConfig = MatrixItem;

/**
 * 矩阵测试场景配置
 */
export interface MatrixScenarioConfig {
  /** 场景名称 */
  name: string;
  /** 场景描述 */
  description: string;
  /** 测试类型 */
  testType: 'tts';
  /** 每个组合的迭代次数 */
  iterations: number;
  /** 超时时间（ms） */
  timeout: number;
}

/**
 * ASR 矩阵测试场景配置
 */
export interface ASRMatrixScenarioConfig {
  /** 场景名称 */
  name: string;
  /** 场景描述 */
  description: string;
  /** 测试类型 */
  testType: 'asr';
  /** 输入模式（ASR 矩阵仅支持非流式入） */
  inputMode: 'non-stream';
  /** 输出模式（ASR 矩阵仅支持流式出） */
  outputMode: 'stream';
  /** 每个组合的迭代次数 */
  iterations: number;
  /** 超时时间（ms） */
  timeout: number;
}

/**
 * 矩阵测试状态
 */
export type MatrixTestStatus = 'tested' | 'pending';

/**
 * 单个矩阵场景覆盖信息
 */
export interface MatrixCoverageItem {
  /** 提供商标识 */
  provider: string;
  /** 模型名称 */
  model: string;
  /** 音色名称 */
  voice: string;
  /** 音频编码格式 */
  format: string;
  /** 采样率 (Hz) */
  sampleRate: number;
  /** 测试状态 */
  status: MatrixTestStatus;
  /** 场景名称（用于匹配） */
  scenario: string;
}

/**
 * 按提供商分组的覆盖率
 */
export interface ProviderMatrixCoverage {
  /** 提供商标识 */
  provider: string;
  /** 提供商显示名称 */
  displayName: string;
  /** 总场景数 */
  totalScenarios: number;
  /** 已测试场景数 */
  testedScenarios: number;
  /** 待测试场景数 */
  pendingScenarios: number;
  /** 覆盖率 (0-1) */
  coverageRate: number;
  /** 待测试场景列表 */
  pendingItems: MatrixCoverageItem[];
}

/**
 * 矩阵覆盖率汇总
 */
export interface MatrixCoverageSummary {
  /** 总场景数 */
  totalScenarios: number;
  /** 已测试场景数 */
  testedScenarios: number;
  /** 待测试场景数 */
  pendingScenarios: number;
  /** 总覆盖率 (0-1) */
  totalCoverageRate: number;
  /** 按提供商统计 */
  byProvider: ProviderMatrixCoverage[];
}

/**
 * ASR 单个矩阵场景覆盖信息
 */
export interface ASRMatrixCoverageItem {
  /** 提供商标识 */
  provider: string;
  /** 模型名称 */
  model: string;
  /** 语言 */
  language: string;
  /** 音频格式 */
  format: string;
  /** 采样率 (Hz) */
  sampleRate: number;
  /** 测试状态 */
  status: MatrixTestStatus;
  /** 场景名称（用于匹配） */
  scenario: string;
}

/**
 * ASR 按提供商分组的覆盖率
 */
export interface ASRProviderMatrixCoverage {
  /** 提供商标识 */
  provider: string;
  /** 提供商显示名称 */
  displayName: string;
  /** 总场景数 */
  totalScenarios: number;
  /** 已测试场景数 */
  testedScenarios: number;
  /** 待测试场景数 */
  pendingScenarios: number;
  /** 覆盖率 (0-1) */
  coverageRate: number;
  /** 待测试场景列表 */
  pendingItems: ASRMatrixCoverageItem[];
}

/**
 * ASR 矩阵覆盖率汇总
 */
export interface ASRMatrixCoverageSummary {
  /** 总场景数 */
  totalScenarios: number;
  /** 已测试场景数 */
  testedScenarios: number;
  /** 待测试场景数 */
  pendingScenarios: number;
  /** 总覆盖率 (0-1) */
  totalCoverageRate: number;
  /** 按提供商统计 */
  byProvider: ASRProviderMatrixCoverage[];
}
