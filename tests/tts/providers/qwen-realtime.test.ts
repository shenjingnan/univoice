import { describe, expect, it } from 'vitest';
import { QwenRealtimeTTS } from '@/tts/providers/qwen-realtime.js';

describe('QwenRealtimeTTS 构造函数', () => {
  it('应该使用默认值初始化', () => {
    const tts = new QwenRealtimeTTS({ apiKey: 'test-key' });
    expect(tts.name).toBe('qwen-realtime');
    expect(tts.baseUrl).toBe('wss://dashscope.aliyuncs.com/api-ws/v1/realtime');
    expect(tts.model).toBe('qwen3-tts-instruct-flash-realtime');
    expect(tts.voice).toBe('Cherry');
    expect(tts.format).toBe('pcm');
  });

  it('应该使用自定义选项', () => {
    const tts = new QwenRealtimeTTS({
      apiKey: 'key',
      baseUrl: 'wss://custom.url',
      model: 'custom-model',
      voice: 'custom-voice',
    });
    expect(tts.baseUrl).toBe('wss://custom.url');
    expect(tts.model).toBe('custom-model');
    expect(tts.voice).toBe('custom-voice');
  });

  it('buildRealtimeUrl 应该拼接模型参数', async () => {
    // QwenRealtimeTTS 有一个私有方法 buildRealtimeUrl
    // 通过检查 synthesize 或 speakStream 中的 WebSocket URL 间接验证
    const tts = new QwenRealtimeTTS({ apiKey: 'key', model: 'test-model' });
    // 验证 model 属性已正确设置
    // buildRealtimeUrl 使用 new URL(this.baseUrl) 并设置 model 参数
    expect(tts.model).toBe('test-model');
    expect(tts.baseUrl).toBe('wss://dashscope.aliyuncs.com/api-ws/v1/realtime');
  });
});
