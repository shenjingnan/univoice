import { describe, expect, it } from 'vitest';
import { DoubaoASR } from '@/asr/providers/doubao.js';
import type { DoubaoASROptions } from '@/types/asr.js';

// 使用子类暴露 getWebSocketUrl
class TestableDoubaoASR extends DoubaoASR {
  public testGetWebSocketUrl(): string {
    // biome-ignore lint/suspicious/noExplicitAny: test mock - accessing private method
    return (this as any).getWebSocketUrl();
  }
}

describe('DoubaoASR 构造函数', () => {
  it('应该使用默认值初始化', () => {
    const asr = new DoubaoASR({ apiKey: 'test-key' });
    expect(asr.name).toBe('doubao');
    expect(asr.appKey).toBe('');
    expect(asr.accessKey).toBe('test-key');
    expect(asr.resourceId).toBe('volc.bigasr.sauc.duration');
    expect(asr.mode).toBe('streaming');
    expect(asr.sampleRate).toBe(16000);
    expect(asr.bits).toBe(16);
    expect(asr.channel).toBe(1);
    expect(asr.segmentDuration).toBe(200);
    expect(asr.enableItn).toBe(true);
    expect(asr.enablePunc).toBe(true);
    expect(asr.enableDdc).toBe(false);
    expect(asr.showUtterances).toBe(true);
    expect(asr.baseUrl).toBe('wss://openspeech.bytedance.com/api/v3/sauc');
  });

  it('应该使用自定义选项覆盖默认值', () => {
    const options: DoubaoASROptions = {
      apiKey: 'test-key',
      appKey: 'my-app',
      accessKey: 'my-access',
      resourceId: 'custom-resource',
      mode: 'nostream',
      audioFormat: { sampleRate: 8000, bits: 8, channel: 2 },
      segmentDuration: 100,
      enableItn: false,
      enablePunc: false,
      enableDdc: true,
      showUtterances: false,
    };
    const asr = new DoubaoASR(options);
    expect(asr.appKey).toBe('my-app');
    expect(asr.accessKey).toBe('my-access');
    expect(asr.resourceId).toBe('custom-resource');
    expect(asr.mode).toBe('nostream');
    expect(asr.sampleRate).toBe(8000);
    expect(asr.bits).toBe(8);
    expect(asr.channel).toBe(2);
    expect(asr.segmentDuration).toBe(100);
    expect(asr.enableItn).toBe(false);
    expect(asr.enablePunc).toBe(false);
    expect(asr.enableDdc).toBe(true);
    expect(asr.showUtterances).toBe(false);
  });
});

describe('DoubaoASR getWebSocketUrl', () => {
  it('streaming 模式应该返回 /bigmodel', () => {
    const asr = new TestableDoubaoASR({ apiKey: 'key', mode: 'streaming' });
    expect(asr.testGetWebSocketUrl()).toContain('/bigmodel');
  });

  it('async 模式应该返回 /bigmodel_async', () => {
    const asr = new TestableDoubaoASR({ apiKey: 'key', mode: 'async' });
    expect(asr.testGetWebSocketUrl()).toContain('/bigmodel_async');
  });

  it('nostream 模式应该返回 /bigmodel_nostream', () => {
    const asr = new TestableDoubaoASR({ apiKey: 'key', mode: 'nostream' });
    expect(asr.testGetWebSocketUrl()).toContain('/bigmodel_nostream');
  });
});
