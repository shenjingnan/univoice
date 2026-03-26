/**
 * Benchmark 分析入口
 * 用于分析已存储的测试结果并生成报告
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { calculateNormalizedAccuracy } from './metrics/accuracy';
import type {
  BenchmarkReport,
  BenchmarkResult,
  MatrixCoverageItem,
  MatrixCoverageSummary,
  ProviderMatrixCoverage,
  SingleTestResult,
} from './metrics/types';
import { analyzeResults } from './utils/aggregator';
import {
  allMatrixItems,
  generateScenarioName,
  getAllProviders,
  getProviderDisplayName,
} from './utils/matrix-loader';
import { generateMarkdownReport } from './utils/report-generator';
import { countResults, loadResults } from './utils/result-loader';
import { getLatestDir } from './utils/result-writer';

/**
 * 将 SingleTestResult 转换为 BenchmarkResult（用于报告生成）
 * 在转换时计算准确率（从 expectedText 和 actualText）和延迟（从原始时间戳）
 */
function toBenchmarkResult(result: SingleTestResult): BenchmarkResult {
  // 计算准确率（如果存在原始数据）
  let accuracy: BenchmarkResult['accuracy'];

  if (result.accuracy) {
    // 新格式：从 expectedText 和 actualText 计算
    if (result.accuracy.expectedText !== undefined && result.accuracy.actualText !== undefined) {
      const accuracyResult = calculateNormalizedAccuracy(
        result.accuracy.expectedText,
        result.accuracy.actualText
      );
      accuracy = {
        accuracy: accuracyResult.accuracy,
        cer: accuracyResult.cer,
        expectedText: result.accuracy.expectedText,
        actualText: result.accuracy.actualText,
      };
    } else {
      // 旧格式：直接使用已有的值（向后兼容）
      const legacyAccuracy = result.accuracy as unknown as {
        accuracy?: number;
        cer?: number;
        expectedText?: string;
        actualText?: string;
      };
      if (legacyAccuracy.accuracy !== undefined) {
        accuracy = {
          accuracy: legacyAccuracy.accuracy,
          cer: legacyAccuracy.cer ?? 0,
          expectedText: legacyAccuracy.expectedText,
          actualText: legacyAccuracy.actualText,
        };
      }
    }
  }

  // 获取 startTime（支持新旧格式）
  const startTime = result.startTime || 0;

  return {
    id: result.id,
    timestamp: result.timestamp,
    provider: result.provider,
    model: result.model,
    testType: result.testType,
    scenario: result.scenario,
    config: result.config,
    startTime,
    throughput: result.throughput,
    quality: result.quality,
    accuracy,
    status: result.status,
    error: result.error,
  };
}

/**
 * 确保目录存在
 */
