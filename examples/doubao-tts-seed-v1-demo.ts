/**
 * Doubao TTS seed-tts-1.0 示例
 * 演示如何使用 seed-tts-1.0 模型进行语音合成
 *
 * seed-tts-1.0 是豆包 TTS 的早期版本模型
 * 本示例使用 zh_male_lengkugege_emo_v2_mars_bigtts 音色
 *
 * speak 支持两种输入模式:
 * - speak(textStream): 流式文本输入 - 适用于 LLM 流式输出场景
 * - speak(string): 字符串输入 - 适用于已知完整文本的场景
 *
 * 返回值: AsyncIterable<TTSStreamChunk>，可通过 for await...of 消费
 */
import 'dotenv/config';
import { writeFileSync } from 'node:fs';
import { createTTS } from 'univoice';
import {
  ensureOutputDir,
  getScriptMeta,
  getTTSConfig,
  printPlayTip,
  printStats,
  timestamp,
} from './utils/common';

const { __dirname, basename } = getScriptMeta(import.meta.url);

async function main() {
  const { appId, accessToken } = getTTSConfig();

  const tts = createTTS({
    provider: 'doubao',
    appId,
    accessToken,
    voice: 'zh_male_lengkugege_emo_v2_mars_bigtts',
    format: 'pcm',
    resourceId: 'seed-tts-1.0',
    sampleRate: 24000,
  });

  if (!tts.speak) {
    console.error('当前 TTS 提供商不支持流式输入模式');
    process.exit(1);
  }

  console.log(`\n[${timestamp()}] === seed-tts-1.0 演示 ===\n`);

  const text =
    '欢迎来到龙井村。这里是西湖龙井茶的原产地，漫山遍野的茶园层层叠叠，空气中弥漫着淡淡的茶香。春天采茶季节，您还能看到茶农们忙碌的身影。';

  console.log(`输入文本: "${text}"\n`);

  const chunks: Uint8Array[] = [];
  const startTime = Date.now();
  let firstChunkTime = 0;
  let chunkCount = 0;

  // 使用 speak 直接传入字符串，通过 for await...of 消费流式音频
  for await (const { audioChunk } of tts.speak(text, { stream: true })) {
    chunkCount++;
    if (chunkCount === 1) {
      firstChunkTime = Date.now();
      console.log(`[${timestamp()}] [首字延迟] ${firstChunkTime - startTime} ms\n`);
    }
    console.log(`[${timestamp()}] 收到音频块: ${audioChunk.length} bytes`);
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
