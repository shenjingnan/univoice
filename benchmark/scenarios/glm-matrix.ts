/**
 * GLM TTS 矩阵测试场景（向后兼容层）
 *
 * 此文件重定向到新的 matrix 模块，保持 API 兼容性
 */
import type { BenchmarkResult, GlmMatrixConfig, MatrixFilter, MatrixItem } from '../metrics/types';

import {
  GLM_MATRIX_CONFIG,
  glmMatrixItems,
  glmScenarioConfig as matrixScenarioConfig,
  runProviderMatrixScenario,
} from './matrix';

// 重新导出数据
export { glmMatrixItems, matrixScenarioConfig };

/**
 * 生成矩阵测试的场景标识
 */
export function generateMatrixScenarioName(matrixConfig: GlmMatrixConfig): string {
  return `matrix/${matrixConfig.model}/${matrixConfig.voice}/${matrixConfig.format}-${matrixConfig.sampleRate}`;
}

/**
 * 计算矩阵测试的总组合数
 */
export function calculateMatrixCombinations(): number {
  return glmMatrixItems.length;
}

/**
 * 打印矩阵测试计划摘要
 */
export function printMatrixSummary(): void {
  const combinations = calculateMatrixCombinations();
  const totalTests = combinations * matrixScenarioConfig.iterations;

  console.log('\n=== GLM TTS 矩阵测试计划 ===\n');
  console.log('矩阵测试列表:');
  for (const item of glmMatrixItems) {
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
 */
export async function runGlmMatrixScenario(options?: {
  iterations?: number;
  filter?: MatrixFilter;
  interval?: number;
  onProgress?: (
    current: number,
    total: number,
    config: GlmMatrixConfig,
    result: BenchmarkResult
  ) => void;
}): Promise<BenchmarkResult[]> {
  return runProviderMatrixScenario(GLM_MATRIX_CONFIG, {
    ...options,
    provider: 'glm',
  });
}
