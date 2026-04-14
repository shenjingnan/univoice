/**
 * 报告生成工具
 * 用于从 BenchmarkReport 生成 Markdown 格式的报告
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { calculateNormalizedAccuracy } from '../metrics/accuracy';
import { average, successRate } from '../metrics/collector';
import type { BenchmarkReport, BenchmarkResult, LatencyMetrics } from '../metrics/types';
import { allASRMatrixItems, allMatrixItems, getProviderDisplayName } from './matrix-loader';

const __filename = fileURLToPath(import.meta.url);
const __dirname = join(__filename, '..', '..', '..');

/**
 * 找出数组中的最小值和最大值索引
 */
function findMinMaxIndices(values: number[]): { minIndex: number; maxIndex: number } {
  if (values.length === 0) {
    return { minIndex: -1, maxIndex: -1 };
  }

  let minIndex = 0;
  let maxIndex = 0;

  for (let i = 1; i < values.length; i++) {
    if (values[i] < values[minIndex]) {
      minIndex = i;
    }
    if (values[i] > values[maxIndex]) {
      maxIndex = i;
    }
  }

  return { minIndex, maxIndex };
}

/**
 * 格式化指标值，添加最佳/最差标记
 */
function formatMetricValue(
  value: number,
  index: number,
  minIndex: number,
  maxIndex: number,
  isLowerBetter: boolean,
  suffix: string,
  decimals = 0
): string {
  const formatted = `${value.toFixed(decimals)}${suffix}`;

  if (minIndex === maxIndex) {
    return formatted;
  }

  if (isLowerBetter) {
    if (index === minIndex) {
      return `**${formatted} 🏆**`;
    }
    if (index === maxIndex) {
      return `*${formatted}*`;
    }
  } else {
    if (index === maxIndex) {
      return `**${formatted} 🏆**`;
    }
    if (index === minIndex) {
      return `*${formatted}*`;
    }
  }

  return formatted;
}

/**
 * 计算提供商的扩展性能统计
 */
