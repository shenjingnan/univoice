/**
 * TTS speak 字符串输入示例
 * 演示如何使用 speak() 方法直接传入完整文本字符串
 *
 * speak 支持两种输入模式:
 * - speak(textStream): 流式文本输入 - 适用于 LLM 流式输出场景
 * - speak(string): 字符串输入 - 适用于已知完整文本的场景
 *
 * 返回值: AsyncIterable<TTSStreamChunk>，可通过 for await...of 消费
 *
 * 环境变量:
 * - DOUBAO_APP_KEY, DOUBAO_ACCESS_TOKEN: 火山引擎配置
 * - QWEN_API_KEY: 阿里云 DashScope API Key
 * - MINIMAX_API_KEY: Minimax API Key
 */
import 'dotenv/config';
import { writeFileSync } from 'node:fs';
import { createTTS } from 'univoice';
import {
  ensureOutputDir,
  getMinimaxApiKey,
  getQwenApiKey,
  getScriptMeta,
  getTTSConfig,
  printPlayTip,
  printStats,
  timestamp,
} from '../../utils/common';

const { __dirname, basename } = getScriptMeta(import.meta.url);

/**
 * 演示 Doubao TTS 字符串输入
 */
async function demoDoubao() {
  const { appId, accessToken, voice } = getTTSConfig();

  const tts = createTTS({
    provider: 'doubao',
    appId,
    accessToken,
    voice,
    format: 'pcm',
    resourceId: 'seed-tts-2.0',
    sampleRate: 24000,
  });

  if (!tts.speak) {
    console.error('Doubao TTS 不支持流式输入模式');
    return;
  }

  console.log(`\n[${timestamp()}] === Doubao TTS speak 字符串输入演示 ===\n`);

  const text =
    '欢迎来到龙井村。这里是西湖龙井茶的原产地，漫山遍野的茶园层层叠叠，空气中弥漫着淡淡的茶香。春天采茶季节，您还能看到茶农们忙碌的身影。';

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
    console.log(`[${timestamp()}] 收到音频块: ${audioChunk.length} bytes`);
    chunks.push(audioChunk);
  }

  printStats(startTime, chunkCount, chunks);

  const outputPath = ensureOutputDir(__dirname, `${basename}-doubao`);
  const buffer = Buffer.concat(chunks.map((c) => Buffer.from(c)));
  writeFileSync(outputPath, buffer);
  console.log(`\n音频已保存至: ${outputPath}`);

  printPlayTip(outputPath);
}

/**
 * 演示 Qwen TTS 字符串输入
 */
async function demoQwen() {
  const apiKey = getQwenApiKey();

  const tts = createTTS({
    provider: 'qwen',
    apiKey,
    model: 'cosyvoice-v3-flash',
    voice: 'longxiaochun_v3',
    format: 'mp3',
    volume: 50,
  });

  console.log(`\n[${timestamp()}] === Qwen TTS speak 字符串输入演示 ===\n`);

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

  const outputFile = ensureOutputDir(__dirname, `${basename}-qwen`, 'mp3');
  const buffer = Buffer.concat(chunks.map((c) => Buffer.from(c)));
  writeFileSync(outputFile, buffer);
  console.log(`\n音频已保存至: ${outputFile}`);
  console.log(`\n播放命令: ffplay -autoexit ${outputFile}`);
}

/**
 * 演示 Minimax TTS 字符串输入
 */
async function demoMinimax() {
  const apiKey = getMinimaxApiKey();

  const tts = createTTS({
    provider: 'minimax',
    apiKey,
    model: 'speech-2.8-hd',
    voice: 'male-qn-qingse',
    format: 'mp3',
    speed: 1,
    volume: 1,
  });

  console.log(`\n[${timestamp()}] === Minimax TTS speak 字符串输入演示 ===\n`);

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

  const outputFile = ensureOutputDir(__dirname, `${basename}-minimax`, 'mp3');
  const buffer = Buffer.concat(chunks.map((c) => Buffer.from(c)));
  writeFileSync(outputFile, buffer);
  console.log(`\n音频已保存至: ${outputFile}`);
  console.log(`\n播放命令: ffplay -autoexit ${outputFile}`);
}

// 从命令行参数选择演示的提供商
const provider = process.argv[2] || 'doubao';

async function main() {
  switch (provider) {
    case 'qwen':
      await demoQwen();
      break;
    case 'minimax':
      await demoMinimax();
      break;
    default:
      await demoDoubao();
      break;
  }
}

main().catch(console.error);
