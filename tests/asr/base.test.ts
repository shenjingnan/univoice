import { describe, expect, it } from 'vitest';
import { BaseASR } from '@/asr/base.js';
import type { ASROptions, ASRStreamChunk, AudioStream } from '@/types/asr.js';

// 创建一个具体的 ASR 实现类用于测试
class MockASR extends BaseASR {
  name = 'mock-asr';

  async *listen(_audio: AudioStream): AsyncIterable<ASRStreamChunk> {
    yield { text: 'Mocked transcription', isFinal: true };
  }
}

describe('BaseASR', () => {
  describe('构造函数默认值', () => {
    it('应该使用默认选项初始化', () => {
      const asr = new MockASR({
        provider: 'test',
        apiKey: 'test-key',
      });

      expect(asr.name).toBe('mock-asr');
      expect(asr.apiKey).toBe('test-key');
      expect(asr.baseUrl).toBe('');
      expect(asr.model).toBe('default');
      expect(asr.language).toBe('zh-CN');
      expect(asr.prompt).toBe('');
      expect(asr.responseFormat).toBe('json');
    });

    it('应该使用提供的选项覆盖默认值', () => {
      const options: ASROptions = {
        provider: 'test',
        apiKey: 'custom-key',
        baseUrl: 'https://custom.api.com',
        model: 'custom-model',
        language: 'en-US',
        prompt: 'Custom prompt',
        responseFormat: 'text',
      };

      const asr = new MockASR(options);

      expect(asr.apiKey).toBe('custom-key');
      expect(asr.baseUrl).toBe('https://custom.api.com');
      expect(asr.model).toBe('custom-model');
      expect(asr.language).toBe('en-US');
      expect(asr.prompt).toBe('Custom prompt');
      expect(asr.responseFormat).toBe('text');
    });
  });
});