function calculateExtendedPerformance(results: BenchmarkResult[]) {
  // 过滤成功记录：必须是 success 状态且有实际数据（chunkCount > 0）
  // 过滤有效记录：status 为 success 且有实际数据返回（chunkCount > 0）
  // chunkCount = 0 表示请求正常完成但未收到任何音频/识别数据
  const successResults = results.filter(
    (r) => r.status === 'success' && r.throughput.chunkCount > 0
  );

  // 检查是否全部失败
  if (successResults.length === 0) {
    return {
      avgFirstChunk: undefined,
      avgTotal: undefined,
      successRate: 0,
      sampleCount: results.length,
      hasFailure: true,
      // TTS
      avgPerChar: undefined,
      avgAudioDuration: undefined,
      avgBitrate: undefined,
      // ASR
      avgRTF: undefined,
      avgAccuracy: undefined,
      avgCER: undefined,
      // 新增：首次耗时、平均耗时、输入格式、输入输出模式
      firstLatency: undefined,
      avgLatency: undefined,
      inputFormat: results.length > 0 ? results[0].config.format : 'unknown',
      inputMode: results.length > 0 ? results[0].config.inputMode : 'non-stream',
      outputMode: results.length > 0 ? results[0].config.outputMode : 'non-stream',
      // 新增：P50、P95、标准差、吞吐量
      p50: undefined,
      p95: undefined,
      stdDev: undefined,
      throughput: undefined,
    };
  }

  // 计算每个结果的延迟指标（支持新旧格式）
  const latencies = successResults.map((r) => {
    // 尝试从新格式计算
    const chunks = r.throughput.chunks;
    const startTime = (r as unknown as { startTime?: number }).startTime;

    // 旧格式兼容：如果存在 latency 字段，直接使用
    const legacyResult = r as unknown as { latency?: LatencyMetrics };
    if (legacyResult.latency) {
      return legacyResult.latency;
    }

    // 新格式：从 chunks 和 startTime 计算
    if (!chunks || chunks.length === 0 || !startTime) {
      return { firstChunk: 0, total: 0 };
    }

    return {
      firstChunk: chunks[0].relativeTime,
      total: chunks[chunks.length - 1].relativeTime,
      perChar:
        r.quality.textLength && r.quality.textLength > 0
          ? chunks[chunks.length - 1].relativeTime / r.quality.textLength
          : undefined,
      rtf:
        r.config.audioDuration && r.config.audioDuration > 0
          ? chunks[chunks.length - 1].relativeTime / (r.config.audioDuration * 1000)
          : undefined,
    };
  });

  // 延迟统计
  const firstChunkLatencies = latencies.map((l) => l.firstChunk);
  const totalLatencies = latencies.map((l) => l.total);
  const perCharLatencies = latencies
    .map((l) => l.perChar)
    .filter((v): v is number => v !== undefined);
  const rtfs = latencies.map((l) => l.rtf).filter((v): v is number => v !== undefined);

  // 准确率统计（ASR）- 需要从原始数据计算或直接获取
  const accuracies: number[] = [];
  const cers: number[] = [];

  for (const r of successResults) {
    if (r.accuracy) {
      // 如果已有计算后的值，直接使用
      if ('accuracy' in r.accuracy && typeof r.accuracy.accuracy === 'number') {
        accuracies.push(r.accuracy.accuracy);
        cers.push(r.accuracy.cer ?? 0);
      }
      // 如果有原始数据，需要计算
      else if (
        'expectedText' in r.accuracy &&
        'actualText' in r.accuracy &&
        r.accuracy.expectedText !== undefined &&
        r.accuracy.actualText !== undefined
      ) {
        const result = calculateNormalizedAccuracy(r.accuracy.expectedText, r.accuracy.actualText);
        accuracies.push(result.accuracy);
        cers.push(result.cer);
      }
    }
  }

  // 质量统计（TTS）
  const audioDurations = successResults
    .map((r) => r.quality.audioDuration)
    .filter((v): v is number => v !== undefined);
  const bitrates = successResults
    .map((r) => r.quality.bitrate)
    .filter((v): v is number => v !== undefined);

  // 首次耗时 = 所有测试的 latency.firstChunk 的平均值
  const firstLatency = average(firstChunkLatencies);

  // 平均耗时 = 排除首包后，平均每个 chunk 的间隔时间
  const avgLatencies = successResults
    .map((r, i) => {
      const chunkCount = r.throughput.chunkCount;
      if (chunkCount <= 1) return 0;
      const lat = latencies[i];
      return (lat.total - lat.firstChunk) / (chunkCount - 1);
    })
    .filter((v) => v > 0);
  const avgLatency = avgLatencies.length > 0 ? average(avgLatencies) : undefined;

  // 获取输入格式
  const inputFormat = successResults.length > 0 ? successResults[0].config.format : 'unknown';

  // 获取输入输出模式
  const inputMode = successResults.length > 0 ? successResults[0].config.inputMode : 'non-stream';
  const outputMode = successResults.length > 0 ? successResults[0].config.outputMode : 'non-stream';

  // 计算 P50、P95、标准差
  const sortedLatencies = [...totalLatencies].sort((a, b) => a - b);
  const avgTotal = totalLatencies.length > 0 ? average(totalLatencies) : 0;

  // P50 (中位数) - 空数组时返回 0
  let p50 = 0;
  if (sortedLatencies.length > 0) {
    const mid = Math.floor(sortedLatencies.length / 2);
    p50 =
      sortedLatencies.length % 2 !== 0
        ? sortedLatencies[mid]
        : (sortedLatencies[mid - 1] + sortedLatencies[mid]) / 2;
  }

  // P95 - 空数组时返回 0
  let p95 = 0;
  if (sortedLatencies.length > 0) {
    const p95Index = Math.ceil(sortedLatencies.length * 0.95) - 1;
    p95 = sortedLatencies[Math.max(0, Math.min(p95Index, sortedLatencies.length - 1))];
  }

  // 标准差 - 空数组时返回 0，避免除零
  const stdDev =
    totalLatencies.length > 0
      ? Math.sqrt(
          totalLatencies.reduce((sum, v) => sum + (v - avgTotal) ** 2, 0) / totalLatencies.length
        )
      : 0;

  // 吞吐量（TTS: chars/s）= 文本长度 / 总耗时(秒)
  const textLengths = successResults
    .map((r) => r.config.textLength)
    .filter((v): v is number => v !== undefined);
  const throughput =
    textLengths.length > 0
      ? textLengths.reduce((sum, len) => sum + len, 0) / (avgTotal / 1000)
      : undefined;

  return {
    avgFirstChunk: average(firstChunkLatencies),
    avgTotal,
    successRate: successRate(results),
    sampleCount: results.length,
    hasFailure: false,
    // TTS
    avgPerChar: perCharLatencies.length > 0 ? average(perCharLatencies) : undefined,
    avgAudioDuration: audioDurations.length > 0 ? average(audioDurations) : undefined,
    avgBitrate: bitrates.length > 0 ? average(bitrates) : undefined,
    // ASR
    avgRTF: rtfs.length > 0 ? average(rtfs) : undefined,
    avgAccuracy: accuracies.length > 0 ? average(accuracies) : undefined,
    avgCER: cers.length > 0 ? average(cers) : undefined,
    // 新增：首次耗时、平均耗时、输入格式、输入输出模式
    firstLatency,
    avgLatency,
    inputFormat,
    inputMode,
    outputMode,
    // 新增：P50、P95、标准差、吞吐量
    p50,
    p95,
    stdDev,
    throughput,
  };
}

