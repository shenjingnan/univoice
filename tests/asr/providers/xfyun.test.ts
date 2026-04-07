import { describe, expect, it } from 'vitest';
import { XfyunASR } from '@/asr/providers/xfyun.js';

describe('XfyunASR 构造函数', () => {
  it('应该使用默认值初始化', () => {
    const asr = new XfyunASR({});
    expect(asr.name).toBe('xfyun');
    expect(asr.appId).toBe('');
    expect(asr.apiKey).toBe('');
    expect(asr.apiSecret).toBe('');
    expect(asr.sampleRate).toBe(16000);
    expect(asr.bitDepth).toBe(16);
    expect(asr.channels).toBe(1);
    expect(asr.domain).toBe('slm');
    expect(asr.accent).toBe('mandarin');
    expect(asr.eos).toBe(6000);
    expect(asr.dwa).toBeUndefined();
    expect(asr.ltc).toBeUndefined();
    expect(asr.resId).toBeUndefined();
    expect(asr.dhw).toBeUndefined();
  });

  it('应该使用自定义选项', () => {
    const asr = new XfyunASR({
      appId: 'my-app-id',
      apiKey: 'my-api-key',
      apiSecret: 'my-api-secret',
      sampleRate: 8000,
      bitDepth: 8,
      channels: 2,
      domain: 'custom',
      accent: 'cantonese',
      eos: 3000,
      dwa: 'wpgs',
      ltc: 2,
      resId: 'hot_words',
      dhw: 'dhw=utf-8;你好',
    });
    expect(asr.appId).toBe('my-app-id');
    expect(asr.apiKey).toBe('my-api-key');
    expect(asr.apiSecret).toBe('my-api-secret');
    expect(asr.sampleRate).toBe(8000);
    expect(asr.bitDepth).toBe(8);
    expect(asr.channels).toBe(2);
    expect(asr.domain).toBe('custom');
    expect(asr.accent).toBe('cantonese');
    expect(asr.eos).toBe(3000);
    expect(asr.dwa).toBe('wpgs');
    expect(asr.ltc).toBe(2);
    expect(asr.resId).toBe('hot_words');
    expect(asr.dhw).toBe('dhw=utf-8;你好');
  });
});
