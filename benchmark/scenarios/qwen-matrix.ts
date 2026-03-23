// @ts-nocheck
/* biome-ignore format: custom formatting */
/**
 * Qwen TTS 矩阵测试场景
 * 测试不同模型、音色、编码、采样率的组合
 */
import type {
  BenchmarkResult,
  MatrixFilter,
  MatrixItem,
  MatrixScenarioConfig,
  QwenMatrixConfig,
} from '../metrics/types';

import { qwenMatrixItems } from './qwen-matrix-data';

/**
 * 场景配置
 */
export const matrixScenarioConfig: MatrixScenarioConfig = {
  name: 'qwen-matrix',
  description: 'Qwen TTS 矩阵测试：覆盖不同模型、音色、编码、采样率的组合',
  testType: 'tts',
  iterations: 3,
  timeout: 120000,
};

/**
 * 生成矩阵测试的场景标识
 * 格式：matrix/<model>/<voice>/<format>-<sampleRate>
 */
export function generateMatrixScenarioName(matrixConfig: QwenMatrixConfig): string {
  return `matrix/${matrixConfig.model}/${matrixConfig.voice}/${matrixConfig.format}-${matrixConfig.sampleRate}`;
}

/**
 * 计算矩阵测试的总组合数
 */
export function calculateMatrixCombinations(): number {
  return qwenMatrixItems.length;
}

/**
 * 打印矩阵测试计划摘要
 */
export function printMatrixSummary(): void {
  const combinations = calculateMatrixCombinations();
  const totalTests = combinations * matrixScenarioConfig.iterations;

  console.log('\n=== Qwen TTS 矩阵测试计划 ===\n');
  console.log('矩阵测试列表:');
  for (const item of qwenMatrixItems) {
    console.log(`  - ${item.model}/${item.voice}/${item.format}/${item.sampleRate}Hz`);
  }
  console.log(`\n矩阵项数量: ${combinations}`);
  console.log(`每项迭代次数: ${matrixScenarioConfig.iterations}`);
  console.log(`总测试数量: ${totalTests}`);
  console.log('');
}

/**
 * 过滤矩阵测试项
 * @param items 矩阵测试项列表
 * @param filter 过滤条件
 * @returns 过滤后的矩阵测试项列表
 */
export function filterMatrixItems(items: MatrixItem[], filter?: MatrixFilter): MatrixItem[] {
  if (!filter) {
    return items;
  }

  return items.filter((item) => {
    // 模型过滤
    if (filter.model && filter.model.length > 0) {
      if (!filter.model.includes(item.model)) {
        return false;
      }
    }

    // 音色过滤
    if (filter.voice && filter.voice.length > 0) {
      if (!filter.voice.includes(item.voice)) {
        return false;
      }
    }

    // 格式过滤
    if (filter.format && filter.format.length > 0) {
      if (!filter.format.includes(item.format)) {
        return false;
      }
    }

    // 采样率过滤
    if (filter.sampleRate && filter.sampleRate.length > 0) {
      if (!filter.sampleRate.includes(item.sampleRate)) {
        return false;
      }
    }

    return true;
  });
}

/**
 * 运行矩阵测试场景
 * 此函数由 run.ts 调用，实际执行测试
 */
export async function runQwenMatrixScenario(options?: {
  iterations?: number;
  /** 过滤条件 */
  filter?: MatrixFilter;
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
  const { textFixtures } = await import('../fixtures/texts');

  const results: BenchmarkResult[] = [];
  const iterations = options?.iterations || matrixScenarioConfig.iterations;

  // 使用第一个文本进行测试
  const text = textFixtures[0];
  if (!text) {
    throw new Error('没有可用的文本测试数据');
  }

  // 应用过滤条件
  const filteredItems = filterMatrixItems(qwenMatrixItems, options?.filter);

  if (filteredItems.length === 0) {
    console.warn('⚠️ 没有匹配的矩阵测试项，请检查过滤条件');
    return results;
  }

  // 打印过滤后的摘要
  console.log('\n=== Qwen TTS 矩阵测试计划 ===\n');
  if (options?.filter) {
    console.log('过滤条件:');
    if (options.filter.model) {
      console.log(`  - 模型: ${options.filter.model.join(', ')}`);
    }
    if (options.filter.voice) {
      console.log(`  - 音色: ${options.filter.voice.join(', ')}`);
    }
    if (options.filter.format) {
      console.log(`  - 格式: ${options.filter.format.join(', ')}`);
    }
    if (options.filter.sampleRate) {
      console.log(`  - 采样率: ${options.filter.sampleRate.join(', ')} Hz`);
    }
    console.log('');
  }
  console.log('矩阵测试列表:');
  for (const item of filteredItems) {
    console.log(`  - ${item.model}/${item.voice}/${item.format}/${item.sampleRate}Hz`);
  }
  console.log(`\n矩阵项数量: ${filteredItems.length} (原始: ${qwenMatrixItems.length})`);
  console.log(`每项迭代次数: ${iterations}`);
  console.log(`总测试数量: ${filteredItems.length * iterations}`);
  console.log('');

  let currentTest = 0;
  const totalTests = filteredItems.length * iterations;

  console.log(`开始执行矩阵测试...\n`);

  for (const matrixConfig of filteredItems) {
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
