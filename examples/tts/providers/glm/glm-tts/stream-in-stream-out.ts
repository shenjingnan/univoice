/**
 * GLM TTS glm-tts - 流式输入/流式输出示例
 * 演示实时语音合成场景
 *
 * 模型特点:
 * - 智谱 AI 语音合成模型
 * - 流式输出仅支持 PCM 格式
 * - 注意：GLM 流式实现会先收集完所有文本再发送请求（非真正边发边收），但接口使用方式一致
 *
 * 环境变量:
 * - GLM_API_KEY: 智谱 AI API Key
 *
 * 使用方法:
 * npx tsx examples/tts/providers/glm/glm-tts/stream-in-stream-out.ts
 */
import 'dotenv/config';
import { writeFileSync } from 'node:fs';
import { createTTS } from 'univoice';
import {
  DEFAULT_TTS_TEXT,
  ensureOutputDir,
  getGlmApiKey,
  getScriptMeta,
  mockLLMStream,
  printPlayTip,
  printStats,
  timestamp,
} from '../../../../utils/common';

const { __dirname, basename } = getScriptMeta(import.meta.url);

// 固定使用 glm-tts 模型
const MODEL = 'glm-tts';

async function main() {
  const apiKey = getGlmApiKey();

  // 创建 TTS 实例
  const tts = createTTS({
    provider: 'glm',
    apiKey,
    voice: 'tongtong',
    format: 'pcm',
    model: MODEL,
  });

  if (!tts.speak) {
    console.error('当前 TTS 提供商不支持流式输入模式');
    process.exit(1);
  }

  console.log(`\n[${timestamp()}] === GLM TTS - 流式入/流式出 ===`);
  console.log(`模型: ${MODEL}`);
  console.log(`场景: 实时语音合成\n`);

  const text =
    '欢迎来到龙井村。这里是西湖龙井茶的原产地，漫山遍野的茶园层层叠叠，空气中弥漫着淡淡的茶香。春天采茶季节，您还能看到茶农们忙碌的身影。';

  console.log(`输入文本: "${text}"\n`);

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
