/**
 * PCM → Opus 流式编码器
 *
 * 将 PCM 音频流流式编码为 Opus 数据包流（可选 OGG 容器封装）。
 * 依赖 prism-media（作为 optionalDependency），使用 libopus 原生编码能力。
 *
 * 核心机制：
 * 1. 从 TTS 流式拉取 PCM chunk（AsyncIterable<TTSStreamChunk> 或裸 Uint8Array 流）
 * 2. 帧缓冲区累积 PCM 数据，凑够一整帧后送入 Opus 编码器
 * 3. 编码器输出 Opus packet 后立即 yield 给消费者（真正的流式，不等待全部数据）
 * 4. 流结束时尾部不足一帧的数据用零填充
 *
 * @module pcm-to-opus
 */

import { Buffer } from 'node:buffer';
import { createOggMuxerWithEos } from '@/asr/utils/ogg-muxer';
import type { TTSStreamChunk } from '@/types/tts';

/** Opus 支持的帧时长（毫秒） */
const VALID_FRAME_DURATIONS_MS = [2.5, 5, 10, 20, 40, 60];

/**
 * PCM → Opus 流式编码选项
 */
export interface PcmToOpusOptions {
  /** PCM 采样率（Hz），默认 24000（与 Doubao TTS PCM 输出一致） */
  sampleRate?: number;
  /** 声道数，默认 1（单声道） */
  channels?: number;
  /**
   * Opus 帧时长（毫秒），默认 60
   *
   * 可选值: 2.5, 5, 10, 20, 40, 60
   * - 20ms: 标准值，延迟与压缩率平衡
   * - 60ms: 高压缩率，适合 TTS 离线场景
   */
  frameDurationMs?: number;
  /** PCM 位深（bytes per sample），默认 2（16-bit） */
  bytesPerSample?: number;
  /**
   * 是否封装为 OGG 容器格式，默认 false
   *
   * 设为 true 时输出可直接播放的 OGG 流，
   * 内部复用 createOggMuxerWithEos 实现。
   */
  ogg?: boolean | { encoder?: string };
}

/**
 * 将 PCM 音频流流式编码为 Opus 数据包流
 *
 * @param pcmStream PCM 音频数据流
 *   - AsyncIterable<TTSStreamChunk>: TTS speak() 的标准返回类型，自动提取 audioChunk
 *   - AsyncIterable<Uint8Array> | AsyncIterable<Buffer>: 原始 PCM 字节流
 * @param options 编码选项
 * @returns Opus 数据包流（AsyncIterable<Buffer>）
 *   - 裸 Opus 模式（默认）: 每个 Buffer 是一个独立的 Opus 编码帧
 *   - OGG 模式（{ ogg: true }）: 每个 Buffer 是一个 OGG 页面，可直接写入文件播放
 *
 * @example
 * ```typescript
 * import { createTTS, pcmToOpus } from 'univoice';
 *
 * const tts = createTTS({ provider: 'doubao', format: 'pcm', sampleRate: 24000 });
 * const pcmStream = tts.speak('你好世界', { stream: true });
 *
 * // 裸 Opus 包流
 * for await (const packet of pcmToOpus(pcmStream)) {
 *   ws.send(packet);
 * }
 *
 * // OGG 封装流（可直接播放）
 * for await (const page of pcmToOpus(pcmStream, { ogg: true })) {
 *   // 写入文件或发送到 WebSocket
 * }
 * ```
 */
