/**
 * OpenAI ChatCompletionChunk 的简化类型定义
 * 用于 speak 方法直接接收 OpenAI SDK 的流式输出
 */
export interface OpenAIChatCompletionChunk {
  choices?: Array<{
    delta?: {
      content?: string | null;
      reasoning_content?: string | null;
    };
  }>;
}

/**
 * OpenAI SDK Stream 类型（简化）
 * 表示 OpenAI chat.completions.stream() 返回的流式输出
 */
export type OpenAIStream = AsyncIterable<OpenAIChatCompletionChunk>;
