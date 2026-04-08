/**
 * Benchmark 运行入口
 * 用于执行性能测试
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { generateAudioFixtures, getAudioFixtures, hasAudioFixtures } from './fixtures/audios';
import type { BenchmarkResult, MatrixFilter } from './metrics/types';
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
  scenario: string | undefined;
  matrixFilter: MatrixFilter | undefined;
  interval: number;
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
      scenario: { type: 'string', short: 's' },
      model: { type: 'string' },
      voice: { type: 'string' },
      format: { type: 'string' },
      'sample-rate': { type: 'string' },
      interval: { type: 'string', default: '1000' },
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
                          TTS: doubao, qwen, minimax, glm, xfyun
                          ASR: doubao, qwen, glm, xfyun
  -t, --type <type>       测试类型 (tts | asr | all)，默认 all
  -i, --iterations <n>    迭代次数，默认 3
  -s, --scenario <name>   测试场景 (qwen-matrix)，默认常规测试
  -d, --dry-run           生成模拟数据预览报告，不实际运行测试
  --no-atomic             禁用原子化保存（不推荐）
  --interval <ms>         任务间隔时间（毫秒），默认 1000
  -h, --help              显示帮助信息

矩阵测试过滤选项 (用于矩阵测试场景):
  --model <models>        按模型过滤（支持逗号分隔多个）
                          例如: --model cosyvoice-v3-flash,cosyvoice-v2
  --voice <voices>        按音色过滤（支持逗号分隔多个）
                          例如: --voice longanyang,longyingxiao
  --format <formats>      按编码格式过滤（支持逗号分隔多个）
                          例如: --format pcm,opus
  --sample-rate <rates>   按采样率过滤（支持逗号分隔多个）
                          例如: --sample-rate 16000,24000

场景说明:
  qwen-matrix             Qwen TTS 矩阵测试，覆盖多种模型、音色、编码、采样率组合
  doubao-matrix           Doubao TTS 矩阵测试，覆盖多种模型、音色、编码、采样率组合
  glm-matrix              GLM TTS 矩阵测试，覆盖多种模型、音色、编码、采样率组合
  minimax-matrix          Minimax TTS 矩阵测试，覆盖多种模型、音色、编码、采样率组合
  qwen-asr-matrix         Qwen ASR 矩阵测试，覆盖多种模型、语言、格式、采样率组合
  xfyun-matrix            Xfyun TTS 矩阵测试，覆盖超拟人模型不同采样率组合
  xfyun-asr-matrix        Xfyun ASR 矩阵测试，覆盖语音听写模型

示例:
  pnpm benchmark run --                         # 测试所有服务商
  pnpm benchmark run -- -p qwen                 # 只测试 qwen
  pnpm benchmark run -- -p qwen -p doubao       # 测试 qwen 和 doubao
  pnpm benchmark run -- -p qwen,doubao          # 测试 qwen 和 doubao（逗号分隔）
  pnpm benchmark run -- -t tts                  # 只测试 TTS
  pnpm benchmark run -- -t tts -p qwen          # 只测试 qwen 的 TTS
  pnpm benchmark run -- -i 5                    # 每个测试迭代 5 次
  pnpm benchmark run -- --dry-run               # 预览模拟报告
  pnpm benchmark run -- -s qwen-matrix          # 运行 Qwen TTS 矩阵测试
  pnpm benchmark run -- -s qwen-matrix -i 3     # 矩阵测试，每组合 3 次迭代
  pnpm benchmark run -- -s qwen-matrix --model cosyvoice-v1  # 只测试 cosyvoice-v1 模型
  pnpm benchmark run -- -s qwen-matrix --format pcm --sample-rate 16000  # 只测试 PCM 16kHz
  pnpm benchmark run -- -s glm-matrix           # 运行 GLM TTS 矩阵测试
  pnpm benchmark run -- -s minimax-matrix       # 运行 Minimax TTS 矩阵测试
  pnpm benchmark run -- -s qwen-matrix --interval 2000  # 矩阵测试间隔 2 秒
  pnpm benchmark run -- -s qwen-asr-matrix      # 运行 Qwen ASR 矩阵测试
  pnpm benchmark run -- -s xfyun-matrix          # 运行 Xfyun TTS 矩阵测试
  pnpm benchmark run -- -s xfyun-asr-matrix      # 运行 Xfyun ASR 矩阵测试

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

  // 解析间隔时间
  const interval = Number.parseInt(values.interval as string, 10);
  if (Number.isNaN(interval) || interval < 0) {
    console.error(`❌ 无效的间隔时间: ${values.interval}，必须为非负整数`);
    process.exit(1);
  }

  // 解析矩阵测试过滤参数
  let matrixFilter: MatrixFilter | undefined;
  if (values.model || values.voice || values.format || values['sample-rate']) {
    matrixFilter = {};

    if (values.model) {
      matrixFilter.model = String(values.model)
        .split(',')
        .map((m) => m.trim())
        .filter(Boolean);
    }

    if (values.voice) {
      matrixFilter.voice = String(values.voice)
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean);
    }

    if (values.format) {
      matrixFilter.format = String(values.format)
        .split(',')
        .map((f) => f.trim())
        .filter(Boolean);
    }

    if (values['sample-rate']) {
      const rates = String(values['sample-rate'])
        .split(',')
        .map((r) => Number.parseInt(r.trim(), 10))
        .filter((r) => !Number.isNaN(r));
      if (rates.length > 0) {
        matrixFilter.sampleRate = rates;
      }
    }
  }

  return {
    providers,
    type,
    iterations,
    dryRun: Boolean(values['dry-run']),
    atomicSave: !values['no-atomic'],
    scenario: values.scenario as string | undefined,
    matrixFilter,
    interval,
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
  scenario?: string;
  matrixFilter?: MatrixFilter;
  interval?: number;
}): Promise<BenchmarkResult[]> {
  // 如果没有提供选项，从命令行解析
  const args = options
    ? {
        providers: options.providers,
        type: options.type || 'all',
        iterations: options.iterations || 3,
        dryRun: options.dryRun || false,
        atomicSave: options.atomicSave ?? true,
        scenario: options.scenario,
        matrixFilter: options.matrixFilter,
        interval: options.interval ?? 1000,
      }
    : parseRunArgs();

  console.log('🚀 Univoice Benchmark 性能测试');
  console.log('================================');
  if (args.dryRun) {
    console.log('📋 模式: 模拟预览 (dry-run)');
  }
  if (args.scenario) {
    console.log(`📋 测试场景: ${args.scenario}`);
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

  // ASR 矩阵测试场景
  if (args.scenario?.endsWith('-asr-matrix')) {
    const providerName = args.scenario.replace('-asr-matrix', '');
    const providerDisplayName: Record<string, string> = {
      qwen: 'Qwen',
      doubao: 'Doubao',
      glm: 'GLM',
      minimax: 'Minimax',
      xfyun: '科大讯飞',
    };

    console.log(
      `📊 运行 ${providerDisplayName[providerName] || providerName} ASR 矩阵测试场景...\n`
    );

    if (args.matrixFilter) {
      console.log('📋 矩阵过滤条件:');
      if (args.matrixFilter.model) {
        console.log(`   - 模型: ${args.matrixFilter.model.join(', ')}`);
      }
      if (args.matrixFilter.format) {
        console.log(`   - 格式: ${args.matrixFilter.format.join(', ')}`);
      }
      if (args.matrixFilter.sampleRate) {
        console.log(`   - 采样率: ${args.matrixFilter.sampleRate.join(', ')} Hz`);
      }
      console.log('');
    }

    // 检查并生成音频
    if (!hasAudioFixtures()) {
      console.log('📝 音频文件不存在，正在生成...\n');
      await generateAudioFixtures();
    }

    const audioFiles = await getAudioFixtures();
    if (audioFiles.length === 0) {
      console.log('⚠️ 无法获取音频文件，跳过 ASR 矩阵测试');
      return allResults;
    }

    // 使用第一个音频文件进行测试
    let audioFile = audioFiles[0];

    // 使用 ASR 矩阵测试运行器
    const { runASRMatrixScenario, getASRProviderMatrixConfig } = await import(
      './scenarios/matrix/asr'
    );
    const providerConfig = getASRProviderMatrixConfig(providerName);

    if (!providerConfig) {
      console.error(`❌ 未知的 ASR 矩阵测试提供商: ${providerName}`);
      process.exit(1);
    }

    // 检查 provider 是否支持 PCM 格式，不支持则回退到 MP3
    const supportsPCM = providerConfig.items.some((item) => item.format === 'pcm');
    if (!supportsPCM && audioFile.format === 'pcm') {
      const mp3Path = audioFile.path.replace(/\.pcm$/, '.mp3');
      if (existsSync(mp3Path)) {
        audioFile = { ...audioFile, path: mp3Path, format: 'mp3' };
      }
    }
    console.log(`📁 使用音频文件: ${audioFile.path}\n`);

    // 转换过滤条件为 ASR 格式
    const asrFilter = args.matrixFilter
      ? {
          model: args.matrixFilter.model,
          format: args.matrixFilter.format,
          sampleRate: args.matrixFilter.sampleRate,
        }
      : undefined;

    const matrixResults = await runASRMatrixScenario(audioFile.path, {
      providers: [providerName],
      filter: asrFilter,
      iterations: args.iterations,
      interval: args.interval,
    });
    allResults.push(...matrixResults);

    const totalTime = Date.now() - startTime;
    console.log(`\n✅ ASR 矩阵测试完成! 总耗时: ${(totalTime / 1000).toFixed(1)}s`);
    console.log(`   - 总测试次数: ${allResults.length}`);

    return allResults;
  }

  // TTS 矩阵测试场景（统一处理）
  if (args.scenario?.endsWith('-matrix')) {
    const providerName = args.scenario.replace('-matrix', '');
    const providerDisplayName: Record<string, string> = {
      qwen: 'Qwen',
      doubao: 'Doubao',
      glm: 'GLM',
      minimax: 'Minimax',
      xfyun: '科大讯飞',
    };

    console.log(
      `📊 运行 ${providerDisplayName[providerName] || providerName} TTS 矩阵测试场景...\n`
    );

    if (args.matrixFilter) {
      console.log('📋 矩阵过滤条件:');
      if (args.matrixFilter.model) {
        console.log(`   - 模型: ${args.matrixFilter.model.join(', ')}`);
      }
      if (args.matrixFilter.voice) {
        console.log(`   - 音色: ${args.matrixFilter.voice.join(', ')}`);
      }
      if (args.matrixFilter.format) {
        console.log(`   - 格式: ${args.matrixFilter.format.join(', ')}`);
      }
      if (args.matrixFilter.sampleRate) {
        console.log(`   - 采样率: ${args.matrixFilter.sampleRate.join(', ')} Hz`);
      }
      console.log('');
    }

    // 使用新的统一矩阵测试运行器
    const { runMatrixScenario, getProviderConfig } = await import('./scenarios/matrix');
    const providerConfig = getProviderConfig(providerName);

    if (!providerConfig) {
      console.error(`❌ 未知的矩阵测试提供商: ${providerName}`);
      process.exit(1);
    }

    const matrixResults = await runMatrixScenario({
      providers: [providerName],
      filter: args.matrixFilter,
      iterations: args.iterations,
      interval: args.interval,
    });
    allResults.push(...matrixResults);

    const totalTime = Date.now() - startTime;
    console.log(`\n✅ 矩阵测试完成! 总耗时: ${(totalTime / 1000).toFixed(1)}s`);
    console.log(`   - 总测试次数: ${allResults.length}`);

    return allResults;
  }

  // TTS 测试
  if (args.type === 'tts' || args.type === 'all') {
    console.log('📝 开始 TTS 性能测试...\n');
    const ttsResults = await runTTSSuite({
      providers: args.providers,
      iterations: args.iterations,
      atomicSave: args.atomicSave,
      interval: args.interval,
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
        interval: args.interval,
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
