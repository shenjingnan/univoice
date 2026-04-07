import { Buffer } from 'node:buffer';
import { writeFile } from 'node:fs/promises';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { saveTTSResponse } from '@/tts/utils/save.js';

vi.mock('node:fs/promises', () => ({
  writeFile: vi.fn().mockResolvedValue(undefined),
}));

describe('saveTTSResponse', () => {
  beforeEach(() => {
    vi.mocked(writeFile).mockClear();
  });

  it('应该使用自动生成的文件名', async () => {
    const audio = new Uint8Array([1, 2, 3]);
    const filepath = await saveTTSResponse({ audio, format: 'mp3' });
    expect(filepath).toMatch(/^tts_\d+\.mp3$/);
    expect(writeFile).toHaveBeenCalledWith(filepath, expect.any(Buffer));
  });

  it('应该使用自定义文件名', async () => {
    const audio = Buffer.from([1, 2, 3]);
    const filepath = await saveTTSResponse({ audio, format: 'wav' }, { filename: 'custom.wav' });
    expect(filepath).toBe('custom.wav');
  });

  it('应该支持目录路径', async () => {
    const audio = new Uint8Array([1, 2]);
    const filepath = await saveTTSResponse({ audio, format: 'mp3' }, { directory: '/tmp/audio' });
    expect(filepath.startsWith('/tmp/audio/')).toBe(true);
  });

  it('应该在非法音频数据时抛错', async () => {
    // biome-ignore lint/suspicious/noExplicitAny: test mock
    await expect(saveTTSResponse({ audio: 'invalid' as any, format: 'mp3' })).rejects.toThrow(
      'Invalid audio data'
    );
  });

  it('应该处理 Uint8Array 音频', async () => {
    const audio = new Uint8Array([1, 2, 3]);
    await saveTTSResponse({ audio, format: 'mp3' });
    expect(writeFile).toHaveBeenCalledWith(expect.any(String), expect.any(Buffer));
  });

  it('应该处理 Buffer 音频', async () => {
    const audio = Buffer.from([4, 5, 6]);
    await saveTTSResponse({ audio, format: 'wav' });
    expect(writeFile).toHaveBeenCalledWith(expect.any(String), audio);
  });
});
