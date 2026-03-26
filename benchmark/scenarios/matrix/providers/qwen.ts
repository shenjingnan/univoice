/**
 * Qwen TTS 矩阵测试配置
 */
import type { MatrixItem, MatrixScenarioConfig } from '../../../metrics/types';
import type { ProviderMatrixConfig } from '../types';

/**
 * Qwen TTS 矩阵测试列表
 */
export const qwenMatrixItems: MatrixItem[] = [
  // cosyvoice-v3-flash + longanyang
  { provider: 'qwen', model: 'cosyvoice-v3-flash', voice: 'longanyang', format: 'pcm', sampleRate: 8000 },
  { provider: 'qwen', model: 'cosyvoice-v3-flash', voice: 'longanyang', format: 'pcm', sampleRate: 16000 },
  { provider: 'qwen', model: 'cosyvoice-v3-flash', voice: 'longanyang', format: 'pcm', sampleRate: 22050 },
  { provider: 'qwen', model: 'cosyvoice-v3-flash', voice: 'longanyang', format: 'pcm', sampleRate: 24000 },
  { provider: 'qwen', model: 'cosyvoice-v3-flash', voice: 'longanyang', format: 'pcm', sampleRate: 44100 },
  { provider: 'qwen', model: 'cosyvoice-v3-flash', voice: 'longanyang', format: 'pcm', sampleRate: 48000 },
  { provider: 'qwen', model: 'cosyvoice-v3-flash', voice: 'longanyang', format: 'opus', sampleRate: 8000 },
  { provider: 'qwen', model: 'cosyvoice-v3-flash', voice: 'longanyang', format: 'opus', sampleRate: 16000 },
  { provider: 'qwen', model: 'cosyvoice-v3-flash', voice: 'longanyang', format: 'opus', sampleRate: 22050 },
  { provider: 'qwen', model: 'cosyvoice-v3-flash', voice: 'longanyang', format: 'opus', sampleRate: 24000 },
  { provider: 'qwen', model: 'cosyvoice-v3-flash', voice: 'longanyang', format: 'opus', sampleRate: 44100 },
  { provider: 'qwen', model: 'cosyvoice-v3-flash', voice: 'longanyang', format: 'opus', sampleRate: 48000 },
  // cosyvoice-v3-plus + longanyang
  { provider: 'qwen', model: 'cosyvoice-v3-plus', voice: 'longanyang', format: 'pcm', sampleRate: 8000 },
  { provider: 'qwen', model: 'cosyvoice-v3-plus', voice: 'longanyang', format: 'pcm', sampleRate: 16000 },
  { provider: 'qwen', model: 'cosyvoice-v3-plus', voice: 'longanyang', format: 'pcm', sampleRate: 22050 },
  { provider: 'qwen', model: 'cosyvoice-v3-plus', voice: 'longanyang', format: 'pcm', sampleRate: 24000 },
  { provider: 'qwen', model: 'cosyvoice-v3-plus', voice: 'longanyang', format: 'pcm', sampleRate: 44100 },
  { provider: 'qwen', model: 'cosyvoice-v3-plus', voice: 'longanyang', format: 'pcm', sampleRate: 48000 },
  { provider: 'qwen', model: 'cosyvoice-v3-plus', voice: 'longanyang', format: 'opus', sampleRate: 8000 },
  { provider: 'qwen', model: 'cosyvoice-v3-plus', voice: 'longanyang', format: 'opus', sampleRate: 16000 },
  { provider: 'qwen', model: 'cosyvoice-v3-plus', voice: 'longanyang', format: 'opus', sampleRate: 22050 },
  { provider: 'qwen', model: 'cosyvoice-v3-plus', voice: 'longanyang', format: 'opus', sampleRate: 24000 },
  { provider: 'qwen', model: 'cosyvoice-v3-plus', voice: 'longanyang', format: 'opus', sampleRate: 44100 },
  { provider: 'qwen', model: 'cosyvoice-v3-plus', voice: 'longanyang', format: 'opus', sampleRate: 48000 },
  // cosyvoice-v2 + longyingxiao
  { provider: 'qwen', model: 'cosyvoice-v2', voice: 'longyingxiao', format: 'pcm', sampleRate: 8000 },
  { provider: 'qwen', model: 'cosyvoice-v2', voice: 'longyingxiao', format: 'pcm', sampleRate: 16000 },
  { provider: 'qwen', model: 'cosyvoice-v2', voice: 'longyingxiao', format: 'pcm', sampleRate: 22050 },
  { provider: 'qwen', model: 'cosyvoice-v2', voice: 'longyingxiao', format: 'pcm', sampleRate: 24000 },
  { provider: 'qwen', model: 'cosyvoice-v2', voice: 'longyingxiao', format: 'pcm', sampleRate: 44100 },
  { provider: 'qwen', model: 'cosyvoice-v2', voice: 'longyingxiao', format: 'pcm', sampleRate: 48000 },
  { provider: 'qwen', model: 'cosyvoice-v2', voice: 'longyingxiao', format: 'opus', sampleRate: 8000 },
  { provider: 'qwen', model: 'cosyvoice-v2', voice: 'longyingxiao', format: 'opus', sampleRate: 16000 },
  { provider: 'qwen', model: 'cosyvoice-v2', voice: 'longyingxiao', format: 'opus', sampleRate: 22050 },
  { provider: 'qwen', model: 'cosyvoice-v2', voice: 'longyingxiao', format: 'opus', sampleRate: 24000 },
  { provider: 'qwen', model: 'cosyvoice-v2', voice: 'longyingxiao', format: 'opus', sampleRate: 44100 },
  { provider: 'qwen', model: 'cosyvoice-v2', voice: 'longyingxiao', format: 'opus', sampleRate: 48000 },
  // cosyvoice-v1 + longwan
  { provider: 'qwen', model: 'cosyvoice-v1', voice: 'longwan', format: 'pcm', sampleRate: 8000 },
  { provider: 'qwen', model: 'cosyvoice-v1', voice: 'longwan', format: 'pcm', sampleRate: 16000 },
  { provider: 'qwen', model: 'cosyvoice-v1', voice: 'longwan', format: 'pcm', sampleRate: 22050 },
  { provider: 'qwen', model: 'cosyvoice-v1', voice: 'longwan', format: 'pcm', sampleRate: 24000 },
  { provider: 'qwen', model: 'cosyvoice-v1', voice: 'longwan', format: 'pcm', sampleRate: 44100 },
  { provider: 'qwen', model: 'cosyvoice-v1', voice: 'longwan', format: 'pcm', sampleRate: 48000 },
  // qwen3-tts-instruct-flash-realtime + Cherry (Realtime API 专用)
  { provider: 'qwen-realtime', model: 'qwen3-tts-instruct-flash-realtime', voice: 'Cherry', format: 'pcm', sampleRate: 8000 },
  { provider: 'qwen-realtime', model: 'qwen3-tts-instruct-flash-realtime', voice: 'Cherry', format: 'pcm', sampleRate: 16000 },
  { provider: 'qwen-realtime', model: 'qwen3-tts-instruct-flash-realtime', voice: 'Cherry', format: 'pcm', sampleRate: 24000 },
  { provider: 'qwen-realtime', model: 'qwen3-tts-instruct-flash-realtime', voice: 'Cherry', format: 'pcm', sampleRate: 48000 },
  { provider: 'qwen-realtime', model: 'qwen3-tts-instruct-flash-realtime', voice: 'Cherry', format: 'opus', sampleRate: 8000 },
  { provider: 'qwen-realtime', model: 'qwen3-tts-instruct-flash-realtime', voice: 'Cherry', format: 'opus', sampleRate: 16000 },
  { provider: 'qwen-realtime', model: 'qwen3-tts-instruct-flash-realtime', voice: 'Cherry', format: 'opus', sampleRate: 24000 },
  { provider: 'qwen-realtime', model: 'qwen3-tts-instruct-flash-realtime', voice: 'Cherry', format: 'opus', sampleRate: 48000 },
  // qwen3-tts-flash-realtime + Cherry
  { provider: 'qwen-realtime', model: 'qwen3-tts-flash-realtime', voice: 'Cherry', format: 'pcm', sampleRate: 8000 },
  { provider: 'qwen-realtime', model: 'qwen3-tts-flash-realtime', voice: 'Cherry', format: 'pcm', sampleRate: 16000 },
  { provider: 'qwen-realtime', model: 'qwen3-tts-flash-realtime', voice: 'Cherry', format: 'pcm', sampleRate: 24000 },
  { provider: 'qwen-realtime', model: 'qwen3-tts-flash-realtime', voice: 'Cherry', format: 'pcm', sampleRate: 48000 },
  { provider: 'qwen-realtime', model: 'qwen3-tts-flash-realtime', voice: 'Cherry', format: 'opus', sampleRate: 8000 },
  { provider: 'qwen-realtime', model: 'qwen3-tts-flash-realtime', voice: 'Cherry', format: 'opus', sampleRate: 16000 },
  { provider: 'qwen-realtime', model: 'qwen3-tts-flash-realtime', voice: 'Cherry', format: 'opus', sampleRate: 24000 },
  { provider: 'qwen-realtime', model: 'qwen3-tts-flash-realtime', voice: 'Cherry', format: 'opus', sampleRate: 48000 },
  // qwen3-tts-realtime + Cherry
  { provider: 'qwen-realtime', model: 'qwen-tts-realtime', voice: 'Cherry', format: 'pcm', sampleRate: 24000 },
];

/**
 * Qwen 场景配置
 */
export const qwenScenarioConfig: MatrixScenarioConfig = {
  name: 'qwen-matrix',
  description: 'Qwen TTS 矩阵测试：覆盖不同模型、音色、编码、采样率的组合',
  testType: 'tts',
  iterations: 3,
  timeout: 120000,
};

/**
 * Qwen 提供商矩阵配置
 */
export const QWEN_MATRIX_CONFIG: ProviderMatrixConfig = {
  provider: 'qwen',
  displayName: '通义千问',
  items: qwenMatrixItems,
  scenarioConfig: qwenScenarioConfig,
  createConfigFactory: (matrixConfig) => ({
    provider: matrixConfig.provider,
    apiKey: process.env.QWEN_API_KEY || '',
    model: matrixConfig.model,
    voice: matrixConfig.voice,
    format: matrixConfig.format,
    sampleRate: matrixConfig.sampleRate
  })
};
