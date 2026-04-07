import { beforeEach, describe, expect, it, vi } from 'vitest';
import { teeAudio } from '@/tts/utils/tee.js';

// Mock dependencies - 使用源码中实际的导入路径
vi.mock('@/tts/utils/save', () => ({
  saveTTSResponse: vi.fn().mockResolvedValue('/tmp/tts_123.mp3'),
}));

vi.mock('@/tts/utils/play', () => ({
  playAudio: vi.fn().mockResolvedValue(undefined),
}));

import { playAudio } from '@/tts/utils/play.js';
import { saveTTSResponse } from '@/tts/utils/save.js';

describe('teeAudio', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('仅 save 时应调用 saveTTSResponse', async () => {
    const audio = new Uint8Array([1, 2, 3]);
    const result = await teeAudio({ audio, format: 'mp3' }, { save: { filename: 'test.mp3' } });
    expect(saveTTSResponse).toHaveBeenCalled();
    expect(playAudio).not.toHaveBeenCalled();
    expect(result.audio).toBeInstanceOf(Uint8Array);
  });

  it('仅 play 时应调用 playAudio', async () => {
    const audio = new Uint8Array([1, 2, 3]);
    await teeAudio({ audio, format: 'mp3' }, { play: { player: 'afplay' } });
    expect(saveTTSResponse).not.toHaveBeenCalled();
    expect(playAudio).toHaveBeenCalled();
  });

  it('两者都有时都应调用', async () => {
    const audio = new Uint8Array([1, 2, 3]);
    await teeAudio({ audio, format: 'mp3' }, { save: {}, play: {} });
    expect(saveTTSResponse).toHaveBeenCalled();
    expect(playAudio).toHaveBeenCalled();
  });

  it('两者都没有时不应调用', async () => {
    const audio = new Uint8Array([1, 2, 3]);
    const result = await teeAudio({ audio, format: 'mp3' });
    expect(saveTTSResponse).not.toHaveBeenCalled();
    expect(playAudio).not.toHaveBeenCalled();
    expect(result.audio).toBeInstanceOf(Uint8Array);
  });
});
