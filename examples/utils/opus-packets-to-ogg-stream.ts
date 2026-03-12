/**
 * Opus 数据包转 OGG 流工具
 *
 * 将原始 Opus 数据包封装成 OGG 容器格式，用于流式传输
 *
 * OGG Opus 流结构:
 * 1. OGG Page 1: Opus ID Header (BOS = true)
 * 2. OGG Page 2: Opus Comment Header
 * 3. OGG Page 3+: Audio Data Pages
 * 4. OGG Page N: Last Audio Data Page (EOS = true)
 */
import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * OGG 页面头部标志
 */
const OGG_CAPTURE = Buffer.from('OggS');

/**
 * OGG 页面头部标志位
 */
const OGG_FLAGS = {
  CONTINUATION: 0,
  BOS: 0x02, // Beginning of Stream
  EOS: 0x04, // End of Stream
};

/**
 * Opus 配置选项
 */
export interface OpusToOggOptions {
  /** 采样率，默认 48000 */
  sampleRate?: number;
  /** 声道数，默认 1 */
  channels?: number;
  /** 预跳过采样数，默认 312 */
  preSkip?: number;
  /** 输出增益，默认 0 */
  outputGain?: number;
  /** 发包间隔（毫秒），默认 0（无延迟） */
  intervalMs?: number;
}

/**
 * 计算 CRC32 校验和（OGG 使用的多项式）
 */
function crc32(data: Buffer): number {
  // OGG 使用的 CRC32 多项式: 0x04C11DB7
  const table: number[] = [];
  for (let i = 0; i < 256; i++) {
    let r = i << 24;
    for (let j = 0; j < 8; j++) {
      r = r & 0x80000000 ? (r << 1) ^ 0x04c11db7 : r << 1;
    }
    table[i] = r >>> 0;
  }

  let crc = 0;
  for (let i = 0; i < data.length; i++) {
    crc = ((crc << 8) ^ table[((crc >>> 24) ^ data[i]) & 0xff]) >>> 0;
  }
  return crc;
}

/**
 * 创建 Opus ID Header
 *
 * 格式:
 * - Magic: "OpusHead" (8 bytes)
 * - Version: 1 (1 byte)
 * - Channel Count: N (1 byte)
 * - Pre-skip: N (2 bytes, little-endian)
 * - Sample Rate: N (4 bytes, little-endian)
 * - Output Gain: N (2 bytes, little-endian)
 * - Channel Mapping Family: 0 (1 byte)
 */
function createOpusIdHeader(options: OpusToOggOptions): Buffer {
  const { sampleRate = 48000, channels = 1, preSkip = 312, outputGain = 0 } = options;

  const header = Buffer.alloc(19);
  Buffer.from('OpusHead').copy(header, 0); // Magic
  header.writeUInt8(1, 8); // Version
  header.writeUInt8(channels, 9); // Channel Count
  header.writeUInt16LE(preSkip, 10); // Pre-skip
  header.writeUInt32LE(sampleRate, 12); // Sample Rate
  header.writeInt16LE(outputGain, 16); // Output Gain
  header.writeUInt8(0, 18); // Channel Mapping Family

  return header;
}

/**
 * 创建 Opus Comment Header
 *
 * 格式:
 * - Magic: "OpusTags" (8 bytes)
 * - Vendor String Length: N (4 bytes, little-endian)
 * - Vendor String: "univoice" (N bytes)
 * - User Comment List Length: 0 (4 bytes, little-endian)
 */
function createOpusCommentHeader(): Buffer {
  const vendor = 'univoice';
  const header = Buffer.alloc(8 + 4 + vendor.length + 4);
  Buffer.from('OpusTags').copy(header, 0); // Magic
  header.writeUInt32LE(vendor.length, 8); // Vendor String Length
  Buffer.from(vendor).copy(header, 12); // Vendor String
  header.writeUInt32LE(0, 12 + vendor.length); // User Comment List Length

  return header;
}

/**
 * 创建 OGG 页面
 *
 * OGG 页面结构:
 * - Capture Pattern: "OggS" (4 bytes)
 * - Stream Structure Version: 0 (1 byte)
 * - Header Type Flags: flags (1 byte)
 * - Granule Position: granulePos (8 bytes, little-endian)
 * - Bitstream Serial Number: serial (4 bytes, little-endian)
 * - Page Sequence Number: sequence (4 bytes, little-endian)
 * - CRC Checksum: checksum (4 bytes, little-endian)
 * - Number of Page Segments: segments.length (1 byte)
 * - Segment Table: segments (N bytes)
 * - Payload: data
 */
