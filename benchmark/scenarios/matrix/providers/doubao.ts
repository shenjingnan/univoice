/**
 * Doubao TTS 矩阵测试配置
 */
import type { MatrixItem, MatrixScenarioConfig } from '../../../metrics/types';
import type { ProviderMatrixConfig } from '../types';

/**
 * Doubao TTS 矩阵测试列表
 */
export const doubaoMatrixItems: MatrixItem[] = [
  // ========== seed-tts-1.0 + pcm ==========
  { provider: 'doubao', model: 'seed-tts-1.0', voice: 'zh_male_lengkugege_emo_v2_mars_bigtts', format: 'pcm', sampleRate: 8000 },
  { provider: 'doubao', model: 'seed-tts-1.0', voice: 'zh_male_lengkugege_emo_v2_mars_bigtts', format: 'pcm', sampleRate: 16000 },
  { provider: 'doubao', model: 'seed-tts-1.0', voice: 'zh_male_lengkugege_emo_v2_mars_bigtts', format: 'pcm', sampleRate: 24000 },
  { provider: 'doubao', model: 'seed-tts-1.0', voice: 'zh_male_lengkugege_emo_v2_mars_bigtts', format: 'pcm', sampleRate: 48000 },
  // ========== seed-tts-1.0 + ogg_opus ==========
  { provider: 'doubao', model: 'seed-tts-1.0', voice: 'zh_male_lengkugege_emo_v2_mars_bigtts', format: 'ogg_opus', sampleRate: 8000 },
  { provider: 'doubao', model: 'seed-tts-1.0', voice: 'zh_male_lengkugege_emo_v2_mars_bigtts', format: 'ogg_opus', sampleRate: 16000 },
  { provider: 'doubao', model: 'seed-tts-1.0', voice: 'zh_male_lengkugege_emo_v2_mars_bigtts', format: 'ogg_opus', sampleRate: 24000 },
  { provider: 'doubao', model: 'seed-tts-1.0', voice: 'zh_male_lengkugege_emo_v2_mars_bigtts', format: 'ogg_opus', sampleRate: 48000 },
  // ========== seed-tts-2.0 + pcm ==========
  { provider: 'doubao', model: 'seed-tts-2.0', voice: 'zh_female_vv_uranus_bigtts', format: 'pcm', sampleRate: 8000 },
  { provider: 'doubao', model: 'seed-tts-2.0', voice: 'zh_female_vv_uranus_bigtts', format: 'pcm', sampleRate: 16000 },
  { provider: 'doubao', model: 'seed-tts-2.0', voice: 'zh_female_vv_uranus_bigtts', format: 'pcm', sampleRate: 24000 },
  { provider: 'doubao', model: 'seed-tts-2.0', voice: 'zh_female_vv_uranus_bigtts', format: 'pcm', sampleRate: 48000 },
  // ========== seed-tts-2.0 + ogg_opus ==========
  { provider: 'doubao', model: 'seed-tts-2.0', voice: 'zh_female_vv_uranus_bigtts', format: 'ogg_opus', sampleRate: 8000 },
  { provider: 'doubao', model: 'seed-tts-2.0', voice: 'zh_female_vv_uranus_bigtts', format: 'ogg_opus', sampleRate: 16000 },
  { provider: 'doubao', model: 'seed-tts-2.0', voice: 'zh_female_vv_uranus_bigtts', format: 'ogg_opus', sampleRate: 24000 },
  { provider: 'doubao', model: 'seed-tts-2.0', voice: 'zh_female_vv_uranus_bigtts', format: 'ogg_opus', sampleRate: 48000 },
];

/**
 * Doubao 场景配置
 */
export const doubaoScenarioConfig: MatrixScenarioConfig = {
  name: 'doubao-matrix',
  description: 'Doubao TTS 矩阵测试：覆盖不同模型、音色、编码、采样率的组合',
  testType: 'tts',
  iterations: 3,
  timeout: 120000,
};

/**
 * Doubao 提供商矩阵配置
 */
export const DOUBAO_MATRIX_CONFIG: ProviderMatrixConfig = { provider: 'doubao', displayName: '豆包', items: doubaoMatrixItems,
  scenarioConfig: doubaoScenarioConfig,
  createConfigFactory: (matrixConfig) => ({
    provider: 'doubao',
    appId: process.env.DOUBAO_APP_KEY || '',
    accessToken: process.env.DOUBAO_ACCESS_TOKEN || '',
    resourceId: matrixConfig.model,
    model: matrixConfig.model,
    voice: matrixConfig.voice,
    format: matrixConfig.format,
    sampleRate: matrixConfig.sampleRate
  })
};
