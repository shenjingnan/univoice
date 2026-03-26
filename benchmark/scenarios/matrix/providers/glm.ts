/**
 * GLM TTS 矩阵测试配置
 */
import type { MatrixItem, MatrixScenarioConfig } from '../../../metrics/types';
import type { ProviderMatrixConfig } from '../types';

/**
 * GLM TTS 矩阵测试列表
 */
export const glmMatrixItems: MatrixItem[] = [
  { provider: 'glm', model: 'glm-tts', voice: 'tongtong', format: 'pcm', sampleRate: 24000 },
];

/**
 * GLM 场景配置
 */
export const glmScenarioConfig: MatrixScenarioConfig = {
  name: 'glm-matrix',
  description: 'GLM TTS 矩阵测试：覆盖不同模型、音色、编码、采样率的组合',
  testType: 'tts',
  iterations: 3,
  timeout: 120000,
};

/**
 * GLM 提供商矩阵配置
 */
export const GLM_MATRIX_CONFIG: ProviderMatrixConfig = {
  provider: 'glm',
  displayName: '智谱 GLM',
  items: glmMatrixItems,
  scenarioConfig: glmScenarioConfig,
  createConfigFactory: (matrixConfig) => ({
    provider: 'glm',
    apiKey: process.env.GLM_API_KEY || '',
    model: matrixConfig.model,
    voice: matrixConfig.voice,
    format: matrixConfig.format,
    sampleRate: matrixConfig.sampleRate,
  }),
};