function createOggPage(
  data: Buffer,
  options: {
    flags: number;
    granulePos: bigint;
    serial: number;
    sequence: number;
  }
): Buffer {
  const { flags, granulePos, serial, sequence } = options;

  // 计算段表
  const segments: number[] = [];
  let offset = 0;
  while (offset < data.length) {
    const remaining = data.length - offset;
    if (remaining >= 255) {
      segments.push(255);
      offset += 255;
    } else {
      segments.push(remaining);
      offset = remaining;
    }
  }
  // 如果数据正好是 255 的倍数，需要添加一个 0
  if (data.length > 0 && data.length % 255 === 0) {
    segments.push(0);
  }
  // 如果数据为空，添加一个 0
  if (data.length === 0) {
    segments.push(0);
  }

  // 计算头部大小
  const headerSize = 27 + segments.length;

  // 创建缓冲区（头部 + 数据），CRC 暂时填 0
  const page = Buffer.alloc(headerSize + data.length);
  OGG_CAPTURE.copy(page, 0); // Capture Pattern
  page.writeUInt8(0, 4); // Stream Structure Version
  page.writeUInt8(flags, 5); // Header Type Flags
  page.writeBigUInt64LE(granulePos, 6); // Granule Position
  page.writeUInt32LE(serial, 14); // Bitstream Serial Number
  page.writeUInt32LE(sequence, 18); // Page Sequence Number
  page.writeUInt32LE(0, 22); // CRC Checksum (placeholder)
  page.writeUInt8(segments.length, 26); // Number of Page Segments

  // 写入段表
  for (let i = 0; i < segments.length; i++) {
    page.writeUInt8(segments[i], 27 + i);
  }

  // 写入数据
  data.copy(page, headerSize);

  // 计算 CRC 并写入
  const checksum = crc32(page);
  page.writeUInt32LE(checksum, 22);

  return page;
}

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
 * 获取目录中按数字排序的 Opus 数据包文件列表
 *
 * @param directory Opus 数据包文件目录路径
 * @returns 排序后的 Opus 文件路径列表
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
 * 生成随机的流序列号
 */
function generateSerialNumber(): number {
  const hash = createHash('sha256');
  hash.update(Date.now().toString() + Math.random().toString());
  return hash.digest().readUInt32LE(0);
}

/**
 * Opus 数据包目录转 OGG 音频流
 *
 * @param directory Opus 数据包文件目录路径
 * @param options 转换选项
 * @returns OGG 音频流（AsyncIterable<Buffer>）
 *
 * @example
 * ```typescript
 * const oggStream = opusPacketsToOggStream('./opus-packets', {
 *   sampleRate: 48000,
 *   channels: 1,
 * });
 *
 * for await (const page of oggStream) {
 *   // 发送 OGG 页面
 * }
 * ```
 */
export async function* opusPacketsToOggStream(
  directory: string,
  options?: OpusToOggOptions
): AsyncIterable<Buffer> {
  const { intervalMs = 0, ...opusOptions } = options || {};
  const files = getSortedOpusFiles(directory);
  const { readFile } = await import('node:fs/promises');

  // 生成流序列号
  const serial = generateSerialNumber();
  let sequence = 0;
  let granulePos = 0n;

  // 1. 发送 Opus ID Header 页 (BOS)
  const idHeader = createOpusIdHeader(opusOptions);
  yield createOggPage(idHeader, {
    flags: OGG_FLAGS.BOS,
    granulePos: 0n,
    serial,
    sequence: sequence++,
  });

  // 2. 发送 Opus Comment Header 页
  const commentHeader = createOpusCommentHeader();
  yield createOggPage(commentHeader, {
    flags: 0,
    granulePos: 0n,
    serial,
    sequence: sequence++,
  });

  // 3. 发送音频数据页
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const isLast = i === files.length - 1;

    // 读取 Opus 数据包
    const data = await readFile(file);

    // 计算 Granule Position
    // Opus 帧大小通常是 20ms（960 samples @ 48kHz）或 10ms/40ms/60ms
    // 这里假设每个包是 20ms（960 samples）
    const frameSize = 960; // 20ms @ 48kHz
    granulePos += BigInt(frameSize);

    // 创建 OGG 页面
    const flags = isLast ? OGG_FLAGS.EOS : 0;
    yield createOggPage(data, {
      flags,
      granulePos,
      serial,
      sequence: sequence++,
    });

    // 如果不是最后一个文件，等待指定的间隔
    if (!isLast && intervalMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }
}

/**
 * Opus 数据包数组转 OGG 音频流
 *
 * @param packets Opus 数据包数组
 * @param options 转换选项
 * @returns OGG 音频流（AsyncIterable<Buffer>）
 */
export async function* opusPacketArrayToOggStream(
  packets: Buffer[],
  options?: OpusToOggOptions
): AsyncIterable<Buffer> {
  const { intervalMs = 0, ...opusOptions } = options || {};

  // 生成流序列号
  const serial = generateSerialNumber();
  let sequence = 0;
  let granulePos = 0n;

  // 1. 发送 Opus ID Header 页 (BOS)
  const idHeader = createOpusIdHeader(opusOptions);
  yield createOggPage(idHeader, {
    flags: OGG_FLAGS.BOS,
    granulePos: 0n,
    serial,
    sequence: sequence++,
  });

  // 2. 发送 Opus Comment Header 页
  const commentHeader = createOpusCommentHeader();
  yield createOggPage(commentHeader, {
    flags: 0,
    granulePos: 0n,
    serial,
    sequence: sequence++,
  });

  // 3. 发送音频数据页
  for (let i = 0; i < packets.length; i++) {
    const data = packets[i];
    const isLast = i === packets.length - 1;

    // 计算 Granule Position
    const frameSize = 960; // 20ms @ 48kHz
    granulePos += BigInt(frameSize);

    // 创建 OGG 页面
    const flags = isLast ? OGG_FLAGS.EOS : 0;
    yield createOggPage(data, {
      flags,
      granulePos,
      serial,
      sequence: sequence++,
    });

    // 如果不是最后一个包，等待指定的间隔
    if (!isLast && intervalMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }
}
