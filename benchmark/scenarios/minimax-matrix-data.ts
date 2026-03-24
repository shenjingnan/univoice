/**
 * Minimax TTS 矩阵测试数据
 * 测试不同模型、音色、编码、采样率的组合
 */
import type { MatrixItem } from '../metrics/types';

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
 * 每个项代表一个完整的测试场景
 *
 * 测试矩阵：
 * - 模型：speech-2.8-hd, speech-2.8-turbo, speech-2.6-hd, speech-2.6-turbo,
 *        speech-02-hd, speech-02-turbo, speech-01-hd, speech-01-turbo
 * - 音色：male-qn-qingse
 * - 格式：pcm
 * - 采样率：8000, 16000, 22050, 24000, 32000, 44100
 *
 * 总计：8 模型 × 1 音色 × 1 格式 × 6 采样率 = 48 个测试组合
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
