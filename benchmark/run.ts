/**
 * Benchmark 运行入口
 * 用于执行性能测试
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { generateAudioFixtures, getAudioFixtures, hasAudioFixtures } from './fixtures/audios';
import type { BenchmarkResult } from './metrics/types';
import { runASRSuite } from './runners/asr-runner';
import { runTTSSuite } from './runners/tts-runner';
import { generateMockReport } from './utils/mock-generator';
import { generateMarkdownReport, syncToReadme } from './utils/report-generator';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

/**
 * 确保目录存在
 */
function ensureDir(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

/**
 * 解析命令行参数
 */
export function parseRunArgs(): {
  providers: string[] | undefined;
  type: 'tts' | 'asr' | 'all';
  iterations: number;
  dryRun: boolean;
  atomicSave: boolean;
} {
  // 过滤掉 pnpm 传递的开头 '--'
  const args = process.argv.slice(2).filter((arg, index) => !(index === 0 && arg === '--'));

  const { values } = parseArgs({
    args,
    options: {
      provider: { type: 'string', multiple: true, short: 'p' },
      type: { type: 'string', default: 'all', short: 't' },
      iterations: { type: 'string', default: '3', short: 'i' },
      'dry-run': { type: 'boolean', short: 'd' },
      'no-atomic': { type: 'boolean' },
      help: { type: 'boolean', short: 'h' },
    },
    strict: false,
  });

  // 显示帮助信息
  if (values.help) {
    console.log(`
用法: pnpm benchmark run -- [选项]

选项:
  -p, --provider <name>   指定服务商（可多次使用，支持逗号分隔）
                          TTS: doubao, qwen, minimax, glm
                          ASR: doubao, qwen, glm
  -t, --type <type>       测试类型 (tts | asr | all)，默认 all
  -i, --iterations <n>    迭代次数，默认 3
  -d, --dry-run           生成模拟数据预览报告，不实际运行测试
  --no-atomic             禁用原子化保存（不推荐）
  -h, --help              显示帮助信息

示例:
  pnpm benchmark run --                         # 测试所有服务商
  pnpm benchmark run -- -p qwen                 # 只测试 qwen
  pnpm benchmark run -- -p qwen -p doubao       # 测试 qwen 和 doubao
  pnpm benchmark run -- -p qwen,doubao          # 测试 qwen 和 doubao（逗号分隔）
  pnpm benchmark run -- -t tts                  # 只测试 TTS
  pnpm benchmark run -- -t tts -p qwen          # 只测试 qwen 的 TTS
  pnpm benchmark run -- -i 5                    # 每个测试迭代 5 次
  pnpm benchmark run -- --dry-run               # 预览模拟报告

注意: pnpm 需要使用 "--" 分隔符来传递参数给脚本
`);
    process.exit(0);
  }

  // 处理 provider 参数（支持逗号分隔）
  const providers = values.provider
    ?.flatMap((p) => (typeof p === 'string' ? p.split(',') : []))
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

  return {
    providers,
    type,
    iterations,
    dryRun: Boolean(values['dry-run']),
    atomicSave: !values['no-atomic'],
  };
}

/**
 * 运行测试
 */
export async function run(options?: {
  providers?: string[];
  type?: 'tts' | 'asr' | 'all';
  iterations?: number;
  dryRun?: boolean;
  atomicSave?: boolean;
}): Promise<BenchmarkResult[]> {
  // 如果没有提供选项，从命令行解析
  const args = options
    ? {
        providers: options.providers,
        type: options.type || 'all',
        iterations: options.iterations || 3,
        dryRun: options.dryRun || false,
        atomicSave: options.atomicSave ?? true,
      }
    : parseRunArgs();

  console.log('🚀 Univoice Benchmark 性能测试');
  console.log('================================');
  if (args.dryRun) {
    console.log('📋 模式: 模拟预览 (dry-run)');
  }
  if (args.providers) {
    console.log(`📋 指定服务商: ${args.providers.join(', ')}`);
  }
  console.log(`📊 测试类型: ${args.type}`);
  console.log(`🔄 迭代次数: ${args.iterations}\n`);

  const startTime = Date.now();

  // 运行测试
  let allResults: BenchmarkResult[];

  if (args.dryRun) {
    // 使用模拟数据
    console.log('📝 生成模拟测试数据...\n');
    const mockReport = generateMockReport({
      providers: args.providers,
      type: args.type,
      iterations: args.iterations,
    });
    allResults = mockReport.results;

    // 直接使用已生成的报告
    const report = mockReport;

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

    // 同步到 README.md
    syncToReadme(mdReport);

    const totalTime = Date.now() - startTime;
    const ttsCount = allResults.filter((r) => r.testType === 'tts').length;
    const asrCount = allResults.filter((r) => r.testType === 'asr').length;
    console.log(`\n✅ 模拟完成! 总耗时: ${(totalTime / 1000).toFixed(1)}s`);
    console.log(`   - TTS 模拟: ${ttsCount} 次`);
    console.log(`   - ASR 模拟: ${asrCount} 次`);

    return allResults;
  }

  allResults = [];

  // TTS 测试
  if (args.type === 'tts' || args.type === 'all') {
    console.log('📝 开始 TTS 性能测试...\n');
    const ttsResults = await runTTSSuite({
      providers: args.providers,
      iterations: args.iterations,
      atomicSave: args.atomicSave,
    });
    allResults.push(...ttsResults);
  }

  // ASR 测试
  if (args.type === 'asr' || args.type === 'all') {
    console.log('\n🎤 开始 ASR 性能测试...\n');

    // 检查并生成音频
    if (!hasAudioFixtures()) {
      console.log('📝 音频文件不存在，正在生成...\n');
      await generateAudioFixtures();
    }

    const audioFiles = await getAudioFixtures();
    if (audioFiles.length === 0) {
      console.log('⚠️ 无法获取音频文件，跳过 ASR 测试');
    } else {
      const asrResults = await runASRSuite({
        providers: args.providers,
        iterations: args.iterations,
        audioFiles,
        atomicSave: args.atomicSave,
      });
      allResults.push(...asrResults);
    }
  }

  const totalTime = Date.now() - startTime;
  const ttsCount = allResults.filter((r) => r.testType === 'tts').length;
  const asrCount = allResults.filter((r) => r.testType === 'asr').length;
  console.log(`\n✅ 测试完成! 总耗时: ${(totalTime / 1000).toFixed(1)}s`);
  console.log(`   - TTS 测试: ${ttsCount} 次`);
  console.log(`   - ASR 测试: ${asrCount} 次`);

  return allResults;
}

// 直接运行时执行
if (import.meta.url === `file://${process.argv[1]}`) {
  run().catch((error) => {
    console.error('测试失败:', error);
    process.exit(1);
  });
}
