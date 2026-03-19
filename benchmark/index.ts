/**
 * Benchmark CLI 入口
 * 用于运行性能测试并生成报告
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { average, percentile, successRate } from './metrics/collector';
import type {
  BenchmarkReport,
  BenchmarkResult,
  ProviderCapabilities,
  ProviderSummary,
} from './metrics/types';
import { getASRProviderConfigs, runASRSuite } from './runners/asr-runner';
import { getProviderConfigs, runTTSSuite } from './runners/tts-runner';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * 确保目录存在
 */
function ensureDir(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

/**
 * 获取提供商能力信息
 */
function getTTSCapabilities(provider: string): ProviderCapabilities {
  const configs = getProviderConfigs();
  const config = configs.find((c) => c.provider === provider);

  if (!config) {
    return {
      provider,
      displayName: provider,
      streamInput: false,
      streamOutput: false,
      protocol: 'http',
    };
  }

  return {
    provider: config.provider,
    displayName: config.displayName,
    streamInput: config.streamInput,
    streamOutput: config.streamOutput,
    protocol: config.provider === 'glm' ? 'http' : 'websocket',
  };
}

function getASRCapabilities(provider: string): ProviderCapabilities {
  const configs = getASRProviderConfigs();
  const config = configs.find((c) => c.provider === provider);

  if (!config) {
    return {
      provider,
      displayName: provider,
      streamInput: false,
      streamOutput: false,
      protocol: 'http',
    };
  }

  return {
    provider: config.provider,
    displayName: config.displayName,
    streamInput: config.streamInput,
    streamOutput: config.streamOutput,
    protocol: config.provider === 'glm' ? 'http' : 'websocket',
  };
}

/**
 * 计算提供商汇总
 */
function summarizeProvider(
  provider: string,
  results: BenchmarkResult[],
  getCapabilities: (p: string) => ProviderCapabilities
): ProviderSummary {
  const providerResults = results.filter((r) => r.provider === provider);
  const successResults = providerResults.filter((r) => r.status === 'success');

  const firstChunkLatencies = successResults.map((r) => r.latency.firstChunk);

  return {
    provider,
    capabilities: getCapabilities(provider),
    performance: {
      avgFirstChunkLatency: average(firstChunkLatencies),
      p50FirstChunkLatency: percentile(firstChunkLatencies, 50),
      p95FirstChunkLatency: percentile(firstChunkLatencies, 95),
      successRate: successRate(providerResults),
      sampleCount: providerResults.length,
    },
  };
}

/**
 * 生成 JSON 报告
 */
function generateJsonReport(results: BenchmarkResult[]): BenchmarkReport {
  const ttsProviders = [
    ...new Set(results.filter((r) => r.testType === 'tts').map((r) => r.provider)),
  ];
  const asrProviders = [
    ...new Set(results.filter((r) => r.testType === 'asr').map((r) => r.provider)),
  ];

  return {
    generatedAt: new Date().toISOString(),
    environment: {
      node: process.version,
      platform: process.platform,
      arch: process.arch,
    },
    ttsProviders: ttsProviders.map((p) => summarizeProvider(p, results, getTTSCapabilities)),
    asrProviders: asrProviders.map((p) => summarizeProvider(p, results, getASRCapabilities)),
    results,
  };
}

/**
 * 生成 Markdown 报告
 */
function generateMarkdownReport(report: BenchmarkReport): string {
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

/**
 * 更新 README.md
 */
function updateReadme(report: BenchmarkReport): void {
  const readmePath = join(__dirname, '..', 'README.md');

  if (!existsSync(readmePath)) {
    console.log('README.md 不存在，跳过更新');
    return;
  }

  let readme = readFileSync(readmePath, 'utf-8');

  // 生成性能基准章节
  const benchmarkSection = generateMarkdownReport(report);

  // 查找性能基准章节的位置
  const benchmarkStart = readme.indexOf('## 性能基准');
  const benchmarkEnd = readme.indexOf('---', benchmarkStart);

  if (benchmarkStart !== -1 && benchmarkEnd !== -1) {
    // 替换现有章节
    readme = `${readme.slice(0, benchmarkStart) + benchmarkSection}\n\n${readme.slice(benchmarkEnd)}`;
  } else {
    // 在「支持的提供商」章节后插入
    const supportedStart = readme.indexOf('## 支持的提供商');
    const nextSectionStart = readme.indexOf('\n## ', supportedStart + 1);

    if (supportedStart !== -1 && nextSectionStart !== -1) {
      readme =
        readme.slice(0, nextSectionStart) +
        '\n\n' +
        benchmarkSection +
        '\n' +
        readme.slice(nextSectionStart);
    }
  }

  writeFileSync(readmePath, readme);
  console.log('README.md 已更新');
}

/**
 * 主函数
 */
async function main(): Promise<void> {
  console.log('🚀 Univoice Benchmark 性能测试');
  console.log('================================\n');

  const startTime = Date.now();

  // 运行测试
  const allResults: BenchmarkResult[] = [];

  // TTS 测试
  console.log('📝 开始 TTS 性能测试...\n');
  const ttsResults = await runTTSSuite({ iterations: 3 });
  allResults.push(...ttsResults);

  // ASR 测试（需要音频文件）
  console.log('\n🎤 开始 ASR 性能测试...\n');
  const asrResults = await runASRSuite({ iterations: 3 });
  allResults.push(...asrResults);

  // 生成报告
  console.log('\n📊 生成报告...\n');
  const report = generateJsonReport(allResults);

  // 保存 JSON 结果
  const resultsDir = join(__dirname, 'results');
  ensureDir(resultsDir);

  const latestDir = join(resultsDir, 'latest');
  ensureDir(latestDir);

  const jsonPath = join(latestDir, 'benchmark.json');
  writeFileSync(jsonPath, JSON.stringify(report, null, 2));
  console.log(`✓ JSON 报告已保存: ${jsonPath}`);

  // 保存 Markdown 报告
  const mdReport = generateMarkdownReport(report);
  const mdPath = join(latestDir, 'benchmark.md');
  writeFileSync(mdPath, mdReport);
  console.log(`✓ Markdown 报告已保存: ${mdPath}`);

  // 更新 README
  updateReadme(report);

  const totalTime = Date.now() - startTime;
  console.log(`\n✅ 测试完成! 总耗时: ${(totalTime / 1000).toFixed(1)}s`);
  console.log(`   - TTS 测试: ${ttsResults.length} 次`);
  console.log(`   - ASR 测试: ${asrResults.length} 次`);
}

// 运行
main().catch((error) => {
  console.error('测试失败:', error);
  process.exit(1);
});
