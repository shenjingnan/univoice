/**
 * @deprecated 请使用 SDK 内置的 ogg-muxer：
 *   import { createOggMuxer, createOggMuxerWithEos, createEosPage } from 'univoice/asr';
 *
 * 本文件保留仅为向后兼容，所有实现已移至 src/asr/utils/ogg-muxer.ts
 */

export type { OggMuxer, OggMuxerOptions } from '../../src/asr/utils/ogg-muxer';
export {
  createEosPage,
  createOggMuxer,
  createOggMuxerWithEos,
} from '../../src/asr/utils/ogg-muxer';
