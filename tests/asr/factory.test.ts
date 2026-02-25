import { BaseASR } from '@/asr/base.js';
import { createASR, getASRProviders, recognize, registerASRProvider } from '@/asr/factory.js';
import type { ASROptions, ASRRequest, ASRResponse } from '@/types/asr.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// 创建一个模拟的 ASR 提供商
class MockASRProvider extends BaseASR {
  name = 'mock-provider';

  async recognize(_request: ASRRequest): Promise<ASRResponse> {
    return {
      text: 'Transcribed text',
      language: 'zh-CN',
      duration: 1.5,
    };
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

  describe('recognize 快捷函数', () => {
    it('应该成功调用 recognize 并返回结果', async () => {
      registerASRProvider('recognize-test', MockASRProvider);

      const options: ASROptions = {
        provider: 'recognize-test',
        apiKey: 'test-key',
      };

      const audio = Buffer.from('test audio data');
      const result = await recognize(audio, options);

      expect(result.text).toBe('Transcribed text');
      expect(result.language).toBe('zh-CN');
      expect(result.duration).toBe(1.5);
    });

    it('应该将音频和选项正确传递给 ASR 实例', async () => {
      const recognizeSpy = vi.fn(async (_request: ASRRequest): Promise<ASRResponse> => {
        return {
          text: '',
          language: 'zh-CN',
        };
      });

      class SpyASR extends BaseASR {
        name = 'spy-provider';

        async recognize(request: ASRRequest): Promise<ASRResponse> {
          return recognizeSpy(request);
        }
      }

      registerASRProvider('spy-test', SpyASR);

      const options: ASROptions = {
        provider: 'spy-test',
        apiKey: 'test-key',
      };

      const audio = Buffer.from('test audio');
      await recognize(audio, options);

      expect(recognizeSpy).toHaveBeenCalledWith({
        audio: Buffer.from('test audio'),
        options: options,
      });
    });

    it('应该支持 Uint8Array 类型的音频输入', async () => {
      registerASRProvider('uint8array-test', MockASRProvider);

      const options: ASROptions = {
        provider: 'uint8array-test',
        apiKey: 'test-key',
      };

      const audio = new Uint8Array([1, 2, 3, 4]);
      const result = await recognize(audio, options);

      expect(result.text).toBeDefined();
    });

    it('应该支持 string 类型的音频输入', async () => {
      registerASRProvider('string-test', MockASRProvider);

      const options: ASROptions = {
        provider: 'string-test',
        apiKey: 'test-key',
      };

      const audio = '/path/to/audio/file.mp3';
      const result = await recognize(audio, options);

      expect(result.text).toBeDefined();
    });
  });
});