/**
 * 矩阵场景信息
 */
interface MatrixScenarioInfo {
  model: string;
  voice: string;
  format: string;
  sampleRate: number;
}

/**
 * 解析矩阵场景名称
 * 格式: matrix/<model>/<voice>/<format>-<sampleRate>
 * 示例: matrix/cosyvoice-v3-flash/longanyang/pcm-16000
 */
function parseMatrixScenario(scenario: string): MatrixScenarioInfo | null {
  if (!scenario.startsWith('matrix/')) return null;
  const parts = scenario.split('/');
  if (parts.length !== 4) return null;

  const [_, model, voice, formatSampleRate] = parts;
  const [format, sampleRateStr] = formatSampleRate.split('-');
  const sampleRate = parseInt(sampleRateStr, 10);
  if (Number.isNaN(sampleRate)) return null;

  return { model, voice, format, sampleRate };
}

/**
 * 提取场景详细配置
 * 从 BenchmarkResult 提取模型、音色、格式等信息，优先使用矩阵场景名称解析
 */
function extractScenarioDetail(result: BenchmarkResult): {
  model: string;
  voice: string;
  format: string;
  sampleRate: string;
} {
  // 优先从矩阵场景名称解析
  const matrixInfo = parseMatrixScenario(result.scenario);
  if (matrixInfo) {
    return {
      model: matrixInfo.model,
      voice: matrixInfo.voice,
      format: matrixInfo.format,
      sampleRate: `${matrixInfo.sampleRate}`,
    };
  }

  // 从 result 中获取
  return {
    model: result.model || 'default',
    voice: result.config.voice || 'default',
    format: result.config.format || 'unknown',
    sampleRate: result.config.sampleRate ? `${result.config.sampleRate}` : 'unknown',
  };
}

/**
 * ASR 矩阵场景信息
 */
interface ASRMatrixScenarioInfo {
  model: string;
  language: string;
  format: string;
  sampleRate: number;
}

/**
 * 解析 ASR 矩阵场景名称
 * 格式: asr-matrix/<model>/<language>/<format>-<sampleRate>
 * 示例: asr-matrix/paraformer-realtime-v2/zh-CN/pcm-16000
 */
function parseASRMatrixScenario(scenario: string): ASRMatrixScenarioInfo | null {
  if (!scenario.startsWith('asr-matrix/')) return null;
  const parts = scenario.split('/');
  if (parts.length !== 4) return null;

  const [_, model, language, formatSampleRate] = parts;
  const [format, sampleRateStr] = formatSampleRate.split('-');
  const sampleRate = parseInt(sampleRateStr, 10);
  if (Number.isNaN(sampleRate)) return null;

  return { model, language, format, sampleRate };
}

/**
 * 提取 ASR 场景详细配置
 * 从 BenchmarkResult 提取模型、语言、格式等信息，优先使用矩阵场景名称解析
 */
function extractASRScenarioDetail(result: BenchmarkResult): {
  model: string;
  language: string;
  format: string;
  sampleRate: string;
} {
  // 优先从 ASR 矩阵场景名称解析
  const asrMatrixInfo = parseASRMatrixScenario(result.scenario);
  if (asrMatrixInfo) {
    return {
      model: asrMatrixInfo.model,
      language: asrMatrixInfo.language,
      format: asrMatrixInfo.format,
      sampleRate: `${asrMatrixInfo.sampleRate}`,
    };
  }

  // 从 result 中获取
  return {
    model: result.model || 'default',
    language: 'unknown',
    format: result.config.format || 'unknown',
    sampleRate: result.config.sampleRate ? `${result.config.sampleRate}` : 'unknown',
  };
}

/**
 * ASR 场景说明配置
 */
const ASR_SCENARIO_CONFIG: Record<string, { label: string; description: string; note?: string }> = {
  'stream-input-stream-output': {
    label: '流式入/流式出',
    description: '实时音频流输入，实时识别结果输出',
  },
  'non-stream-input-non-stream-output': {
    label: '非流式入/非流式出',
    description: '完整音频输入，完整结果返回',
  },
  'non-stream-input-stream-output': {
    label: '非流式入/流式出',
    description: '完整音频输入，实时识别结果输出',
  },
};

/**
 * TTS 场景说明配置
 */
const TTS_SCENARIO_CONFIG: Record<string, { label: string; description: string; note?: string }> = {
  'non-stream-in-stream-out': {
    label: '非流式入/流式出',
    description: '完整文本输入，实时音频流输出',
  },
  'non-stream-in-non-stream-out': {
    label: '非流式入/非流式出',
    description: '完整文本输入，完整音频返回',
  },
};

