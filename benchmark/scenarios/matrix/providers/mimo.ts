/**
 * 小米 Mimo TTS 矩阵测试配置
 */
import type { MatrixItem, MatrixScenarioConfig } from '../../../metrics/types';
import type { ProviderMatrixConfig } from '../types';

/**
 * Mimo TTS 矩阵测试列表
 */
export const mimoMatrixItems: MatrixItem[] = [
  { provider: 'mimo', model: 'mimo-v2-tts', voice: 'default_zh', format: 'pcm', sampleRate: 24000 },
];

/**
 * Mimo 场景配置
 */
export const mimoScenarioConfig: MatrixScenarioConfig = {
  name: 'mimo-matrix',
  description: '小米 Mimo TTS 矩阵测试：覆盖不同模型、音色、编码、采样率的组合',
  testType: 'tts',
  iterations: 3,
  timeout: 120000,
};

/**
 * Mimo 提供商矩阵配置
 */
export const MIMO_MATRIX_CONFIG: ProviderMatrixConfig = {
  provider: 'mimo',
  displayName: '小米 Mimo',
  items: mimoMatrixItems,
  scenarioConfig: mimoScenarioConfig,
  createConfigFactory: (matrixConfig) => ({
    provider: 'openai',
    apiKey: process.env.XIAOMI_API_KEY || '',
    baseUrl: process.env.XIAOMI_BASE_URL || '',
    model: matrixConfig.model,
    voice: matrixConfig.voice,
    format: matrixConfig.format,
    sampleRate: matrixConfig.sampleRate,
  }),
};
