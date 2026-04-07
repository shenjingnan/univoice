import { describe, expect, it } from 'vitest';
import { GlmTTS } from '@/tts/providers/glm.js';

describe('GlmTTS 构造函数', () => {
  it('应该使用默认值初始化', () => {
    const tts = new GlmTTS({ apiKey: 'test-key' });
    expect(tts.name).toBe('glm');
    expect(tts.baseUrl).toBe('https://open.bigmodel.cn/api/paas/v4/audio/speech');
    expect(tts.model).toBe('glm-tts');
    expect(tts.voice).toBe('tongtong');
    expect(tts.format).toBe('pcm');
  });

  it('应该使用自定义选项', () => {
    const tts = new GlmTTS({
      apiKey: 'key',
      baseUrl: 'https://custom.url',
      model: 'custom-model',
      voice: 'custom-voice',
      format: 'wav',
    });
    expect(tts.baseUrl).toBe('https://custom.url');
    expect(tts.model).toBe('custom-model');
    expect(tts.voice).toBe('custom-voice');
    expect(tts.format).toBe('wav');
  });
});
