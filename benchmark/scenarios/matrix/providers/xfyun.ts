/**
 * Xfyun (科大讯飞) TTS 矩阵测试配置
 *
 * 使用超拟人语音合成模型 super-human-tts，发音人 x5_lingxiaoxuan_flow（x5 超拟人系列）。
 * 仅支持 pcm 格式，覆盖 8000/16000/24000/48000 四种采样率。
 */
import type { MatrixItem, MatrixScenarioConfig } from '../../../metrics/types';
import type { ProviderMatrixConfig } from '../types';

/**
 * Xfyun TTS 矩阵测试列表
 */
export const xfyunMatrixItems: MatrixItem[] = [
  // ========== super-human-tts + x5_lingxiaoxuan_flow + pcm ==========
  { provider: 'xfyun', model: 'super-human-tts', voice: 'x5_lingxiaoxuan_flow', format: 'pcm', sampleRate: 8000 },
  { provider: 'xfyun', model: 'super-human-tts', voice: 'x5_lingxiaoxuan_flow', format: 'pcm', sampleRate: 16000 },
  { provider: 'xfyun', model: 'super-human-tts', voice: 'x5_lingxiaoxuan_flow', format: 'pcm', sampleRate: 24000 },
];

/**
 * Xfyun 场景配置
 */
export const xfyunScenarioConfig: MatrixScenarioConfig = {
  name: 'xfyun-matrix',
  description: 'Xfyun TTS 矩阵测试：覆盖超拟人模型不同采样率的组合',
  testType: 'tts',
  iterations: 3,
  timeout: 120000,
};

/**
 * Xfyun 提供商矩阵配置
 */
export const XFYUN_MATRIX_CONFIG: ProviderMatrixConfig = {
  provider: 'xfyun',
  displayName: '科大讯飞',
  items: xfyunMatrixItems,
  scenarioConfig: xfyunScenarioConfig,
  createConfigFactory: (matrixConfig) => ({
    provider: 'xfyun',
    appId: process.env.XFYUN_APP_ID || '',
    apiKey: process.env.XFYUN_API_KEY || '',
    apiSecret: process.env.XFYUN_API_SECRET || '',
    model: matrixConfig.model,
    voice: matrixConfig.voice,
    format: matrixConfig.format,
    sampleRate: matrixConfig.sampleRate,
  }),
};
