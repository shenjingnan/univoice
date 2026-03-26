/**
 * 矩阵加载工具
 * 用于统一加载所有提供商的矩阵数据
 */
import type { ASRMatrixItem, MatrixItem } from '../metrics/types';
import {
  doubaoMatrixItems,
  glmMatrixItems,
  minimaxMatrixItems,
  qwenMatrixItems,
} from '../scenarios/matrix';
import { qwenASRMatrixItems } from '../scenarios/matrix/asr';

/**
 * 所有 TTS 矩阵测试项
 * 合并所有提供商的矩阵数据
 */
export const allMatrixItems: MatrixItem[] = [
  ...qwenMatrixItems,
  ...doubaoMatrixItems,
  ...minimaxMatrixItems,
  ...glmMatrixItems,
];

/**
 * 所有 ASR 矩阵测试项
 */
export const allASRMatrixItems: ASRMatrixItem[] = [
  ...qwenASRMatrixItems,
  // 其他提供商的 ASR 矩阵项可以在这里添加
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

/**
 * 生成 ASR 场景名称
 * 格式: asr-matrix/<model>/<language>/<format>-<sampleRate>
 */
export function generateASRScenarioName(item: ASRMatrixItem): string {
  return `asr-matrix/${item.model}/${item.language}/${item.format}-${item.sampleRate}`;
}

/**
 * 获取 ASR 矩阵统计信息
 */
export function getASRMatrixStats(): {
  total: number;
  byProvider: Record<string, number>;
} {
  const byProvider: Record<string, number> = {};

  for (const item of allASRMatrixItems) {
    byProvider[item.provider] = (byProvider[item.provider] || 0) + 1;
  }

  return {
    total: allASRMatrixItems.length,
    byProvider,
  };
}

/**
 * 按提供商获取 ASR 矩阵项
 */
export function getASRMatrixItemsByProvider(provider: string): ASRMatrixItem[] {
  return allASRMatrixItems.filter((item) => item.provider === provider);
}

/**
 * 获取所有 ASR 提供商列表
 */
export function getAllASRProviders(): string[] {
  return [...new Set(allASRMatrixItems.map((item) => item.provider))];
}