/**
 * 生成 TTS 性能报告
 */
function generateTTSReport(results: BenchmarkResult[], providers: Map<string, string>): string[] {
  const lines: string[] = [];

  const ttsResults = results.filter((r) => r.testType === 'tts');
  if (ttsResults.length === 0) return lines;

  lines.push('## TTS 性能指标');
  lines.push('');

  // 场景说明表
  lines.push('### 场景说明');
  lines.push('');
  lines.push('| 场景 | 说明 |');
  lines.push('|------|------|');
  for (const [, config] of Object.entries(TTS_SCENARIO_CONFIG)) {
    lines.push(`| ${config.label} | ${config.description} |`);
  }
  lines.push('');

  // 指标说明
  lines.push('### 指标说明');
  lines.push('');
  lines.push('| 指标 | 含义 | 计算方法 | 作用 |');
  lines.push('|------|------|----------|------|');
  lines.push(
    '| 首包延迟 | 从发送请求到收到第一个音频块的时间 | 所有测试首包延迟的平均值 | 反映 TTS 服务的响应速度 |'
  );
  lines.push(
    '| 平均间隔 | 稳定状态下平均每个 chunk 的间隔时间 | (总耗时 - 首包延迟) / (chunk数 - 1) 的平均值 | 反映 TTS 服务吐数据块的节奏 |'
  );
  lines.push('| P50 | 中位数，50% 请求低于此值 | 所有耗时排序后取中位数 | 反映典型请求的性能 |');
  lines.push(
    '| P95 | 95% 请求低于此值 | 所有耗时排序后取第95百分位 | 评估尾部延迟，了解最坏情况 |'
  );
  lines.push(
    '| 标准差 | 延迟的离散程度 | 各耗时与平均值差值的平方的均值的平方根 | 值越小性能越稳定 |'
  );
  lines.push('| 吞吐量 | 每秒处理的字符数 | 文本长度 / 平均耗时(秒) | 值越大处理效率越高 |');
  lines.push('');

  // 按 outputMode 分组
  const streamOutResults = ttsResults.filter((r) => r.config.outputMode === 'stream');
  const nonStreamOutResults = ttsResults.filter((r) => r.config.outputMode === 'non-stream');

  // 非流式入/流式出表格
  // 始终显示表格，即使没有测试结果
  lines.push('### 非流式入/流式出');
  lines.push('');
  lines.push(
    '| 服务商 | 模型 | 音色 | 编码格式 | 采样率 (Hz) | 测试次数 | 首包延迟 (ms) | 平均间隔 (ms) | P50 (ms) | P95 (ms) | 标准差 (ms) | 吞吐量 (chars/s) |'
  );
  lines.push(
    '|--------|------|------|----------|-------------|----------|---------------|---------------|----------|----------|-------------|-----------------|'
  );

  // 按配置分组（忽略 textCategory），聚合同一配置的测试记录
  const groups = new Map<string, BenchmarkResult[]>();
  for (const result of streamOutResults) {
    const detail = extractScenarioDetail(result);
    const key = `${result.provider}/${detail.model}/${detail.voice}/${detail.format}/${detail.sampleRate}`;
    const group = groups.get(key) || [];
    group.push(result);
    groups.set(key, group);
  }

  // 遍历所有矩阵定义的场景
  const stats: Array<{
    key: string;
    provider: string;
    model: string;
    voice: string;
    format: string;
    sampleRate: string;
    displayName: string;
    hasFailure: boolean;
    sampleCount: number;
    firstLatency?: number;
    avgLatency?: number;
    p50?: number;
    p95?: number;
    stdDev?: number;
    throughput?: number;
  }> = [];

  for (const item of allMatrixItems) {
    const key = `${item.provider}/${item.model}/${item.voice}/${item.format}/${item.sampleRate}`;
    const testResults = groups.get(key);

    if (testResults && testResults.length > 0) {
      // 有测试结果
      const perf = calculateExtendedPerformance(testResults);
      stats.push({
        key,
        provider: item.provider,
        model: item.model,
        voice: item.voice,
        format: item.format,
        sampleRate: `${item.sampleRate}`,
        displayName: providers.get(item.provider) || getProviderDisplayName(item.provider),
        hasFailure: perf.hasFailure,
        sampleCount: perf.sampleCount,
        firstLatency: perf.firstLatency,
        avgLatency: perf.avgLatency,
        p50: perf.p50,
        p95: perf.p95,
        stdDev: perf.stdDev,
        throughput: perf.throughput,
      });
    } else {
      // 无测试结果
      stats.push({
        key,
        provider: item.provider,
        model: item.model,
        voice: item.voice,
        format: item.format,
        sampleRate: `${item.sampleRate}`,
        displayName: providers.get(item.provider) || getProviderDisplayName(item.provider),
        hasFailure: true,
        sampleCount: 0,
      });
    }
  }

  // 计算各指标的 min/max 索引用于标记最佳值（只计算有成功结果的）
  const successStats = stats.filter((s) => !s.hasFailure);
  const firstLatencyValues = successStats.map((s) => s.firstLatency ?? 0);
  const avgLatencyValues = successStats.map((s) => s.avgLatency ?? 0);
  const p50Values = successStats.map((s) => s.p50 ?? 0);
  const p95Values = successStats.map((s) => s.p95 ?? 0);
  const stdDevValues = successStats.map((s) => s.stdDev ?? 0);
  const throughputValues = successStats
    .filter((s) => s.throughput !== undefined)
    .map((s) => s.throughput as number);

  const firstLatencyMinMax = findMinMaxIndices(firstLatencyValues);
  const avgLatencyMinMax = findMinMaxIndices(avgLatencyValues);
  const p50MinMax = findMinMaxIndices(p50Values);
  const p95MinMax = findMinMaxIndices(p95Values);
  const stdDevMinMax = findMinMaxIndices(stdDevValues);
  const throughputMinMax = findMinMaxIndices(throughputValues);

  let throughputIdx = 0;

  for (let i = 0; i < stats.length; i++) {
    const s = stats[i];

    if (s.hasFailure) {
      if (s.sampleCount === 0) {
        // 未测试
        lines.push(
          `| ${s.displayName} | ${s.model} | ${s.voice} | ${s.format} | ${s.sampleRate} | - | 未测试 | - | - | - | - | - |`
        );
      } else {
        // 测试失败
        lines.push(
          `| ${s.displayName} | ${s.model} | ${s.voice} | ${s.format} | ${s.sampleRate} | ${s.sampleCount} | 测试失败 | - | - | - | - | - |`
        );
      }
      continue;
    }

    const successIndex = successStats.indexOf(s);

    // 首次耗时
    const firstLat = formatMetricValue(
      s.firstLatency ?? 0,
      successIndex,
      firstLatencyMinMax.minIndex,
      firstLatencyMinMax.maxIndex,
      true,
      ''
    );

    // 平均耗时
    const avgLat = formatMetricValue(
      s.avgLatency ?? 0,
      successIndex,
      avgLatencyMinMax.minIndex,
      avgLatencyMinMax.maxIndex,
      true,
      ''
    );

    // P50
    const p50 = formatMetricValue(
      s.p50 ?? 0,
      successIndex,
      p50MinMax.minIndex,
      p50MinMax.maxIndex,
      true,
      ''
    );

    // P95
    const p95 = formatMetricValue(
      s.p95 ?? 0,
      successIndex,
      p95MinMax.minIndex,
      p95MinMax.maxIndex,
      true,
      ''
    );

    // 标准差
    const stdDev = formatMetricValue(
      s.stdDev ?? 0,
      successIndex,
      stdDevMinMax.minIndex,
      stdDevMinMax.maxIndex,
      true,
      ''
    );

    // 吞吐量
    const throughput = s.throughput
      ? formatMetricValue(
          s.throughput,
          throughputIdx++,
          throughputMinMax.minIndex,
          throughputMinMax.maxIndex,
          false, // 越大越好
          '',
          1
        )
      : 'N/A';

    lines.push(
      `| ${s.displayName} | ${s.model} | ${s.voice} | ${s.format} | ${s.sampleRate} | ${s.sampleCount} | ${firstLat} | ${avgLat} | ${p50} | ${p95} | ${stdDev} | ${throughput} |`
    );
  }

  lines.push('');

  // 非流式入/非流式出表格
  if (nonStreamOutResults.length > 0) {
    lines.push('### 非流式入/非流式出');
    lines.push('');
    lines.push('| 服务商 | 模型 | 音色 | 编码格式 | 采样率 (Hz) | 测试次数 | 总耗时 (ms) |');
    lines.push('|--------|------|------|----------|-------------|----------|------------|');

    // 按配置分组（忽略 textCategory），聚合同一配置的测试记录
    const groups = new Map<string, BenchmarkResult[]>();
    for (const result of nonStreamOutResults) {
      const detail = extractScenarioDetail(result);
      const key = `${result.provider}/${detail.model}/${detail.voice}/${detail.format}/${detail.sampleRate}`;
      const group = groups.get(key) || [];
      group.push(result);
      groups.set(key, group);
    }

    const stats = Array.from(groups.entries()).map(([key, res]) => {
      const [provider, model, voice, format, sampleRate] = key.split('/');
      return {
        key,
        provider,
        model,
        voice,
        format,
        sampleRate,
        displayName: providers.get(provider) || provider,
        ...calculateExtendedPerformance(res),
      };
    });

    // 计算总耗时的 min/max 索引
    const successStats = stats.filter((s) => !s.hasFailure);
    const totalLatencyValues = successStats.map((s) => s.avgTotal ?? 0);
    const totalLatencyMinMax = findMinMaxIndices(totalLatencyValues);

    for (let i = 0; i < stats.length; i++) {
      const s = stats[i];

      if (s.hasFailure) {
        lines.push(
          `| ${s.displayName} | ${s.model} | ${s.voice} | ${s.format} | ${s.sampleRate} | ${s.sampleCount} | 测试失败 |`
        );
        continue;
      }

      const successIndex = successStats.indexOf(s);

      // 总耗时
      const totalLat = formatMetricValue(
        s.avgTotal ?? 0,
        successIndex,
        totalLatencyMinMax.minIndex,
        totalLatencyMinMax.maxIndex,
        true,
        ''
      );

      lines.push(
        `| ${s.displayName} | ${s.model} | ${s.voice} | ${s.format} | ${s.sampleRate} | ${s.sampleCount} | ${totalLat} |`
      );
    }

    lines.push('');
  }

  return lines;
}

