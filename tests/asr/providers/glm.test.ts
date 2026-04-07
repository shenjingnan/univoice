import { describe, expect, it } from 'vitest';
import { GlmASR } from '@/asr/providers/glm.js';

describe('GlmASR 构造函数', () => {
  it('应该使用默认值初始化', () => {
    const asr = new GlmASR({ apiKey: 'test-key' });
    expect(asr.name).toBe('glm');
    expect(asr.baseUrl).toBe('https://open.bigmodel.cn/api/paas/v4/audio/transcriptions');
    expect(asr.model).toBe('glm-asr-2512');
    expect(asr.hotwords).toBeUndefined();
    expect(asr.context).toBeUndefined();
  });

  it('应该使用自定义选项', () => {
    const asr = new GlmASR({
      apiKey: 'key',
      baseUrl: 'https://custom.url',
      model: 'custom-model',
      hotwords: ['人工智能', '大模型'],
      context: '这是一段关于技术的对话',
    });
    expect(asr.baseUrl).toBe('https://custom.url');
    expect(asr.model).toBe('custom-model');
    expect(asr.hotwords).toEqual(['人工智能', '大模型']);
    expect(asr.context).toBe('这是一段关于技术的对话');
  });
});
