/**
 * OpenAI TTS mimo-v2-tts - 流式输入/流式输出示例
 * 演示使用 chat 模式进行流式语音合成
 *
 * 模型特点:
 * - 使用 chat.completions + audio 参数的 TTS 模型
 * - 适用于 mimo-v2-tts 等兼容 OpenAI chat 接口的 TTS 服务
 * - 流式输出 pcm 格式音频
 *
 * 环境变量:
 * - OPENAI_API_KEY: API Key（必填）
 * - OPENAI_BASE_URL: API 地址（必填，指向 mimo-v2-tts 服务地址）
 * - OPENAI_TTS_MODEL: 模型名称（可选，默认 mimo-v2-tts）
 *
 * 使用方法:
 * npx tsx examples/tts/providers/openai/mimo-v2-tts/stream-in-stream-out.ts
 */
import 'dotenv/config';
import { writeFileSync } from 'node:fs';
import { createTTS } from 'univoice';
import {
  DEFAULT_TTS_TEXT,
  ensureOutputDir,
  getOpenAIConfig,
  getScriptMeta,
  mockLLMStream,
  printPlayTip,
  printStats,
  timestamp,
} from '../../../../utils/common';

const { __dirname, basename } = getScriptMeta(import.meta.url);

// 固定使用 mimo-v2-tts 模型（chat 模式）
const MODEL = 'mimo-v2-tts';

async function main() {
  const { apiKey, baseUrl } = getOpenAIConfig();

  // 创建 TTS 实例，使用 chat 模式
  // mimo-v2-tts 会自动推断为 chat 模式
  const tts = createTTS({
    provider: 'openai',
    apiKey,
    baseUrl,
    voice: 'default_zh',
    format: 'pcm',
    model: MODEL,
  });

  if (!tts.speak) {
    console.error('当前 TTS 提供商不支持流式输入模式');
    process.exit(1);
  }

  console.log(`\n[${timestamp()}] === OpenAI TTS (chat 模式) - 流式入/流式出 ===`);
  console.log(`模型: ${MODEL}`);
  console.log(`场景: 实时语音合成\n`);

  const chunks: Uint8Array[] = [];
  const startTime = Date.now();
  let firstChunkTime = 0;
  let chunkCount = 0;

  // 使用 mockLLMStream 模拟 LLM 流式输出，通过 speak 消费流式音频
  const textStream = mockLLMStream(DEFAULT_TTS_TEXT, { delay: 150 });
  for await (const { audioChunk } of tts.speak(textStream, { stream: true })) {
    chunkCount++;
    if (chunkCount === 1) {
      firstChunkTime = Date.now();
      console.log(`[${timestamp()}] [首字延迟] ${firstChunkTime - startTime} ms\n`);
    }
    console.log(`[${timestamp()}] 收到音频块 #${chunkCount}: ${audioChunk.length} bytes`);
    chunks.push(audioChunk);
  }

  printStats(startTime, chunkCount, chunks);

  // 保存音频
  const outputPath = ensureOutputDir(__dirname, basename);
  const buffer = Buffer.concat(chunks.map((c) => Buffer.from(c)));
  writeFileSync(outputPath, buffer);
  console.log(`\n音频已保存至: ${outputPath}`);

  printPlayTip(outputPath);
}

main();
