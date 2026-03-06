import type { OpenAIChatCompletionChunk } from '@/types/llm-stream';
import type { TextStream } from '@/types/tts';

/**
 * 检测是否为 OpenAI stream chunk
 * 通过检查对象是否有 choices 数组来判断
 */
function isOpenAIChunk(chunk: unknown): chunk is OpenAIChatCompletionChunk {
  return (
    typeof chunk === 'object' &&
    chunk !== null &&
    'choices' in chunk &&
    Array.isArray((chunk as OpenAIChatCompletionChunk).choices)
  );
}

/**
 * 从 OpenAI chunk 中提取 content
 * 忽略 reasoning_content 等其他字段
 */
function extractOpenAIContent(chunk: OpenAIChatCompletionChunk): string | null {
  const content = chunk.choices?.[0]?.delta?.content;
  return content ?? null;
}

/**
 * 统一转换为 AsyncIterable<string>
 * 自动处理以下输入类型：
 * - string: 直接 yield
 * - AsyncIterable<string>: 直接转发
 * - OpenAIStream: 提取 delta.content 并忽略 reasoning_content
 *
 * @param input 输入文本或文本流
 * @yields 统一的字符串流
 */
export async function* normalizeTextStream(input: string | TextStream): AsyncGenerator<string> {
  // 情况 1：字符串
  if (typeof input === 'string') {
    yield input;
    return;
  }

  // 情况 2 和 3：流式输入
  for await (const chunk of input) {
    // 检测 chunk 类型
    if (typeof chunk === 'string') {
      // 普通文本流
      yield chunk;
    } else if (isOpenAIChunk(chunk)) {
      // OpenAI stream - 提取 content，忽略 reasoning_content
      const content = extractOpenAIContent(chunk);
      if (content) {
        yield content;
      }
    }
  }
}
