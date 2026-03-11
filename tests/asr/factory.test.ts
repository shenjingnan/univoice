import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BaseASR } from '@/asr/base.js';
import {
  createASR,
  getASRProviders,
  listen,
  registerASRProvider,
  streamFrom,
} from '@/asr/factory.js';
import type {
  ASROptions,
  ASRRequest,
  ASRResponse,
  ASRStreamChunk,
  AudioStream,
} from '@/types/asr.js';

// 创建一个模拟的 ASR 提供商
class MockASRProvider extends BaseASR {
  name = 'mock-provider';

  async listen(_request: ASRRequest): Promise<ASRResponse> {
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

  describe('listen 快捷函数', () => {
    it('应该成功调用 listen 并返回结果', async () => {
      registerASRProvider('listen-test', MockASRProvider);

      const options: ASROptions = {
        provider: 'listen-test',
        apiKey: 'test-key',
      };

      const audio = Buffer.from('test audio data');
      const result = await listen(audio, options);

      expect(result.text).toBe('Transcribed text');
      expect(result.language).toBe('zh-CN');
      expect(result.duration).toBe(1.5);
    });

    it('应该将音频和选项正确传递给 ASR 实例', async () => {
      const listenSpy = vi.fn(async (_request: ASRRequest): Promise<ASRResponse> => {
        return {
          text: '',
          language: 'zh-CN',
        };
      });

      class SpyASR extends BaseASR {
        name = 'spy-provider';

        async listen(request: ASRRequest): Promise<ASRResponse> {
          return listenSpy(request);
        }
      }

      registerASRProvider('spy-test', SpyASR);

      const options: ASROptions = {
        provider: 'spy-test',
        apiKey: 'test-key',
      };

      const audio = Buffer.from('test audio');
      await listen(audio, options);

      expect(listenSpy).toHaveBeenCalledWith({
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
      const result = await listen(audio, options);

      expect(result.text).toBeDefined();
    });

    it('应该支持 string 类型的音频输入', async () => {
      registerASRProvider('string-test', MockASRProvider);

      const options: ASROptions = {
        provider: 'string-test',
        apiKey: 'test-key',
      };

      const audio = '/path/to/audio/file.mp3';
      const result = await listen(audio, options);

      expect(result.text).toBeDefined();
    });
  });

  describe('streamFrom 快捷函数', () => {
    // 创建一个支持 streamFrom 的模拟提供商
    class MockStreamFromProvider extends BaseASR {
      name = 'mock-streamfrom-provider';

      async listen(_request: ASRRequest): Promise<ASRResponse> {
        return { text: 'test' };
      }

      async *streamFrom(_audio: AudioStream): AsyncIterable<ASRStreamChunk> {
        yield { text: '你好', isFinal: false };
        yield { text: '世界', isFinal: true };
      }
    }

    it('应该支持 AudioStream 输入', async () => {
      registerASRProvider('streamfrom-audiostream-test', MockStreamFromProvider);

      const options: ASROptions = {
        provider: 'streamfrom-audiostream-test',
      };

      // 创建模拟的 AudioStream
      async function* mockAudioStream(): AudioStream {
        yield Buffer.from('chunk1');
        yield Buffer.from('chunk2');
      }

      const results: ASRStreamChunk[] = [];
      for await (const chunk of streamFrom(mockAudioStream(), options)) {
        results.push(chunk);
      }

      expect(results).toHaveLength(2);
      expect(results[0].text).toBe('你好');
      expect(results[1].text).toBe('世界');
      expect(results[1].isFinal).toBe(true);
    });

    it('应该支持字符串类型的输入（文件路径）', async () => {
      registerASRProvider('streamfrom-string-test', MockStreamFromProvider);

      const options: ASROptions = {
        provider: 'streamfrom-string-test',
      };

      // 使用字符串路径（会被转换为 AudioStream）
      const results: ASRStreamChunk[] = [];
      for await (const chunk of streamFrom('/path/to/audio.wav', options)) {
        results.push(chunk);
      }

      expect(results).toHaveLength(2);
    });

    it('应该支持 Buffer 类型的输入', async () => {
      registerASRProvider('streamfrom-buffer-test', MockStreamFromProvider);

      const options: ASROptions = {
        provider: 'streamfrom-buffer-test',
      };

      // 使用 Buffer（会被转换为 AudioStream）
      const audioBuffer = Buffer.from('test audio data');
      const results: ASRStreamChunk[] = [];
      for await (const chunk of streamFrom(audioBuffer, options)) {
        results.push(chunk);
      }

      expect(results).toHaveLength(2);
      expect(results[0].text).toBe('你好');
      expect(results[1].text).toBe('世界');
    });

    it('应该支持 Uint8Array 类型的输入', async () => {
      registerASRProvider('streamfrom-uint8array-test', MockStreamFromProvider);

      const options: ASROptions = {
        provider: 'streamfrom-uint8array-test',
      };

      // 使用 Uint8Array（会被转换为 AudioStream）
      const audioData = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
      const results: ASRStreamChunk[] = [];
      for await (const chunk of streamFrom(audioData, options)) {
        results.push(chunk);
      }

      expect(results).toHaveLength(2);
    });
  });
});
