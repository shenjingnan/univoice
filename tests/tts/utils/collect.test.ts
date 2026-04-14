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

  it('onError 回调存在但无错误时不应被调用', async () => {
    const audio = new Uint8Array([1, 2, 3]);
    const onError = vi.fn();
    await collectAudio({ audio, format: 'mp3' }, { onError });
    expect(onError).not.toHaveBeenCalled();
  });

  it('Buffer 输入应触发 onComplete 回调', async () => {
    const audio = Buffer.from([10, 20, 30]);
    const onComplete = vi.fn();
    const result = await collectAudio({ audio, format: 'wav' }, { onComplete });
    expect(onComplete).toHaveBeenCalledWith(result);
    expect(Array.from(result)).toEqual([10, 20, 30]);
  });
});