export async function* pcmToOpus(
  pcmStream: AsyncIterable<TTSStreamChunk> | AsyncIterable<Uint8Array> | AsyncIterable<Buffer>,
  options?: PcmToOpusOptions
): AsyncIterable<Buffer> {
  // ====== 参数解析与校验 ======
  const {
    sampleRate = 24000,
    channels = 1,
    frameDurationMs = 60,
    bytesPerSample = 2,
    ogg: oggEnabled,
  } = options || {};

  if (sampleRate <= 0) {
    throw new RangeError('sampleRate must be a positive number');
  }
  if (channels <= 0) {
    throw new RangeError('channels must be a positive number');
  }
  if (!VALID_FRAME_DURATIONS_MS.includes(frameDurationMs)) {
    throw new RangeError(`frameDurationMs must be one of: ${VALID_FRAME_DURATIONS_MS.join(', ')}`);
  }
  if (bytesPerSample !== 1 && bytesPerSample !== 2) {
    throw new RangeError('bytesPerSample must be 1 or 2');
  }

  const frameSizeSamples = Math.round((sampleRate / 1000) * frameDurationMs);
  const frameSizeBytes = frameSizeSamples * bytesPerSample;

  // ====== 动态导入 prism-media ======
  let prismMedia: typeof import('prism-media');
  try {
    prismMedia = await import('prism-media');
  } catch {
    throw new Error(
      'prism-media is required for Opus encoding but is not installed. ' +
        'Install it with: pnpm add prism-media'
    );
  }

  // ====== 创建 Opus 编码器（Transform Stream）======
  const encoder = new prismMedia.opus.Encoder({
    frameSize: frameSizeSamples,
    channels,
    rate: sampleRate,
  });

  // ====== 输出队列与状态 ======
  const outputQueue: Buffer[] = [];
  let encodeError: Error | null = null;
  let outputDone = false;

  // 条件变量：用于在输出队列为空且未完成时阻塞主循环，
  // 当有新数据入队或流结束时唤醒。
  // 无论裸 Opus 模式还是 OGG 模式，都通过此机制统一唤醒，避免事件丢失。
  let wakeUpResolver: (() => void) | null = null;

  function wakeUp(): void {
    if (wakeUpResolver) {
      const r = wakeUpResolver;
      wakeUpResolver = null;
      r();
    }
  }

  // ====== OGG 模式初始化 ======
  const useOgg = !!oggEnabled;
  const oggEncoderName = typeof oggEnabled === 'object' ? oggEnabled.encoder : undefined;

  let oggMuxer: ReturnType<typeof createOggMuxerWithEos> | null = null;
  let pushIterable: PushIterable<Buffer> | null = null;

  if (useOgg) {
    // 创建可手动推送的 AsyncIterable 适配器，将 encoder 的 data 事件桥接为 AsyncIterable
    pushIterable = new PushIterable<Buffer>();
    oggMuxer = createOggMuxerWithEos(pushIterable.asyncIterable, {
      sampleRate,
      channels,
      frameSizeMs: frameDurationMs,
      encoder: oggEncoderName ?? 'univoice',
    });
    // 从 OGG muxer 的流中拉取页面并送入输出队列
    (async () => {
      try {
        for await (const page of oggMuxer.stream) {
          outputQueue.push(page);
          wakeUp();
        }
      } catch (err) {
        if (!encodeError) {
          encodeError = err instanceof Error ? err : new Error(String(err));
        }
      } finally {
        outputDone = true;
        wakeUp();
      }
    })();
  }

  // 收集编码输出（裸 Opus 模式直接入队；OGG 模式通过 PushIterable 送入 muxer）
  encoder.on('data', (chunk: Buffer) => {
    if (useOgg && pushIterable) {
      pushIterable.push(chunk);
    } else {
      outputQueue.push(chunk);
      wakeUp();
    }
  });

  encoder.on('error', (err: Error) => {
    encodeError = err;
    if (!useOgg) {
      outputDone = true;
    }
    wakeUp();
  });

  // 裸 Opus 模式的结束信号
  if (!useOgg) {
    encoder.on('end', () => {
      outputDone = true;
      wakeUp();
    });
  }

  // ====== 后台任务：从 PCM 流拉取数据并送入编码器 ======
  const writePromise = (async () => {
    let pcmBuffer = Buffer.alloc(0);

    try {
      for await (const chunk of pcmStream) {
        if (encodeError) break;

        // 类型收窄：TTSStreamChunk 提取 audioChunk，其他直接使用
        const rawData = extractPcmData(chunk);
        const data = Buffer.isBuffer(rawData) ? rawData : Buffer.from(rawData);

        // 追加到帧缓冲区
        pcmBuffer = Buffer.concat([pcmBuffer, data]);

        // 凑够一帧就编码
        while (pcmBuffer.length >= frameSizeBytes) {
          const frame = pcmBuffer.subarray(0, frameSizeBytes);
          pcmBuffer = pcmBuffer.subarray(frameSizeBytes);
          encoder.write(frame);
        }
      }

      // 尾部不足一帧的数据用零填充（静音填充）
      if (pcmBuffer.length > 0) {
        const paddedFrame = Buffer.alloc(frameSizeBytes);
        pcmBuffer.copy(paddedFrame);
        encoder.write(paddedFrame);
      }
    } catch (err) {
      encodeError = err instanceof Error ? err : new Error(String(err));
    } finally {
      // 结束编码器（刷新内部缓冲区）
      encoder.end();

      // OGG 模式：通知 muxer 发送 EOS 页面
      if (useOgg && oggMuxer) {
        oggMuxer.finish();
        if (pushIterable) {
          pushIterable.finish();
        }
      }
    }
  })();

  // 等待后台任务启动
  await new Promise((resolve) => setImmediate(resolve));

  // ====== 主循环：从队列 yield 数据给消费者 ======
  while (!outputDone || outputQueue.length > 0) {
    if (encodeError) {
      // 等待后台任务完成以确保资源清理
      await writePromise.catch(() => {});
      throw encodeError;
    }

    if (outputQueue.length > 0) {
      const item = outputQueue.shift();
      if (item) yield item;
    } else if (!outputDone) {
      // 等待有新数据入队或流结束（通过 wakeUp 条件变量唤醒）
      await new Promise<void>((resolve) => {
        wakeUpResolver = resolve;
      });
    }
  }

  // 等待后台写入任务完成
  await writePromise;

  if (encodeError) {
    throw encodeError;
  }
}

