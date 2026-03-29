/**
 * Doubao TTS seed-tts-1.0 - 流式输入/流式输出示例
 * 演示实时语音合成场景
 *
 * 模型特点:
 * - V1 版本
 * - 兼容旧版 API
 * - 适用于需要向后兼容的场景
 *
 * 环境变量:
 * - DOUBAO_APP_ID: 火山引擎应用 ID
 * - DOUBAO_ACCESS_TOKEN: 火山引擎访问令牌
 *
 * 使用方法:
 * npx tsx examples/tts/providers/doubao/seed-tts-1.0/stream-in-stream-out.ts
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
} from '../../../../utils/common';

const { __dirname, basename } = getScriptMeta(import.meta.url);

// 固定使用 seed-tts-1.0 模型
const RESOURCE_ID = 'seed-tts-1.0';

async function main() {
  const { appId, accessToken } = getTTSConfig();

  // 创建 TTS 实例
  const tts = createTTS({
    provider: 'doubao',
    appId,
    accessToken,
    voice: 'zh_male_lengkugege_emo_v2_mars_bigtts',
    format: 'pcm',
    resourceId: RESOURCE_ID,
    sampleRate: 24000,
  });

  if (!tts.speak) {
    console.error('当前 TTS 提供商不支持流式输入模式');
    process.exit(1);
  }

  console.log(`\n[${timestamp()}] === Seed TTS 1.0 - 流式入/流式出 ===`);
  console.log(`模型: ${RESOURCE_ID}`);
  console.log(`场景: 实时语音合成\n`);

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
