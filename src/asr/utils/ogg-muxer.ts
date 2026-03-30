/**
 * 流式 OGG Muxer
 *
 * 将 Opus 数据包流式封装为 OGG 流
 * 纯 JavaScript 实现，无需额外依赖
 *
 * @module ogg-muxer
 */

import { Buffer } from 'node:buffer';

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

  // 总大小: 8 + 4 + vendor.length + 4 + 4 + tag.length
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
 * OGG Muxer 选项
 */
export interface OggMuxerOptions {
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
 * 创建流式 OGG Muxer
 *
 * 将 Opus 数据包流式封装为 OGG 流。每收到一个 Opus packet，立即 yield 一个 OGG page。
 *
 * @param opusPackets Opus 数据包流
 * @param options 选项配置
 * @returns OGG 页面流
 *
 * @example
 * ```typescript
 * const oggStream = createOggMuxer(hardwareStream, { sampleRate: 16000 });
 * for await (const oggPage of oggStream) {
 *   // 处理每个 OGG 页面
 * }
 * ```
 */
export async function* createOggMuxer(
  opusPackets: AsyncIterable<Buffer>,
  options?: OggMuxerOptions
): AsyncIterable<Buffer> {
  const {
    sampleRate = 16000,
    channels = 1,
    frameSizeMs = 60,
    encoder = 'univoice',
  } = options || {};

  // 生成随机序列号
  const serialNumber = Math.floor(Math.random() * 0xffffffff);

  // Opus 内部采样率总是 48000Hz
  // pre-skip 推荐值为 312 (for 48kHz)
  // 参考: https://tools.ietf.org/html/rfc7845#section-5.1
  const preSkip = 312;

  // Opus 内部采样率总是 48000Hz，颗粒位置使用 48000Hz 计算
  // 参考: https://tools.ietf.org/html/rfc7845#section-3
  const opusInternalSampleRate = 48000;
  const samplesPerFrame = (opusInternalSampleRate / 1000) * frameSizeMs;

  // 页面序列号
  let pageSequence = 0;

  // 1. yield OpusHead 页面 (BOS - Beginning Of Stream)
  const opusHead = createOpusHead(sampleRate, channels, preSkip);
  yield createOggPage([opusHead], pageSequence++, 0n, serialNumber, { bos: true, eos: false });

  // 2. yield OpusTags 页面
  const opusTags = createOpusTags(encoder);
  yield createOggPage([opusTags], pageSequence++, 0n, serialNumber, { bos: false, eos: false });

  // 3. 流式处理 Opus 数据包
  // 颗粒位置从 pre-skip 开始
  let granulePosition = BigInt(preSkip);

  for await (const packet of opusPackets) {
    const data = Buffer.isBuffer(packet) ? packet : Buffer.from(packet);

    // 更新颗粒位置
    granulePosition += BigInt(samplesPerFrame);

    // yield OGG 页面（中间页面不设置 EOS 标志）
    yield createOggPage([data], pageSequence++, granulePosition, serialNumber, {
      bos: false,
      eos: false,
    });
  }

  // 注意：流式场景下，最后一个页面的 EOS 标志需要单独处理
  // 调用方可以在结束时调用 createEosPage 或让 ASR 服务通过结束信号处理
}

/**
 * 创建 EOS (End Of Stream) 页面
 *
 * 用于标记 OGG 流的结束
 *
 * @param serialNumber 比特流序列号
 * @param pageSequence 下一个页面序列号
 * @param granulePosition 最后的颗粒位置
 * @returns 带有 EOS 标志的 OGG 页面
 */
export function createEosPage(
  serialNumber: number,
  pageSequence: number,
  granulePosition: bigint
): Buffer {
  // 创建一个空的 EOS 页面
  return createOggPage([], pageSequence, granulePosition, serialNumber, {
    bos: false,
    eos: true,
  });
}

/**
 * 创建完整的 OGG Muxer 实例
 *
 * 提供更多控制能力，包括：
 * - 获取序列号
 * - 手动发送 EOS 页面
 */
export interface OggMuxer {
  /** OGG 流 */
  stream: AsyncIterable<Buffer>;
  /** 比特流序列号 */
  serialNumber: number;
  /** 发送 EOS 标记并结束流 */
  finish: () => void;
}

/**
 * 创建可控的 OGG Muxer 实例
 *
 * 提供更精细的控制，可以在流结束时发送 EOS 标记
 *
 * @param opusPackets Opus 数据包流
 * @param options 选项配置
 * @returns OGG Muxer 实例
 */
export function createOggMuxerWithEos(
  opusPackets: AsyncIterable<Buffer>,
  options?: OggMuxerOptions
): OggMuxer {
  const {
    sampleRate = 16000,
    channels = 1,
    frameSizeMs = 60,
    encoder = 'univoice',
  } = options || {};

  // 生成随机序列号
  const serialNumber = Math.floor(Math.random() * 0xffffffff);

  // Opus 参数
  const preSkip = 312;
  const opusInternalSampleRate = 48000;
  const samplesPerFrame = (opusInternalSampleRate / 1000) * frameSizeMs;

  // 状态
  let pageSequence = 0;
  let granulePosition = BigInt(preSkip);
  let finished = false;

  // 创建流
  async function* stream(): AsyncIterable<Buffer> {
    // OpusHead
    const opusHead = createOpusHead(sampleRate, channels, preSkip);
    yield createOggPage([opusHead], pageSequence++, 0n, serialNumber, { bos: true, eos: false });

    // OpusTags
    const opusTags = createOpusTags(encoder);
    yield createOggPage([opusTags], pageSequence++, 0n, serialNumber, { bos: false, eos: false });

    // 音频数据包
    for await (const packet of opusPackets) {
      if (finished) break;

      const data = Buffer.isBuffer(packet) ? packet : Buffer.from(packet);
      granulePosition += BigInt(samplesPerFrame);

      yield createOggPage([data], pageSequence++, granulePosition, serialNumber, {
        bos: false,
        eos: false,
      });
    }

    // 发送 EOS 页面（如果已标记结束）
    if (finished) {
      yield createEosPage(serialNumber, pageSequence, granulePosition);
    }
  }

  return {
    stream: stream(),
    serialNumber,
    finish: () => {
      finished = true;
    },
  };
}
