/**
 * OpenAI TTS tts-1 - 流式输入/流式输出示例
 * 演示使用 speech 模式进行流式语音合成
 *
 * 模型特点:
 * - OpenAI 标准 TTS 模型
 * - 流式输出支持所有格式，本示例使用 pcm
 *
 * 环境变量:
 * - OPENAI_API_KEY: OpenAI API Key（必填）
 * - OPENAI_BASE_URL: 自定义 API 地址（可选）
 *
 * 使用方法:
 * npx tsx examples/tts/providers/openai/tts-1/stream-in-stream-out.ts
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

// 固定使用 tts-1 模型
const MODEL = 'tts-1';

async function main() {
  const { apiKey, baseUrl } = getOpenAIConfig();

  // 创建 TTS 实例
  const tts = createTTS({
    provider: 'openai',
    apiKey,
    baseUrl,
    voice: 'alloy',
    format: 'pcm',
    model: MODEL,
  });

  if (!tts.speak) {
    console.error('当前 TTS 提供商不支持流式输入模式');
    process.exit(1);
  }

  console.log(`\n[${timestamp()}] === OpenAI TTS - 流式入/流式出 ===`);
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
