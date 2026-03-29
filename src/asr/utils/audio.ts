/**
 * 音频处理工具
 * 用于音频格式判断、转换和分割
 */

import { Buffer } from 'node:buffer';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, unlinkSync, writeFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * 默认采样率
 */
export const DEFAULT_SAMPLE_RATE = 16000;

/**
 * WAV 文件信息
 */
export interface WavInfo {
  channels: number;
  sampleWidth: number;
  sampleRate: number;
  frameCount: number;
  data: Buffer;
}

/**
 * 判断是否为 WAV 格式
 */
export function isWav(data: Buffer): boolean {
  if (data.length < 44) {
    return false;
  }
  return data.slice(0, 4).toString() === 'RIFF' && data.slice(8, 12).toString() === 'WAVE';
}

/**
 * 检测是否为压缩音频格式（MP3、OGG、FLAC 等）
 */
export function isCompressedAudio(data: Buffer): boolean {
  if (data.length < 4) return false;
  // MP3: ID3v2 标签
  if (data[0] === 0x49 && data[1] === 0x44 && data[2] === 0x33) return true;
  // MP3: 帧同步标记
  if (data[0] === 0xff && (data[1] & 0xe0) === 0xe0) return true;
  // OGG
  if (data.slice(0, 4).toString() === 'OggS') return true;
  // FLAC
  if (data.slice(0, 4).toString() === 'fLaC') return true;
  return false;
}

/**
 * 将裸 PCM 数据封装为 WAV 格式
 */
export function createWavFromPcm(
  pcmData: Buffer,
  sampleRate: number = DEFAULT_SAMPLE_RATE,
  channels: number = 1,
  bitDepth: number = 16
): Buffer {
  const byteRate = sampleRate * channels * (bitDepth / 8);
  const blockAlign = channels * (bitDepth / 8);
  const dataSize = pcmData.length;

  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM 格式
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitDepth, 34);
  header.write('data', 36);
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, pcmData]);
}

/**
 * 解析 WAV 文件信息
 */
export function parseWavInfo(data: Buffer): WavInfo {
  if (data.length < 44) {
    throw new Error('Invalid WAV file: too short');
  }

  // 解析 WAV 头
  const chunkId = data.slice(0, 4).toString();
  if (chunkId !== 'RIFF') {
    throw new Error('Invalid WAV file: not RIFF format');
  }

  const format = data.slice(8, 12).toString();
  if (format !== 'WAVE') {
    throw new Error('Invalid WAV file: not WAVE format');
  }

  // 解析 fmt 子块
  const audioFormat = data.readUInt16LE(20);
  if (audioFormat !== 1) {
    throw new Error(`Unsupported WAV format: ${audioFormat}, only PCM (1) is supported`);
  }

  const numChannels = data.readUInt16LE(22);
  const sampleRate = data.readUInt32LE(24);
  const bitsPerSample = data.readUInt16LE(34);

  // 查找 data 子块
  let pos = 36;
  while (pos < data.length - 8) {
    const subchunkId = data.slice(pos, pos + 4).toString();
    const subchunkSize = data.readUInt32LE(pos + 4);

    if (subchunkId === 'data') {
      const waveData = data.slice(pos + 8, pos + 8 + subchunkSize);
      const frameCount = Math.floor(subchunkSize / (numChannels * (bitsPerSample / 8)));

      return {
        channels: numChannels,
        sampleWidth: bitsPerSample / 8,
        sampleRate,
        frameCount,
        data: waveData,
      };
    }

    pos += 8 + subchunkSize;
  }

  throw new Error('Invalid WAV file: no data subchunk found');
}

/**
 * 检查 ffmpeg 是否可用
 */
