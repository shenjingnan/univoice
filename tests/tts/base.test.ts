import { describe, expect, it } from 'vitest';
import { BaseTTS } from '@/tts/base.js';
import type { BaseTTSOptions, TTSRequest, TTSResponse } from '@/types/tts.js';

// 创建一个具体的 TTS 实现类用于测试
class MockTTS extends BaseTTS {
  name = 'mock-tts';
  private _synthesizeCalled = false;
  private _lastText = '';

  async synthesize(request: TTSRequest): Promise<TTSResponse> {
    this._synthesizeCalled = true;
    this._lastText = request.text;
    const opts = this.buildRequestOptions(request);
    return {
      audio: new Uint8Array(0),
      format: opts.format || 'mp3',
      duration: 0,
    };
  }

  // 测试辅助方法
  get synthesizeCalled() {
    return this._synthesizeCalled;
  }

  get lastText() {
    return this._lastText;
  }

  reset() {
    this._synthesizeCalled = false;
    this._lastText = '';
  }
}

describe('BaseTTS', () => {
  describe('构造函数默认值', () => {
    it('应该使用默认选项初始化', () => {
      const tts = new MockTTS({
        apiKey: 'test-key',
      });

      expect(tts.name).toBe('mock-tts');
      expect(tts.apiKey).toBe('test-key');
      expect(tts.baseUrl).toBe('');
      expect(tts.model).toBe('default');
      expect(tts.voice).toBe('default');
      expect(tts.speed).toBe(1.0);
      expect(tts.volume).toBe(1.0);
      expect(tts.pitch).toBe(1.0);
      expect(tts.format).toBe('mp3');
      expect(tts.language).toBe('zh-CN');
    });

    it('应该使用提供的选项覆盖默认值', () => {
      const options: BaseTTSOptions = {
        apiKey: 'custom-key',
        baseUrl: 'https://custom.api.com',
        model: 'custom-model',
        voice: 'custom-voice',
        speed: 1.5,
        volume: 0.8,
        pitch: 0.9,
        format: 'wav',
        language: 'en-US',
      };

      const tts = new MockTTS(options);

      expect(tts.apiKey).toBe('custom-key');
      expect(tts.baseUrl).toBe('https://custom.api.com');
      expect(tts.model).toBe('custom-model');
      expect(tts.voice).toBe('custom-voice');
      expect(tts.speed).toBe(1.5);
      expect(tts.volume).toBe(0.8);
      expect(tts.pitch).toBe(0.9);
      expect(tts.format).toBe('wav');
      expect(tts.language).toBe('en-US');
    });
  });

  describe('buildRequestOptions', () => {
    it('应该返回包含所有默认选项的对象', () => {
      const tts = new MockTTS({
        apiKey: 'test-key',
      });

      const request: TTSRequest = {
        text: 'Hello',
      };

      const result = tts.buildRequestOptions(request);

      expect(result.provider).toBe('MockTTS');
      expect(result.apiKey).toBe('test-key');
      expect(result.baseUrl).toBe('');
      expect(result.model).toBe('default');
      expect(result.voice).toBe('default');
      expect(result.speed).toBe(1.0);
      expect(result.volume).toBe(1.0);
      expect(result.pitch).toBe(1.0);
      expect(result.format).toBe('mp3');
      expect(result.language).toBe('zh-CN');
    });

    it('应该合并请求选项到基础选项', () => {
      const tts = new MockTTS({
        apiKey: 'test-key',
        model: 'base-model',
        format: 'mp3',
      });

      const request: TTSRequest = {
        text: 'Hello',
        options: {
          model: 'request-model',
          format: 'wav',
          speed: 1.2,
        },
      };

      const result = tts.buildRequestOptions(request);

      expect(result.model).toBe('request-model');
      expect(result.format).toBe('wav');
      expect(result.speed).toBe(1.2);
      // 基础选项应该保留
      expect(result.apiKey).toBe('test-key');
    });
  });

  describe('speak 方法', () => {
    it('字符串输入 + 非流式输出应该调用 synthesize', async () => {
      const tts = new MockTTS({
        apiKey: 'test-key',
      });

      const response = await tts.speak('你好世界');

      expect(tts.synthesizeCalled).toBe(true);
      expect(tts.lastText).toBe('你好世界');
      expect(response.format).toBe('mp3');
    });

    it('流式输入 + 非流式输出应该收集文本后调用 synthesize', async () => {
      const tts = new MockTTS({
        apiKey: 'test-key',
      });

      async function* textStream() {
        yield '你好';
        yield ' ';
        yield '世界';
      }

      const response = await tts.speak(textStream());

      expect(tts.synthesizeCalled).toBe(true);
      expect(tts.lastText).toBe('你好 世界');
      expect(response.format).toBe('mp3');
    });

    it('字符串输入 + 流式输出应该抛错（provider 不支持）', async () => {
      const tts = new MockTTS({
        apiKey: 'test-key',
      });

      const iterable = tts.speak('你好世界', { stream: true });

      await expect(async () => {
        for await (const _ of iterable) {
          // 不应该到达这里
        }
      }).rejects.toThrow('Provider mock-tts 不支持流式输出模式');
    });

    it('流式输入 + 流式输出应该抛错（provider 不支持）', async () => {
      const tts = new MockTTS({
        apiKey: 'test-key',
      });

      async function* textStream() {
        yield '你好';
      }

      const iterable = tts.speak(textStream(), { stream: true });

      await expect(async () => {
        for await (const _ of iterable) {
          // 不应该到达这里
        }
      }).rejects.toThrow('Provider mock-tts 不支持流式输出模式');
    });
  });
});
