/**
 * Qwen TTS 矩阵测试场景（向后兼容层）
 *
 * 此文件重定向到新的 matrix 模块，保持 API 兼容性
 */
import type { BenchmarkResult, MatrixFilter, MatrixItem, QwenMatrixConfig } from '../metrics/types';

import {
  qwenScenarioConfig as matrixScenarioConfig,
  QWEN_MATRIX_CONFIG,
  qwenMatrixItems,
  runProviderMatrixScenario,
} from './matrix';

// 重新导出数据
export { matrixScenarioConfig, qwenMatrixItems };

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
 */
export function filterMatrixItems(items: MatrixItem[], filter?: MatrixFilter): MatrixItem[] {
  if (!filter) {
    return items;
  }

  return items.filter((item) => {
    if (filter.model && filter.model.length > 0) {
      if (!filter.model.includes(item.model)) {
        return false;
      }
    }
    if (filter.voice && filter.voice.length > 0) {
      if (!filter.voice.includes(item.voice)) {
        return false;
      }
    }
    if (filter.format && filter.format.length > 0) {
      if (!filter.format.includes(item.format)) {
        return false;
      }
    }
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
  filter?: MatrixFilter;
  interval?: number;
  onProgress?: (
    current: number,
    total: number,
    config: QwenMatrixConfig,
    result: BenchmarkResult
  ) => void;
}): Promise<BenchmarkResult[]> {
  return runProviderMatrixScenario(QWEN_MATRIX_CONFIG, {
    ...options,
    provider: 'qwen',
  });
}
