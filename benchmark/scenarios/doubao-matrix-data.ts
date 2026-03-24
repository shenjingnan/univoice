/**
 * Doubao TTS 矩阵测试数据
 * 测试不同模型、音色、编码、采样率的组合
 */
import type { MatrixItem } from '../metrics/types';

/**
 * Doubao TTS 矩阵测试列表
 * 每个项代表一个完整的测试场景
 *
 * 测试矩阵：
 * - 模型：seed-tts-1.0, seed-tts-2.0
 * - seed-tts-1.0 音色：zh_male_lengkugege_emo_v2_mars_bigtts
 * - seed-tts-2.0 音色：zh_female_tianmeixiaoyuan_moon_bigtts
 * - 采样率：8000, 16000, 24000, 48000 Hz
 * - 格式：pcm, ogg_opus
 *
 * 总计：2 模型 × 4 采样率 × 2 格式 = 16 个测试组合
 */
export const doubaoMatrixItems: MatrixItem[] = [
  // ========== seed-tts-1.0 + pcm ==========
  { provider: 'doubao', model: 'seed-tts-1.0', voice: 'zh_male_lengkugege_emo_v2_mars_bigtts', format: 'pcm', sampleRate: 8000, },
  { provider: 'doubao', model: 'seed-tts-1.0', voice: 'zh_male_lengkugege_emo_v2_mars_bigtts', format: 'pcm', sampleRate: 16000, },
  { provider: 'doubao', model: 'seed-tts-1.0', voice: 'zh_male_lengkugege_emo_v2_mars_bigtts', format: 'pcm', sampleRate: 24000, },
  { provider: 'doubao', model: 'seed-tts-1.0', voice: 'zh_male_lengkugege_emo_v2_mars_bigtts', format: 'pcm', sampleRate: 48000, },

  // ========== seed-tts-1.0 + ogg_opus ==========
  { provider: 'doubao', model: 'seed-tts-1.0', voice: 'zh_male_lengkugege_emo_v2_mars_bigtts', format: 'ogg_opus', sampleRate: 8000, },
  { provider: 'doubao', model: 'seed-tts-1.0', voice: 'zh_male_lengkugege_emo_v2_mars_bigtts', format: 'ogg_opus', sampleRate: 16000, },
  { provider: 'doubao', model: 'seed-tts-1.0', voice: 'zh_male_lengkugege_emo_v2_mars_bigtts', format: 'ogg_opus', sampleRate: 24000, },
  { provider: 'doubao', model: 'seed-tts-1.0', voice: 'zh_male_lengkugege_emo_v2_mars_bigtts', format: 'ogg_opus', sampleRate: 48000, },

  // ========== seed-tts-2.0 + pcm ==========
  { provider: 'doubao', model: 'seed-tts-2.0', voice: 'zh_female_vv_uranus_bigtts', format: 'pcm', sampleRate: 8000, },
  { provider: 'doubao', model: 'seed-tts-2.0', voice: 'zh_female_vv_uranus_bigtts', format: 'pcm', sampleRate: 16000, },
  { provider: 'doubao', model: 'seed-tts-2.0', voice: 'zh_female_vv_uranus_bigtts', format: 'pcm', sampleRate: 24000, },
  { provider: 'doubao', model: 'seed-tts-2.0', voice: 'zh_female_vv_uranus_bigtts', format: 'pcm', sampleRate: 48000, },

  // ========== seed-tts-2.0 + ogg_opus ==========
  { provider: 'doubao', model: 'seed-tts-2.0', voice: 'zh_female_vv_uranus_bigtts', format: 'ogg_opus', sampleRate: 8000, },
  { provider: 'doubao', model: 'seed-tts-2.0', voice: 'zh_female_vv_uranus_bigtts', format: 'ogg_opus', sampleRate: 16000, },
  { provider: 'doubao', model: 'seed-tts-2.0', voice: 'zh_female_vv_uranus_bigtts', format: 'ogg_opus', sampleRate: 24000, },
  { provider: 'doubao', model: 'seed-tts-2.0', voice: 'zh_female_vv_uranus_bigtts', format: 'ogg_opus', sampleRate: 48000, },
];
