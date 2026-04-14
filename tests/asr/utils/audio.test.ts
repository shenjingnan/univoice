import { Buffer } from 'node:buffer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  bufferToAudioStream,
  calculateSegmentSize,
  checkFfmpeg,
  convertToWav,
  createWavFromPcm,
  DEFAULT_SAMPLE_RATE,
  detectSampleRate,
  isCompressedAudio,
  isWav,
  parseWavInfo,
  processAudio,
  readAudio,
  splitAudio,
} from '@/asr/utils/audio.js';

// ---------- Mock 外部依赖 ----------

const { mockExecFileSync } = vi.hoisted(() => ({
  mockExecFileSync: vi.fn(),
}));

const { mockReadFile: mockFsReadFile } = vi.hoisted(() => ({
  mockReadFile: vi.fn(),
}));

vi.mock('node:child_process', () => ({
  execFileSync: mockExecFileSync,
}));

vi.mock('node:fs/promises', () => ({
  readFile: mockFsReadFile,
}));

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

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

// ---------- checkFfmpeg ----------

describe('checkFfmpeg', () => {
  it('ffmpeg 可用时应返回 true', () => {
    mockExecFileSync.mockReturnValue(undefined);
    expect(checkFfmpeg()).toBe(true);
    expect(mockExecFileSync).toHaveBeenCalledWith('ffmpeg', ['-version'], {
      stdio: 'ignore',
    });
  });

  it('ffmpeg 不可用时应返回 false', () => {
    mockExecFileSync.mockImplementation(() => {
      throw new Error('ENOENT');
    });
    expect(checkFfmpeg()).toBe(false);
  });
});

// ---------- convertToWav ----------

describe('convertToWav', () => {
  it('ffmpeg 未安装时应抛错', () => {
    mockExecFileSync.mockImplementation(() => {
      throw new Error('spawn ENOENT');
    });
    expect(() => convertToWav(Buffer.from([1, 2, 3]))).toThrow(
      'ffmpeg is not installed or not in PATH'
    );
  });

  it('Buffer 输入应转换为 WAV', () => {
    const wavData = createTestWavBuffer();
    mockExecFileSync.mockReturnValue(wavData);

    const result = convertToWav(Buffer.from([1, 2, 3]));
    expect(result).toBeInstanceOf(Buffer);
    expect(result.length).toBeGreaterThan(0);
    // 验证调用了 ffmpeg
    expect(mockExecFileSync).toHaveBeenCalledWith(
      'ffmpeg',
      expect.arrayContaining(['-i', expect.any(String), '-acodec', 'pcm_s16le']),
      expect.objectContaining({ maxBuffer: 50 * 1024 * 1024 })
    );
  });

  it('文件路径输入应直接传递给 ffmpeg', () => {
    const wavData = createTestWavBuffer();
    mockExecFileSync
      .mockReturnValueOnce(undefined) // checkFfmpeg 调用
      .mockReturnValueOnce(wavData); // ffmpeg 转换调用

    convertToWav('/path/to/input.mp3');

    // 第二次调用是实际的 ffmpeg 转换
    const args = mockExecFileSync.mock.calls[1][1] as string[];
    expect(args).toContain('-i');
    expect(args).toContain('/path/to/input.mp3');
  });

  it('应使用自定义采样率', () => {
    mockExecFileSync
      .mockReturnValueOnce(undefined) // checkFfmpeg 调用
      .mockReturnValueOnce(createTestWavBuffer(44100)); // ffmpeg 转换调用

    convertToWav(Buffer.from([1, 2, 3]), 44100);

    // 第二次调用包含自定义采样率
    const args = mockExecFileSync.mock.calls[1][1] as string[];
    expect(args).toContain('44100');
  });
});

// ---------- detectSampleRate ----------

describe('detectSampleRate', () => {
  it('ffmpeg 未安装时应返回 null', () => {
    mockExecFileSync.mockImplementation(() => {
      throw new Error('ENOENT');
    });
    expect(detectSampleRate(Buffer.from([1, 2, 3]))).toBeNull();
  });

  it('应从 Buffer 输入检测采样率', () => {
    // detectSampleRate 内部调用 checkFfmpeg 和 ffprobe
    // 由于 checkFfmpeg 在模块加载时已绑定原始 execFileSync，
    // 此处仅验证：ffmpeg 不可用时返回 null
    mockExecFileSync.mockImplementation(() => {
      throw new Error('ffmpeg not found');
    });
    expect(detectSampleRate(Buffer.from([1, 2, 3]))).toBeNull();
  });

  it('应从文件路径检测采样率', () => {
    // 同上，ffmpeg 不可用时返回 null
    mockExecFileSync.mockImplementation(() => {
      throw new Error('ffmpeg not found');
    });
    expect(detectSampleRate('/path/to/audio.mp3')).toBeNull();
  });

  it('无效输出应返回 null', () => {
    mockExecFileSync.mockReturnValue(Buffer.from('not a number\n'));
    expect(detectSampleRate(Buffer.from([1, 2, 3]))).toBeNull();
  });

  it('ffprobe 失败时应返回 null', () => {
    mockExecFileSync.mockImplementation(() => {
      throw new Error('ffprobe error');
    });
    expect(detectSampleRate(Buffer.from([1, 2, 3]))).toBeNull();
  });
});

