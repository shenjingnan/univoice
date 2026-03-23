/**
 * 报告生成工具
 * 用于从 BenchmarkReport 生成 Markdown 格式的报告
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { calculateNormalizedAccuracy } from '../metrics/accuracy';
import { average, successRate } from '../metrics/collector';
import type { BenchmarkReport, BenchmarkResult } from '../metrics/types';

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
  const successResults = results.filter((r) => r.status === 'success');

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
    };
  }

  // 按时间戳排序，计算首次耗时和平均耗时
  const sortedResults = [...successResults].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  // 延迟统计
  const firstChunkLatencies = successResults.map((r) => r.latency.firstChunk);
  const totalLatencies = successResults.map((r) => r.latency.total);
  const perCharLatencies = successResults
    .map((r) => r.latency.perChar)
    .filter((v): v is number => v !== undefined);
  const rtfs = successResults.map((r) => r.latency.rtf).filter((v): v is number => v !== undefined);

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

  // 计算首次耗时和平均耗时
  const firstLatency = sortedResults.length > 0 ? sortedResults[0].latency.total : 0;
  const remainingLatencies = sortedResults.slice(1).map((r) => r.latency.total);
  const avgLatency = remainingLatencies.length > 0 ? average(remainingLatencies) : firstLatency;

  // 获取输入格式
  const inputFormat = successResults.length > 0 ? successResults[0].config.format : 'unknown';

  // 获取输入输出模式
  const inputMode = successResults.length > 0 ? successResults[0].config.inputMode : 'non-stream';
  const outputMode = successResults.length > 0 ? successResults[0].config.outputMode : 'non-stream';

  return {
    avgFirstChunk: average(firstChunkLatencies),
    avgTotal: average(totalLatencies),
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
  textCategory: string;
}

/**
 * 解析矩阵场景名称
 * 格式: matrix/<model>/<voice>/<format>-<sampleRate>/<textCategory>
 * 示例: matrix/cosyvoice-v3-flash/longanyang/pcm-16000/short
 */
