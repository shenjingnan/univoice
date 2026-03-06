import { writeFile } from 'node:fs/promises';
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
 * 保存音频数据到文件
 * 支持三种调用方式：
 * 1. saveAudio(filePath, chunks) - chunks 是 Uint8Array[]
 * 2. saveAudio(filePath, asyncIterable) - AsyncIterable<Uint8Array>
 * 3. saveAudio(filePath, asyncIterable) - AsyncIterable<TTSStreamChunk>
 *
 * @param filePath 目标文件路径
 * @param source 音频数据源，可以是 Uint8Array 数组或异步迭代器
 */
export async function saveAudio(
  filePath: string,
  source: Uint8Array[] | AsyncIterable<Uint8Array> | AsyncIterable<TTSStreamChunk>
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

  // 合并并写入文件
  const audio = concatUint8Arrays(chunks);
  await writeFile(filePath, audio);
}
