/**
 * 将 Opus 数据包目录合并为 OGG 文件
 *
 * 纯 JavaScript 实现 OGG Muxer，无需额外依赖
 */
import { existsSync, readdirSync, writeFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * OGG Opus 文件选项
 */
export interface OpusPacketsToOggOptions {
  /** 采样率，默认 16000 */
  sampleRate?: number;
  /** 声道数，默认 1 */
  channels?: number;
  /** Opus 帧大小（毫秒），默认 60 */
  frameSizeMs?: number;
  /** 编码器名称，默认 'univoice' */
  encoder?: string;
}

/**
 * CRC32 查找表（OGG 使用的多项式: 0x04c11db7）
 */
const CRC32_TABLE: Uint32Array = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let r = i << 24;
    for (let j = 0; j < 8; j++) {
      r = (r & 0x80000000) !== 0 ? (r << 1) ^ 0x04c11db7 : r << 1;
    }
    table[i] = r >>> 0;
  }
  return table;
})();

/**
 * 计算 OGG CRC32 校验和
 * @param data 数据缓冲区
 * @returns CRC32 值
 */
function crc32(data: Uint8Array): number {
  let crc = 0;
  for (let i = 0; i < data.length; i++) {
    crc = ((crc << 8) ^ CRC32_TABLE[((crc >>> 24) ^ data[i]) & 0xff]) >>> 0;
  }
  return crc;
}

/**
 * 创建 OpusHead 包
 * @param sampleRate 采样率
 * @param channels 声道数
 * @param preSkip 预跳过采样数
 * @returns OpusHead Buffer
 */
function createOpusHead(sampleRate: number, channels: number, preSkip: number): Buffer {
  const buffer = Buffer.alloc(19);

  // "OpusHead" 魔数 (8 bytes)
  buffer.write('OpusHead', 0, 'ascii');

  // 版本号 (1 byte) - 总是 1
  buffer.writeUInt8(1, 8);

  // 声道数 (1 byte)
  buffer.writeUInt8(channels, 9);

  // Pre-skip (2 bytes, little-endian)
  buffer.writeUInt16LE(preSkip, 10);

  // 采样率 (4 bytes, little-endian)
  buffer.writeUInt32LE(sampleRate, 12);

  // Output gain (2 bytes, little-endian) - 总是 0
  buffer.writeUInt16LE(0, 16);

  // Channel mapping family (1 byte) - 0 = 单声道或立体声
  buffer.writeUInt8(0, 18);

  return buffer;
}

/**
 * 创建 OpusTags 包
 * @param encoder 编码器名称
 * @returns OpusTags Buffer
 */
function createOpusTags(encoder: string): Buffer {
  const encoderTag = `encoder=${encoder}`;
  const encoderTagBuffer = Buffer.from(encoderTag, 'utf-8');

  // OpusTags 结构:
  // "OpusTags" (8) + Vendor Length (4) + Vendor String + Tag Count (4) + Tags...
  const vendorBuffer = Buffer.from('univoice', 'utf-8');

  // 总大小: 8 + 4 + vendor.length + 4 + tag.length
  const totalSize = 8 + 4 + vendorBuffer.length + 4 + 4 + encoderTagBuffer.length;
  const buffer = Buffer.alloc(totalSize);

  let offset = 0;

  // "OpusTags" 魔数 (8 bytes)
  buffer.write('OpusTags', offset, 'ascii');
  offset += 8;

  // Vendor string length (4 bytes, little-endian)
  buffer.writeUInt32LE(vendorBuffer.length, offset);
  offset += 4;

  // Vendor string
  vendorBuffer.copy(buffer, offset);
  offset += vendorBuffer.length;

  // Tag count (4 bytes, little-endian)
  buffer.writeUInt32LE(1, offset);
  offset += 4;

  // Tag length (4 bytes, little-endian)
  buffer.writeUInt32LE(encoderTagBuffer.length, offset);
  offset += 4;

  // Tag string
  encoderTagBuffer.copy(buffer, offset);

  return buffer;
}

/**
 * 创建 OGG 页面
 * @param packets 数据包数组（一个页面可包含多个包）
 * @param pageSequence 页面序列号
 * @param granulePosition 颗粒位置（采样数）
 * @param serialNumber 比特流序列号
 * @param flags 页面标志
 * @returns OGG 页面 Buffer
 */
