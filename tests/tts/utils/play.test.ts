import { Buffer } from 'node:buffer';
import { spawn } from 'node:child_process';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { playAudio } from '@/tts/utils/play.js';
import type { TTSResponse } from '@/types/tts';

// Mock spawn 的返回值
const mockStdin = { write: vi.fn(), end: vi.fn() };
const mockOn = vi.fn();
const mockOnce = vi.fn();
const mockRemoveListener = vi.fn();
const mockProcess = {
  stdin: mockStdin,
  on: mockOn,
  once: mockOnce,
  removeListener: mockRemoveListener,
};

vi.mock('node:child_process', () => ({
  spawn: vi.fn(() => mockProcess),
}));

describe('playAudio', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // 默认模拟 close 事件 code=0
    mockOn.mockImplementation((event: string, callback: (code: number) => void) => {
      if (event === 'close') {
        setTimeout(() => callback(0), 0);
      }
    });
  });

  it('应该使用默认播放器 afplay', async () => {
    const audio = Buffer.from([1, 2, 3]);
    await playAudio({ audio, format: 'mp3' } as TTSResponse);
    expect(spawn).toHaveBeenCalledWith('afplay', [], expect.any(Object));
  });

  it('应该使用自定义播放器', async () => {
    const audio = Buffer.from([1, 2, 3]);
    await playAudio({ audio, format: 'mp3' } as TTSResponse, { player: 'mpv' });
    expect(spawn).toHaveBeenCalledWith('mpv', [], expect.any(Object));
  });

  it('应该将音频写入 stdin', async () => {
    const audio = Buffer.from([1, 2, 3]);
    await playAudio({ audio, format: 'mp3' } as TTSResponse);
    expect(mockStdin.write).toHaveBeenCalledWith(expect.any(Buffer));
    expect(mockStdin.end).toHaveBeenCalled();
  });

  it('应该支持 Uint8Array 音频', async () => {
    const audio = new Uint8Array([1, 2, 3]);
    await playAudio({ audio, format: 'mp3' } as TTSResponse);
    expect(mockStdin.write).toHaveBeenCalled();
  });

  it('非零退出码应该抛错', async () => {
    mockOn.mockImplementation((event: string, callback: (code: number) => void) => {
      if (event === 'close') {
        setTimeout(() => callback(1), 0);
      }
    });
    await expect(
      playAudio({ audio: Buffer.from([1]), format: 'mp3' } as TTSResponse)
    ).rejects.toThrow('Player exited with code 1');
  });

  it('非法音频数据应该抛错', async () => {
    await expect(
      // biome-ignore lint/suspicious/noExplicitAny: test mock
      playAudio({ audio: 'invalid' as any, format: 'mp3' } as TTSResponse)
    ).rejects.toThrow('Invalid audio data');
  });
});
