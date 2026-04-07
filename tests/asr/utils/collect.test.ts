import { describe, expect, it, vi } from 'vitest';
import { collectText } from '@/asr/utils/collect.js';
import type { ASRResponse } from '@/types/asr.js';

describe('collectText', () => {
  it('应该提取纯文本', async () => {
    const response: ASRResponse = { text: 'Hello World' };
    const result = await collectText(response);
    expect(result).toBe('Hello World');
  });

  it('有 segments 时应该调用 onSegment 回调', async () => {
    const response: ASRResponse = {
      text: 'Hello World',
      segments: [
        { id: 0, start: 0, end: 500, text: 'Hello' },
        { id: 1, start: 500, end: 1000, text: ' World' },
      ],
    };
    const onSegment = vi.fn();
    await collectText(response, { onSegment });
    expect(onSegment).toHaveBeenCalledTimes(2);
    expect(onSegment).toHaveBeenCalledWith('Hello');
    expect(onSegment).toHaveBeenCalledWith(' World');
  });

  it('应该调用 onComplete 回调', async () => {
    const response: ASRResponse = { text: 'Test' };
    const onComplete = vi.fn();
    await collectText(response, { onComplete });
    expect(onComplete).toHaveBeenCalledWith('Test');
  });

  it('无 segments 时不应调用 onSegment', async () => {
    const response: ASRResponse = { text: 'Test' };
    const onSegment = vi.fn();
    await collectText(response, { onSegment });
    expect(onSegment).not.toHaveBeenCalled();
  });
});
