import { describe, expect, it } from 'vitest';
import { DoubaoTTS } from '@/tts/providers/doubao.js';
import type { DoubaoTTSOptions } from '@/types/tts.js';

describe('DoubaoTTS 构造函数', () => {
  it('应该使用默认值初始化', () => {
    const tts = new DoubaoTTS({ apiKey: 'test-key' });
    expect(tts.name).toBe('doubao');
    expect(tts.appId).toBe('');
    expect(tts.accessToken).toBe('');
    expect(tts.resourceId).toBe('seed-tts-2.0');
    expect(tts.sampleRate).toBe(24000);
    expect(tts.enableTimestamp).toBe(false);
    expect(tts.baseUrl).toBe('wss://openspeech.bytedance.com/api/v3/tts/bidirection');
    expect(tts.voice).toBe('zh_female_tianmeixiaoyuan_moon_bigtts');
    expect(tts.format).toBe('mp3');
  });

  it('应该使用自定义选项覆盖默认值', () => {
    const options: DoubaoTTSOptions = {
      appId: 'my-app',
      accessToken: 'my-token',
      resourceId: 'custom-resource',
      sampleRate: 16000,
      enableTimestamp: true,
      voice: 'custom-voice',
      format: 'wav',
      baseUrl: 'wss://custom.url',
      apiKey: 'key',
    };
    const tts = new DoubaoTTS(options);
    expect(tts.appId).toBe('my-app');
    expect(tts.accessToken).toBe('my-token');
    expect(tts.resourceId).toBe('custom-resource');
    expect(tts.sampleRate).toBe(16000);
    expect(tts.enableTimestamp).toBe(true);
    expect(tts.baseUrl).toBe('wss://custom.url');
    expect(tts.voice).toBe('custom-voice');
    expect(tts.format).toBe('wav');
  });
});