/**
 * 生成 ASR 性能报告
 */
function generateASRReport(results: BenchmarkResult[], providers: Map<string, string>): string[] {
  const lines: string[] = [];

  const asrResults = results.filter((r) => r.testType === 'asr');
  if (asrResults.length === 0) return lines;

  lines.push('## ASR 性能指标');
  lines.push('');

  // 场景说明表
  lines.push('### 场景说明');
  lines.push('');
  lines.push('| 场景 | 说明 |');
  lines.push('|------|------|');
  for (const [, config] of Object.entries(ASR_SCENARIO_CONFIG)) {
    lines.push(`| ${config.label}${config.note || ''} | ${config.description} |`);
  }
  lines.push('');
  lines.push('> **注意**：标记 `*` 的场景使用 WebSocket 流式传输后聚合结果，并非原生非流式。');
  lines.push('');

  // 指标说明
  lines.push('### 指标说明');
  lines.push('');
  lines.push('| 指标 | 含义 | 计算方法 | 作用 |');
  lines.push('|------|------|----------|------|');
  lines.push(
    '| 首包延迟 | 从发送请求到收到第一个识别结果的时间 | 所有测试首包延迟的平均值 | 反映 ASR 服务的响应速度 |'
  );
  lines.push(
    '| 平均间隔 | 稳定状态下平均每个 chunk 的间隔时间 | (总耗时 - 首包延迟) / (chunk数 - 1) 的平均值 | 反映 ASR 服务吐识别结果的节奏 |'
  );
  lines.push('| P50 | 中位数，50% 请求低于此值 | 所有耗时排序后取中位数 | 反映典型请求的性能 |');
  lines.push(
    '| P95 | 95% 请求低于此值 | 所有耗时排序后取第95百分位 | 评估尾部延迟，了解最坏情况 |'
  );
  lines.push(
    '| 标准差 | 延迟的离散程度 | 各耗时与平均值差值的平方的均值的平方根 | 值越小性能越稳定 |'
  );
  lines.push(
    '| RTF | 实时因子，处理时间与音频时长的比值 | 处理耗时 / 音频时长 | 值越小效率越高，<1 表示快于实时 |'
  );
  lines.push('| 准确率 | 识别正确的字符比例 | 正确字符数 / 总字符数 | 值越高识别越准确 |');
  lines.push(
    '| CER | 字符错误率，需编辑操作的字符比例 | (替换+删除+插入) / 总字符数 | 值越低识别越准确 |'
  );
  lines.push('');

  // ASR 矩阵表格（非流式入/流式出）
  // 检查是否有 ASR 矩阵场景
  const asrMatrixResults = asrResults.filter((r) => r.scenario.startsWith('asr-matrix/'));

  if (asrMatrixResults.length > 0 || allASRMatrixItems.length > 0) {
    lines.push('### 非流式入/流式出');
    lines.push('');
    lines.push(
      '| 服务商 | 模型 | 语言 | 输入格式 | 采样率 (Hz) | 测试次数 | 首包延迟 (ms) | 平均间隔 (ms) | P50 (ms) | P95 (ms) | 标准差 (ms) | RTF |'
    );
    lines.push(
      '|--------|------|------|----------|-------------|----------|---------------|---------------|----------|----------|-------------|-----|'
    );

    // 按配置分组
    const asrMatrixGroups = new Map<string, BenchmarkResult[]>();
    for (const result of asrMatrixResults) {
      const detail = extractASRScenarioDetail(result);
      const key = `${result.provider}/${detail.model}/${detail.language}/${detail.format}/${detail.sampleRate}`;
      const group = asrMatrixGroups.get(key) || [];
      group.push(result);
      asrMatrixGroups.set(key, group);
    }

    // 遍历所有 ASR 矩阵定义的场景
    const asrStats: Array<{
      key: string;
      provider: string;
      model: string;
      language: string;
      format: string;
      sampleRate: string;
      displayName: string;
      hasFailure: boolean;
      sampleCount: number;
      firstLatency?: number;
      avgLatency?: number;
      p50?: number;
      p95?: number;
      stdDev?: number;
      avgRTF?: number;
    }> = [];

    for (const item of allASRMatrixItems) {
      const key = `${item.provider}/${item.model}/${item.language}/${item.format}/${item.sampleRate}`;
      const testResults = asrMatrixGroups.get(key);

      if (testResults && testResults.length > 0) {
        // 有测试结果
        const perf = calculateExtendedPerformance(testResults);
        asrStats.push({
          key,
          provider: item.provider,
          model: item.model,
          language: item.language,
          format: item.format,
          sampleRate: `${item.sampleRate}`,
          displayName: providers.get(item.provider) || getProviderDisplayName(item.provider),
          hasFailure: perf.hasFailure,
          sampleCount: perf.sampleCount,
          firstLatency: perf.firstLatency,
          avgLatency: perf.avgLatency,
          p50: perf.p50,
          p95: perf.p95,
          stdDev: perf.stdDev,
          avgRTF: perf.avgRTF,
        });
      } else {
        // 无测试结果
        asrStats.push({
          key,
          provider: item.provider,
          model: item.model,
          language: item.language,
          format: item.format,
          sampleRate: `${item.sampleRate}`,
          displayName: providers.get(item.provider) || getProviderDisplayName(item.provider),
          hasFailure: true,
          sampleCount: 0,
        });
      }
    }

    // 计算各指标的 min/max 索引
    const successAsrStats = asrStats.filter((s) => !s.hasFailure);
    const asrFirstLatencyValues = successAsrStats.map((s) => s.firstLatency ?? 0);
    const asrAvgLatencyValues = successAsrStats.map((s) => s.avgLatency ?? 0);
    const asrP50Values = successAsrStats.map((s) => s.p50 ?? 0);
    const asrP95Values = successAsrStats.map((s) => s.p95 ?? 0);
    const asrStdDevValues = successAsrStats.map((s) => s.stdDev ?? 0);
    const asrRtfValues = successAsrStats
      .filter((s) => s.avgRTF !== undefined)
      .map((s) => s.avgRTF as number);

    const asrFirstLatencyMinMax = findMinMaxIndices(asrFirstLatencyValues);
    const asrAvgLatencyMinMax = findMinMaxIndices(asrAvgLatencyValues);
    const asrP50MinMax = findMinMaxIndices(asrP50Values);
    const asrP95MinMax = findMinMaxIndices(asrP95Values);
    const asrStdDevMinMax = findMinMaxIndices(asrStdDevValues);
    const asrRtfMinMax = findMinMaxIndices(asrRtfValues);

    let asrRtfIdx = 0;

    for (let i = 0; i < asrStats.length; i++) {
      const s = asrStats[i];

      if (s.hasFailure) {
        if (s.sampleCount === 0) {
          // 未测试
          lines.push(
            `| ${s.displayName} | ${s.model} | ${s.language} | ${s.format} | ${s.sampleRate} | - | 未测试 | - | - | - | - | - |`
          );
        } else {
          // 测试失败
          lines.push(
            `| ${s.displayName} | ${s.model} | ${s.language} | ${s.format} | ${s.sampleRate} | ${s.sampleCount} | 测试失败 | - | - | - | - | - |`
          );
        }
        continue;
      }

      const successIndex = successAsrStats.indexOf(s);

      // 首包延迟
      const firstLat = formatMetricValue(
        s.firstLatency ?? 0,
        successIndex,
        asrFirstLatencyMinMax.minIndex,
        asrFirstLatencyMinMax.maxIndex,
        true,
        ''
      );

      // 平均间隔
      const avgLat = formatMetricValue(
        s.avgLatency ?? 0,
        successIndex,
        asrAvgLatencyMinMax.minIndex,
        asrAvgLatencyMinMax.maxIndex,
        true,
        ''
      );

      // P50
      const p50 = formatMetricValue(
        s.p50 ?? 0,
        successIndex,
        asrP50MinMax.minIndex,
        asrP50MinMax.maxIndex,
        true,
        ''
      );

      // P95
      const p95 = formatMetricValue(
        s.p95 ?? 0,
        successIndex,
        asrP95MinMax.minIndex,
        asrP95MinMax.maxIndex,
        true,
        ''
      );

      // 标准差
      const stdDev = formatMetricValue(
        s.stdDev ?? 0,
        successIndex,
        asrStdDevMinMax.minIndex,
        asrStdDevMinMax.maxIndex,
        true,
        ''
      );

      // RTF
      const rtf = s.avgRTF
        ? formatMetricValue(
            s.avgRTF,
            asrRtfIdx++,
            asrRtfMinMax.minIndex,
            asrRtfMinMax.maxIndex,
            true,
            '',
            2
          )
        : 'N/A';

      lines.push(
        `| ${s.displayName} | ${s.model} | ${s.language} | ${s.format} | ${s.sampleRate} | ${s.sampleCount} | ${firstLat} | ${avgLat} | ${p50} | ${p95} | ${stdDev} | ${rtf} |`
      );
    }

    lines.push('');
  }

  return lines;
}

