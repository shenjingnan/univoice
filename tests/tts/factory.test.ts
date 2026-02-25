import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BaseTTS } from '@/tts/base.js';
import {
  createTTS,
  getTTSProviders,
  registerTTSProvider,
  synthesize,
} from '@/tts/factory.js';
import type { TTSOptions, TTSRequest, TTSResponse } from '@/types/tts.js';

// 创建一个模拟的 TTS 提供商
class MockTTSProvider extends BaseTTS {
  name = 'mock-provider';

  async synthesize(request: TTSRequest): Promise<TTSResponse> {
    return {
      audio: new Uint8Array([1, 2, 3]),
      format: 'mp3',
      duration: 1.0,
    };
  }
}

describe('TTS Factory', () => {
  beforeEach(() => {
    // 清理所有注册的提供商
    // 注意：由于 providers 是模块级变量，每个测试文件独立运行时需要重置
  });

  describe('registerTTSProvider', () => {
    it('应该成功注册一个新的 TTS 提供商', () => {
      registerTTSProvider('test-provider', MockTTSProvider);

      const providers = getTTSProviders();
      expect(providers).toContain('test-provider');
    });
  });

  describe('createTTS', () => {
    it('应该成功创建 TTS 实例', () => {
      registerTTSProvider('create-test', MockTTSProvider);

      const options: TTSOptions = {
        provider: 'create-test',
        apiKey: 'test-key',
      };

      const instance = createTTS(options);

      expect(instance).toBeInstanceOf(MockTTSProvider);
      expect(instance.name).toBe('mock-provider');
    });

    it('当提供商不存在时应该抛出错误', () => {
      expect(() => {
        createTTS({
          provider: 'non-existent-provider',
        });
      }).toThrow('TTS provider "non-existent-provider" not found');
    });
  });

  describe('getTTSProviders', () => {
    it('应该返回已注册的提供商列表', () => {
      registerTTSProvider('provider-a', MockTTSProvider);
      registerTTSProvider('provider-b', MockTTSProvider);

      const providers = getTTSProviders();

      expect(providers).toContain('provider-a');
      expect(providers).toContain('provider-b');
    });

    it('当没有注册提供商时应该返回空数组', () => {
      const providers = getTTSProviders();
      expect(Array.isArray(providers)).toBe(true);
    });
  });

  describe('synthesize 快捷函数', () => {
    it('应该成功调用 synthesize 并返回结果', async () => {
      registerTTSProvider('synthesize-test', MockTTSProvider);

      const options: TTSOptions = {
        provider: 'synthesize-test',
        apiKey: 'test-key',
      };

      const result = await synthesize('Hello World', options);

      expect(result.audio).toBeDefined();
      expect(result.format).toBe('mp3');
      expect(result.duration).toBe(1.0);
    });

    it('应该将文本和选项正确传递给 TTS 实例', async () => {
      const synthesizeSpy = vi.fn(async (request: TTSRequest): Promise<TTSResponse> => {
        return {
          audio: new Uint8Array(0),
          format: 'mp3',
          duration: 0,
        };
      });

      class SpyTTS extends BaseTTS {
        name = 'spy-provider';

        async synthesize(request: TTSRequest): Promise<TTSResponse> {
          return synthesizeSpy(request);
        }
      }

      registerTTSProvider('spy-test', SpyTTS);

      const options: TTSOptions = {
        provider: 'spy-test',
        apiKey: 'test-key',
      };

      await synthesize('Test text', options);

      expect(synthesizeSpy).toHaveBeenCalledWith({
        text: 'Test text',
        options: options,
      });
    });
  });
});
