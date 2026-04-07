import { describe, expect, it } from 'vitest';
import { BaseASR } from '@/asr/base.js';
import type { ASRStreamChunk, AudioStream, BaseASROptions } from '@/types/asr.js';

// 创建一个具体的 ASR 实现类用于测试
class MockASR extends BaseASR {
  name = 'mock-asr';

  async *listenStream(_audio: AudioStream): AsyncIterable<ASRStreamChunk> {
    yield { text: 'Mocked transcription', isFinal: true };
  }
}

// 创建一个能产生多个 chunk（含 segment 信息）的 Mock
class MockASRWithSegments extends BaseASR {
  name = 'mock-asr-segments';

  async *listenStream(_audio: AudioStream): AsyncIterable<ASRStreamChunk> {
    yield {
      text: 'Hello',
      isFinal: true,
      segment: { id: 0, start: 0, end: 1000, text: 'Hello' },
    };
    yield {
      text: ' World',
      isFinal: true,
      segment: { id: 1, start: 1000, end: 2000, text: ' World' },
    };
    yield { text: '', isFinal: false }; // 非最终结果不应被收集到 textParts
  }
}

describe('BaseASR', () => {
  describe('构造函数默认值', () => {
    it('应该使用默认选项初始化', () => {
      const asr = new MockASR({
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
      const options: BaseASROptions = {
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

  describe('connect()', () => {
    it('connect() 默认应该抛出错误', () => {
      const asr = new MockASR({ apiKey: 'test' });
      expect(() => asr.connect()).toThrow('does not support connection pre-establishment');
    });
  });

  describe('listen() stream=true', () => {
    it('listen() stream=true 应该返回 AsyncIterable', async () => {
      const asr = new MockASR({ apiKey: 'test' });
      const audioData = new Uint8Array([1, 2, 3]);
      const result = asr.listen(audioData, { stream: true });
      const chunks = [];
      for await (const chunk of result) {
        chunks.push(chunk);
      }
      expect(chunks).toHaveLength(1);
      expect(chunks[0].text).toBe('Mocked transcription');
      expect(chunks[0].isFinal).toBe(true);
    });

    it('listen() stream=true 应该处理 Buffer 输入', async () => {
      const asr = new MockASR({ apiKey: 'test' });
      const buffer = Buffer.from([1, 2, 3, 4]);
      const result = asr.listen(buffer, { stream: true });
      const chunks = [];
      for await (const chunk of result) {
        chunks.push(chunk);
      }
      expect(chunks).toHaveLength(1);
    });
  });

  describe('listen() stream=false', () => {
    it('listen() stream=false 应该返回 Promise<ASRResponse>', async () => {
      const asr = new MockASR({ apiKey: 'test' });
      const audioData = new Uint8Array([1, 2, 3]);
      const result = await asr.listen(audioData);
      expect(result.text).toBe('Mocked transcription');
    });

    it('listen() 应该收集最终的 text 和 segments', async () => {
      const asr = new MockASRWithSegments({ apiKey: 'test' });
      const result = await asr.listen(new Uint8Array([1, 2, 3]));
      expect(result.text).toBe('Hello World');
      expect(result.segments).toHaveLength(2);
      expect(result.segments?.[0].text).toBe('Hello');
      expect(result.segments?.[1].text).toBe(' World');
    });

    it('listen() 无 segments 时不应返回 segments 字段', async () => {
      const asr = new MockASR({ apiKey: 'test' });
      const result = await asr.listen(new Uint8Array([1]));
      expect(result.text).toBe('Mocked transcription');
      expect(result.segments).toBeUndefined();
    });
  });
});
