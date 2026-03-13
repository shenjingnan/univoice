import { Buffer } from 'node:buffer';
import { spawn } from 'node:child_process';
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
  /** Opus 采样率，默认 24000（TTS 生成的默认采样率） */
  opusSampleRate?: number;
  /** 目标 PCM 采样率，默认 16000（ASR 需要的采样率） */
  targetSampleRate?: number;
  /** 声道数，默认 1（单声道） */
  channels?: number;
  /** 发包间隔（毫秒），默认 0（无间隔） */
  intervalMs?: number;
}

/**
 * 使用 ffmpeg 对 PCM 数据进行重采样
 *
 * @param pcmData 输入 PCM 数据
 * @param sourceRate 源采样率
 * @param targetRate 目标采样率
 * @param channels 声道数
 * @returns 重采样后的 PCM 数据
 */
async function resamplePcmBuffer(
  pcmData: Buffer,
  sourceRate: number,
  targetRate: number,
  channels: number = 1
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', [
      '-v',
      'quiet',
      '-f',
      's16le',
      '-ar',
      String(sourceRate),
      '-ac',
      String(channels),
      '-i',
      'pipe:0',
      '-f',
      's16le',
      '-ar',
      String(targetRate),
      '-ac',
      String(channels),
      'pipe:1',
    ]);

    const chunks: Buffer[] = [];

    ffmpeg.stdout.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
    });

    ffmpeg.on('close', (code) => {
      if (code === 0) {
        resolve(Buffer.concat(chunks));
      } else {
        reject(new Error(`ffmpeg exited with code ${code}`));
      }
    });

    ffmpeg.on('error', (err) => {
      reject(new Error(`Failed to start ffmpeg: ${err.message}`));
    });

    // 写入输入数据
    ffmpeg.stdin.write(pcmData);
    ffmpeg.stdin.end();
  });
}

/**
 * 将 Opus 数据包目录转换为 PCM 音频流
 *
 * 工作流程：
 * 1. 读取目录中所有 .opus 文件并按数字排序
 * 2. 使用 prism-media 的 OpusDecoder 解码 Opus 数据包为 PCM
 * 3. 使用 ffmpeg 重采样到目标采样率（默认 16kHz）
 * 4. 分块输出 PCM 数据
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
    opusSampleRate = 24000,
    targetSampleRate = 16000,
    channels = 1,
    intervalMs = 0,
  } = options || {};

  const { readFile } = await import('node:fs/promises');
  const { opus } = await import('prism-media');

  // 获取排序后的 Opus 文件列表
  const files = getSortedOpusFiles(directory);

  console.log(`找到 ${files.length} 个 Opus 文件，采样率 ${opusSampleRate}Hz`);

  // Opus 帧大小：20ms 帧
  // 采样率 24000Hz，20ms = 480 samples
  // 采样率 16000Hz，20ms = 320 samples
  // 采样率 48000Hz，20ms = 960 samples
  const frameSize = (opusSampleRate / 1000) * 20;

  // 创建 Opus 解码器
  const decoder = new opus.Decoder({
    frameSize,
    channels,
    rate: opusSampleRate,
  });

  // 将所有 Opus 数据包推送到解码器
  for (const file of files) {
    const opusData = await readFile(file);
    // 将 Opus 数据推送到解码器
    decoder.write(opusData);
  }

  // 监听解码输出
  const decodedPromise = new Promise<Buffer[]>((resolve, reject) => {
    const chunks: Buffer[] = [];

    decoder.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
    });

    decoder.on('end', () => {
      resolve(chunks);
    });

    decoder.on('error', (err: Error) => {
      reject(err);
    });

    // 结束输入流
    decoder.end();
  });

  const decodedChunks = await decodedPromise;
  const allPcmData = Buffer.concat(decodedChunks);

  console.log(`解码完成，PCM 数据大小: ${allPcmData.length} bytes`);

  // 如果采样率相同，直接分块输出
  if (opusSampleRate === targetSampleRate) {
    const chunkSize = (targetSampleRate * channels * 2 * 100) / 1000;
    for (let i = 0; i < allPcmData.length; i += chunkSize) {
      yield allPcmData.slice(i, Math.min(i + chunkSize, allPcmData.length));

      if (intervalMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
      }
    }
    return;
  }

  // 使用 ffmpeg 重采样
  const resampledData = await resamplePcmBuffer(
    allPcmData,
    opusSampleRate,
    targetSampleRate,
    channels
  );

  console.log(
    `重采样完成，目标采样率 ${targetSampleRate}Hz，数据大小: ${resampledData.length} bytes`
  );

  // 分块输出（每块约 100ms @ 16kHz 16bit mono = 3200 bytes）
  const chunkSize = (targetSampleRate * channels * 2 * 100) / 1000;
  for (let i = 0; i < resampledData.length; i += chunkSize) {
    yield resampledData.slice(i, Math.min(i + chunkSize, resampledData.length));

    if (intervalMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }
}
