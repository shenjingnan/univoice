import { Buffer } from 'node:buffer';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * 从文件名中提取数字用于排序
 */
function extractNumber(filename: string): number {
  const baseName = filename.replace(/\.[^.]+$/, '');
  const match = baseName.match(/^(\d+)/);
  if (match) {
    return Number.parseInt(match[1], 10);
  }
  return Number.POSITIVE_INFINITY;
}

/**
 * 获取目录中按数字排序的 PCM 文件列表
 *
 * @param directory PCM 文件目录路径
 * @returns 排序后的 PCM 文件路径列表
 * @throws 如果目录不存在或没有 PCM 文件
 */
export function getSortedPcmFiles(directory: string): string[] {
  const files = readdirSync(directory);
  const pcmFiles = files.filter((f) => f.toLowerCase().endsWith('.pcm'));

  if (pcmFiles.length === 0) {
    throw new Error(`No PCM files found in directory: ${directory}`);
  }

  // 按文件名中的数字排序
  pcmFiles.sort((a, b) => extractNumber(a) - extractNumber(b));

  // 返回完整路径
  return pcmFiles.map((f) => join(directory, f));
}

/**
 * PCM 目录转音频流选项
 */
export interface PcmDirectoryToStreamOptions {
  /** 发包间隔（毫秒），默认 100 */
  intervalMs?: number;
}

/**
 * 将 PCM 目录转换为音频流
 *
 * @param directory PCM 文件目录路径
 * @param options 转换选项
 * @returns 音频流（AsyncIterable<Buffer>）
 */
export async function* pcmDirectoryToAudioStream(
  directory: string,
  options?: PcmDirectoryToStreamOptions
): AsyncIterable<Buffer> {
  const { intervalMs = 100 } = options || {};
  const files = getSortedPcmFiles(directory);
  const { readFile } = await import('node:fs/promises');

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const isLast = i === files.length - 1;

    // 读取文件内容
    const data = await readFile(file);

    yield data;

    // 如果不是最后一个文件，等待指定的间隔
    if (!isLast && intervalMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }
}

/**
 * PCM 文件列表转音频流选项
 */
export interface PcmFilesToStreamOptions {
  /** 发包间隔（毫秒），默认 100 */
  intervalMs?: number;
}

/**
 * 将 PCM 文件列表转换为音频流
 *
 * @param files PCM 文件路径列表
 * @param options 转换选项
 * @returns 音频流（AsyncIterable<Buffer>）
 */
export async function* pcmFilesToAudioStream(
  files: string[],
  options?: PcmFilesToStreamOptions
): AsyncIterable<Buffer> {
  const { intervalMs = 100 } = options || {};
  const { readFile } = await import('node:fs/promises');

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const isLast = i === files.length - 1;

    // 读取文件内容
    const data = await readFile(file);

    yield data;

    // 如果不是最后一个文件，等待指定的间隔
    if (!isLast && intervalMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }
}
