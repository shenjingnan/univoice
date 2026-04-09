/**
 * 聚合分析工具
 * 用于对原子化存储的测试结果进行聚合分析
 */
import { calculateNormalizedAccuracy } from '../metrics/accuracy';
import type {
  LatencyMetrics,
  ProviderCapabilities,
  ProviderSummary,
  ScenarioSummary,
  SingleTestResult,
} from '../metrics/types';

/**
 * 从原始时间戳数据计算延迟指标
 * 支持新旧两种格式：
 * - 新格式：使用 startTime 和 chunks[].timestamp/relativeTime
 * - 旧格式：直接使用 latency 字段（向后兼容）
 */
export function calculateLatency(result: SingleTestResult): LatencyMetrics {
  // 旧格式兼容：如果存在 latency 字段，直接返回
  const legacyResult = result as unknown as {
    latency?: LatencyMetrics;
  };
  if (legacyResult.latency) {
    return legacyResult.latency;
  }

  // 新格式：从 chunks 和 startTime 计算
  const chunks = result.throughput.chunks;
  const startTime = result.startTime;

  if (!chunks || chunks.length === 0 || !startTime) {
    return {
      firstChunk: 0,
      total: 0,
    };
  }

  // 首包延迟：第一个 chunk 的相对时间
  const firstChunk = chunks[0].relativeTime;

  // 总延迟：最后一个 chunk 的相对时间
  const total = chunks[chunks.length - 1].relativeTime;

  const metrics: LatencyMetrics = {
    firstChunk,
    total,
  };

  // TTS：计算每字符延迟
  if (result.quality.textLength && result.quality.textLength > 0) {
    metrics.perChar = total / result.quality.textLength;
  }

  // ASR：计算 RTF（实时率）
  if (result.config.audioDuration && result.config.audioDuration > 0) {
    // RTF = 处理时间 / 音频时长，音频时长单位是秒，total 是毫秒
    metrics.rtf = total / (result.config.audioDuration * 1000);
  }

  return metrics;
}

/**
 * 计算数组的统计指标
 */
