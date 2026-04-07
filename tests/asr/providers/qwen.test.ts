import { describe, expect, it } from 'vitest';
import { QwenASR } from '@/asr/providers/qwen.js';

describe('QwenASR 构造函数', () => {
  it('应该使用默认值初始化', () => {
    const asr = new QwenASR({ apiKey: 'test-key' });
    expect(asr.name).toBe('qwen');
    expect(asr.baseUrl).toBe('wss://dashscope.aliyuncs.com/api-ws/v1/inference/');
    expect(asr.model).toBe('paraformer-realtime-v2');
    expect(asr.sampleRate).toBeUndefined();
    expect(asr.enableWords).toBeUndefined();
    expect(asr.enablePunctuationPrediction).toBeUndefined();
    expect(asr.enableInverseTextNormalization).toBeUndefined();
  });

  it('应该使用自定义选项', () => {
    const asr = new QwenASR({
      apiKey: 'key',
      baseUrl: 'wss://custom.url',
      model: 'paraformer-realtime-v1',
      audioFormat: { sampleRate: 8000 },
      enableWords: true,
      enablePunc: true,
      enableItn: false,
    });
    expect(asr.baseUrl).toBe('wss://custom.url');
    expect(asr.model).toBe('paraformer-realtime-v1');
    expect(asr.sampleRate).toBe(8000);
    expect(asr.enableWords).toBe(true);
    expect(asr.enablePunctuationPrediction).toBe(true);
    expect(asr.enableInverseTextNormalization).toBe(false);
  });
});

describe('QwenASR isFilePath', () => {
  it('应该识别 Unix 路径', () => {
    const asr = new QwenASR({ apiKey: 'key' });
    expect(asr.isFilePath('/path/to/file.mp3')).toBe(true);
  });

  it('应该识别相对路径', () => {
    const asr = new QwenASR({ apiKey: 'key' });
    expect(asr.isFilePath('./audio.wav')).toBe(true);
  });

  it('应该识别以 .mp3 结尾的文件名', () => {
    const asr = new QwenASR({ apiKey: 'key' });
    expect(asr.isFilePath('audio.mp3')).toBe(true);
  });

  it('应该识别以 .wav 结尾的文件名', () => {
    const asr = new QwenASR({ apiKey: 'key' });
    expect(asr.isFilePath('audio.wav')).toBe(true);
  });

  it('不应该识别纯文本字符串', () => {
    const asr = new QwenASR({ apiKey: 'key' });
    expect(asr.isFilePath('hello world')).toBe(false);
  });

  it('不应该识别非字符串输入', () => {
    const asr = new QwenASR({ apiKey: 'key' });
    expect(asr.isFilePath(new Uint8Array(0))).toBe(false);
  });

  it('应该识别 Windows 路径', () => {
    const asr = new QwenASR({ apiKey: 'key' });
    expect(asr.isFilePath('C:\\Users\\audio.mp3')).toBe(true);
  });
});
