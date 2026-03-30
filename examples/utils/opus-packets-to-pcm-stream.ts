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
 * 获取目录中按数字排序的 Opus 文件列表
 *
 * @param directory Opus 文件目录路径
 * @returns 排序后的 Opus 文件路径列表
 * @throws 如果目录不存在或没有 Opus 文件
 */
export function getSortedOpusFiles(directory: string): string[] {
  const files = readdirSync(directory);
  const opusFiles = files.filter((f) => f.toLowerCase().endsWith('.opus'));

  if (opusFiles.length === 0) {
    throw new Error(`No Opus files found in directory: ${directory}`);
  }

  // 按文件名中的数字排序
  opusFiles.sort((a, b) => extractNumber(a) - extractNumber(b));

  // 返回完整路径
  return opusFiles.map((f) => join(directory, f));
}

/**
 * Opus 数据包转 PCM 流选项
 */
export interface OpusPacketsToPcmStreamOptions {
  /** Opus 采样率，默认 16000 */
  opusSampleRate?: number;
  /** 目标 PCM 采样率，默认 16000（ASR 需要的采样率） */
  targetSampleRate?: number;
  /** 声道数，默认 1（单声道） */
  channels?: number;
  /** 发包间隔（毫秒），默认 0（无间隔） */
  intervalMs?: number;
}

/**
 * 将 Opus 数据包目录转换为 PCM 音频流
 *
 * 使用 SDK 内置的 decodeOpusStream 进行流式解码。
 * 每收到一个 Opus packet 就立即解码输出 PCM，不等待全部数据。
 *
 * @param directory Opus 数据包目录路径
 * @param options 转换选项
 * @returns PCM 音频流（AsyncIterable<Buffer>）
 */
export async function* opusPacketsToPcmStream(
  directory: string,
  options?: OpusPacketsToPcmStreamOptions
): AsyncIterable<Buffer> {
  const {
    opusSampleRate = 16000,
    targetSampleRate = 16000,
    channels = 1,
    intervalMs = 0,
  } = options || {};

  const { readFile } = await import('node:fs/promises');

  // 动态导入 SDK 内置的 decodeOpusStream
  const { decodeOpusStream } = await import('../../src/asr/utils/opus-decode');

  // 获取排序后的 Opus 文件列表
  const files = getSortedOpusFiles(directory);

  console.log(`找到 ${files.length} 个 Opus 文件，采样率 ${opusSampleRate}Hz`);

  // 创建从目录读取 Opus 文件的异步生成器
  async function* readOpusPackets(): AsyncIterable<Buffer> {
    for (const file of files) {
      yield await readFile(file);
    }
  }

  // 使用 SDK 内置的 decodeOpusStream 进行流式解码
  for await (const pcmChunk of decodeOpusStream(readOpusPackets(), {
    sampleRate: targetSampleRate,
    channels,
  })) {
    yield pcmChunk;

    if (intervalMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }
}
