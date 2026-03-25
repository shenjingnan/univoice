/**
 * Mock 数据生成器
 * 用于生成模拟的 Benchmark 测试结果，预览报告格式
 */
import type {
  AccuracyMetrics,
  BenchmarkConfig,
  BenchmarkReport,
  BenchmarkResult,
  ProviderCapabilities,
} from '../metrics/types';

/**
 * Mock 生成器选项
 */
export interface MockGeneratorOptions {
  /** 要模拟的提供商列表 */
  providers?: string[];
  /** 测试类型 */
  type: 'tts' | 'asr' | 'all';
  /** 每个场景的迭代次数 */
  iterations: number;
}

/**
 * 提供商配置
 */
interface ProviderConfig {
  name: string;
  displayName: string;
  streamInput: boolean;
  streamOutput: boolean;
  protocol: 'websocket' | 'http';
}

/**
 * TTS 提供商配置
 */
const TTS_PROVIDERS: ProviderConfig[] = [
  {
    name: 'qwen',
    displayName: '通义千问',
    streamInput: true,
    streamOutput: true,
    protocol: 'websocket',
  },
  {
    name: 'doubao',
    displayName: '豆包',
    streamInput: true,
    streamOutput: true,
    protocol: 'websocket',
  },
  {
    name: 'minimax',
    displayName: 'MiniMax',
    streamInput: true,
    streamOutput: true,
    protocol: 'websocket',
  },
  {
    name: 'glm',
    displayName: '智谱 GLM',
    streamInput: false,
    streamOutput: true,
    protocol: 'http',
  },
];

/**
 * ASR 提供商配置
 */
const ASR_PROVIDERS: ProviderConfig[] = [
  {
    name: 'qwen',
    displayName: '通义千问',
    streamInput: true,
    streamOutput: true,
    protocol: 'websocket',
  },
  {
    name: 'doubao',
    displayName: '豆包',
    streamInput: true,
    streamOutput: true,
    protocol: 'websocket',
  },
  {
    name: 'glm',
    displayName: '智谱 GLM',
    streamInput: false,
    streamOutput: true,
    protocol: 'http',
  },
];

/**
 * TTS 提供商性能特征
 */
const TTS_PERFORMANCE: Record<
  string,
  { firstChunkRange: [number, number]; totalMultiplier: [number, number] }
> = {
  qwen: { firstChunkRange: [800, 1500], totalMultiplier: [5, 10] },
  doubao: { firstChunkRange: [600, 1200], totalMultiplier: [4, 8] },
  minimax: { firstChunkRange: [900, 1800], totalMultiplier: [6, 12] },
  glm: { firstChunkRange: [1000, 2000], totalMultiplier: [8, 15] },
};

/**
 * ASR 提供商性能特征
 */
const ASR_PERFORMANCE: Record<
  string,
  { firstChunkRange: [number, number]; rtfRange: [number, number]; accuracyRange: [number, number] }
> = {
  qwen: { firstChunkRange: [500, 1200], rtfRange: [0.3, 0.6], accuracyRange: [0.95, 0.99] },
  doubao: { firstChunkRange: [600, 1400], rtfRange: [0.4, 0.7], accuracyRange: [0.94, 0.98] },
  glm: { firstChunkRange: [800, 1600], rtfRange: [0.5, 0.8], accuracyRange: [0.92, 0.96] },
};

/**
 * 文本测试场景
 */
const TEXT_SCENARIOS = [
  { name: 'short', text: '你好世界', length: 4 },
  { name: 'medium', text: '这是一个中等长度的测试文本，用于测试 TTS 性能表现。', length: 25 },
  {
    name: 'long',
    text: '这是一段较长的测试文本，用于评估 TTS 系统在处理长文本时的性能表现。通过这段文本的测试，我们可以了解系统的首包延迟、总延迟以及流式输出的稳定性。',
    length: 68,
  },
];

/**
 * 音频测试场景
 */
const AUDIO_SCENARIOS = [
  { name: 'short', duration: 3 },
  { name: 'medium', duration: 10 },
  { name: 'long', duration: 30 },
];

/**
 * 生成指定范围内的随机数
 */
