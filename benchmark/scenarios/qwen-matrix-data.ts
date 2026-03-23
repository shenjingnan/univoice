/**
 * Qwen TTS 矩阵测试数据
 * 测试不同模型、音色、编码、采样率的组合
 */
import type { MatrixItem } from '../metrics/types';

/**
 * Qwen TTS 矩阵测试列表
 * 每个项代表一个完整的测试场景
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
];
