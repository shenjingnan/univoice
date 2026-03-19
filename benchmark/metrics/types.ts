/**
 * Benchmark 性能测试类型定义
 */

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

  /** 延迟指标 */
  latency: LatencyMetrics;

  /** 吞吐量指标 */
  throughput: ThroughputMetrics;

  /** 质量指标 */
  quality: QualityMetrics;

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
}

/**
 * 质量指标
 */
export interface QualityMetrics {
  /** 数据大小（bytes） */
  dataSize: number;
  /** 文本长度（ASR 专用） */
  textLength?: number;
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
    /** P50 首包延迟 */
    p50FirstChunkLatency: number;
    /** P95 首包延迟 */
    p95FirstChunkLatency: number;
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