/**
 * 生成 Markdown 格式的性能报告
 */
export function generateMarkdownReport(report: BenchmarkReport): string {
  const lines: string[] = [];

  // 标题
  lines.push('# Univoice 性能基准测试报告');
  lines.push('');
  lines.push('> ⚠️ **重要说明**');
  lines.push('>');
  lines.push(
    '> 本报告仅反映在使用 **univoice** 时不同服务商和模型之间的**相对性能差异**，仅供参考，不代表服务商和模型的绝对性能。'
  );
  lines.push('>');
  lines.push('> 实际测试结果受多种因素影响，包括但不限于：');
  lines.push('> - 网络波动与延迟');
  lines.push('> - 测试环境与地理位置');
  lines.push('> - univoice 的实现方式');
  lines.push('> - 服务商当前的负载情况');
  lines.push('> - 服务商对模型的迭代');
  lines.push('>');
  lines.push('> 如需评估服务商的真实性能，建议直接使用服务商官方 SDK 进行测试。');
  lines.push('');
  lines.push(`> 生成时间: ${new Date(report.generatedAt).toLocaleString('zh-CN')}`);
  lines.push('');
  lines.push(
    `> 环境: Node.js ${report.environment.node}, ${report.environment.platform} ${report.environment.arch}`
  );
  lines.push('');

  // 构建提供商名称映射
  const providerNames = new Map<string, string>();
  for (const p of report.ttsProviders) {
    providerNames.set(p.provider, p.capabilities.displayName);
  }
  for (const p of report.asrProviders) {
    providerNames.set(p.provider, p.capabilities.displayName);
  }

  // TTS 报告
  const ttsLines = generateTTSReport(report.results, providerNames);
  lines.push(...ttsLines);

  // ASR 报告
  const asrLines = generateASRReport(report.results, providerNames);
  lines.push(...asrLines);

  // 页脚
  lines.push('---');
  lines.push('');
  lines.push(`*数据更新于: ${new Date().toISOString().split('T')[0]}*`);

  return lines.join('\n');
}

