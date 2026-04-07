import { describe, expect, it } from 'vitest';
import { QwenTTS } from '@/tts/providers/qwen.js';

describe('QwenTTS 构造函数', () => {
  it('应该使用默认值初始化', () => {
    const tts = new QwenTTS({ apiKey: 'test-key' });
    expect(tts.name).toBe('qwen');
    expect(tts.baseUrl).toBe('wss://dashscope.aliyuncs.com/api-ws/v1/inference/');
    expect(tts.model).toBe('cosyvoice-v3-flash');
    expect(tts.voice).toBe('longxiaochun_v3');
    expect(tts.format).toBe('mp3');
    expect(tts.instruction).toBeUndefined();
  });

  it('应该使用自定义选项', () => {
    const tts = new QwenTTS({
      apiKey: 'key',
      baseUrl: 'wss://custom.url',
      model: 'cosyvoice-v2',
      voice: 'custom-voice',
      format: 'wav',
      instruction: '请用温柔语调',
      sampleRate: 16000,
    });
    expect(tts.baseUrl).toBe('wss://custom.url');
    expect(tts.model).toBe('cosyvoice-v2');
    expect(tts.voice).toBe('custom-voice');
    expect(tts.format).toBe('wav');
    expect(tts.instruction).toBe('请用温柔语调');
    expect(tts.sampleRate).toBe(16000);
  });
});
