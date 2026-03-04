import { writeFile } from 'node:fs/promises';

/**
 * 判断是否为异步迭代器
 */
function isAsyncIterable(value: unknown): value is AsyncIterable<Uint8Array> {
  return (
    typeof value === 'object' &&
    value !== null &&
    Symbol.asyncIterator in value &&
    typeof (value as AsyncIterable<Uint8Array>)[Symbol.asyncIterator] === 'function'
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
 * 支持两种调用方式：
 * 1. saveToFile(filePath, chunks) - chunks 是 Uint8Array[]
 * 2. saveToFile(filePath, asyncIterable) - 直接传入异步迭代器
 *
 * @param filePath 目标文件路径
 * @param source 音频数据源，可以是 Uint8Array 数组或异步迭代器
 */
export async function saveToFile(
  filePath: string,
  source: Uint8Array[] | AsyncIterable<Uint8Array>
): Promise<void> {
  const chunks: Uint8Array[] = [];

  // 判断是否为异步迭代器
  if (isAsyncIterable(source)) {
    for await (const chunk of source) {
      chunks.push(chunk);
    }
  } else {
    chunks.push(...source);
  }

  // 合并并写入文件
  const audio = concatUint8Arrays(chunks);
  await writeFile(filePath, audio);
}