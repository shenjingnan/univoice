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
    expect(asr.domain).toBe('iat');
    expect(asr.accent).toBe('mandarin');
    expect(asr.eos).toBe(2000);
    expect(asr.dwa).toBeUndefined();
    expect(asr.ltc).toBeUndefined();
    expect(asr.dhw).toBeUndefined();
    expect(asr.ptt).toBeUndefined();
    expect(asr.rlang).toBeUndefined();
    expect(asr.vinfo).toBeUndefined();
    expect(asr.nunum).toBeUndefined();
    expect(asr.nbest).toBeUndefined();
    expect(asr.wbest).toBeUndefined();
  });

  it('应该使用自定义选项', () => {
    const asr = new XfyunASR({
      appId: 'my-app-id',
      apiKey: 'my-api-key',
      apiSecret: 'my-api-secret',
      sampleRate: 8000,
      domain: 'custom',
      accent: 'cantonese',
      eos: 3000,
      dwa: 'wpgs',
      ltc: 2,
      dhw: 'dhw=utf-8;你好',
      ptt: 1,
      rlang: 'zh-cn',
      vinfo: 1,
      nunum: 1,
      nbest: 3,
      wbest: 5,
    });
    expect(asr.appId).toBe('my-app-id');
    expect(asr.apiKey).toBe('my-api-key');
    expect(asr.apiSecret).toBe('my-api-secret');
    expect(asr.sampleRate).toBe(8000);
    expect(asr.domain).toBe('custom');
    expect(asr.accent).toBe('cantonese');
    expect(asr.eos).toBe(3000);
    expect(asr.dwa).toBe('wpgs');
    expect(asr.ltc).toBe(2);
    expect(asr.dhw).toBe('dhw=utf-8;你好');
    expect(asr.ptt).toBe(1);
    expect(asr.rlang).toBe('zh-cn');
    expect(asr.vinfo).toBe(1);
    expect(asr.nunum).toBe(1);
    expect(asr.nbest).toBe(3);
    expect(asr.wbest).toBe(5);
  });
});
