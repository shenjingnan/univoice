/**
 * Minimax TTS 矩阵测试配置
 */
import type { MatrixItem, MatrixScenarioConfig } from '../../../metrics/types';
import type { ProviderMatrixConfig } from '../types';

/**
 * Minimax TTS 矩阵测试列表
 */
export const minimaxMatrixItems: MatrixItem[] = [
  // speech-2.8-hd + male-qn-qingse
  { provider: 'minimax', model: 'speech-2.8-hd', voice: 'male-qn-qingse', format: 'pcm', sampleRate: 8000 },
  { provider: 'minimax', model: 'speech-2.8-hd', voice: 'male-qn-qingse', format: 'pcm', sampleRate: 16000 },
  { provider: 'minimax', model: 'speech-2.8-hd', voice: 'male-qn-qingse', format: 'pcm', sampleRate: 22050 },
  { provider: 'minimax', model: 'speech-2.8-hd', voice: 'male-qn-qingse', format: 'pcm', sampleRate: 24000 },
  { provider: 'minimax', model: 'speech-2.8-hd', voice: 'male-qn-qingse', format: 'pcm', sampleRate: 32000 },
  { provider: 'minimax', model: 'speech-2.8-hd', voice: 'male-qn-qingse', format: 'pcm', sampleRate: 44100 },
  // speech-2.8-turbo + male-qn-qingse
  { provider: 'minimax', model: 'speech-2.8-turbo', voice: 'male-qn-qingse', format: 'pcm', sampleRate: 8000 },
  { provider: 'minimax', model: 'speech-2.8-turbo', voice: 'male-qn-qingse', format: 'pcm', sampleRate: 16000 },
  { provider: 'minimax', model: 'speech-2.8-turbo', voice: 'male-qn-qingse', format: 'pcm', sampleRate: 22050 },
  { provider: 'minimax', model: 'speech-2.8-turbo', voice: 'male-qn-qingse', format: 'pcm', sampleRate: 24000 },
  { provider: 'minimax', model: 'speech-2.8-turbo', voice: 'male-qn-qingse', format: 'pcm', sampleRate: 32000 },
  { provider: 'minimax', model: 'speech-2.8-turbo', voice: 'male-qn-qingse', format: 'pcm', sampleRate: 44100 },
  // speech-2.6-hd + male-qn-qingse
  { provider: 'minimax', model: 'speech-2.6-hd', voice: 'male-qn-qingse', format: 'pcm', sampleRate: 8000 },
  { provider: 'minimax', model: 'speech-2.6-hd', voice: 'male-qn-qingse', format: 'pcm', sampleRate: 16000 },
  { provider: 'minimax', model: 'speech-2.6-hd', voice: 'male-qn-qingse', format: 'pcm', sampleRate: 22050 },
  { provider: 'minimax', model: 'speech-2.6-hd', voice: 'male-qn-qingse', format: 'pcm', sampleRate: 24000 },
  { provider: 'minimax', model: 'speech-2.6-hd', voice: 'male-qn-qingse', format: 'pcm', sampleRate: 32000 },
  { provider: 'minimax', model: 'speech-2.6-hd', voice: 'male-qn-qingse', format: 'pcm', sampleRate: 44100 },
  // speech-2.6-turbo + male-qn-qingse
  { provider: 'minimax', model: 'speech-2.6-turbo', voice: 'male-qn-qingse', format: 'pcm', sampleRate: 8000 },
  { provider: 'minimax', model: 'speech-2.6-turbo', voice: 'male-qn-qingse', format: 'pcm', sampleRate: 16000 },
  { provider: 'minimax', model: 'speech-2.6-turbo', voice: 'male-qn-qingse', format: 'pcm', sampleRate: 22050 },
  { provider: 'minimax', model: 'speech-2.6-turbo', voice: 'male-qn-qingse', format: 'pcm', sampleRate: 24000 },
  { provider: 'minimax', model: 'speech-2.6-turbo', voice: 'male-qn-qingse', format: 'pcm', sampleRate: 32000 },
  { provider: 'minimax', model: 'speech-2.6-turbo', voice: 'male-qn-qingse', format: 'pcm', sampleRate: 44100 },
  // speech-02-hd + male-qn-qingse
  { provider: 'minimax', model: 'speech-02-hd', voice: 'male-qn-qingse', format: 'pcm', sampleRate: 8000 },
  { provider: 'minimax', model: 'speech-02-hd', voice: 'male-qn-qingse', format: 'pcm', sampleRate: 16000 },
  { provider: 'minimax', model: 'speech-02-hd', voice: 'male-qn-qingse', format: 'pcm', sampleRate: 22050 },
  { provider: 'minimax', model: 'speech-02-hd', voice: 'male-qn-qingse', format: 'pcm', sampleRate: 24000 },
  { provider: 'minimax', model: 'speech-02-hd', voice: 'male-qn-qingse', format: 'pcm', sampleRate: 32000 },
  { provider: 'minimax', model: 'speech-02-hd', voice: 'male-qn-qingse', format: 'pcm', sampleRate: 44100 },
  // speech-02-turbo + male-qn-qingse
  { provider: 'minimax', model: 'speech-02-turbo', voice: 'male-qn-qingse', format: 'pcm', sampleRate: 8000 },
  { provider: 'minimax', model: 'speech-02-turbo', voice: 'male-qn-qingse', format: 'pcm', sampleRate: 16000 },
  { provider: 'minimax', model: 'speech-02-turbo', voice: 'male-qn-qingse', format: 'pcm', sampleRate: 22050 },
  { provider: 'minimax', model: 'speech-02-turbo', voice: 'male-qn-qingse', format: 'pcm', sampleRate: 24000 },
  { provider: 'minimax', model: 'speech-02-turbo', voice: 'male-qn-qingse', format: 'pcm', sampleRate: 32000 },
  { provider: 'minimax', model: 'speech-02-turbo', voice: 'male-qn-qingse', format: 'pcm', sampleRate: 44100 },
  // speech-01-hd + male-qn-qingse
  { provider: 'minimax', model: 'speech-01-hd', voice: 'male-qn-qingse', format: 'pcm', sampleRate: 8000 },
  { provider: 'minimax', model: 'speech-01-hd', voice: 'male-qn-qingse', format: 'pcm', sampleRate: 16000 },
  { provider: 'minimax', model: 'speech-01-hd', voice: 'male-qn-qingse', format: 'pcm', sampleRate: 22050 },
  { provider: 'minimax', model: 'speech-01-hd', voice: 'male-qn-qingse', format: 'pcm', sampleRate: 24000 },
  { provider: 'minimax', model: 'speech-01-hd', voice: 'male-qn-qingse', format: 'pcm', sampleRate: 32000 },
  { provider: 'minimax', model: 'speech-01-hd', voice: 'male-qn-qingse', format: 'pcm', sampleRate: 44100 },
  // speech-01-turbo + male-qn-qingse
  { provider: 'minimax', model: 'speech-01-turbo', voice: 'male-qn-qingse', format: 'pcm', sampleRate: 8000 },
  { provider: 'minimax', model: 'speech-01-turbo', voice: 'male-qn-qingse', format: 'pcm', sampleRate: 16000 },
  { provider: 'minimax', model: 'speech-01-turbo', voice: 'male-qn-qingse', format: 'pcm', sampleRate: 22050 },
  { provider: 'minimax', model: 'speech-01-turbo', voice: 'male-qn-qingse', format: 'pcm', sampleRate: 24000 },
  { provider: 'minimax', model: 'speech-01-turbo', voice: 'male-qn-qingse', format: 'pcm', sampleRate: 32000 },
  { provider: 'minimax', model: 'speech-01-turbo', voice: 'male-qn-qingse', format: 'pcm', sampleRate: 44100 },
];

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