export function checkFfmpeg(): boolean {
  try {
    execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * 创建临时目录
 */
let tempDir: string | null = null;

function getTempDir(): string {
  if (!tempDir) {
    tempDir = mkdtempSync(join(tmpdir(), 'univoice-asr-'));
  }
  return tempDir;
}

/**
 * 使用 ffmpeg 转换音频为 WAV 格式
 */
export function convertToWav(
  input: Buffer | string,
  sampleRate: number = DEFAULT_SAMPLE_RATE
): Buffer {
  if (!checkFfmpeg()) {
    throw new Error('ffmpeg is not installed or not in PATH');
  }

  let inputPath: string;
  let shouldCleanup = false;

  if (Buffer.isBuffer(input)) {
    // 将 Buffer 写入临时文件
    const tempFile = join(getTempDir(), `input-${Date.now()}.tmp`);
    writeFileSync(tempFile, input);
    inputPath = tempFile;
    shouldCleanup = true;
  } else {
    inputPath = input;
  }

  try {
    const result = execFileSync(
      'ffmpeg',
      [
        '-v',
        'quiet',
        '-y',
        '-i',
        inputPath,
        '-acodec',
        'pcm_s16le',
        '-ac',
        '1',
        '-ar',
        String(sampleRate),
        '-f',
        'wav',
        '-',
      ],
      { maxBuffer: 50 * 1024 * 1024 } // 50MB buffer
    );
    return result;
  } finally {
    if (shouldCleanup) {
      try {
        unlinkSync(inputPath);
      } catch {
        // 忽略清理错误
      }
    }
  }
}

/**
 * 使用 ffprobe 检测音频文件的采样率
 *
 * @param input 音频文件路径或 Buffer
 * @returns 采样率（Hz），如果无法检测则返回 null
 */
export function detectSampleRate(input: Buffer | string): number | null {
  if (!checkFfmpeg()) {
    return null;
  }

  let inputPath: string;
  let shouldCleanup = false;

  if (Buffer.isBuffer(input)) {
    // 将 Buffer 写入临时文件
    const tempFile = join(getTempDir(), `input-${Date.now()}.tmp`);
    writeFileSync(tempFile, input);
    inputPath = tempFile;
    shouldCleanup = true;
  } else {
    inputPath = input;
  }

  try {
    const result = execFileSync(
      'ffprobe',
      [
        '-v',
        'error',
        '-show_entries',
        'stream=sample_rate',
        '-of',
        'default=noprint_wrappers=1:nokey=1',
        inputPath,
      ],
      { encoding: 'utf8' }
    );

    const sampleRate = parseInt(result.trim(), 10);
    if (Number.isNaN(sampleRate) || sampleRate <= 0) {
      return null;
    }

    return sampleRate;
  } catch {
    return null;
  } finally {
    if (shouldCleanup) {
      try {
        unlinkSync(inputPath);
      } catch {
        // 忽略清理错误
      }
    }
  }
}

/**
 * 根据时长计算分段大小（字节数）
 */
export function calculateSegmentSize(
  channels: number,
  sampleWidth: number,
  sampleRate: number,
  durationMs: number
): number {
  const bytesPerSecond = channels * sampleWidth * sampleRate;
  return Math.floor((bytesPerSecond * durationMs) / 1000);
}

/**
 * 分割音频数据
 */
export function splitAudio(data: Buffer, segmentSize: number): Buffer[] {
  if (segmentSize <= 0) {
    return [];
  }

  const segments: Buffer[] = [];
  for (let i = 0; i < data.length; i += segmentSize) {
    const end = Math.min(i + segmentSize, data.length);
    segments.push(data.slice(i, end));
  }
  return segments;
}

/**
 * 读取音频数据
 * 支持多种输入类型：Buffer、文件路径
 */
export async function readAudio(input: Buffer | Uint8Array | string): Promise<Buffer> {
  if (Buffer.isBuffer(input)) {
    return input;
  }

  if (input instanceof Uint8Array) {
    return Buffer.from(input);
  }

  // 文件路径
  if (typeof input === 'string') {
    // 检查是否为 URL
    if (input.startsWith('http://') || input.startsWith('https://')) {
      const response = await fetch(input);
      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    }

    // 本地文件
    return readFile(input);
  }

  throw new Error(`Unsupported audio input type: ${typeof input}`);
}

/**
 * 处理音频数据
 * 包括格式转换、WAV 解析和分段计算
 */
export async function processAudio(
  input: Buffer | Uint8Array | string,
  segmentDurationMs: number = 200
): Promise<{
  wavData: Buffer;
  wavInfo: WavInfo;
  segmentSize: number;
  audioData: Buffer;
}> {
  // 读取音频数据
  const rawData = await readAudio(input);

  // 判断音频格式并转换为 WAV
  let wavData: Buffer;
  if (isWav(rawData)) {
    wavData = rawData;
  } else if (isCompressedAudio(rawData)) {
    // 压缩格式（MP3 等）需要 ffmpeg 解码
    wavData = convertToWav(rawData, DEFAULT_SAMPLE_RATE);
  } else {
    // 裸 PCM 数据，直接添加 WAV 头
    wavData = createWavFromPcm(rawData, DEFAULT_SAMPLE_RATE);
  }

  // 解析 WAV 信息
  const wavInfo = parseWavInfo(wavData);

  // 计算分段大小
  const segmentSize = calculateSegmentSize(
    wavInfo.channels,
    wavInfo.sampleWidth,
    wavInfo.sampleRate,
    segmentDurationMs
  );

  return {
    wavData,
    wavInfo,
    segmentSize,
    audioData: wavInfo.data,
  };
}

/**
 * 将 Buffer 或 Uint8Array 转换为音频流
 * 用于 listen 方法，支持流式输入识别
 *
 * @param buffer 音频数据
 * @param chunkSize 分块大小（字节），默认 3200（100ms @ 16kHz 16bit mono）
 * @returns 音频流
 */
export async function* bufferToAudioStream(
  buffer: Buffer | Uint8Array,
  chunkSize = 3200
): AsyncIterable<Buffer | Uint8Array> {
  for (let i = 0; i < buffer.length; i += chunkSize) {
    yield buffer.slice(i, Math.min(i + chunkSize, buffer.length));
  }
}