function parseMatrixScenario(scenario: string): MatrixScenarioInfo | null {
  if (!scenario.startsWith('matrix/')) return null;
  const parts = scenario.split('/');
  if (parts.length !== 5) return null;

  const [_, model, voice, formatSampleRate, textCategory] = parts;
  const [format, sampleRateStr] = formatSampleRate.split('-');
  const sampleRate = parseInt(sampleRateStr, 10);
  if (Number.isNaN(sampleRate)) return null;

  return { model, voice, format, sampleRate, textCategory };
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
 * 提供商协议配置
 */
const PROVIDER_PROTOCOL: Record<string, string> = {
  qwen: 'WebSocket',
  doubao: 'WebSocket',
  glm: 'HTTP',
  minimax: 'WebSocket',
  openai: 'HTTP',
  gemini: 'HTTP',
};

/**
 * 格式化场景名称
 */
function formatScenario(
  scenario: string,
  type: 'tts' | 'asr' = 'asr'
): { label: string; note?: string } {
  const config = type === 'tts' ? TTS_SCENARIO_CONFIG : ASR_SCENARIO_CONFIG;
  const scenarioConfig = config[scenario];
  if (scenarioConfig) {
    return { label: scenarioConfig.label, note: scenarioConfig.note };
  }
  return { label: scenario };
}

/**
 * 获取提供商协议
 */
function getProtocol(provider: string): string {
  return PROVIDER_PROTOCOL[provider] || 'Unknown';
}

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

  // 按 outputMode 分组
  const streamOutResults = ttsResults.filter((r) => r.config.outputMode === 'stream');
  const nonStreamOutResults = ttsResults.filter((r) => r.config.outputMode === 'non-stream');

  // 非流式入/流式出表格
  if (streamOutResults.length > 0) {
    lines.push('### 非流式入/流式出');
    lines.push('');
    lines.push(
      '| 服务商 | 模型 | 音色 | 编码格式 | 采样率 (Hz) | 测试次数 | 首次耗时 (ms) | 平均耗时 (ms) | 总耗时 (ms) |'
    );
    lines.push(
      '|--------|------|------|----------|-------------|----------|---------------|---------------|------------|'
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

    // 计算各指标的 min/max 索引用于标记最佳值
    const successStats = stats.filter((s) => !s.hasFailure);
    const firstLatencyValues = successStats.map((s) => s.firstLatency ?? 0);
    const avgLatencyValues = successStats.map((s) => s.avgLatency ?? 0);
    const totalLatencyValues = successStats.map((s) => s.avgTotal ?? 0);

    const firstLatencyMinMax = findMinMaxIndices(firstLatencyValues);
    const avgLatencyMinMax = findMinMaxIndices(avgLatencyValues);
    const totalLatencyMinMax = findMinMaxIndices(totalLatencyValues);

    for (let i = 0; i < stats.length; i++) {
      const s = stats[i];

      if (s.hasFailure) {
        lines.push(
          `| ${s.displayName} | ${s.model} | ${s.voice} | ${s.format} | ${s.sampleRate} | ${s.sampleCount} | 测试失败 | - | - |`
        );
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
        `| ${s.displayName} | ${s.model} | ${s.voice} | ${s.format} | ${s.sampleRate} | ${s.sampleCount} | ${firstLat} | ${avgLat} | ${totalLat} |`
      );
    }

    lines.push('');
  }

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

  // 能力矩阵
  lines.push('### 能力矩阵');
  lines.push('');
  lines.push('| 提供商 | 协议 | 流式输入 | 流式输出 |');
  lines.push('|--------|------|:--------:|:--------:|');

  // 按提供商分组来生成能力矩阵
  const providerGroups = new Map<string, BenchmarkResult[]>();
  for (const result of ttsResults) {
    const group = providerGroups.get(result.provider) || [];
    group.push(result);
    providerGroups.set(result.provider, group);
  }

  for (const [provider, res] of providerGroups) {
    const displayName = providers.get(provider) || provider;
    const protocol = getProtocol(provider);
    // 根据 config.inputMode 和 config.outputMode 判断流式能力
    const hasStreamIn = res.some((r) => r.config.inputMode === 'stream' && r.status === 'success');
    const hasStreamOut = res.some(
      (r) => r.config.outputMode === 'stream' && r.status === 'success'
    );
    const streamIn = hasStreamIn ? '✅' : '❌';
    const streamOut = hasStreamOut ? '✅' : '❌';
    lines.push(`| ${displayName} | ${protocol} | ${streamIn} | ${streamOut} |`);
  }

  lines.push('');

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

  // 按提供商 + 场景分组
  const scenarioGroups = new Map<string, BenchmarkResult[]>();
  for (const result of asrResults) {
    const key = `${result.provider}/${result.scenario}`;
    const group = scenarioGroups.get(key) || [];
    group.push(result);
    scenarioGroups.set(key, group);
  }

  // 计算统计
  const scenarioStats = Array.from(scenarioGroups.entries()).map(([key, res]) => {
    const [provider, scenario] = key.split('/');
    return {
      key,
      provider,
      scenario,
      displayName: providers.get(provider) || provider,
      ...calculateExtendedPerformance(res),
    };
  });

  // 综合性能表格
  lines.push('### 综合性能指标');
  lines.push('');
  lines.push('| ASR | 场景 | 协议 | 首次耗时 (ms) | 平均耗时 (ms) | RTF | 准确率 | CER |');
  lines.push('|-----|------|------|---------------|---------------|-----|--------|-----|');

  // 计算各指标的 min/max 索引用于标记最佳值（只计算成功的）
  const successStats = scenarioStats.filter((s) => !s.hasFailure);
  const firstLatencyValues = successStats.map((s) => s.firstLatency ?? 0);
  const avgLatencyValues = successStats.map((s) => s.avgLatency ?? 0);
  const rtfValues = successStats
    .filter((s) => s.avgRTF !== undefined)
    .map((s) => s.avgRTF as number);
  const cerValues = successStats
    .filter((s) => s.avgCER !== undefined)
    .map((s) => s.avgCER as number);

  const firstLatencyMinMax = findMinMaxIndices(firstLatencyValues);
  const avgLatencyMinMax = findMinMaxIndices(avgLatencyValues);
  const rtfMinMax = findMinMaxIndices(rtfValues);
  const cerMinMax = findMinMaxIndices(cerValues);

  let rtfIdx = 0;
  let cerIdx = 0;

  for (let i = 0; i < scenarioStats.length; i++) {
    const s = scenarioStats[i];
    const scenarioInfo = formatScenario(s.scenario, 'asr');
    const protocol = getProtocol(s.provider);

    // 场景名称（带标记）
    const scenarioLabel = `${scenarioInfo.label}${scenarioInfo.note || ''}`;

    if (s.hasFailure) {
      lines.push(
        `| ${s.displayName} | ${scenarioLabel} | ${protocol} | 测试失败 | - | - | - | - |`
      );
      continue;
    }

    // 首次耗时
    const successIndex = successStats.indexOf(s);
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

    // RTF
    const rtf = s.avgRTF
      ? formatMetricValue(s.avgRTF, rtfIdx++, rtfMinMax.minIndex, rtfMinMax.maxIndex, true, '', 2)
      : 'N/A';

    // 准确率
    const accuracy = s.avgAccuracy !== undefined ? `${(s.avgAccuracy * 100).toFixed(1)}%` : 'N/A';

    // CER
    const cer = s.avgCER
      ? formatMetricValue(
          s.avgCER * 100,
          cerIdx++,
          cerMinMax.minIndex,
          cerMinMax.maxIndex,
          true,
          '%',
          1
        )
      : 'N/A';

    lines.push(
      `| ${s.displayName} | ${scenarioLabel} | ${protocol} | ${firstLat} | ${avgLat} | ${rtf} | ${accuracy} | ${cer} |`
    );
  }

  lines.push('');

  // 能力矩阵
  lines.push('### 能力矩阵');
  lines.push('');
  lines.push('| 提供商 | 协议 | 流式输入 | 流式输出 | 原生非流式 |');
  lines.push('|--------|------|:--------:|:--------:|:----------:|');

  // 按提供商分组来生成能力矩阵
  const providerGroups = new Map<string, BenchmarkResult[]>();
  for (const result of asrResults) {
    const group = providerGroups.get(result.provider) || [];
    group.push(result);
    providerGroups.set(result.provider, group);
  }

  for (const [provider, res] of providerGroups) {
    const displayName = providers.get(provider) || provider;
    const protocol = getProtocol(provider);
    const hasStreamIn = res.some(
      (r) => r.scenario.includes('stream-input') && r.status === 'success'
    );
    const hasStreamOut = res.some(
      (r) => r.scenario.includes('stream-output') && r.status === 'success'
    );
    // WebSocket 提供商不支持原生非流式
    const hasNativeNonStream =
      protocol !== 'WebSocket' &&
      res.some(
        (r) => r.scenario === 'non-stream-input-non-stream-output' && r.status === 'success'
      );

    const streamIn = hasStreamIn ? '✅' : '❌';
    const streamOut = hasStreamOut ? '✅' : '❌';
    const nativeNonStream = hasNativeNonStream ? '✅' : '❌';
    lines.push(
      `| ${displayName} | ${protocol} | ${streamIn} | ${streamOut} | ${nativeNonStream} |`
    );
  }

  lines.push('');

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
 * 将性能报告同步到 README.md
 */
export function syncToReadme(reportContent: string): void {
  const readmePath = join(__dirname, 'README.md');
  const readmeContent = readFileSync(readmePath, 'utf-8');

  const startMarker = '<!-- PERFORMANCE_TABLE_START -->';
  const endMarker = '<!-- PERFORMANCE_TABLE_END -->';

  const startIndex = readmeContent.indexOf(startMarker);
  const endIndex = readmeContent.indexOf(endMarker);

  if (startIndex === -1 || endIndex === -1) {
    throw new Error('README.md 中找不到性能表格标记');
  }

  const newReadmeContent =
    readmeContent.slice(0, startIndex + startMarker.length) +
    '\n\n' +
    reportContent +
    '\n' +
    readmeContent.slice(endIndex);

  writeFileSync(readmePath, newReadmeContent);
  console.log('✓ 已同步性能报告到 README.md');
}
