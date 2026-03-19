/**
 * Benchmark CLI 入口
 * 用于运行性能测试并生成报告
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { average, percentile, successRate } from './metrics/collector';
import type {
  BenchmarkReport,
  BenchmarkResult,
  ProviderCapabilities,
  ProviderSummary,
} from './metrics/types';
import { generateMarkdownReport } from './utils/report-generator';

export type { BenchmarkReport, BenchmarkResult, ProviderCapabilities, ProviderSummary };

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
 * 解析命令行参数
 */
function parseCliArgs(): {
  providers: string[] | undefined;
  type: 'tts' | 'asr' | 'all';
  iterations: number;
} {
  // 过滤掉 pnpm 传递的开头 '--'
  const args = process.argv.slice(2).filter((arg, index) => !(index === 0 && arg === '--'));

  const { values } = parseArgs({
    args,
    options: {
      provider: { type: 'string', multiple: true, short: 'p' },
      type: { type: 'string', default: 'all', short: 't' },
      iterations: { type: 'string', default: '3', short: 'i' },
      help: { type: 'boolean', short: 'h' },
    },
    strict: false,
  });

  // 显示帮助信息
  if (values.help) {
    console.log(`
用法: pnpm benchmark -- [选项]

选项:
  -p, --provider <name>   指定服务商（可多次使用，支持逗号分隔）
                          TTS: doubao, qwen, minimax, glm
                          ASR: doubao, qwen, glm
  -t, --type <type>       测试类型 (tts | asr | all)，默认 all
  -i, --iterations <n>    迭代次数，默认 3
  -h, --help              显示帮助信息

示例:
  pnpm benchmark --                         # 测试所有服务商
  pnpm benchmark -- -p qwen                 # 只测试 qwen
  pnpm benchmark -- -p qwen -p doubao       # 测试 qwen 和 doubao
  pnpm benchmark -- -p qwen,doubao          # 测试 qwen 和 doubao（逗号分隔）
  pnpm benchmark -- -t tts                  # 只测试 TTS
  pnpm benchmark -- -t tts -p qwen          # 只测试 qwen 的 TTS
  pnpm benchmark -- -i 5                    # 每个测试迭代 5 次

注意: pnpm 需要使用 "--" 分隔符来传递参数给脚本
`);
    process.exit(0);
  }

  // 处理 provider 参数（支持逗号分隔）
  const providers = values.provider
    ?.flatMap((p) => p.split(','))
    .map((p) => p.trim())
    .filter(Boolean);

  // 验证 type 参数
  const type = values.type as 'tts' | 'asr' | 'all';
  if (!['tts', 'asr', 'all'].includes(type)) {
    console.error(`❌ 无效的测试类型: ${type}，可选值: tts, asr, all`);
    process.exit(1);
  }

  // 解析迭代次数
  const iterations = Number.parseInt(values.iterations as string, 10);
  if (Number.isNaN(iterations) || iterations < 1) {
    console.error(`❌ 无效的迭代次数: ${values.iterations}，必须为正整数`);
    process.exit(1);
  }

  return { providers, type, iterations };
}

/**
 * 主函数
 */
async function main(): Promise<void> {
  const { providers, type, iterations } = parseCliArgs();

  console.log('🚀 Univoice Benchmark 性能测试');
  console.log('================================');
  if (providers) {
    console.log(`📋 指定服务商: ${providers.join(', ')}`);
  }
  console.log(`📊 测试类型: ${type}`);
  console.log(`🔄 迭代次数: ${iterations}\n`);

  const startTime = Date.now();

  // 运行测试
  const allResults: BenchmarkResult[] = [];

  // TTS 测试
  if (type === 'tts' || type === 'all') {
    console.log('📝 开始 TTS 性能测试...\n');
    const ttsResults = await runTTSSuite({ providers, iterations });
    allResults.push(...ttsResults);
  }

  // ASR 测试
  if (type === 'asr' || type === 'all') {
    console.log('\n🎤 开始 ASR 性能测试...\n');
    const asrResults = await runASRSuite({ providers, iterations });
    allResults.push(...asrResults);
  }

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

  const totalTime = Date.now() - startTime;
  const ttsCount = allResults.filter((r) => r.testType === 'tts').length;
  const asrCount = allResults.filter((r) => r.testType === 'asr').length;
  console.log(`\n✅ 测试完成! 总耗时: ${(totalTime / 1000).toFixed(1)}s`);
  console.log(`   - TTS 测试: ${ttsCount} 次`);
  console.log(`   - ASR 测试: ${asrCount} 次`);
}

// 运行
main().catch((error) => {
  console.error('测试失败:', error);
  process.exit(1);
});
