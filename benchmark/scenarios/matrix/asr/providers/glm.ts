/**
 * GLM ASR 矩阵测试配置
 *
 * GLM ASR 模型固定为 glm-asr-2512，支持 wav 和 mp3 格式，不支持裸 PCM。
 */
import type { ASRMatrixItem, ASRMatrixScenarioConfig } from '../../../../metrics/types';
import type { ASRProviderMatrixConfig } from '../types';

/**
 * GLM ASR 矩阵测试列表
 */
export const glmASRMatrixItems: ASRMatrixItem[] = [
  { provider: 'glm', model: 'glm-asr-2512', language: 'zh-CN', format: 'wav', sampleRate: 16000 },
  { provider: 'glm', model: 'glm-asr-2512', language: 'zh-CN', format: 'mp3' },
];

/**
 * GLM ASR 场景配置
 */
export const glmASRScenarioConfig: ASRMatrixScenarioConfig = {
  name: 'glm-asr-matrix',
  description: 'GLM ASR 矩阵测试：wav/mp3 格式，非流式入/流式出',
  testType: 'asr',
  inputMode: 'non-stream',
  outputMode: 'stream',
  iterations: 3,
  timeout: 120000,
};

/**
 * GLM ASR 提供商矩阵配置
 */
export const GLM_ASR_MATRIX_CONFIG: ASRProviderMatrixConfig = {
  provider: 'glm',
  displayName: '智谱 GLM',
  items: glmASRMatrixItems,
  scenarioConfig: glmASRScenarioConfig,
  createConfigFactory: (matrixConfig) => ({
    provider: matrixConfig.provider,
    apiKey: process.env.GLM_API_KEY || '',
    model: matrixConfig.model,
    language: matrixConfig.language,
    format: matrixConfig.format,
    ...(matrixConfig.sampleRate ? { audioFormat: { sampleRate: matrixConfig.sampleRate } } : {}),
  }),
};