function calculateStats(values: number[]): {
  avg: number;
  p50: number;
  p95: number;
  min: number;
  max: number;
  stdDev: number;
} {
  if (values.length === 0) {
    return { avg: 0, p50: 0, p95: 0, min: 0, max: 0, stdDev: 0 };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  const avg = sum / sorted.length;

  // P50 (中位数)
  const mid = Math.floor(sorted.length / 2);
  const p50 = sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;

  // P95
  const p95Index = Math.ceil(sorted.length * 0.95) - 1;
  const p95 = sorted[Math.max(0, Math.min(p95Index, sorted.length - 1))];

  // 标准差
  const stdDev = Math.sqrt(sorted.reduce((sum, v) => sum + (v - avg) ** 2, 0) / sorted.length);

  return {
    avg,
    p50,
    p95,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    stdDev,
  };
}

/**
 * 计算成功率
 */
function calculateSuccessRate(results: SingleTestResult[]): number {
  if (results.length === 0) return 0;
  const successCount = results.filter((r) => r.status === 'success').length;
  return successCount / results.length;
}

/**
 * 从 SingleTestResult 计算准确率
 * 支持新旧两种格式：
 * - 新格式：只有 expectedText 和 actualText，需要计算
 * - 旧格式：已有 accuracy 和 cer 字段
 */
function calculateAccuracyFromResult(result: SingleTestResult): {
  accuracy: number;
  cer: number;
} | null {
  if (!result.accuracy) return null;

  // 新格式：只有原始文本，需要计算
  if (result.accuracy.expectedText !== undefined && result.accuracy.actualText !== undefined) {
    const accuracyResult = calculateNormalizedAccuracy(
      result.accuracy.expectedText,
      result.accuracy.actualText
    );
    return {
      accuracy: accuracyResult.accuracy,
      cer: accuracyResult.cer,
    };
  }

  // 旧格式：已有计算值（向后兼容）
  // 使用类型断言处理旧格式
  const legacyAccuracy = result.accuracy as unknown as {
    accuracy?: number;
    cer?: number;
  };
  if (legacyAccuracy.accuracy !== undefined && legacyAccuracy.cer !== undefined) {
    return {
      accuracy: legacyAccuracy.accuracy,
      cer: legacyAccuracy.cer,
    };
  }

  return null;
}

/**
 * 按场景分组聚合结果
 */
export function aggregateByScenario(results: SingleTestResult[]): Map<string, ScenarioSummary> {
  const groups = new Map<string, SingleTestResult[]>();

  // 按 provider + scenario 分组
  for (const result of results) {
    const key = `${result.testType}/${result.provider}/${result.scenario}`;
    const group = groups.get(key) || [];
    group.push(result);
    groups.set(key, group);
  }

  // 计算每个场景的统计
  const summaries = new Map<string, ScenarioSummary>();

  for (const [key, group] of groups) {
    const successResults = group.filter((r) => r.status === 'success');

    // 计算每个结果的延迟指标
    const latencies = successResults.map((r) => calculateLatency(r));

    // 延迟统计
    const firstChunkLatencies = latencies.map((l) => l.firstChunk);
    const totalLatencies = latencies.map((l) => l.total);

    const firstChunkStats = calculateStats(firstChunkLatencies);
    const totalStats = calculateStats(totalLatencies);

    // ASR 特有指标
    const rtfs = latencies.map((l) => l.rtf).filter((v): v is number => v !== undefined);

    // 从结果计算准确率（支持新旧格式）
    const accuracyResults = successResults
      .map((r) => calculateAccuracyFromResult(r))
      .filter((v): v is { accuracy: number; cer: number } => v !== null);

    const accuracies = accuracyResults.map((r) => r?.accuracy);
    const cers = accuracyResults.map((r) => r?.cer);

    // TTS 特有指标
    const perCharLatencies = latencies
      .map((l) => l.perChar)
      .filter((v): v is number => v !== undefined);

    const summary: ScenarioSummary = {
      provider: group[0].provider,
      scenario: group[0].scenario,
      testType: group[0].testType,
      sampleCount: group.length,
      successCount: successResults.length,
      successRate: calculateSuccessRate(group),
      avgFirstChunkLatency: firstChunkStats.avg,
      medianFirstChunkLatency: firstChunkStats.p50,
      p95FirstChunkLatency: firstChunkStats.p95,
      avgTotalLatency: totalStats.avg,
      medianTotalLatency: totalStats.p50,
      p50TotalLatency: totalStats.p50,
      p95TotalLatency: totalStats.p95,
      stdDevTotalLatency: totalStats.stdDev,
      minTotalLatency: totalStats.min,
      maxTotalLatency: totalStats.max,
    };

    // ASR 特有
    if (rtfs.length > 0) {
      summary.avgRTF = calculateStats(rtfs).avg;
    }
    if (accuracies.length > 0) {
      summary.avgAccuracy = calculateStats(accuracies).avg;
    }
    if (cers.length > 0) {
      summary.avgCER = calculateStats(cers).avg;
    }

    // TTS 特有
    if (perCharLatencies.length > 0) {
      summary.avgPerCharLatency = calculateStats(perCharLatencies).avg;
    }

    summaries.set(key, summary);
  }

  return summaries;
}

/**
 * 按提供商聚合结果
 */
export function aggregateByProvider(
  results: SingleTestResult[],
  getCapabilities: (provider: string, testType: 'tts' | 'asr') => ProviderCapabilities
): Map<string, ProviderSummary[]> {
  const ttsGroups = new Map<string, SingleTestResult[]>();
  const asrGroups = new Map<string, SingleTestResult[]>();

  // 分别按 TTS 和 ASR 分组
  for (const result of results) {
    if (result.testType === 'tts') {
      const group = ttsGroups.get(result.provider) || [];
      group.push(result);
      ttsGroups.set(result.provider, group);
    } else {
      const group = asrGroups.get(result.provider) || [];
      group.push(result);
      asrGroups.set(result.provider, group);
    }
  }

  // 计算提供商统计
  const result = new Map<string, ProviderSummary[]>();

  for (const [provider, group] of ttsGroups) {
    const successResults = group.filter((r) => r.status === 'success');
    const latencies = successResults.map((r) => calculateLatency(r));
    const firstChunkLatencies = latencies.map((l) => l.firstChunk);

    const summary: ProviderSummary = {
      provider,
      capabilities: getCapabilities(provider, 'tts'),
      performance: {
        avgFirstChunkLatency:
          firstChunkLatencies.length > 0
            ? firstChunkLatencies.reduce((a, b) => a + b, 0) / firstChunkLatencies.length
            : 0,
        successRate: calculateSuccessRate(group),
        sampleCount: group.length,
      },
    };

    result.set(provider, [...(result.get(provider) || []), summary]);
  }

  for (const [provider, group] of asrGroups) {
    const successResults = group.filter((r) => r.status === 'success');
    const latencies = successResults.map((r) => calculateLatency(r));
    const firstChunkLatencies = latencies.map((l) => l.firstChunk);

    const summary: ProviderSummary = {
      provider,
      capabilities: getCapabilities(provider, 'asr'),
      performance: {
        avgFirstChunkLatency:
          firstChunkLatencies.length > 0
            ? firstChunkLatencies.reduce((a, b) => a + b, 0) / firstChunkLatencies.length
            : 0,
        successRate: calculateSuccessRate(group),
        sampleCount: group.length,
      },
    };

    result.set(provider, [...(result.get(provider) || []), summary]);
  }

  return result;
}

/**
 * 获取提供商能力信息（从结果推断）
 */
export function inferCapabilities(
  provider: string,
  results: SingleTestResult[]
): ProviderCapabilities {
  const hasStreamIn = results.some(
    (r) => r.scenario.includes('stream-in') || r.scenario.includes('stream-input')
  );
  const hasStreamOut = results.some(
    (r) => r.scenario.includes('stream-out') || r.scenario.includes('stream-output')
  );

  // 显示名称映射
  const displayNames: Record<string, string> = {
    qwen: '通义千问',
    doubao: '豆包',
    minimax: 'MiniMax',
    glm: '智谱 GLM',
    openai: 'OpenAI',
    gemini: 'Gemini',
    xfyun: '科大讯飞',
    mimo: '小米 Mimo',
  };

  return {
    provider,
    displayName: displayNames[provider] || provider,
    streamInput: hasStreamIn,
    streamOutput: hasStreamOut,
    protocol: provider === 'glm' ? 'http' : 'websocket',
  };
}

/**
 * 完整的聚合分析
 */
export function analyzeResults(results: SingleTestResult[]): {
  scenarioSummaries: Map<string, ScenarioSummary>;
  ttsProviders: ProviderSummary[];
  asrProviders: ProviderSummary[];
} {
  // 按场景聚合
  const scenarioSummaries = aggregateByScenario(results);

  // 分别处理 TTS 和 ASR
  const ttsResults = results.filter((r) => r.testType === 'tts');
  const asrResults = results.filter((r) => r.testType === 'asr');

  // 按提供商聚合 TTS
  const ttsProviders: ProviderSummary[] = [];
  const ttsByProvider = new Map<string, SingleTestResult[]>();
  for (const r of ttsResults) {
    const group = ttsByProvider.get(r.provider) || [];
    group.push(r);
    ttsByProvider.set(r.provider, group);
  }

  for (const [provider, group] of ttsByProvider) {
    const successResults = group.filter((r) => r.status === 'success');
    const latencies = successResults.map((r) => calculateLatency(r));
    const firstChunkLatencies = latencies.map((l) => l.firstChunk);

    ttsProviders.push({
      provider,
      capabilities: inferCapabilities(provider, group),
      performance: {
        avgFirstChunkLatency:
          firstChunkLatencies.length > 0
            ? firstChunkLatencies.reduce((a, b) => a + b, 0) / firstChunkLatencies.length
            : 0,
        successRate: calculateSuccessRate(group),
        sampleCount: group.length,
      },
    });
  }

  // 按提供商聚合 ASR
  const asrProviders: ProviderSummary[] = [];
  const asrByProvider = new Map<string, SingleTestResult[]>();
  for (const r of asrResults) {
    const group = asrByProvider.get(r.provider) || [];
    group.push(r);
    asrByProvider.set(r.provider, group);
  }

  for (const [provider, group] of asrByProvider) {
    const successResults = group.filter((r) => r.status === 'success');
    const latencies = successResults.map((r) => calculateLatency(r));
    const firstChunkLatencies = latencies.map((l) => l.firstChunk);

    asrProviders.push({
      provider,
      capabilities: inferCapabilities(provider, group),
      performance: {
        avgFirstChunkLatency:
          firstChunkLatencies.length > 0
            ? firstChunkLatencies.reduce((a, b) => a + b, 0) / firstChunkLatencies.length
            : 0,
        successRate: calculateSuccessRate(group),
        sampleCount: group.length,
      },
    });
  }

  return {
    scenarioSummaries,
    ttsProviders,
    asrProviders,
  };
}