// ==================== 内部工具 ====================

/**
 * 从流式 chunk 中提取原始 PCM 数据
 *
 * @internal
 */
function extractPcmData(chunk: TTSStreamChunk | Uint8Array | Buffer): Uint8Array | Buffer {
  if ('audioChunk' in chunk && chunk.audioChunk instanceof Uint8Array) {
    return chunk.audioChunk;
  }
  return chunk as Uint8Array | Buffer;
}

/**
 * 可手动推送数据的 AsyncIterable 适配器
 *
 * 用于将事件驱动（如 encoder.on('data')）的数据源转换为 AsyncIterable<Buffer>，
 * 以便接入 createOggMuxerWithEos 等 AsyncIterable 消费者。
 *
 * @internal
 */
class PushIterable<T> implements AsyncIterable<T> {
  private queue: T[] = [];
  private done = false;
  private error: Error | null = null;
  private pendingResolver: ((result: IteratorResult<T>) => void) | null = null;

  push(value: T): void {
    this.queue.push(value);
    if (this.pendingResolver) {
      const resolver = this.pendingResolver;
      this.pendingResolver = null;
      const shifted = this.queue.shift();
      resolver({ value: shifted as T, done: false });
    }
  }

  finish(err?: Error): void {
    if (err) {
      this.error = err;
    }
    this.done = true;
    if (this.pendingResolver) {
      const resolver = this.pendingResolver;
      this.pendingResolver = null;
      if (this.error) {
        resolver(Promise.reject(this.error) as unknown as IteratorResult<T>);
      } else {
        resolver({ value: undefined as T, done: true });
      }
    }
  }

  get asyncIterable(): AsyncIterable<T> {
    return this;
  }

  [Symbol.asyncIterator](): AsyncIterator<T> {
    return {
      next: (): Promise<IteratorResult<T>> => {
        if (this.queue.length > 0) {
          const shifted = this.queue.shift();
          return Promise.resolve({
            value: shifted as T,
            done: false,
          });
        }
        if (this.error) {
          const err = this.error;
          this.error = null;
          return Promise.reject(err);
        }
        if (this.done) {
          return Promise.resolve({
            value: undefined as T,
            done: true,
          });
        }
        return new Promise((resolve) => {
          this.pendingResolver = resolve;
        });
      },
    };
  }
}
