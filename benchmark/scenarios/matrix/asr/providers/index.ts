/**
 * ASR 矩阵测试提供商配置汇总
 */
import type { ASRProviderMatrixConfig } from '../types';
import { DOUBAO_ASR_MATRIX_CONFIG, doubaoASRMatrixItems, doubaoASRScenarioConfig } from './doubao';
import { GLM_ASR_MATRIX_CONFIG, glmASRMatrixItems, glmASRScenarioConfig } from './glm';
import { QWEN_ASR_MATRIX_CONFIG, qwenASRMatrixItems, qwenASRScenarioConfig } from './qwen';
import { XFYUN_ASR_MATRIX_CONFIG, xfyunASRMatrixItems, xfyunASRScenarioConfig } from './xfyun';

// 重新导出各提供商配置和数据
export {
  DOUBAO_ASR_MATRIX_CONFIG,
  doubaoASRMatrixItems,
  doubaoASRScenarioConfig,
  GLM_ASR_MATRIX_CONFIG,
  glmASRMatrixItems,
  glmASRScenarioConfig,
  QWEN_ASR_MATRIX_CONFIG,
  qwenASRMatrixItems,
  qwenASRScenarioConfig,
  XFYUN_ASR_MATRIX_CONFIG,
  xfyunASRMatrixItems,
  xfyunASRScenarioConfig,
};

/**
 * 所有 ASR 提供商矩阵配置
 */
export const ALL_ASR_PROVIDER_MATRIX_CONFIGS: ASRProviderMatrixConfig[] = [
  QWEN_ASR_MATRIX_CONFIG,
  DOUBAO_ASR_MATRIX_CONFIG,
  GLM_ASR_MATRIX_CONFIG,
  XFYUN_ASR_MATRIX_CONFIG,
];

/**
 * 获取 ASR 提供商矩阵配置
 * @param providerNames 指定提供商名称列表，不指定则返回全部
 * @returns 提供商配置列表
 */
export function getASRProviderConfigs(providerNames?: string[]): ASRProviderMatrixConfig[] {
  if (!providerNames || providerNames.length === 0) {
    return ALL_ASR_PROVIDER_MATRIX_CONFIGS;
  }
  return ALL_ASR_PROVIDER_MATRIX_CONFIGS.filter((config) => providerNames.includes(config.provider));
}

/**
 * 获取单个 ASR 提供商配置
 * @param providerName 提供商名称
 * @returns 提供商配置，不存在则返回 undefined
 */
export function getASRProviderConfig(providerName: string): ASRProviderMatrixConfig | undefined {
  return ALL_ASR_PROVIDER_MATRIX_CONFIGS.find((config) => config.provider === providerName);
}