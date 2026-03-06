import { describe, expect, it } from 'vitest';
import { BaseASR } from '@/asr/base.js';
import type { ASROptions, ASRRequest } from '@/types/asr.js';

// 创建一个具体的 ASR 实现类用于测试
class MockASR extends BaseASR {
  name = 'mock-asr';

  async recognize(request: ASRRequest) {
    const opts = this.buildRequestOptions(request);
    return {
      text: 'Mocked transcription',
      language: opts.language,
    };
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

  describe('buildRequestOptions', () => {
    it('应该返回包含所有默认选项的对象', () => {
      const asr = new MockASR({
        provider: 'test',
        apiKey: 'test-key',
      });

      const request: ASRRequest = {
        audio: Buffer.from('test audio'),
      };

      const result = asr.buildRequestOptions(request);

      expect(result.provider).toBe('MockASR');
      expect(result.apiKey).toBe('test-key');
      expect(result.baseUrl).toBe('');
      expect(result.model).toBe('default');
      expect(result.language).toBe('zh-CN');
      expect(result.prompt).toBe('');
      expect(result.responseFormat).toBe('json');
    });

    it('应该合并请求选项到基础选项', () => {
      const asr = new MockASR({
        provider: 'test',
        apiKey: 'test-key',
        model: 'base-model',
        language: 'zh-CN',
      });

      const request: ASRRequest = {
        audio: Buffer.from('test audio'),
        options: {
          model: 'request-model',
          language: 'en-US',
          responseFormat: 'text',
        },
      };

      const result = asr.buildRequestOptions(request);

      expect(result.model).toBe('request-model');
      expect(result.language).toBe('en-US');
      expect(result.responseFormat).toBe('text');
      // 基础选项应该保留
      expect(result.apiKey).toBe('test-key');
    });
  });
});
