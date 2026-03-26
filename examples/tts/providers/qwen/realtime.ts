/**
 * Qwen TTS 实时模式示例
 * 演示 Qwen CosyVoice 实时语音合成模式
 *
 * 环境变量:
 * - QWEN_API_KEY: 阿里云 DashScope API Key
 */
import 'dotenv/config';
import { writeFileSync } from 'node:fs';
import { createTTS } from 'univoice';
import {
  ensureOutputDir,
  getQwenApiKey,
  getScriptMeta,
  printStats,
  timestamp,
} from '../../../utils/common';

const { __dirname, basename } = getScriptMeta(import.meta.url);

async function main() {
  const apiKey = getQwenApiKey();

  const tts = createTTS({
    provider: 'qwen',
    apiKey,
    model: 'cosyvoice-v3-flash',
    voice: 'longxiaochun_v3',
    format: 'mp3',
  });

  if (!tts.speak) {
    console.error('Qwen TTS 不支持 speak 方法');
    process.exit(1);
  }

  console.log(`\n[${timestamp()}] === Qwen TTS 实时模式演示 ===\n`);

  const text =
    '欢迎来到杭州！我是您的智能导游。杭州，这座有着2200多年历史的古城，曾是南宋都城，如今是现代与古典完美交融的东方名城。让我们一起开启这段美妙的杭州之旅吧！';

  console.log(`输入文本: "${text}"\n`);

  const chunks: Uint8Array[] = [];
  const startTime = Date.now();
  let firstChunkTime = 0;
  let chunkCount = 0;

  for await (const { audioChunk } of tts.speak(text, { stream: true })) {
    chunkCount++;
    if (chunkCount === 1) {
      firstChunkTime = Date.now();
      console.log(`[${timestamp()}] [首字延迟] ${firstChunkTime - startTime} ms\n`);
    }
    chunks.push(audioChunk);
  }

  printStats(startTime, chunkCount, chunks);

  const outputPath = ensureOutputDir(__dirname, basename, 'mp3');
  const buffer = Buffer.concat(chunks.map((c) => Buffer.from(c)));
  writeFileSync(outputPath, buffer);
  console.log(`\n音频已保存至: ${outputPath}`);
  console.log(`\n播放命令: ffplay -autoexit ${outputPath}`);
}

main();
