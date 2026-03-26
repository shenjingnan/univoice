/**
 * ASR 矩阵测试工具函数
 */
import type { ASRMatrixFilter, ASRMatrixItem } from '../../../metrics/types';

/**
 * 过滤 ASR 矩阵测试项
 * @param items ASR 矩阵测试项列表
 * @param filter 过滤条件
 * @returns 过滤后的 ASR 矩阵测试项列表
 */
export function filterASRMatrixItems(items: ASRMatrixItem[], filter?: ASRMatrixFilter): ASRMatrixItem[] {
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

    // 语言过滤
    if (filter.language && filter.language.length > 0) {
      if (!filter.language.includes(item.language)) {
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
      if (item.sampleRate === undefined || !filter.sampleRate.includes(item.sampleRate)) {
        return false;
      }
    }

    return true;
  });
}

/**
 * 生成 ASR 矩阵测试的场景标识
 * 格式：asr-matrix/<model>/<language>/<format>-<sampleRate>
 */
export function generateASRMatrixScenarioName(matrixConfig: ASRMatrixItem): string {
  return `asr-matrix/${matrixConfig.model}/${matrixConfig.language}/${matrixConfig.format}-${matrixConfig.sampleRate}`;
}

/**
 * 打印 ASR 矩阵测试计划摘要
 * @param displayName 提供商显示名称
 * @param filteredItems 过滤后的矩阵测试项
 * @param totalItems 原始矩阵测试项总数
 * @param iterations 迭代次数
 * @param filter 过滤条件
 */
export function printASRMatrixSummary(
  displayName: string,
  filteredItems: ASRMatrixItem[],
  totalItems: number,
  iterations: number,
  filter?: ASRMatrixFilter
): void {
  console.log(`\n=== ${displayName} ASR 矩阵测试计划 ===\n`);

  if (filter) {
    console.log('过滤条件:');
    if (filter.model) {
      console.log(`  - 模型: ${filter.model.join(', ')}`);
    }
    if (filter.language) {
      console.log(`  - 语言: ${filter.language.join(', ')}`);
    }
    if (filter.format) {
      console.log(`  - 格式: ${filter.format.join(', ')}`);
    }
    if (filter.sampleRate) {
      console.log(`  - 采样率: ${filter.sampleRate.join(', ')} Hz`);
    }
    console.log('');
  }

  console.log('矩阵测试列表:');
  for (const item of filteredItems) {
    console.log(`  - ${item.model}/${item.language}/${item.format}/${item.sampleRate}Hz`);
  }
  console.log(`\n矩阵项数量: ${filteredItems.length} (原始: ${totalItems})`);
  console.log(`每项迭代次数: ${iterations}`);
  console.log(`总测试数量: ${filteredItems.length * iterations}`);
  console.log('');
}

/**
 * 打印 ASR 进度信息
 */
export function printASRProgress(
  current: number,
  total: number,
  scenarioName: string,
  iteration: number,
  result: { status: string; throughput: { chunks?: Array<{ relativeTime: number }> } }
): void {
  const status = result.status === 'success' ? '✓' : '✗';
  const firstChunk = result.throughput.chunks?.[0]?.relativeTime ?? 0;
  const total2 = result.throughput.chunks?.[result.throughput.chunks.length - 1]?.relativeTime ?? 0;
  console.log(
    `[${current}/${total}] ${scenarioName} ` +
      `#${iteration}: ${status} 首包=${firstChunk}ms, 总计=${total2}ms`
  );
}