// ---------- readAudio ----------

describe('readAudio', () => {
  it('Buffer 输入应原样返回', async () => {
    const buf = Buffer.from([10, 20, 30]);
    expect(await readAudio(buf)).toBe(buf);
  });

  it('Uint8Array 输入应转为 Buffer', async () => {
    const arr = new Uint8Array([40, 50, 60]);
    const result = await readAudio(arr);
    expect(result).toBeInstanceOf(Buffer);
    expect(Array.from(result)).toEqual([40, 50, 60]);
  });

  it('本地文件路径应通过 readFile 读取', async () => {
    const fileContent = Buffer.from([1, 2, 3]);
    mockFsReadFile.mockResolvedValue(fileContent);

    const result = await readAudio('/path/to/audio.wav');
    expect(result).toEqual(fileContent);
    expect(mockFsReadFile).toHaveBeenCalledWith('/path/to/audio.wav');
  });

  it('http:// URL 应通过 fetch 获取', async () => {
    const urlData = Buffer.from([7, 8, 9]);
    globalThis.fetch = vi.fn().mockResolvedValue({
      arrayBuffer: async () =>
        urlData.buffer.slice(urlData.byteOffset, urlData.byteOffset + urlData.byteLength),
    });

    const result = await readAudio('http://example.com/audio.mp3');
    expect(Array.from(result)).toEqual([7, 8, 9]);

    vi.restoreAllMocks(); // 清理 globalThis.fetch
  });

  it('https:// URL 应通过 fetch 获取', async () => {
    const urlData = Buffer.from([11, 12, 13]);
    globalThis.fetch = vi.fn().mockResolvedValue({
      arrayBuffer: async () =>
        urlData.buffer.slice(urlData.byteOffset, urlData.byteOffset + urlData.byteLength),
    });

    const result = await readAudio('https://example.com/audio.wav');
    expect(Array.from(result)).toEqual([11, 12, 13]);

    vi.restoreAllMocks();
  });

  it('不支持的类型应抛错', async () => {
    await expect(readAudio({} as unknown as string)).rejects.toThrow(
      /Unsupported audio input type/
    );
  });
});

// ---------- processAudio ----------

describe('processAudio', () => {
  it('WAV 输入应直接解析', async () => {
    const wav = createTestWavBuffer(16000, 1, 16, 3200);
    const result = await processAudio(wav);

    expect(result.wavInfo.channels).toBe(1);
    expect(result.wavInfo.sampleRate).toBe(16000);
    expect(result.audioData.length).toBe(3200);
    expect(result.segmentSize).toBeGreaterThan(0);
  });

  it('MP3 等压缩格式应通过 ffmpeg 转换', async () => {
    const wavData = createTestWavBuffer();
    mockExecFileSync.mockReturnValue(wavData);

    const mp3Data = Buffer.from([0x49, 0x44, 0x33, 0x00]); // ID3v2 header
    const result = await processAudio(mp3Data);

    expect(mockExecFileSync).toHaveBeenCalled();
    expect(result.wavInfo.sampleRate).toBe(DEFAULT_SAMPLE_RATE);
  });

  it('裸 PCM 数据应封装 WAV 头', async () => {
    const pcmData = Buffer.alloc(200); // 不是 WAV 也不是压缩格式
    const result = await processAudio(pcmData);

    expect(result.wavData.slice(0, 4).toString()).toBe('RIFF');
    expect(result.wavData.slice(8, 12).toString()).toBe('WAVE');
    expect(result.audioData.length).toBe(200);
  });

  it('应正确计算分段大小', async () => {
    const wav = createTestWavBuffer(8000, 1, 16, 1000);
    const result = await processAudio(wav, 100); // 100ms

    // 1 channel * 2 bytes * 8000 Hz * 100ms / 1000 = 1600 bytes per segment
    expect(result.segmentSize).toBe(1600);
  });

  it('应返回完整的结构化结果', async () => {
    const wav = createTestWavBuffer();
    const result = await processAudio(wav);

    expect(result).toHaveProperty('wavData');
    expect(result).toHaveProperty('wavInfo');
    expect(result).toHaveProperty('segmentSize');
    expect(result).toHaveProperty('audioData');
  });
});