/**
 * 将性能报告同步到指定文件（通过标记替换）
 */
export function syncToFile(
  filePath: string,
  reportContent: string,
  startMarker = '<!-- PERFORMANCE_TABLE_START -->',
  endMarker = '<!-- PERFORMANCE_TABLE_END -->'
): void {
  const fileContent = readFileSync(filePath, 'utf-8');

  const startIndex = fileContent.indexOf(startMarker);
  const endIndex = fileContent.indexOf(endMarker);

  if (startIndex === -1 || endIndex === -1) {
    throw new Error(`${filePath} 中找不到性能表格标记`);
  }

  const newContent =
    fileContent.slice(0, startIndex + startMarker.length) +
    '\n\n' +
    reportContent +
    '\n' +
    fileContent.slice(endIndex);

  writeFileSync(filePath, newContent);
}

/**
 * 生成适合嵌入文档站点的性能报告（不含顶层 H1 标题）
 */
export function generateDocsReport(report: BenchmarkReport): string {
  const fullReport = generateMarkdownReport(report);
  // 移除第一行 H1 标题及其后的空行
  const lines = fullReport.split('\n');
  const contentStartIndex = lines.findIndex((line) => line.trim() !== '' && !line.startsWith('# '));
  if (contentStartIndex === -1) return fullReport;
  // MDX 兼容处理：
  // 1. 独立的 --- 替换为 ***（避免被误认为 frontmatter 分隔符）
  // 2. < 替换为 &lt;（避免被当成 JSX 标签）
  return lines
    .slice(contentStartIndex)
    .map((line) => {
      if (line === '---') return '***';
      return line.replace(/</g, '&lt;');
    })
    .join('\n');
}

/**
 * 将性能报告同步到 README.md（向后兼容）
 */
export function syncToReadme(reportContent: string): void {
  syncToFile(join(__dirname, 'README.md'), reportContent);
  console.log('✓ 已同步性能报告到 README.md');
}
