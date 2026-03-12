/**
 * 将 OGG 音频文件解码成多个 Opus 数据包文件
 *
 * 使用 prism-media 的 OggDemuxer 从 OGG 容器中提取 Opus 数据包
 */
import { createReadStream, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { opus } from 'prism-media';

/**
 * 选项配置
 */
export interface OggToOpusPacketsOptions {
  /** 输出目录路径 */
  outputDir: string;
  /** 文件名前缀，默认为空 */
  filePrefix?: string;
}

/**
 * 将 OGG 音频文件解码成多个 Opus 数据包文件
 *
 * @param oggFilePath OGG 文件路径
 * @param options 选项配置
 * @returns 解码后的 Opus 数据包数量
 *
 * @example
 * ```typescript
 * const packetCount = await oggToOpusPackets('./audio.ogg', {
 *   outputDir: './output/packets',
 *   filePrefix: 'audio_'
 * });
 * console.log(`提取了 ${packetCount} 个 Opus 数据包`);
 * // 输出文件: audio_1.opus, audio_2.opus, ...
 * ```
 */
export async function oggToOpusPackets(
  oggFilePath: string,
  options: OggToOpusPacketsOptions
): Promise<number> {
  const { outputDir, filePrefix = '' } = options;

  // 验证文件存在
  if (!existsSync(oggFilePath)) {
    throw new Error(`OGG 文件不存在: ${oggFilePath}`);
  }

  // 创建输出目录
  mkdirSync(outputDir, { recursive: true });

  return new Promise((resolve, reject) => {
    const demuxer = new opus.OggDemuxer();
    let packetCount = 0;

    demuxer.on('data', (packet: Buffer) => {
      packetCount++;
      const filename = `${filePrefix}${packetCount}.opus`;
      const outputPath = join(outputDir, filename);
      writeFileSync(outputPath, packet);
    });

    demuxer.on('end', () => {
      resolve(packetCount);
    });

    demuxer.on('error', (err: Error) => {
      reject(err);
    });

    createReadStream(oggFilePath).pipe(demuxer);
  });
}
