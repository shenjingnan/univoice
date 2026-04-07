import { describe, expect, it } from 'vitest';
import { TTS1 } from '@/tts/providers/openai.js';

describe('TTS1 (OpenAI) 构造函数', () => {
  it('应该使用默认值初始化', () => {
    const tts = new TTS1({ apiKey: 'test-key' });
    expect(tts.name).toBe('openai');
    expect(tts.baseUrl).toBe('https://api.openai.com/v1');
    expect(tts.model).toBe('tts-1');
  });

  it('应该使用自定义选项', () => {
    const tts = new TTS1({
      apiKey: 'key',
      baseUrl: 'https://custom.url',
      model: 'tts-1-hd',
      voice: 'alloy',
    });
    expect(tts.baseUrl).toBe('https://custom.url');
    expect(tts.model).toBe('tts-1-hd');
    expect(tts.voice).toBe('alloy');
  });
});
