/**
 * 报告生成工具
 * 用于从 BenchmarkReport 生成 Markdown 格式的报告
 */
import type { BenchmarkReport } from '../metrics/types';

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

    for (const p of report.ttsProviders) {
      if (p.performance.sampleCount > 0) {
        const avg = p.performance.avgFirstChunkLatency.toFixed(0);
        const p50 = p.performance.p50FirstChunkLatency.toFixed(0);
        const p95 = p.performance.p95FirstChunkLatency.toFixed(0);
        const rate = (p.performance.successRate * 100).toFixed(0);
        lines.push(`| ${p.capabilities.displayName} | ${avg}ms | ${p50}ms | ${p95}ms | ${rate}% |`);
      }
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

    for (const p of report.asrProviders) {
      if (p.performance.sampleCount > 0) {
        const avg = p.performance.avgFirstChunkLatency.toFixed(0);
        const p50 = p.performance.p50FirstChunkLatency.toFixed(0);
        const p95 = p.performance.p95FirstChunkLatency.toFixed(0);
        const rate = (p.performance.successRate * 100).toFixed(0);
        lines.push(`| ${p.capabilities.displayName} | ${avg}ms | ${p50}ms | ${p95}ms | ${rate}% |`);
      }
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
