import { beforeEach, describe, expect, it } from 'vitest';
import { BaseASR } from '@/asr/base.js';
import { createASR, getASRProviders, registerASRProvider } from '@/asr/factory.js';
import type { ASROptions, ASRStreamChunk, AudioStream } from '@/types/asr.js';

// 创建一个模拟的 ASR 提供商
class MockASRProvider extends BaseASR {
  name = 'mock-provider';

  async *listenStream(_audio: AudioStream): AsyncIterable<ASRStreamChunk> {
    yield { text: 'Transcribed text', isFinal: true };
  }
}

describe('ASR Factory', () => {
  beforeEach(() => {
    // 清理所有注册的提供商
    // 注意：由于 providers 是模块级变量，每个测试文件独立运行时需要重置
  });

  describe('registerASRProvider', () => {
    it('应该成功注册一个新的 ASR 提供商', () => {
      registerASRProvider('test-provider', MockASRProvider);

      const providers = getASRProviders();
      expect(providers).toContain('test-provider');
    });
  });

  describe('createASR', () => {
    it('应该成功创建 ASR 实例', () => {
      registerASRProvider('create-test', MockASRProvider);

      const options: ASROptions = {
        provider: 'create-test',
        apiKey: 'test-key',
      };

      const instance = createASR(options);

      expect(instance).toBeInstanceOf(MockASRProvider);
      expect(instance.name).toBe('mock-provider');
    });

    it('当提供商不存在时应该抛出错误', () => {
      expect(() => {
        createASR({
          provider: 'non-existent-provider',
        });
      }).toThrow('ASR provider "non-existent-provider" not found');
    });
  });

  describe('getASRProviders', () => {
    it('应该返回已注册的提供商列表', () => {
      registerASRProvider('provider-a', MockASRProvider);
      registerASRProvider('provider-b', MockASRProvider);

      const providers = getASRProviders();

      expect(providers).toContain('provider-a');
      expect(providers).toContain('provider-b');
    });

    it('当没有注册提供商时应该返回空数组', () => {
      const providers = getASRProviders();
      expect(Array.isArray(providers)).toBe(true);
    });
  });
});
