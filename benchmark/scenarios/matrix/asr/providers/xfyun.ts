/**
 * Xfyun (科大讯飞) ASR 矩阵测试配置
 *
 * 使用语音听写模型 iat，pcm 格式，16000 采样率。
 */
import type { ASRMatrixItem, ASRMatrixScenarioConfig } from '../../../../metrics/types';
import type { ASRProviderMatrixConfig } from '../types';

/**
 * Xfyun ASR 矩阵测试列表
 */
export const xfyunASRMatrixItems: ASRMatrixItem[] = [
  { provider: 'xfyun', model: 'iat', language: 'zh-CN', format: 'pcm', sampleRate: 16000 },
];

/**
 * Xfyun ASR 场景配置
 */
export const xfyunASRScenarioConfig: ASRMatrixScenarioConfig = {
  name: 'xfyun-asr-matrix',
  description: 'Xfyun ASR 矩阵测试：pcm 格式，非流式入/流式出',
  testType: 'asr',
  inputMode: 'non-stream',
  outputMode: 'stream',
  iterations: 3,
  timeout: 120000,
};

/**
 * Xfyun ASR 提供商矩阵配置
 */
export const XFYUN_ASR_MATRIX_CONFIG: ASRProviderMatrixConfig = {
  provider: 'xfyun',
  displayName: '科大讯飞',
  items: xfyunASRMatrixItems,
  scenarioConfig: xfyunASRScenarioConfig,
  createConfigFactory: (matrixConfig) => ({
    provider: matrixConfig.provider,
    appId: process.env.XFYUN_APP_ID || '',
    apiKey: process.env.XFYUN_API_KEY || '',
    apiSecret: process.env.XFYUN_API_SECRET || '',
    domain: matrixConfig.model,
    model: matrixConfig.model,
    language: matrixConfig.language,
    format: matrixConfig.format,
    ...(matrixConfig.sampleRate ? { audioFormat: { sampleRate: matrixConfig.sampleRate } } : {}),
  }),
};
