import { writeFile } from 'node:fs/promises';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { saveAudio } from '@/tts/utils/save-audio.js';

vi.mock('node:fs/promises', () => ({
  writeFile: vi.fn().mockResolvedValue(undefined),
}));

describe('saveAudio', () => {
  beforeEach(() => {
    vi.mocked(writeFile).mockClear();
  });

  it('应该保存 Uint8Array[] 数据', async () => {
    const chunks = [new Uint8Array([1, 2, 3]), new Uint8Array([4, 5, 6])];
    await saveAudio('output.raw', chunks);
    expect(writeFile).toHaveBeenCalledWith('output.raw', expect.any(Uint8Array));
  });

  it('应该保存 AsyncIterable 数据', async () => {
    async function* gen() {
      yield new Uint8Array([1, 2, 3]);
      yield new Uint8Array([4, 5, 6]);
    }
    await saveAudio('output.raw', gen());
    expect(writeFile).toHaveBeenCalledWith('output.raw', expect.any(Uint8Array));
    const written = vi.mocked(writeFile).mock.calls[0][1] as Uint8Array;
    expect(Array.from(written)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('保存 .wav 文件且无 RIFF 头时应添加 WAV 头', async () => {
    const pcmData = new Uint8Array(100); // 裸 PCM 数据
    await saveAudio('output.wav', [pcmData]);
    expect(writeFile).toHaveBeenCalledWith('output.wav', expect.any(Uint8Array));
    const written = vi.mocked(writeFile).mock.calls[0][1] as Uint8Array;
    // 检查 RIFF 头
    expect(written[0]).toBe(0x52); // R
    expect(written[1]).toBe(0x49); // I
    expect(written[2]).toBe(0x46); // F
    expect(written[3]).toBe(0x46); // F
    expect(written.length).toBe(144); // 44 header + 100 data
  });

  it('保存 .wav 文件且已有 RIFF 头时不应重复添加', async () => {
    const wavData = new Uint8Array(144);
    wavData[0] = 0x52;
    wavData[1] = 0x49;
    wavData[2] = 0x46;
    wavData[3] = 0x46;
    await saveAudio('output.wav', [wavData]);
    const written = vi.mocked(writeFile).mock.calls[0][1] as Uint8Array;
    expect(written.length).toBe(144); // 不应该增加
  });

  it('应该支持自定义采样率', async () => {
    await saveAudio('output.wav', [new Uint8Array(100)], { sampleRate: 16000 });
    const written = vi.mocked(writeFile).mock.calls[0][1] as Uint8Array;
    // 检查采样率字段 (bytes 24-27, little-endian)
    const sampleRate = written[24] | (written[25] << 8) | (written[26] << 16) | (written[27] << 24);
    expect(sampleRate).toBe(16000);
  });

  it('应该处理 TTSStreamChunk 异步迭代器', async () => {
    async function* gen() {
      yield { audioChunk: new Uint8Array([1, 2, 3]) };
      yield { audioChunk: new Uint8Array([4, 5, 6]) };
    }
    await saveAudio('output.raw', gen());
    const written = vi.mocked(writeFile).mock.calls[0][1] as Uint8Array;
    expect(Array.from(written)).toEqual([1, 2, 3, 4, 5, 6]);
  });
});
