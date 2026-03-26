/**
 * 矩阵加载工具
 * 用于统一加载所有提供商的矩阵数据
 */
import type { MatrixItem } from '../metrics/types';
import { doubaoMatrixItems } from '../scenarios/doubao-matrix-data';
import { glmMatrixItems } from '../scenarios/glm-matrix-data';
import { minimaxMatrixItems } from '../scenarios/minimax-matrix-data';
import { qwenMatrixItems } from '../scenarios/qwen-matrix-data';

/**
 * 所有矩阵测试项
 * 合并所有提供商的矩阵数据
 */
export const allMatrixItems: MatrixItem[] = [
  ...qwenMatrixItems,
  ...doubaoMatrixItems,
  ...minimaxMatrixItems,
  ...glmMatrixItems,
];

/**
 * 提供商显示名称映射
 */
const PROVIDER_DISPLAY_NAMES: Record<string, string> = {
  qwen: '通义千问',
  'qwen-realtime': '通义千问 (Realtime)',
  doubao: '火山引擎',
  glm: '智谱 GLM',
  minimax: 'Minimax',
};

/**
 * 获取提供商显示名称
 */
export function getProviderDisplayName(provider: string): string {
  return PROVIDER_DISPLAY_NAMES[provider] || provider;
}

/**
 * 生成场景名称
 * 格式: matrix/<model>/<voice>/<format>-<sampleRate>
 */
export function generateScenarioName(item: MatrixItem): string {
  return `matrix/${item.model}/${item.voice}/${item.format}-${item.sampleRate}`;
}

/**
 * 获取矩阵统计信息
 */
export function getMatrixStats(): {
  total: number;
  byProvider: Record<string, number>;
} {
  const byProvider: Record<string, number> = {};

  for (const item of allMatrixItems) {
    byProvider[item.provider] = (byProvider[item.provider] || 0) + 1;
  }

  return {
    total: allMatrixItems.length,
    byProvider,
  };
}

/**
 * 按提供商获取矩阵项
 */
export function getMatrixItemsByProvider(provider: string): MatrixItem[] {
  return allMatrixItems.filter((item) => item.provider === provider);
}

/**
 * 获取所有提供商列表
 */
export function getAllProviders(): string[] {
  return [...new Set(allMatrixItems.map((item) => item.provider))];
}
