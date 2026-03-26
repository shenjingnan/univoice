/**
 * 矩阵测试工具函数
 */
import type { MatrixFilter, MatrixItem } from '../../metrics/types';

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
 * 生成矩阵测试的场景标识
 * 格式：matrix/<model>/<voice>/<format>-<sampleRate>
 */
export function generateMatrixScenarioName(matrixConfig: MatrixItem): string {
  return `matrix/${matrixConfig.model}/${matrixConfig.voice}/${matrixConfig.format}-${matrixConfig.sampleRate}`;
}

/**
 * 打印矩阵测试计划摘要
 * @param displayName 提供商显示名称
 * @param filteredItems 过滤后的矩阵测试项
 * @param totalItems 原始矩阵测试项总数
 * @param iterations 迭代次数
 * @param filter 过滤条件
 */
export function printMatrixSummary(
  displayName: string,
  filteredItems: MatrixItem[],
  totalItems: number,
  iterations: number,
  filter?: MatrixFilter
): void {
  console.log(`\n=== ${displayName} TTS 矩阵测试计划 ===\n`);

  if (filter) {
    console.log('过滤条件:');
    if (filter.model) {
      console.log(`  - 模型: ${filter.model.join(', ')}`);
    }
    if (filter.voice) {
      console.log(`  - 音色: ${filter.voice.join(', ')}`);
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
    console.log(`  - ${item.model}/${item.voice}/${item.format}/${item.sampleRate}Hz`);
  }
  console.log(`\n矩阵项数量: ${filteredItems.length} (原始: ${totalItems})`);
  console.log(`每项迭代次数: ${iterations}`);
  console.log(`总测试数量: ${filteredItems.length * iterations}`);
  console.log('');
}

/**
 * 打印进度信息
 */
export function printProgress(
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
