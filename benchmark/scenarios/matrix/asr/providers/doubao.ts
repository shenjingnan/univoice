/**
 * Doubao ASR 矩阵测试配置
 *
 * Doubao ASR 的模型固定为 bigmodel（硬编码），默认使用 streaming 模式（非流式入/流式出）。
 */
import type { ASRMatrixItem, ASRMatrixScenarioConfig } from '../../../../metrics/types';
import type { ASRProviderMatrixConfig } from '../types';

/**
 * Doubao ASR 矩阵测试列表
 */
export const doubaoASRMatrixItems: ASRMatrixItem[] = [
  { provider: 'doubao', model: 'bigmodel', language: 'zh-CN', format: 'pcm', sampleRate: 16000 },
];

/**
 * Doubao ASR 场景配置
 */
export const doubaoASRScenarioConfig: ASRMatrixScenarioConfig = {
  name: 'doubao-asr-matrix',
  description: 'Doubao ASR 矩阵测试：pcm 格式，非流式入/流式出',
  testType: 'asr',
  inputMode: 'non-stream',
  outputMode: 'stream',
  iterations: 3,
  timeout: 120000,
};

/**
 * Doubao ASR 提供商矩阵配置
 */
export const DOUBAO_ASR_MATRIX_CONFIG: ASRProviderMatrixConfig = {
  provider: 'doubao',
  displayName: '火山引擎',
  items: doubaoASRMatrixItems,
  scenarioConfig: doubaoASRScenarioConfig,
  createConfigFactory: (matrixConfig) => ({
    provider: matrixConfig.provider,
    appKey: process.env.DOUBAO_APP_KEY || '',
    accessKey: process.env.DOUBAO_ACCESS_TOKEN || '',
    model: matrixConfig.model,
    language: matrixConfig.language,
    format: matrixConfig.format,
    ...(matrixConfig.sampleRate ? { audioFormat: { sampleRate: matrixConfig.sampleRate } } : {}),
  }),
};
