/**
 * 流式 Opus 解码器
 *
 * 将 Opus 数据包流式解码为 PCM 流
 * 依赖 prism-media（作为 optionalDependency）
 *
 * @module opus-decode
 */

import { Buffer } from 'node:buffer';

/**
 * 解码选项
 */
export interface DecodeOpusStreamOptions {
  /** 目标 PCM 采样率，默认 16000（ASR 常用采样率） */
  sampleRate?: number;
  /** 声道数，默认 1（单声道） */
  channels?: number;
  /** Opus 帧大小（毫秒），默认 20 */
  frameSizeMs?: number;
}

/**
 * 将 Opus 数据包流式解码为 PCM 流
 *
 * 真正的流式处理：收到一个 Opus packet 就解码输出 PCM，不等待全部数据。
 * 利用 prism-media 的 opus.Decoder（Transform Stream）实现逐 packet 解码。
 * Opus 解码器原生支持输出任意采样率的 PCM，无需 ffmpeg 重采样。
 *
 * @param opusPackets Opus 数据包流（AsyncIterable<Buffer>）
 * @param options 解码选项
 * @returns PCM 音频流（AsyncIterable<Buffer>）
 *
 * @example
 * ```typescript
 * import { decodeOpusStream } from 'univoice/asr';
 *
 * // 硬件端发送的 Opus 裸流
 * const pcmStream = decodeOpusStream(hardwareStream, {
 *   sampleRate: 16000,
 * });
 *
 * // 直接传给 ASR 服务
 * for await (const chunk of asr.listen(pcmStream, { stream: true })) {
 *   console.log(chunk.text);
 * }
 * ```
 */
export async function* decodeOpusStream(
  opusPackets: AsyncIterable<Buffer>,
  options?: DecodeOpusStreamOptions
): AsyncIterable<Buffer> {
  const { sampleRate = 16000, channels = 1, frameSizeMs = 20 } = options || {};

  // 动态导入 prism-media
  let prismMedia: typeof import('prism-media');
  try {
    prismMedia = await import('prism-media');
  } catch {
    throw new Error(
      'prism-media is required for Opus decoding but is not installed. ' +
        'Install it with: npm install prism-media or pnpm add prism-media'
    );
  }

  // 计算帧大小（采样数）
  const frameSize = (sampleRate / 1000) * frameSizeMs;

  // 创建 Opus 解码器（Transform Stream）
  // Opus 解码器原生支持输出任意采样率的 PCM
  const decoder = new prismMedia.opus.Decoder({
    frameSize,
    channels,
    rate: sampleRate,
  });

  // 将 Transform Stream 桥接为 AsyncIterable，实现背压处理
  yield* bridgeTransformStream(decoder, opusPackets);
}

/**
 * 将 Node.js Transform Stream 桥接为 AsyncIterable
 *
 * 核心机制（拉取式）：
 * 1. 后台异步任务从 opusPackets 逐个拉取 packet 并写入解码器
 * 2. 解码器解码后输出 PCM chunk 到队列
 * 3. 消费者从队列拉取 PCM chunk
 * 4. 通过背压控制（highWaterMark）确保不会无限缓冲
 *
 * @param decoder Opus 解码器（Transform Stream）
 * @param opusPackets Opus 数据包源
 */
async function* bridgeTransformStream(
  decoder: InstanceType<typeof import('prism-media').opus.Decoder>,
  opusPackets: AsyncIterable<Buffer>
): AsyncIterable<Buffer> {
  const pcmChunks: Buffer[] = [];
  let decodeError: Error | null = null;
  let outputDone = false;

  // 收集解码输出
  decoder.on('data', (chunk: Buffer) => {
    pcmChunks.push(chunk);
  });

  decoder.on('error', (err: Error) => {
    decodeError = err;
  });

  decoder.on('end', () => {
    outputDone = true;
  });

  // 后台：流式写入 Opus 数据包到解码器
  const writePromise = (async () => {
    try {
      for await (const packet of opusPackets) {
        if (decodeError) break;
        const data = Buffer.isBuffer(packet) ? packet : Buffer.from(packet);
        // 写入解码器，如果缓冲区满则等待 drain（背压控制）
        if (!decoder.write(data)) {
          await new Promise<void>((resolve) => decoder.once('drain', resolve));
        }
      }
    } catch (err) {
      decodeError = err instanceof Error ? err : new Error(String(err));
    } finally {
      decoder.end();
    }
  })();

  // 等待写入启动
  await new Promise((resolve) => setImmediate(resolve));

  // 从解码器拉取 PCM 数据
  while (!outputDone || pcmChunks.length > 0) {
    if (decodeError) {
      throw decodeError;
    }

    if (pcmChunks.length > 0) {
      const chunk = pcmChunks.shift();
      if (chunk) yield chunk;
    } else if (!outputDone) {
      // 等待解码器产生数据或结束
      await new Promise<void>((resolve) => {
        const cleanup = () => {
          decoder.removeListener('data', onData);
          decoder.removeListener('end', onEnd);
          decoder.removeListener('error', onError);
        };
        const onData = () => {
          cleanup();
          resolve();
        };
        const onEnd = () => {
          cleanup();
          resolve();
        };
        const onError = (err: Error) => {
          cleanup();
          decodeError = err;
          resolve();
        };
        decoder.once('data', onData);
        decoder.once('end', onEnd);
        decoder.once('error', onError);
      });
    } else {
      break;
    }
  }

  // 等待写入完成
  await writePromise;

  if (decodeError) {
    throw decodeError;
  }
}
