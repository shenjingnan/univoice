/**
 * Minimax TTS 矩阵测试配置
 */
import type { MatrixItem, MatrixScenarioConfig } from '../../../metrics/types';
import type { ProviderMatrixConfig } from '../types';

/**
 * Minimax TTS 模型列表
 */
const minimaxModels = [
  'speech-2.8-hd',
  'speech-2.8-turbo',
  'speech-2.6-hd',
  'speech-2.6-turbo',
  'speech-02-hd',
  'speech-02-turbo',
  'speech-01-hd',
  'speech-01-turbo',
] as const;

/**
 * Minimax TTS 采样率列表
 */
const minimaxSampleRates = [8000, 16000, 22050, 24000, 32000, 44100] as const;

/**
 * Minimax TTS 矩阵测试列表
 */
export const minimaxMatrixItems: MatrixItem[] = [];

// 生成所有测试组合
for (const model of minimaxModels) {
  for (const sampleRate of minimaxSampleRates) {
    minimaxMatrixItems.push({
      provider: 'minimax',
      model,
      voice: 'male-qn-qingse',
      format: 'pcm',
      sampleRate,
    });
  }
}

/**
 * Minimax 场景配置
 */
export const minimaxScenarioConfig: MatrixScenarioConfig = {
  name: 'minimax-matrix',
  description: 'Minimax TTS 矩阵测试：覆盖不同模型、音色、编码、采样率的组合',
  testType: 'tts',
  iterations: 3,
  timeout: 120000,
};

/**
 * Minimax 提供商矩阵配置
 */
export const MINIMAX_MATRIX_CONFIG: ProviderMatrixConfig = {
  provider: 'minimax',
  displayName: 'MiniMax',
  items: minimaxMatrixItems,
  scenarioConfig: minimaxScenarioConfig,
  createConfigFactory: (matrixConfig) => ({
    provider: 'minimax',
    apiKey: process.env.MINIMAX_API_KEY || '',
    groupId: process.env.MINIMAX_GROUP_ID,
    model: matrixConfig.model,
    voice: matrixConfig.voice,
    format: matrixConfig.format,
    sampleRate: matrixConfig.sampleRate,
  }),
};
