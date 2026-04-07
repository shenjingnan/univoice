import { describe, expect, it } from 'vitest';
import { MinimaxTTS } from '@/tts/providers/minimax.js';

describe('MinimaxTTS 构造函数', () => {
  it('应该使用默认值初始化', () => {
    const tts = new MinimaxTTS({ apiKey: 'test-key' });
    expect(tts.name).toBe('minimax');
    expect(tts.baseUrl).toBe('wss://api.minimaxi.com/ws/v1/t2a_v2');
    expect(tts.model).toBe('speech-2.8-hd');
    expect(tts.voice).toBe('male-qn-qingse');
    expect(tts.format).toBe('mp3');
    expect(tts.sampleRate).toBeUndefined();
    expect(tts.bitrate).toBeUndefined();
  });

  it('应该使用自定义选项', () => {
    const tts = new MinimaxTTS({
      apiKey: 'key',
      baseUrl: 'wss://custom.url',
      model: 'custom-model',
      voice: 'custom-voice',
      sampleRate: 16000,
      bitrate: 128000,
      format: 'wav',
    });
    expect(tts.baseUrl).toBe('wss://custom.url');
    expect(tts.model).toBe('custom-model');
    expect(tts.voice).toBe('custom-voice');
    expect(tts.sampleRate).toBe(16000);
    expect(tts.bitrate).toBe(128000);
    expect(tts.format).toBe('wav');
  });
});