function randomInRange(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * 生成指定范围内的随机浮点数
 */
function randomFloatInRange(min: number, max: number, decimals = 2): number {
  const value = Math.random() * (max - min) + min;
  return Math.round(value * 10 ** decimals) / 10 ** decimals;
}

/**
 * 随机决定是否成功（约 90% 成功率）
 */
function randomSuccess(): boolean {
  return Math.random() > 0.1;
}

/**
 * 生成唯一 ID
 */
function generateId(): string {
  return `mock-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * 获取提供商能力信息
 */
function getCapabilities(provider: ProviderConfig): ProviderCapabilities {
  return {
    provider: provider.name,
    displayName: provider.displayName,
    streamInput: provider.streamInput,
    streamOutput: provider.streamOutput,
    protocol: provider.protocol,
  };
}

/**
 * 生成模拟的 TTS 测试结果
 */
function generateMockTTSResults(
  providers: ProviderConfig[],
  iterations: number
): BenchmarkResult[] {
  const results: BenchmarkResult[] = [];
  const filteredProviders = providers.filter((p) => TTS_PERFORMANCE[p.name]);

  for (const provider of filteredProviders) {
    const perf = TTS_PERFORMANCE[provider.name];
    if (!perf) continue;

    for (const scenario of TEXT_SCENARIOS) {
      // 非流式入/非流式出
      for (let i = 0; i < iterations; i++) {
        const success = randomSuccess();
        const firstChunk = randomInRange(perf.firstChunkRange[0], perf.firstChunkRange[1]);
        const total = firstChunk * randomInRange(perf.totalMultiplier[0], perf.totalMultiplier[1]);

        results.push(
          createTTSResult(provider, scenario, 'non-stream-in-non-stream-out', success, total)
        );
      }

      // 非流式入/流式出
      if (provider.streamOutput) {
        for (let i = 0; i < iterations; i++) {
          const success = randomSuccess();
          const firstChunk = randomInRange(perf.firstChunkRange[0], perf.firstChunkRange[1]);
          const total =
            firstChunk * randomInRange(perf.totalMultiplier[0], perf.totalMultiplier[1]);

          results.push(
            createTTSResult(provider, scenario, 'non-stream-in-stream-out', success, total)
          );
        }
      }

      // 流式入/流式出
      if (provider.streamInput && provider.streamOutput) {
        for (let i = 0; i < iterations; i++) {
          const success = randomSuccess();
          const firstChunk = randomInRange(perf.firstChunkRange[0], perf.firstChunkRange[1]);
          const total =
            firstChunk * randomInRange(perf.totalMultiplier[0], perf.totalMultiplier[1]);

          results.push(
            createTTSResult(provider, scenario, 'stream-in-stream-out-normal', success, total)
          );
        }
      }
    }
  }

  return results;
}

/**
 * 创建单个 TTS 测试结果
 */
function createTTSResult(
  provider: ProviderConfig,
  scenario: { name: string; text: string; length: number },
  scenarioName: string,
  success: boolean,
  total: number
): BenchmarkResult {
  const config: BenchmarkConfig = {
    inputMode: scenarioName.includes('stream-in') ? 'stream' : 'non-stream',
    outputMode: scenarioName.includes('stream-out') ? 'stream' : 'non-stream',
    format: 'mp3',
    textLength: scenario.length,
  };

  const audioSize = randomInRange(10000, 50000);
  const audioDuration = randomFloatInRange(1, 5, 1);
  const bitrate = randomInRange(64, 192);

  const result: BenchmarkResult = {
    id: generateId(),
    timestamp: new Date().toISOString(),
    provider: provider.name,
    model: 'mock-model',
    testType: 'tts',
    scenario: scenarioName,
    config,
    startTime: Date.now() - (success ? total : 0),
    throughput: {
      dataRate: success ? Math.round(audioSize / total) : 0,
      chunkCount: success ? randomInRange(5, 20) : 0,
      avgChunkSize: success ? Math.round(audioSize / randomInRange(5, 20)) : 0,
      chunks: success
        ? Array.from({ length: randomInRange(5, 20) }, (_, i) => ({
            timestamp: Date.now() - total + Math.round((total / randomInRange(5, 20)) * i),
            relativeTime: Math.round((total / randomInRange(5, 20)) * i),
            size: Math.round(audioSize / randomInRange(5, 20)),
          }))
        : [],
    },
    quality: {
      dataSize: success ? audioSize : 0,
      audioDuration: success ? audioDuration : undefined,
      bitrate: success ? bitrate : undefined,
      textLength: scenario.length,
    },
    status: success ? 'success' : 'error',
    error: success ? undefined : 'Mock error: connection timeout',
  };

  return result;
}

/**
 * 生成模拟的 ASR 测试结果
 */
function generateMockASRResults(
  providers: ProviderConfig[],
  iterations: number
): BenchmarkResult[] {
  const results: BenchmarkResult[] = [];
  const filteredProviders = providers.filter((p) => ASR_PERFORMANCE[p.name]);

  for (const provider of filteredProviders) {
    const perf = ASR_PERFORMANCE[provider.name];
    if (!perf) continue;

    for (const scenario of AUDIO_SCENARIOS) {
      // 流式入/流式出
      if (provider.streamInput) {
        for (let i = 0; i < iterations; i++) {
          const success = randomSuccess();
          const rtf = randomFloatInRange(perf.rtfRange[0], perf.rtfRange[1]);
          const total = Math.round(scenario.duration * rtf * 1000);

          results.push(
            createASRResult(
              provider,
              scenario,
              'stream-input-stream-output',
              success,
              total,
              perf.accuracyRange
            )
          );
        }
      }

      // 非流式入/流式出
      for (let i = 0; i < iterations; i++) {
        const success = randomSuccess();
        const rtf = randomFloatInRange(perf.rtfRange[0], perf.rtfRange[1]);
        const total = Math.round(scenario.duration * rtf * 1000);

        results.push(
          createASRResult(
            provider,
            scenario,
            'non-stream-input-non-stream-output',
            success,
            total,
            perf.accuracyRange
          )
        );
      }
    }
  }

  return results;
}

/**
 * 创建单个 ASR 测试结果
 */
function createASRResult(
  provider: ProviderConfig,
  scenario: { name: string; duration: number },
  scenarioName: string,
  success: boolean,
  total: number,
  accuracyRange: [number, number]
): BenchmarkResult {
  const config: BenchmarkConfig = {
    inputMode: scenarioName.includes('stream-input') ? 'stream' : 'non-stream',
    outputMode: 'stream',
    format: 'mp3',
    audioDuration: scenario.duration,
  };

  const textSize = randomInRange(50, 200);
  const accuracy = randomFloatInRange(accuracyRange[0], accuracyRange[1], 3);
  const cer = 1 - accuracy;

  const accuracyMetrics: AccuracyMetrics | undefined = success
    ? {
        accuracy,
        cer,
        expectedText: '这是一段测试文本',
        actualText: '这是一段测试文本',
      }
    : undefined;

  const result: BenchmarkResult = {
    id: generateId(),
    timestamp: new Date().toISOString(),
    provider: provider.name,
    model: 'mock-model',
    testType: 'asr',
    scenario: scenarioName,
    config,
    startTime: Date.now() - (success ? total : 0),
    throughput: {
      dataRate: success ? randomInRange(10, 50) : 0,
      chunkCount: success ? randomInRange(3, 10) : 0,
      avgChunkSize: success ? randomInRange(100, 500) : 0,
      chunks: success
        ? Array.from({ length: randomInRange(3, 10) }, (_, i) => ({
            timestamp: Date.now() - total + Math.round((total / randomInRange(3, 10)) * i),
            relativeTime: Math.round((total / randomInRange(3, 10)) * i),
            size: randomInRange(100, 500),
          }))
        : [],
    },
    quality: {
      dataSize: randomInRange(5000, 20000),
      textLength: success ? textSize : undefined,
    },
    accuracy: accuracyMetrics,
    status: success ? 'success' : 'error',
    error: success ? undefined : 'Mock error: recognition failed',
  };

  return result;
}

/**
 * 计算提供商汇总
 */
function summarizeProvider(provider: ProviderConfig, results: BenchmarkResult[]) {
  const providerResults = results.filter((r) => r.provider === provider.name);
  const successResults = providerResults.filter((r) => r.status === 'success');
  const firstChunkLatencies = successResults.map((r) => {
    const chunks = r.throughput.chunks;
    return chunks && chunks.length > 0 ? chunks[0].relativeTime : 0;
  });

  const avgFirstChunk =
    firstChunkLatencies.length > 0
      ? Math.round(firstChunkLatencies.reduce((a, b) => a + b, 0) / firstChunkLatencies.length)
      : 0;

  return {
    provider: provider.name,
    capabilities: getCapabilities(provider),
    performance: {
      avgFirstChunkLatency: avgFirstChunk,
      successRate:
        providerResults.length > 0
          ? Math.round((successResults.length / providerResults.length) * 100) / 100
          : 0,
      sampleCount: providerResults.length,
    },
  };
}

/**
 * 生成模拟的 BenchmarkReport
 */
export function generateMockReport(options: MockGeneratorOptions): BenchmarkReport {
  const { providers, type, iterations } = options;

  // 过滤提供商
  const ttsProviders = providers
    ? TTS_PROVIDERS.filter((p) => providers.includes(p.name))
    : TTS_PROVIDERS;
  const asrProviders = providers
    ? ASR_PROVIDERS.filter((p) => providers.includes(p.name))
    : ASR_PROVIDERS;

  // 生成测试结果
  const results: BenchmarkResult[] = [];

  if (type === 'tts' || type === 'all') {
    results.push(...generateMockTTSResults(ttsProviders, iterations));
  }

  if (type === 'asr' || type === 'all') {
    results.push(...generateMockASRResults(asrProviders, iterations));
  }

  // 生成报告
  const report: BenchmarkReport = {
    generatedAt: new Date().toISOString(),
    environment: {
      node: process.version,
      platform: process.platform,
      arch: process.arch,
    },
    ttsProviders:
      type === 'tts' || type === 'all'
        ? ttsProviders.map((p) => summarizeProvider(p, results))
        : [],
    asrProviders:
      type === 'asr' || type === 'all'
        ? asrProviders.map((p) => summarizeProvider(p, results))
        : [],
    results,
  };

  return report;
}
