import { describe, expect, it } from 'vitest';
import { GeminiTTS } from '@/tts/providers/gemini.js';

describe('GeminiTTS 构造函数', () => {
  it('应该使用默认值初始化', () => {
    const tts = new GeminiTTS({ apiKey: 'test-key' });
    expect(tts.name).toBe('gemini');
    expect(tts.baseUrl).toBe('https://generativelanguage.googleapis.com/v1beta');
    expect(tts.model).toBe('gemini-tts');
  });

  it('应该使用自定义选项', () => {
    const tts = new GeminiTTS({
      apiKey: 'key',
      baseUrl: 'https://custom.url',
      model: 'custom-model',
    });
    expect(tts.baseUrl).toBe('https://custom.url');
    expect(tts.model).toBe('custom-model');
  });
});
