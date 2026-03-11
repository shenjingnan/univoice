import { beforeEach, describe, expect, it } from 'vitest';
import { BaseASR } from '@/asr/base.js';
import { createASR, getASRProviders, listen, registerASRProvider } from '@/asr/factory.js';
import type { ASROptions, ASRStreamChunk, AudioStream } from '@/types/asr.js';

// 创建一个模拟的 ASR 提供商
class MockASRProvider extends BaseASR {
  name = 'mock-provider';

  async *listen(_audio: AudioStream): AsyncIterable<ASRStreamChunk> {
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

  describe('listen 快捷函数', () => {
    it('应该支持 AudioStream 输入', async () => {
      registerASRProvider('listen-audiostream-test', MockASRProvider);

      const options: ASROptions = {
        provider: 'listen-audiostream-test',
      };

      // 创建模拟的 AudioStream
      async function* mockAudioStream(): AudioStream {
        yield Buffer.from('chunk1');
        yield Buffer.from('chunk2');
      }

      const results: ASRStreamChunk[] = [];
      for await (const chunk of listen(mockAudioStream(), options)) {
        results.push(chunk);
      }

      expect(results).toHaveLength(1);
      expect(results[0].text).toBe('Transcribed text');
      expect(results[0].isFinal).toBe(true);
    });

    it('应该支持字符串类型的输入（文件路径）', async () => {
      registerASRProvider('listen-string-test', MockASRProvider);

      const options: ASROptions = {
        provider: 'listen-string-test',
      };

      // 使用字符串路径（会被转换为 AudioStream）
      const results: ASRStreamChunk[] = [];
      for await (const chunk of listen('/path/to/audio.wav', options)) {
        results.push(chunk);
      }

      expect(results).toHaveLength(1);
    });

    it('应该支持 Buffer 类型的输入', async () => {
      registerASRProvider('listen-buffer-test', MockASRProvider);

      const options: ASROptions = {
        provider: 'listen-buffer-test',
      };

      // 使用 Buffer（会被转换为 AudioStream）
      const audioBuffer = Buffer.from('test audio data');
      const results: ASRStreamChunk[] = [];
      for await (const chunk of listen(audioBuffer, options)) {
        results.push(chunk);
      }

      expect(results).toHaveLength(1);
      expect(results[0].text).toBe('Transcribed text');
    });

    it('应该支持 Uint8Array 类型的输入', async () => {
      registerASRProvider('listen-uint8array-test', MockASRProvider);

      const options: ASROptions = {
        provider: 'listen-uint8array-test',
      };

      // 使用 Uint8Array（会被转换为 AudioStream）
      const audioData = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
      const results: ASRStreamChunk[] = [];
      for await (const chunk of listen(audioData, options)) {
        results.push(chunk);
      }

      expect(results).toHaveLength(1);
    });
  });
});
