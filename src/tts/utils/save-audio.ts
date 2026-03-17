import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { TTSStreamChunk } from '@/types/tts';

/**
 * 判断是否为异步迭代器
 */
function isAsyncIterable(value: unknown): value is AsyncIterable<unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    Symbol.asyncIterator in value &&
    typeof (value as AsyncIterable<unknown>)[Symbol.asyncIterator] === 'function'
  );
}

/**
 * 判断是否为 TTSStreamChunk 类型
 */
function isTTSStreamChunk(value: unknown): value is TTSStreamChunk {
  return (
    typeof value === 'object' &&
    value !== null &&
    'audioChunk' in value &&
    (value as TTSStreamChunk).audioChunk instanceof Uint8Array
  );
}

/**
 * 合并多个 Uint8Array
 */
function concatUint8Arrays(arrays: Uint8Array[]): Uint8Array {
  const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

/**
 * 创建 WAV 文件头
 * @param dataLength 音频数据长度
 * @param sampleRate 采样率（默认 24000）
 * @param channels 声道数（默认 1）
 * @param bitsPerSample 位深（默认 16）
 */
function createWavHeader(
  dataLength: number,
  sampleRate = 24000,
  channels = 1,
  bitsPerSample = 16
): Uint8Array {
  const headerLength = 44;
  const header = new Uint8Array(headerLength);
  const view = new DataView(header.buffer);

  // RIFF chunk descriptor
  view.setUint8(0, 0x52); // 'R'
  view.setUint8(1, 0x49); // 'I'
  view.setUint8(2, 0x46); // 'F'
  view.setUint8(3, 0x46); // 'F'
  view.setUint32(4, 36 + dataLength, true); // file size - 8
  view.setUint8(8, 0x57); // 'W'
  view.setUint8(9, 0x41); // 'A'
  view.setUint8(10, 0x56); // 'V'
  view.setUint8(11, 0x45); // 'E'

  // fmt sub-chunk
  view.setUint8(12, 0x66); // 'f'
  view.setUint8(13, 0x6d); // 'm'
  view.setUint8(14, 0x74); // 't'
  view.setUint8(15, 0x20); // ' '
  view.setUint32(16, 16, true); // sub-chunk size
  view.setUint16(20, 1, true); // audio format (PCM)
  view.setUint16(22, channels, true); // number of channels
  view.setUint32(24, sampleRate, true); // sample rate
  view.setUint32(28, sampleRate * channels * (bitsPerSample / 8), true); // byte rate
  view.setUint16(32, channels * (bitsPerSample / 8), true); // block align
  view.setUint16(34, bitsPerSample, true); // bits per sample

  // data sub-chunk
  view.setUint8(36, 0x64); // 'd'
  view.setUint8(37, 0x61); // 'a'
  view.setUint8(38, 0x74); // 't'
  view.setUint8(39, 0x61); // 'a'
  view.setUint32(40, dataLength, true); // data size

  return header;
}

/**
 * 保存音频数据到文件
 * 支持三种调用方式：
 * 1. saveAudio(filePath, chunks) - chunks 是 Uint8Array[]
 * 2. saveAudio(filePath, asyncIterable) - AsyncIterable<Uint8Array>
 * 3. saveAudio(filePath, asyncIterable) - AsyncIterable<TTSStreamChunk>
 *
 * @param filePath 目标文件路径
 * @param source 音频数据源，可以是 Uint8Array 数组或异步迭代器
 * @param options 可选参数
 * @param options.sampleRate 采样率，用于生成 WAV 头（默认 24000）
 */
export async function saveAudio(
  filePath: string,
  source: Uint8Array[] | AsyncIterable<Uint8Array> | AsyncIterable<TTSStreamChunk>,
  options?: { sampleRate?: number }
): Promise<void> {
  const chunks: Uint8Array[] = [];

  // 判断是否为异步迭代器
  if (isAsyncIterable(source)) {
    for await (const chunk of source) {
      // 自动检测并提取 audioChunk
      if (isTTSStreamChunk(chunk)) {
        chunks.push(chunk.audioChunk);
      } else if (chunk instanceof Uint8Array) {
        chunks.push(chunk);
      }
    }
  } else {
    chunks.push(...source);
  }

  // 合并音频数据
  const audio = concatUint8Arrays(chunks);

  // 根据文件扩展名判断是否需要添加 WAV 头
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.wav') {
    // 检查是否已有 WAV 头（RIFF 标识）
    const hasWavHeader =
      audio.length >= 4 &&
      audio[0] === 0x52 && // 'R'
      audio[1] === 0x49 && // 'I'
      audio[2] === 0x46 && // 'F'
      audio[3] === 0x46; // 'F'

    if (!hasWavHeader) {
      // 添加 WAV 头
      const sampleRate = options?.sampleRate ?? 24000;
      const wavHeader = createWavHeader(audio.length, sampleRate);
      const wavData = new Uint8Array(wavHeader.length + audio.length);
      wavData.set(wavHeader);
      wavData.set(audio, wavHeader.length);
      await writeFile(filePath, wavData);
      return;
    }
  }

  await writeFile(filePath, audio);
}
