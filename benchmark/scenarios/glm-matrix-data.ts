/**
 * GLM TTS 矩阵测试数据
 * 测试不同模型、音色、编码、采样率的组合
 */
import type { MatrixItem } from '../metrics/types';

/**
 * GLM TTS 矩阵测试列表
 * 每个项代表一个完整的测试场景
 *
 * 测试矩阵：
 * - 模型：glm-tts
 * - 音色：tongtong
 * - 格式：pcm（GLM TTS 流式模式只支持 PCM 格式）
 * - 采样率：24000 Hz
 *
 * 总计：1 个测试组合
 */
export const glmMatrixItems: MatrixItem[] = [
  { provider: 'glm', model: 'glm-tts', voice: 'tongtong', format: 'pcm', sampleRate: 24000 },
];
