/**
 * OpenAI SDK 流式请求示例
 * 用于演示和调试流式返回数据
 */
import 'dotenv/config';
import OpenAI from 'openai';

async function main() {
  // 配置 OpenAI 客户端
  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_BASE_URL,
  });

  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

  console.log('=== OpenAI 流式请求示例 ===\n');
  console.log(`模型: ${model}`);
  console.log(`Base URL: ${process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1'}\n`);
  console.log('开始流式请求...\n');

  // 创建流式聊天补全
  const stream = await client.chat.completions.stream({
    model,
    messages: [
      {
        role: 'user',
        content: '请用一句话介绍 TypeScript',
      },
    ],
    stream: true,
  });

  let chunkIndex = 0;

  // 遍历流式响应
  for await (const chunk of stream) {
    chunkIndex++;
    console.log(`--- Chunk ${chunkIndex} ---`);
    console.log(JSON.stringify(chunk, null, 2));
    console.log('');
  }

  // 获取最终结果
  const result = await stream.finalChatCompletion();
  console.log('=== 最终结果 ===');
  console.log(JSON.stringify(result, null, 2));
}

main().catch(console.error);