function createOggPage(
  packets: Buffer[],
  pageSequence: number,
  granulePosition: bigint,
  serialNumber: number,
  flags: { bos: boolean; eos: boolean }
): Buffer {
  // 计算总数据大小
  const totalDataSize = packets.reduce((sum, p) => sum + p.length, 0);

  // 计算段表
  const segments: number[] = [];
  for (const packet of packets) {
    let remaining = packet.length;
    while (remaining >= 255) {
      segments.push(255);
      remaining -= 255;
    }
    segments.push(remaining);
  }

  // OGG 页面头部大小: 27 + segments.length
  const headerSize = 27 + segments.length;
  const pageSize = headerSize + totalDataSize;

  // 创建页面缓冲区（先不包含 CRC）
  const page = Buffer.alloc(pageSize);
  let offset = 0;

  // OggS 捕获模式 (4 bytes)
  page.write('OggS', offset, 'ascii');
  offset += 4;

  // 版本 (1 byte) - 总是 0
  page.writeUInt8(0, offset);
  offset += 1;

  // 头类型标志 (1 byte)
  // bit 0: continued packet
  // bit 1: BOS (beginning of stream)
  // bit 2: EOS (end of stream)
  let headerType = 0;
  if (flags.bos) headerType |= 0x02;
  if (flags.eos) headerType |= 0x04;
  page.writeUInt8(headerType, offset);
  offset += 1;

  // 颗粒位置 (8 bytes, little-endian)
  page.writeBigUInt64LE(granulePosition, offset);
  offset += 8;

  // 比特流序列号 (4 bytes, little-endian)
  page.writeUInt32LE(serialNumber, offset);
  offset += 4;

  // 页面序列号 (4 bytes, little-endian)
  page.writeUInt32LE(pageSequence, offset);
  offset += 4;

  // CRC32 (4 bytes) - 先填 0，后面计算
  const crcOffset = offset;
  page.writeUInt32LE(0, offset);
  offset += 4;

  // 段数 (1 byte)
  page.writeUInt8(segments.length, offset);
  offset += 1;

  // 段长度表
  for (const seg of segments) {
    page.writeUInt8(seg, offset);
    offset += 1;
  }

  // 数据段
  for (const packet of packets) {
    packet.copy(page, offset);
    offset += packet.length;
  }

  // 计算 CRC32 并填入
  const crcValue = crc32(page);
  page.writeUInt32LE(crcValue, crcOffset);

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
 * 获取目录中按数字排序的 Opus 文件列表
 * @param directory Opus 文件目录路径
 * @returns 排序后的 Opus 文件路径列表
 */
function getSortedOpusFiles(directory: string): string[] {
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
 * 将 Opus 数据包目录合并为 OGG 文件
 *
 * @param inputDir Opus 数据包目录路径
 * @param outputFile 输出 OGG 文件路径
 * @param options 选项配置
 * @returns 合并的 Opus 数据包数量
 *
 * @example
 * ```typescript
 * const count = await opusPacketsToOgg(
 *   './output/packets',
 *   './output/merged.ogg',
 *   { sampleRate: 16000, channels: 1 }
 * );
 * console.log(`合并了 ${count} 个 Opus 数据包`);
 * ```
 */
export async function opusPacketsToOgg(
  inputDir: string,
  outputFile: string,
  options?: OpusPacketsToOggOptions
): Promise<number> {
  const {
    sampleRate = 16000,
    channels = 1,
    frameSizeMs = 60,
    encoder = 'univoice',
  } = options || {};

  // 验证目录存在
  if (!existsSync(inputDir)) {
    throw new Error(`目录不存在: ${inputDir}`);
  }

  // 获取排序后的 Opus 文件
  const files = getSortedOpusFiles(inputDir);
  console.log(`找到 ${files.length} 个 Opus 文件`);

  // 读取所有 Opus 数据包
  const packets: Buffer[] = [];
  for (const file of files) {
    const data = await readFile(file);
    packets.push(data);
  }

  // 生成随机序列号
  const serialNumber = Math.floor(Math.random() * 0xffffffff);

  // Opus 内部采样率总是 48000Hz
  // pre-skip 推荐值为 312 (for 48kHz)
  // 参考: https://tools.ietf.org/html/rfc7845#section-5.1
  const preSkip = 312;

  // 创建 OpusHead 包
  const opusHead = createOpusHead(sampleRate, channels, preSkip);

  // 创建 OpusTags 包
  const opusTags = createOpusTags(encoder);

  // Opus 内部采样率总是 48000Hz，颗粒位置使用 48000Hz 计算
  // 参考: https://tools.ietf.org/html/rfc7845#section-3
  const opusInternalSampleRate = 48000;
  const samplesPerFrame = (opusInternalSampleRate / 1000) * frameSizeMs;

  // 创建所有 OGG 页面
  const pages: Buffer[] = [];

  // 页面 0: OpusHead (BOS)
  pages.push(createOggPage([opusHead], 0, 0n, serialNumber, { bos: true, eos: false }));

  // 页面 1: OpusTags
  pages.push(createOggPage([opusTags], 1, 0n, serialNumber, { bos: false, eos: false }));

  // 将音频数据包封装到 OGG 页面
  // 每个页面最多约 255 个段（segments），但考虑到大包需要多个段，
  // 实际上每个页面放一个 Opus 包更简单可靠
  let granulePosition = BigInt(preSkip); // 从 pre-skip 开始

  for (let i = 0; i < packets.length; i++) {
    const packet = packets[i];
    const pageSequence = 2 + i;

    // 更新颗粒位置
    granulePosition += BigInt(samplesPerFrame);

    // 判断是否为最后一页
    const isLast = i === packets.length - 1;

    pages.push(
      createOggPage([packet], pageSequence, granulePosition, serialNumber, {
        bos: false,
        eos: isLast,
      })
    );
  }

  // 合并所有页面并写入文件
  const totalSize = pages.reduce((sum, p) => sum + p.length, 0);
  const output = Buffer.concat(pages, totalSize);

  writeFileSync(outputFile, output);
  console.log(`OGG 文件已写入: ${outputFile} (${output.length} bytes)`);

  return packets.length;
}
