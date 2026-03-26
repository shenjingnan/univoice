/**
 * Qwen ASR 矩阵测试配置
 */
import type { ASRMatrixItem, ASRMatrixScenarioConfig } from '../../../../metrics/types';
import type { ASRProviderMatrixConfig } from '../types';

/**
 * Qwen ASR 矩阵测试列表
 *
 * 支持的模型：
 * - paraformer-realtime-v2（推荐）：支持多语言、任意采样率（自动检测）
 * - paraformer-realtime-v1：支持 16kHz 采样率
 * - paraformer-realtime-8k-v1：专用 8kHz 模型（电话场景）
 *
 * 注：只测试 pcm 格式，语言固定为 zh-CN
 * 注：paraformer-realtime-8k-v1 需要 8kHz 音频文件，暂时跳过
 */
export const qwenASRMatrixItems: ASRMatrixItem[] = [
  // paraformer-realtime-v2：推荐模型，支持任意采样率（自动检测）
  { provider: 'qwen', model: 'paraformer-realtime-v2', language: 'zh-CN', format: 'pcm', sampleRate: 16000 },
  // paraformer-realtime-v1：仅支持 16kHz
  { provider: 'qwen', model: 'paraformer-realtime-v1', language: 'zh-CN', format: 'pcm', sampleRate: 16000 },
  // 注：paraformer-realtime-8k-v1 需要 8kHz 音频文件，暂时跳过
];

/**
 * Qwen ASR 场景配置
 */
export const qwenASRScenarioConfig: ASRMatrixScenarioConfig = {
  name: 'qwen-asr-matrix',
  description: 'Qwen ASR 矩阵测试：覆盖不同模型、语言、格式、采样率的组合',
  testType: 'asr',
  inputMode: 'non-stream',
  outputMode: 'stream',
  iterations: 3,
  timeout: 120000,
};

/**
 * Qwen ASR 提供商矩阵配置
 */
export const QWEN_ASR_MATRIX_CONFIG: ASRProviderMatrixConfig = {
  provider: 'qwen',
  displayName: '通义千问',
  items: qwenASRMatrixItems,
  scenarioConfig: qwenASRScenarioConfig,
  createConfigFactory: (matrixConfig) => ({
    provider: matrixConfig.provider,
    apiKey: process.env.QWEN_API_KEY || '',
    model: matrixConfig.model,
    language: matrixConfig.language,
    format: matrixConfig.format,
    // 采样率可选：paraformer-realtime-v2 支持自动检测
    ...(matrixConfig.sampleRate ? { audioFormat: { sampleRate: matrixConfig.sampleRate } } : {}),
  }),
};