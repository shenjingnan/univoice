import { Buffer } from 'node:buffer';
import { describe, expect, it, vi } from 'vitest';
import { collectAudio } from '@/tts/utils/collect.js';

describe('collectAudio', () => {
  it('应该收集 Uint8Array 音频数据', async () => {
    const audio = new Uint8Array([1, 2, 3, 4]);
    const result = await collectAudio({ audio, format: 'mp3' });
    expect(result).toBeInstanceOf(Uint8Array);
    expect(Array.from(result)).toEqual([1, 2, 3, 4]);
  });

  it('应该收集 Buffer 音频数据', async () => {
    const audio = Buffer.from([5, 6, 7, 8]);
    const result = await collectAudio({ audio, format: 'mp3' });
    expect(result).toBeInstanceOf(Uint8Array);
    expect(Array.from(result)).toEqual([5, 6, 7, 8]);
  });

  it('应该调用 onComplete 回调', async () => {
    const audio = new Uint8Array([1, 2, 3]);
    const onComplete = vi.fn();
    await collectAudio({ audio, format: 'mp3' }, { onComplete });
    expect(onComplete).toHaveBeenCalledWith(audio);
  });

  it('空音频应该返回空 Uint8Array', async () => {
    const audio = new Uint8Array(0);
    const result = await collectAudio({ audio, format: 'mp3' });
    expect(result.length).toBe(0);
  });
});
