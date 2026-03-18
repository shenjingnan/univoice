/**
 * Minimax TTS speak 流式输出示例
 * 演示如何使用 speak(text, { stream: true }) 实现边收边输出的流式模式
 *
 * 流式模式特点:
 * - 音频块实时返回，首字延迟更低
 * - 适用于实时播放场景
 * - 支持字符串输入和流式文本输入
 *
 * 环境变量:
 * - MINIMAX_API_KEY: Minimax API Key
 */
import 'dotenv/config';
import { writeFileSync } from 'node:fs';
import { createTTS } from 'univoice';
import { ensureOutputDir, getScriptMeta, timestamp } from './utils/common';

const { __dirname, basename } = getScriptMeta(import.meta.url);

/**
 * 获取 Minimax API Key
 */
function getMinimaxApiKey(): string {
  const apiKey = process.env.MINIMAX_API_KEY;
  if (!apiKey) {
    console.error('请设置环境变量 MINIMAX_API_KEY');
    process.exit(1);
  }
  return apiKey;
}

async function main() {
  const apiKey = getMinimaxApiKey();

  // 创建 TTS 实例
  const tts = createTTS({
    provider: 'minimax',
    apiKey,
    // speech-2.8-hd: 精准还原真实语气（推荐）
    model: 'speech-2.8-hd',
    // 青春男声
    voice: 'male-qn-qingse',
    format: 'mp3',
    speed: 1,
    volume: 1,
  });

  console.log(`\n[${timestamp()}] === speak 流式输出模式演示 ===\n`);

  const text =
    '欢迎来到杭州！我是您的智能导游。杭州，这座有着2200多年历史的古城，曾是南宋都城，如今是现代与古典完美交融的东方名城。让我们一起开启这段美妙的杭州之旅吧！';

  console.log(`输入文本: "${text}"\n`);

  const chunks: Uint8Array[] = [];
  const startTime = Date.now();
  let firstChunkTime = 0;
  let chunkCount = 0;

  // 使用 speak 流式模式，通过 for await...of 消费流式音频
  for await (const { audioChunk } of tts.speak(text, { stream: true })) {
    chunkCount++;
    if (chunkCount === 1) {
      firstChunkTime = Date.now();
      console.log(`[${timestamp()}] [首字延迟] ${firstChunkTime - startTime} ms\n`);
    }
    chunks.push(audioChunk);
  }

  const endTime = Date.now();
  const totalDuration = endTime - startTime;

  // 统计信息
  const totalSize = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  console.log(`\n[${timestamp()}] === 统计信息 ===`);
  console.log(`总耗时: ${totalDuration} ms`);
  console.log(`首字延迟: ${firstChunkTime - startTime} ms`);
  console.log(`音频块数: ${chunkCount}`);
  console.log(`音频大小: ${totalSize} bytes`);

  // 保存音频
  const outputFile = ensureOutputDir(__dirname, basename, 'mp3');
  const buffer = Buffer.concat(chunks.map((c) => Buffer.from(c)));
  writeFileSync(outputFile, buffer);
  console.log(`\n音频已保存至: ${outputFile}`);
  console.log(`\n播放命令: ffplay -autoexit ${outputFile}`);
}

main().catch((error) => {
  console.error('语音合成失败:', error);
  process.exit(1);
});
