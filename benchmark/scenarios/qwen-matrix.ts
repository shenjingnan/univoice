/**
 * Qwen TTS 矩阵测试场景
 * 测试不同模型、音色、编码、采样率、文本长度的组合
 */
import { textFixtures } from '../fixtures/texts';
import type {
  BenchmarkResult,
  MatrixScenarioConfig,
  QwenMatrixConfig,
  TextFixture,
} from '../metrics/types';

/**
 * 场景配置
 */
export const matrixScenarioConfig: MatrixScenarioConfig = {
  name: 'qwen-matrix',
  description: 'Qwen TTS 矩阵测试：覆盖不同模型、音色、编码、采样率、文本长度的组合',
  testType: 'tts',
  // 模型与音色兼容性
  modelVoiceCompatibility: [
    {
      model: 'cosyvoice-v3-flash',
      voices: ['longanyang'],
    },
    {
      model: 'cosyvoice-v3-plus',
      voices: ['longanyang'],
    },
    {
      model: 'cosyvoice-v2',
      voices: ['longyingxiao'],
    },
  ],
  formats: ['pcm', 'opus'],
  sampleRates: [16000, 24000, 48000],
  textCategories: ['short', 'medium', 'long'],
  iterations: 3,
  timeout: 120000,
};

/**
 * 生成所有有效的矩阵配置组合
 */
export function generateMatrixConfigs(config: MatrixScenarioConfig): QwenMatrixConfig[] {
  const matrix: QwenMatrixConfig[] = [];

  for (const modelVoice of config.modelVoiceCompatibility) {
    for (const voice of modelVoice.voices) {
      for (const format of config.formats) {
        for (const sampleRate of config.sampleRates) {
          for (const textCategory of config.textCategories) {
            matrix.push({
              provider: 'qwen',
              model: modelVoice.model as QwenMatrixConfig['model'],
              voice,
              format,
              sampleRate,
              textCategory,
            });
          }
        }
      }
    }
  }

  return matrix;
}

/**
 * 获取指定分类的文本
 */
export function getTextsByCategory(category: 'short' | 'medium' | 'long'): TextFixture[] {
  return textFixtures.filter((t) => t.category === category);
}

/**
 * 生成矩阵测试的场景标识
 * 格式：matrix/<model>/<voice>/<format>-<sampleRate>/<textCategory>
 */
export function generateMatrixScenarioName(matrixConfig: QwenMatrixConfig): string {
  return `matrix/${matrixConfig.model}/${matrixConfig.voice}/${matrixConfig.format}-${matrixConfig.sampleRate}/${matrixConfig.textCategory}`;
}

/**
 * 计算矩阵测试的总组合数
 */
export function calculateMatrixCombinations(config: MatrixScenarioConfig): number {
  let totalVoices = 0;
  for (const modelVoice of config.modelVoiceCompatibility) {
    totalVoices += modelVoice.voices.length;
  }

  return (
    totalVoices * config.formats.length * config.sampleRates.length * config.textCategories.length
  );
}

/**
 * 打印矩阵测试计划摘要
 */
export function printMatrixSummary(config: MatrixScenarioConfig): void {
  const combinations = calculateMatrixCombinations(config);
  const totalTests = combinations * config.iterations;

  console.log('\n=== Qwen TTS 矩阵测试计划 ===\n');
  console.log(`模型与音色兼容性:`);
  for (const modelVoice of config.modelVoiceCompatibility) {
    console.log(`  - ${modelVoice.model}: ${modelVoice.voices.join(', ')}`);
  }
  console.log(`\n编码格式: ${config.formats.join(', ')}`);
  console.log(`采样率: ${config.sampleRates.map((r) => `${r}Hz`).join(', ')}`);
  console.log(`文本长度分类: ${config.textCategories.join(', ')}`);
  console.log(`\n组合数量: ${combinations}`);
  console.log(`每组合迭代次数: ${config.iterations}`);
  console.log(`总测试数量: ${totalTests}`);
  console.log('');
}

/**
 * 运行矩阵测试场景
 * 此函数由 run.ts 调用，实际执行测试
 */
export async function runQwenMatrixScenario(options?: {
  iterations?: number;
  /** 进度回调 */
  onProgress?: (
    current: number,
    total: number,
    config: QwenMatrixConfig,
    result: BenchmarkResult
  ) => void;
}): Promise<BenchmarkResult[]> {
  // 动态导入以避免循环依赖
  const { runTTSTestForMatrix } = await import('../runners/tts-runner');

  const results: BenchmarkResult[] = [];
  const iterations = options?.iterations || matrixScenarioConfig.iterations;
  const matrixConfigs = generateMatrixConfigs(matrixScenarioConfig);

  // 获取所有文本
  const allTexts = {
    short: getTextsByCategory('short'),
    medium: getTextsByCategory('medium'),
    long: getTextsByCategory('long'),
  };

  printMatrixSummary(matrixScenarioConfig);

  let currentTest = 0;
  const totalTests = matrixConfigs.length * iterations;

  console.log(`开始执行矩阵测试...\n`);

  for (const matrixConfig of matrixConfigs) {
    const texts = allTexts[matrixConfig.textCategory];

    // 每个分类只测试第一个文本
    const text = texts[0];

    if (!text) {
      console.warn(`警告: 没有找到 ${matrixConfig.textCategory} 分类的文本，跳过`);
      continue;
    }

    const scenarioName = generateMatrixScenarioName(matrixConfig);

    for (let i = 0; i < iterations; i++) {
      currentTest++;

      const result = await runTTSTestForMatrix(matrixConfig, text, scenarioName);
      results.push(result);

      // 打印进度
      const status = result.status === 'success' ? '✓' : '✗';
      console.log(
        `[${currentTest}/${totalTests}] ${scenarioName} ` +
          `#${i + 1}: ${status} 首包=${result.latency.firstChunk}ms, 总计=${result.latency.total}ms`
      );

      // 回调
      options?.onProgress?.(currentTest, totalTests, matrixConfig, result);

      // 测试间隔，避免请求过快
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  console.log(`\n矩阵测试完成! 共执行 ${currentTest} 次测试`);

  return results;
}
