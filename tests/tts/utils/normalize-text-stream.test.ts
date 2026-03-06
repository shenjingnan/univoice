import { describe, expect, it } from 'vitest';
import { normalizeTextStream } from '@/tts/utils/normalize-text-stream.js';
import type { OpenAIChatCompletionChunk } from '@/types/llm-stream.js';

describe('normalizeTextStream', () => {
  describe('字符串输入', () => {
    it('应该直接 yield 字符串', async () => {
      const input = 'Hello, World!';
      const results: string[] = [];

      for await (const chunk of normalizeTextStream(input)) {
        results.push(chunk);
      }

      expect(results).toEqual(['Hello, World!']);
    });

    it('应该处理空字符串', async () => {
      const input = '';
      const results: string[] = [];

      for await (const chunk of normalizeTextStream(input)) {
        results.push(chunk);
      }

      expect(results).toEqual(['']);
    });
  });

  describe('普通文本流', () => {
    it('应该处理 AsyncIterable<string>', async () => {
      async function* textStream() {
        yield 'Hello';
        yield ' ';
        yield 'World';
        yield '!';
      }

      const results: string[] = [];
      for await (const chunk of normalizeTextStream(textStream())) {
        results.push(chunk);
      }

      expect(results).toEqual(['Hello', ' ', 'World', '!']);
    });

    it('应该处理 AsyncGenerator<string>', async () => {
      async function* generator(): AsyncGenerator<string> {
        yield 'Line 1\n';
        yield 'Line 2\n';
      }

      const results: string[] = [];
      for await (const chunk of normalizeTextStream(generator())) {
        results.push(chunk);
      }

      expect(results).toEqual(['Line 1\n', 'Line 2\n']);
    });

    it('应该处理空流', async () => {
      async function* emptyStream() {
        // 不 yield 任何内容
      }

      const results: string[] = [];
      for await (const chunk of normalizeTextStream(emptyStream())) {
        results.push(chunk);
      }

      expect(results).toEqual([]);
    });
  });

  describe('OpenAI stream 处理', () => {
    it('应该提取 content 字段', async () => {
      async function* openaiStream(): AsyncIterable<OpenAIChatCompletionChunk> {
        yield {
          choices: [{ delta: { content: 'Hello' } }],
        };
        yield {
          choices: [{ delta: { content: ' World' } }],
        };
      }

      const results: string[] = [];
      for await (const chunk of normalizeTextStream(openaiStream())) {
        results.push(chunk);
      }

      expect(results).toEqual(['Hello', ' World']);
    });

    it('应该忽略 reasoning_content 字段', async () => {
      async function* openaiStream(): AsyncIterable<OpenAIChatCompletionChunk> {
        yield {
          choices: [
            {
              delta: {
                content: 'Answer',
                reasoning_content: 'This is reasoning',
              },
            },
          ],
        };
      }

      const results: string[] = [];
      for await (const chunk of normalizeTextStream(openaiStream())) {
        results.push(chunk);
      }

      expect(results).toEqual(['Answer']);
    });

    it('应该处理 content 为 null 的 chunk', async () => {
      async function* openaiStream(): AsyncIterable<OpenAIChatCompletionChunk> {
        yield {
          choices: [{ delta: { content: 'Text' } }],
        };
        yield {
          choices: [{ delta: { content: null } }],
        };
        yield {
          choices: [{ delta: { content: ' More' } }],
        };
      }

      const results: string[] = [];
      for await (const chunk of normalizeTextStream(openaiStream())) {
        results.push(chunk);
      }

      expect(results).toEqual(['Text', ' More']);
    });

    it('应该处理空的 choices 数组', async () => {
      async function* openaiStream(): AsyncIterable<OpenAIChatCompletionChunk> {
        yield {
          choices: [{ delta: { content: 'Start' } }],
        };
        yield {
          choices: [],
        };
        yield {
          choices: [{ delta: { content: 'End' } }],
        };
      }

      const results: string[] = [];
      for await (const chunk of normalizeTextStream(openaiStream())) {
        results.push(chunk);
      }

      expect(results).toEqual(['Start', 'End']);
    });

    it('应该处理没有 choices 的 chunk', async () => {
      async function* openaiStream(): AsyncIterable<OpenAIChatCompletionChunk> {
        yield {
          choices: [{ delta: { content: 'Text' } }],
        };
        yield {} as OpenAIChatCompletionChunk;
        yield {
          choices: [{ delta: { content: ' Done' } }],
        };
      }

      const results: string[] = [];
      for await (const chunk of normalizeTextStream(openaiStream())) {
        results.push(chunk);
      }

      expect(results).toEqual(['Text', ' Done']);
    });

    it('应该处理完整的 OpenAI 流式响应模拟', async () => {
      async function* openaiStream(): AsyncIterable<OpenAIChatCompletionChunk> {
        // 模拟完整的 OpenAI 流式响应
        yield { choices: [{ delta: { content: 'Type' } }] };
        yield { choices: [{ delta: { content: 'Script' } }] };
        yield { choices: [{ delta: { content: ' is' } }] };
        yield { choices: [{ delta: { content: ' a' } }] };
        yield { choices: [{ delta: { content: ' typed' } }] };
        yield { choices: [{ delta: { content: ' superset' } }] };
        yield { choices: [{ delta: { content: ' of' } }] };
        yield { choices: [{ delta: { content: ' JavaScript' } }] };
        yield { choices: [{ delta: { content: '.' } }] };
        yield { choices: [{ delta: {} }] }; // 结束 chunk
      }

      const results: string[] = [];
      for await (const chunk of normalizeTextStream(openaiStream())) {
        results.push(chunk);
      }

      expect(results).toEqual([
        'Type',
        'Script',
        ' is',
        ' a',
        ' typed',
        ' superset',
        ' of',
        ' JavaScript',
        '.',
      ]);
    });
  });

  describe('混合场景', () => {
    it('应该正确区分普通字符串流和 OpenAI 流', async () => {
      // 普通 string 流
      async function* stringStream() {
        yield '{"choices":[{"delta":{"content":"json string"}}]}'; // 这是个字符串，不是 OpenAI chunk
      }

      const results: string[] = [];
      for await (const chunk of normalizeTextStream(stringStream())) {
        results.push(chunk);
      }

      // 应该原样输出字符串，而不是解析
      expect(results).toEqual(['{"choices":[{"delta":{"content":"json string"}}]}']);
    });
  });
});
