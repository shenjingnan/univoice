/**
 * 报告生成工具
 * 用于从 BenchmarkReport 生成 Markdown 格式的报告
 */
import type { BenchmarkReport } from '../metrics/types';

/**
 * 找出数组中的最小值和最大值索引
 * @param values 数值数组
 * @returns { minIndex: 最小值索引, maxIndex: 最大值索引 }
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
 * @param value 原始值
 * @param index 当前索引
 * @param minIndex 最佳索引（对于越小越好的指标）或最差索引（对于越大越好的指标）
 * @param maxIndex 最差索引（对于越小越好的指标）或最佳索引（对于越大越好的指标）
 * @param isLowerBetter 指标是否越小越好（如延迟），否则越大越好（如成功率）
 * @param suffix 后缀（如 'ms' 或 '%'）
 */
function formatMetricValue(
  value: number,
  index: number,
  minIndex: number,
  maxIndex: number,
  isLowerBetter: boolean,
  suffix: string
): string {
  const formatted = `${value.toFixed(0)}${suffix}`;

  // 如果只有一个数据点，不标注
  if (minIndex === maxIndex) {
    return formatted;
  }

  if (isLowerBetter) {
    // 越小越好：最小值是最佳，最大值是最差
    if (index === minIndex) {
      return `**${formatted} 🏆**`;
    }
    if (index === maxIndex) {
      return `*${formatted}*`;
    }
  } else {
    // 越大越好：最大值是最佳，最小值是最差
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
 * 生成 Markdown 格式的性能报告
 */
export function generateMarkdownReport(report: BenchmarkReport): string {
  const lines: string[] = [];

  lines.push('# Univoice 性能基准测试报告');
  lines.push('');
  lines.push(`> 生成时间: ${new Date(report.generatedAt).toLocaleString('zh-CN')}`);
  lines.push('');
  lines.push(
    `> 环境: Node.js ${report.environment.node}, ${report.environment.platform} ${report.environment.arch}`
  );
  lines.push('');

  // TTS 部分
  if (report.ttsProviders.length > 0) {
    lines.push('## TTS 性能指标');
    lines.push('');
    lines.push('### 首包延迟（短文本，流式输出）');
    lines.push('');
    lines.push('| 提供商 | 平均延迟 | P50 | P95 | 成功率 |');
    lines.push('|--------|---------|-----|-----|--------|');

    // 过滤出有数据的提供商
    const ttsWithData = report.ttsProviders.filter((p) => p.performance.sampleCount > 0);

    // 收集各指标值用于找出最佳/最差
    const avgValues = ttsWithData.map((p) => p.performance.avgFirstChunkLatency);
    const p50Values = ttsWithData.map((p) => p.performance.p50FirstChunkLatency);
    const p95Values = ttsWithData.map((p) => p.performance.p95FirstChunkLatency);
    const rateValues = ttsWithData.map((p) => p.performance.successRate * 100);

    // 找出各列的最佳/最差索引
    const avgMinMax = findMinMaxIndices(avgValues);
    const p50MinMax = findMinMaxIndices(p50Values);
    const p95MinMax = findMinMaxIndices(p95Values);
    const rateMinMax = findMinMaxIndices(rateValues);

    for (let i = 0; i < ttsWithData.length; i++) {
      const p = ttsWithData[i];
      const avg = formatMetricValue(
        p.performance.avgFirstChunkLatency,
        i,
        avgMinMax.minIndex,
        avgMinMax.maxIndex,
        true, // 延迟越小越好
        'ms'
      );
      const p50 = formatMetricValue(
        p.performance.p50FirstChunkLatency,
        i,
        p50MinMax.minIndex,
        p50MinMax.maxIndex,
        true,
        'ms'
      );
      const p95 = formatMetricValue(
        p.performance.p95FirstChunkLatency,
        i,
        p95MinMax.minIndex,
        p95MinMax.maxIndex,
        true,
        'ms'
      );
      const rate = formatMetricValue(
        p.performance.successRate * 100,
        i,
        rateMinMax.minIndex,
        rateMinMax.maxIndex,
        false, // 成功率越大越好
        '%'
      );
      lines.push(`| ${p.capabilities.displayName} | ${avg} | ${p50} | ${p95} | ${rate} |`);
    }

    lines.push('');
    lines.push('### 能力矩阵');
    lines.push('');
    lines.push('| 提供商 | 流式输入 | 流式输出 | 协议 |');
    lines.push('|--------|:--------:|:--------:|:----:|');

    for (const p of report.ttsProviders) {
      const streamIn = p.capabilities.streamInput ? '✅' : '❌';
      const streamOut = p.capabilities.streamOutput ? '✅' : '❌';
      lines.push(
        `| ${p.capabilities.displayName} | ${streamIn} | ${streamOut} | ${p.capabilities.protocol} |`
      );
    }

    lines.push('');
  }

  // ASR 部分
  if (report.asrProviders.length > 0) {
    lines.push('## ASR 性能指标');
    lines.push('');
    lines.push('### 首包延迟');
    lines.push('');
    lines.push('| 提供商 | 平均延迟 | P50 | P95 | 成功率 |');
    lines.push('|--------|---------|-----|-----|--------|');

    // 过滤出有数据的提供商
    const asrWithData = report.asrProviders.filter((p) => p.performance.sampleCount > 0);

    // 收集各指标值用于找出最佳/最差
    const asrAvgValues = asrWithData.map((p) => p.performance.avgFirstChunkLatency);
    const asrP50Values = asrWithData.map((p) => p.performance.p50FirstChunkLatency);
    const asrP95Values = asrWithData.map((p) => p.performance.p95FirstChunkLatency);
    const asrRateValues = asrWithData.map((p) => p.performance.successRate * 100);

    // 找出各列的最佳/最差索引
    const asrAvgMinMax = findMinMaxIndices(asrAvgValues);
    const asrP50MinMax = findMinMaxIndices(asrP50Values);
    const asrP95MinMax = findMinMaxIndices(asrP95Values);
    const asrRateMinMax = findMinMaxIndices(asrRateValues);

    for (let i = 0; i < asrWithData.length; i++) {
      const p = asrWithData[i];
      const avg = formatMetricValue(
        p.performance.avgFirstChunkLatency,
        i,
        asrAvgMinMax.minIndex,
        asrAvgMinMax.maxIndex,
        true, // 延迟越小越好
        'ms'
      );
      const p50 = formatMetricValue(
        p.performance.p50FirstChunkLatency,
        i,
        asrP50MinMax.minIndex,
        asrP50MinMax.maxIndex,
        true,
        'ms'
      );
      const p95 = formatMetricValue(
        p.performance.p95FirstChunkLatency,
        i,
        asrP95MinMax.minIndex,
        asrP95MinMax.maxIndex,
        true,
        'ms'
      );
      const rate = formatMetricValue(
        p.performance.successRate * 100,
        i,
        asrRateMinMax.minIndex,
        asrRateMinMax.maxIndex,
        false, // 成功率越大越好
        '%'
      );
      lines.push(`| ${p.capabilities.displayName} | ${avg} | ${p50} | ${p95} | ${rate} |`);
    }

    lines.push('');
  }

  // 场景推荐
  lines.push('## 场景推荐');
  lines.push('');

  if (report.ttsProviders.length > 0) {
    // 找出首包延迟最低的提供商
    const sortedByLatency = [...report.ttsProviders]
      .filter((p) => p.performance.sampleCount > 0)
      .sort((a, b) => a.performance.avgFirstChunkLatency - b.performance.avgFirstChunkLatency);

    if (sortedByLatency.length > 0) {
      const fastest = sortedByLatency[0];
      lines.push(`| 场景 | 推荐提供商 | 原因 |`);
      lines.push('|------|-----------|------|');
      lines.push(
        `| LLM 实时对话 | ${fastest.capabilities.displayName} | 最低首包延迟 (${fastest.performance.avgFirstChunkLatency.toFixed(0)}ms) |`
      );
    }
  }

  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push(`*数据更新于: ${new Date().toISOString().split('T')[0]}*`);

  return lines.join('\n');
}