function ensureDir(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

/**
 * 生成 JSON 报告
 */
function generateReport(results: SingleTestResult[]): BenchmarkReport {
  const analysis = analyzeResults(results);
  const matrixCoverage = calculateMatrixCoverage(results);

  return {
    generatedAt: new Date().toISOString(),
    environment: {
      node: process.version,
      platform: process.platform,
      arch: process.arch,
    },
    ttsProviders: analysis.ttsProviders,
    asrProviders: analysis.asrProviders,
    results: results.map(toBenchmarkResult),
    matrixCoverage,
  };
}

/**
 * 计算矩阵覆盖率
 */
function calculateMatrixCoverage(results: SingleTestResult[]): MatrixCoverageSummary {
  // 构建已测试场景的 Set（只统计成功的测试）
  const testedScenarios = new Set<string>();
  for (const result of results) {
    if (result.status === 'success' && result.scenario.startsWith('matrix/')) {
      testedScenarios.add(result.scenario);
    }
  }

  // 按提供商分组统计
  const providerCoverages: ProviderMatrixCoverage[] = [];
  const providers = getAllProviders();

  for (const provider of providers) {
    const providerItems = allMatrixItems.filter((item) => item.provider === provider);
    const pendingItems: MatrixCoverageItem[] = [];
    let testedCount = 0;

    for (const item of providerItems) {
      const scenario = generateScenarioName(item);
      const isTested = testedScenarios.has(scenario);

      if (!isTested) {
        pendingItems.push({
          provider: item.provider,
          model: item.model,
          voice: item.voice,
          format: item.format,
          sampleRate: item.sampleRate,
          status: 'pending',
          scenario,
        });
      } else {
        testedCount++;
      }
    }

    const totalScenarios = providerItems.length;
    providerCoverages.push({
      provider,
      displayName: getProviderDisplayName(provider),
      totalScenarios,
      testedScenarios: testedCount,
      pendingScenarios: pendingItems.length,
      coverageRate: totalScenarios > 0 ? testedCount / totalScenarios : 0,
      pendingItems,
    });
  }

  // 计算总计
  const totalScenarios = allMatrixItems.length;
  const testedScenariosCount = testedScenarios.size;

  return {
    totalScenarios,
    testedScenarios: testedScenariosCount,
    pendingScenarios: totalScenarios - testedScenariosCount,
    totalCoverageRate: totalScenarios > 0 ? testedScenariosCount / totalScenarios : 0,
    byProvider: providerCoverages,
  };
}

/**
 * 解析命令行参数
 */
function parseCliArgs(): {
  providers: string[] | undefined;
  testType: 'tts' | 'asr' | 'all';
  fromDate: string | undefined;
  toDate: string | undefined;
  help: boolean;
} {
  const args = process.argv.slice(2).filter((arg, index) => !(index === 0 && arg === '--'));

  const { values } = parseArgs({
    args,
    options: {
      provider: { type: 'string', multiple: true, short: 'p' },
      type: { type: 'string', default: 'all', short: 't' },
      'from-date': { type: 'string' },
      'to-date': { type: 'string' },
      help: { type: 'boolean', short: 'h' },
    },
    strict: false,
  });

  if (values.help) {
    console.log(`
用法: pnpm benchmark analyze -- [选项]

选项:
  -p, --provider <name>   筛选指定服务商
  -t, --type <type>       测试类型 (tts | asr | all)，默认 all
  --from-date <date>      开始日期 (YYYY-MM-DD)
  --to-date <date>        结束日期 (YYYY-MM-DD)
  -h, --help              显示帮助信息

示例:
  pnpm benchmark analyze                         # 分析所有数据
  pnpm benchmark analyze -- -p qwen              # 只分析 qwen
  pnpm benchmark analyze -- -t asr               # 只分析 ASR
  pnpm benchmark analyze -- --from 2026-03-01    # 分析指定日期之后的数据
`);
    process.exit(0);
  }

  // 处理 provider 参数
  const providers = values.provider
    ?.flatMap((p) => (typeof p === 'string' ? p.split(',') : []))
    .map((p) => p.trim())
    .filter(Boolean);

  // 验证 type 参数
  const testType = values.type as 'tts' | 'asr' | 'all';
  if (!['tts', 'asr', 'all'].includes(testType)) {
    console.error(`❌ 无效的测试类型: ${testType}，可选值: tts, asr, all`);
    process.exit(1);
  }

  return {
    providers,
    testType,
    fromDate: values['from-date'] as string | undefined,
    toDate: values['to-date'] as string | undefined,
    help: false,
  };
}

/**
 * 主函数
 */
export async function analyze(options?: {
  providers?: string[];
  testType?: 'tts' | 'asr' | 'all';
  fromDate?: string;
  toDate?: string;
}): Promise<void> {
  // 如果没有提供选项，从命令行解析
  const args = options
    ? {
        providers: options.providers,
        testType: options.testType || 'all',
        fromDate: options.fromDate,
        toDate: options.toDate,
        help: false,
      }
    : parseCliArgs();

  console.log('📊 Univoice Benchmark 结果分析');
  console.log('================================\n');

  // 构建筛选条件
  const filter = {
    providers: args.providers,
    testType: args.testType === 'all' ? undefined : args.testType,
    fromDate: args.fromDate,
    toDate: args.toDate,
  };

  // 统计结果
  const counts = countResults(filter);
  console.log(`找到 ${counts.total} 条测试结果`);

  if (counts.total === 0) {
    console.log('\n⚠️ 没有找到匹配的测试结果');
    console.log('   请先运行测试: pnpm benchmark run');
    return;
  }

  // 显示分组统计
  console.log('\n按提供商统计:');
  for (const [provider, count] of Object.entries(counts.byProvider)) {
    console.log(`  - ${provider}: ${count} 条`);
  }

  // 加载结果
  console.log('\n正在加载测试结果...');
  const results = loadResults(filter);
  console.log(`已加载 ${results.length} 条结果`);

  // 分析结果
  console.log('\n正在分析结果...');
  const report = generateReport(results);

  // 保存报告
  const latestDir = getLatestDir();
  ensureDir(latestDir);

  const jsonPath = join(latestDir, 'benchmark.json');
  writeFileSync(jsonPath, JSON.stringify(report, null, 2));
  console.log(`\n✓ JSON 报告已保存: ${jsonPath}`);

  // 生成 Markdown 报告
  const mdReport = generateMarkdownReport(report);
  const mdPath = join(latestDir, 'benchmark.md');
  writeFileSync(mdPath, mdReport);
  console.log(`✓ Markdown 报告已保存: ${mdPath}`);

  // 同步到 README.md
  try {
    const { syncToReadme } = await import('./utils/report-generator');
    syncToReadme(mdReport);
  } catch {
    console.log('⚠️ 无法同步到 README.md');
  }

  // 显示摘要
  const ttsCount = results.filter((r) => r.testType === 'tts').length;
  const asrCount = results.filter((r) => r.testType === 'asr').length;
  console.log(`\n✅ 分析完成!`);
  console.log(`   - TTS 测试: ${ttsCount} 条`);
  console.log(`   - ASR 测试: ${asrCount} 条`);

  // 显示矩阵覆盖率摘要
  if (report.matrixCoverage) {
    const coverage = report.matrixCoverage;
    console.log(`\n📊 测试矩阵覆盖率:`);
    console.log(
      `   - 总覆盖率: ${(coverage.totalCoverageRate * 100).toFixed(1)}% (${coverage.testedScenarios}/${coverage.totalScenarios})`
    );
    for (const pc of coverage.byProvider) {
      const rate = (pc.coverageRate * 100).toFixed(1);
      console.log(`   - ${pc.displayName}: ${rate}% (${pc.testedScenarios}/${pc.totalScenarios})`);
    }
  }
}

// 直接运行时执行
if (import.meta.url === `file://${process.argv[1]}`) {
  analyze().catch((error) => {
    console.error('分析失败:', error);
    process.exit(1);
  });
}
