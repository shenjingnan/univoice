import { Buffer } from 'node:buffer';
import { describe, expect, it } from 'vitest';
import {
  bufferToAudioStream,
  calculateSegmentSize,
  createWavFromPcm,
  DEFAULT_SAMPLE_RATE,
  isCompressedAudio,
  isWav,
  parseWavInfo,
  splitAudio,
} from '@/asr/utils/audio.js';

function createTestWavBuffer(
  sampleRate = 16000,
  channels = 1,
  bitsPerSample = 16,
  dataLength = 100
): Buffer {
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataLength, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * channels * (bitsPerSample / 8), 28);
  header.writeUInt16LE(channels * (bitsPerSample / 8), 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36);
  header.writeUInt32LE(dataLength, 40);
  return Buffer.concat([header, Buffer.alloc(dataLength)]);
}

describe('isWav', () => {
  it('应该识别有效的 WAV 数据', () => {
    const wav = createTestWavBuffer();
    expect(isWav(wav)).toBe(true);
  });

  it('应该拒绝非 WAV 数据', () => {
    const data = Buffer.from('not a wav file');
    expect(isWav(data)).toBe(false);
  });

  it('应该拒绝长度不足 44 字节的数据', () => {
    const data = Buffer.alloc(30);
    expect(isWav(data)).toBe(false);
  });
});

describe('parseWavInfo', () => {
  it('应该正确解析标准 WAV 文件', () => {
    const wav = createTestWavBuffer(16000, 1, 16, 3200);
    const info = parseWavInfo(wav);
    expect(info.channels).toBe(1);
    expect(info.sampleWidth).toBe(2);
    expect(info.sampleRate).toBe(16000);
    expect(info.frameCount).toBe(1600); // 3200 / (1 * 2)
    expect(info.data.length).toBe(3200);
  });

  it('应该拒绝非 RIFF 格式', () => {
    const data = Buffer.alloc(100);
    expect(() => parseWavInfo(data)).toThrow('not RIFF format');
  });

  it('应该拒绝非 PCM 格式', () => {
    const wav = createTestWavBuffer();
    // 修改 audioFormat 为非 PCM
    wav.writeUInt16LE(3, 20); // set audioFormat to 3 (float)
    expect(() => parseWavInfo(wav)).toThrow('Unsupported WAV format');
  });

  it('应该拒绝长度不足的数据', () => {
    const data = Buffer.alloc(20);
    expect(() => parseWavInfo(data)).toThrow('too short');
  });
});

describe('createWavFromPcm', () => {
  it('应该创建正确的 WAV 头', () => {
    const pcm = Buffer.alloc(100);
    const wav = createWavFromPcm(pcm, 16000, 1, 16);
    expect(wav.slice(0, 4).toString()).toBe('RIFF');
    expect(wav.slice(8, 12).toString()).toBe('WAVE');
    expect(wav.length).toBe(144); // 44 + 100
  });

  it('应该使用正确的采样率', () => {
    const pcm = Buffer.alloc(100);
    const wav = createWavFromPcm(pcm, 44100);
    expect(wav.readUInt32LE(24)).toBe(44100);
  });

  it('应该使用默认参数', () => {
    const pcm = Buffer.alloc(100);
    const wav = createWavFromPcm(pcm);
    expect(wav.readUInt16LE(22)).toBe(1); // channels
    expect(wav.readUInt16LE(34)).toBe(16); // bitsPerSample
    expect(wav.readUInt32LE(24)).toBe(DEFAULT_SAMPLE_RATE);
  });
});

describe('isCompressedAudio', () => {
  it('应该检测 MP3 ID3v2 标签', () => {
    const data = Buffer.from([0x49, 0x44, 0x33, 0x00]);
    expect(isCompressedAudio(data)).toBe(true);
  });

  it('应该检测 MP3 帧同步标记', () => {
    const data = Buffer.from([0xff, 0xe0, 0x00, 0x00]);
    expect(isCompressedAudio(data)).toBe(true);
  });

  it('应该检测 OGG 格式', () => {
    const data = Buffer.from('OggS');
    expect(isCompressedAudio(data)).toBe(true);
  });

  it('应该检测 FLAC 格式', () => {
    const data = Buffer.from('fLaC');
    expect(isCompressedAudio(data)).toBe(true);
  });

  it('应该拒绝非压缩格式', () => {
    const data = Buffer.from([0x00, 0x01, 0x02, 0x03]);
    expect(isCompressedAudio(data)).toBe(false);
  });

  it('数据不足 4 字节应返回 false', () => {
    expect(isCompressedAudio(Buffer.from([0x00]))).toBe(false);
    expect(isCompressedAudio(Buffer.alloc(0))).toBe(false);
  });
});

describe('calculateSegmentSize', () => {
  it('应该正确计算分段大小', () => {
    // 16kHz, 16bit, mono, 100ms = 3200 bytes
    expect(calculateSegmentSize(1, 2, 16000, 100)).toBe(3200);
  });

  it('应该支持不同参数', () => {
    // 44.1kHz, 16bit, stereo, 200ms
    expect(calculateSegmentSize(2, 2, 44100, 200)).toBe(35280);
  });

  it('应该向下取整', () => {
    // 结果不是整数时应该取整
    const result = calculateSegmentSize(1, 2, 16000, 33);
    expect(result).toBe(Math.floor((1 * 2 * 16000 * 33) / 1000));
  });
});

describe('splitAudio', () => {
  it('应该正常分割音频', () => {
    const data = Buffer.alloc(100);
    const segments = splitAudio(data, 30);
    expect(segments.length).toBe(4); // 30 + 30 + 30 + 10
    expect(segments[0].length).toBe(30);
    expect(segments[3].length).toBe(10);
  });

  it('segmentSize <= 0 应该返回空数组', () => {
    const data = Buffer.alloc(100);
    expect(splitAudio(data, 0)).toEqual([]);
    expect(splitAudio(data, -1)).toEqual([]);
  });

  it('segmentSize 大于数据长度应返回单个段', () => {
    const data = Buffer.alloc(100);
    const segments = splitAudio(data, 200);
    expect(segments).toHaveLength(1);
    expect(segments[0].length).toBe(100);
  });
});

describe('bufferToAudioStream', () => {
  it('应该按默认 chunkSize 分块', async () => {
    const buffer = Buffer.alloc(10000);
    const chunks: Buffer[] = [];
    for await (const chunk of bufferToAudioStream(buffer)) {
      chunks.push(Buffer.from(chunk));
    }
    expect(chunks.length).toBe(Math.ceil(10000 / 3200)); // 4 chunks
  });

  it('应该支持自定义 chunkSize', async () => {
    const buffer = Buffer.alloc(100);
    const chunks: Buffer[] = [];
    for await (const chunk of bufferToAudioStream(buffer, 30)) {
      chunks.push(Buffer.from(chunk));
    }
    expect(chunks).toHaveLength(4);
    expect(chunks[3].length).toBe(10); // 最后一块
  });

  it('空 buffer 应该返回空迭代器', async () => {
    const buffer = Buffer.alloc(0);
    const chunks: Buffer[] = [];
    for await (const chunk of bufferToAudioStream(buffer)) {
      chunks.push(Buffer.from(chunk));
    }
    expect(chunks).toHaveLength(0);
  });
});
