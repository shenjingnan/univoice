/**
 * 矩阵测试提供商配置汇总
 */
import type { ProviderMatrixConfig } from '../types';
import { DOUBAO_MATRIX_CONFIG, doubaoMatrixItems, doubaoScenarioConfig } from './doubao';
import { GLM_MATRIX_CONFIG, glmMatrixItems, glmScenarioConfig } from './glm';
import { MIMO_MATRIX_CONFIG, mimoMatrixItems, mimoScenarioConfig } from './mimo';
import { MINIMAX_MATRIX_CONFIG, minimaxMatrixItems, minimaxScenarioConfig } from './minimax';
import { QWEN_MATRIX_CONFIG, qwenMatrixItems, qwenScenarioConfig } from './qwen';
import { XFYUN_MATRIX_CONFIG, xfyunMatrixItems, xfyunScenarioConfig } from './xfyun';

// 重新导出各提供商配置和数据
export {
  DOUBAO_MATRIX_CONFIG,
  doubaoMatrixItems,
  doubaoScenarioConfig,
  GLM_MATRIX_CONFIG,
  glmMatrixItems,
  glmScenarioConfig,
  MIMO_MATRIX_CONFIG,
  MINIMAX_MATRIX_CONFIG,
  mimoMatrixItems,
  mimoScenarioConfig,
  minimaxMatrixItems,
  minimaxScenarioConfig,
  QWEN_MATRIX_CONFIG,
  qwenMatrixItems,
  qwenScenarioConfig,
  XFYUN_MATRIX_CONFIG,
  xfyunMatrixItems,
  xfyunScenarioConfig,
};

/**
 * 所有提供商矩阵配置
 */
export const ALL_PROVIDER_MATRIX_CONFIGS: ProviderMatrixConfig[] = [
  QWEN_MATRIX_CONFIG,
  DOUBAO_MATRIX_CONFIG,
  GLM_MATRIX_CONFIG,
  MIMO_MATRIX_CONFIG,
  MINIMAX_MATRIX_CONFIG,
  XFYUN_MATRIX_CONFIG,
];

/**
 * 获取提供商矩阵配置
 * @param providerNames 指定提供商名称列表，不指定则返回全部
 * @returns 提供商配置列表
 */
export function getProviderConfigs(providerNames?: string[]): ProviderMatrixConfig[] {
  if (!providerNames || providerNames.length === 0) {
    return ALL_PROVIDER_MATRIX_CONFIGS;
  }
  return ALL_PROVIDER_MATRIX_CONFIGS.filter((config) => providerNames.includes(config.provider));
}

/**
 * 获取单个提供商配置
 * @param providerName 提供商名称
 * @returns 提供商配置，不存在则返回 undefined
 */
export function getProviderConfig(providerName: string): ProviderMatrixConfig | undefined {
  return ALL_PROVIDER_MATRIX_CONFIGS.find((config) => config.provider === providerName);
}
