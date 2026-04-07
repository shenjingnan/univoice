import { writeFile } from 'node:fs/promises';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { saveText } from '@/asr/utils/save.js';
import type { ASRResponse } from '@/types/asr.js';

vi.mock('node:fs/promises', () => ({
  writeFile: vi.fn().mockResolvedValue(undefined),
}));

describe('saveText', () => {
  beforeEach(() => {
    vi.mocked(writeFile).mockClear();
  });

  it('应该以 txt 格式保存', async () => {
    const response: ASRResponse = { text: 'Hello World' };
    const filepath = await saveText(response);
    expect(filepath).toMatch(/^asr_\d+\.txt$/);
    expect(writeFile).toHaveBeenCalledWith(filepath, 'Hello World', 'utf-8');
  });

  it('应该以 json 格式保存', async () => {
    const response: ASRResponse = { text: 'Hello' };
    const filepath = await saveText(response, { format: 'json' });
    expect(filepath).toMatch(/^asr_\d+\.json$/);
    const content = vi.mocked(writeFile).mock.calls[0][1] as string;
    expect(JSON.parse(content).text).toBe('Hello');
  });

  it('应该使用自定义文件名', async () => {
    const response: ASRResponse = { text: 'Test' };
    const filepath = await saveText(response, { filename: 'result.txt' });
    expect(filepath).toBe('result.txt');
  });

  it('应该支持目录路径', async () => {
    const response: ASRResponse = { text: 'Test' };
    const filepath = await saveText(response, { directory: '/tmp/output' });
    expect(filepath.startsWith('/tmp/output/')).toBe(true);
  });

  it('应该使用自定义格式', async () => {
    const response: ASRResponse = { text: 'Test' };
    const filepath = await saveText(response, { format: 'srt' });
    expect(filepath).toMatch(/\.srt$/);
  });
});
