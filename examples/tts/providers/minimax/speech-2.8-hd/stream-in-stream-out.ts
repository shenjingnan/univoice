/**
 * Minimax TTS speech-2.8-hd - 流式输入/流式输出示例
 * 演示实时语音合成场景
 *
 * 模型特点:
 * - 精准还原真实语气
 * - 推荐用于通用场景
 *
 * 环境变量:
 * - MINIMAX_API_KEY: Minimax API Key
 *
 * 使用方法:
 * npx tsx examples/tts/providers/minimax/speech-2.8-hd/stream-in-stream-out.ts
 */
import 'dotenv/config';
import { writeFileSync } from 'node:fs';
import { createTTS } from 'univoice';
import {
  DEFAULT_TTS_TEXT,
  ensureOutputDir,
  getMinimaxApiKey,
  getScriptMeta,
  mockLLMStream,
  printStats,
  timestamp,
} from '../../../../utils/common';

const { __dirname, basename } = getScriptMeta(import.meta.url);

// 固定使用 speech-2.8-hd 模型
const MODEL = 'speech-2.8-hd';

async function main() {
  const apiKey = getMinimaxApiKey();

  // 创建 TTS 实例
  const tts = createTTS({
    provider: 'minimax',
    apiKey,
    voice: 'male-qn-qingse',
    format: 'mp3',
    model: MODEL,
    speed: 1,
    volume: 1,
  });

  if (!tts.speak) {
    console.error('当前 TTS 提供商不支持流式输入模式');
    process.exit(1);
  }

  console.log(`\n[${timestamp()}] === Speech 2.8 HD - 流式入/流式出 ===`);
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
  const outputPath = ensureOutputDir(__dirname, basename, 'mp3');
  const buffer = Buffer.concat(chunks.map((c) => Buffer.from(c)));
  writeFileSync(outputPath, buffer);
  console.log(`\n音频已保存至: ${outputPath}`);
  console.log(`\n播放命令: ffplay -autoexit ${outputPath}`);
}

main();
