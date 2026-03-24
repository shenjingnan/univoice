/**
 * Qwen Realtime TTS speak 流式输出示例
 * 演示如何使用 qwen-realtime provider 和 Cherry 音色实现语音合成
 *
 * 特点:
 * - 使用 qwen3-tts-instruct-flash-realtime 模型
 * - 支持 instructions 指令控制功能
 * - 音频块实时返回，首字延迟更低
 *
 * 环境变量:
 * - QWEN_API_KEY: 阿里云 DashScope API Key
 */
import 'dotenv/config';
import { writeFileSync } from 'node:fs';
import { createTTS } from 'univoice';
import { ensureOutputDir, getScriptMeta, timestamp } from './utils/common';

const { __dirname, basename } = getScriptMeta(import.meta.url);

/**
 * 获取 Qwen API Key
 */
function getQwenApiKey(): string {
  const apiKey = process.env.QWEN_API_KEY;
  if (!apiKey) {
    console.error('请设置环境变量 QWEN_API_KEY');
    process.exit(1);
  }
  return apiKey;
}

async function main() {
  const apiKey = getQwenApiKey();

  // 创建 TTS 实例
  const tts = createTTS({
    provider: 'qwen-realtime',
    apiKey,
    // qwen3-tts-instruct-flash-realtime: 支持 instructions 功能
    model: 'qwen3-tts-instruct-flash-realtime',
    // Cherry 音色
    voice: 'Cherry',
    // PCM 格式（Realtime API 常用）
    format: 'pcm',
    // 采样率
    sampleRate: 24000,
    // Realtime 专用选项
    realtime: {
      // server_commit: 服务端自动判断合成时机（推荐）
      mode: 'server_commit',
      // 语言类型
      languageType: 'Chinese',
      // 指令控制：用温柔的语气说话
      instructions: '用温柔的语气说话',
      // 启用指令优化
      optimizeInstructions: true,
    },
  });

  console.log(`\n[${timestamp()}] === Qwen Realtime TTS 流式输出演示 ===\n`);

  const text =
    '欢迎来到杭州！我是您的智能导游。杭州，这座有着2200多年历史的古城，曾是南宋都城，如今是现代与古典完美交融的东方名城。让我们一起开启这段美妙的杭州之旅吧！';

  console.log(`输入文本: "${text}"\n`);
  console.log(`音色: Cherry`);
  console.log(`指令: 用温柔的语气说话\n`);

  const chunks: Uint8Array[] = [];
  const startTime = Date.now();
  let firstChunkTime = 0;
  let chunkCount = 0;

  // 使用 speak 流式模式
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
  const outputFile = ensureOutputDir(__dirname, basename, 'pcm');
  const buffer = Buffer.concat(chunks.map((c) => Buffer.from(c)));
  writeFileSync(outputFile, buffer);
  console.log(`\n音频已保存至: ${outputFile}`);
  console.log(`\n播放命令: ffplay -f s16le -ar 24000 ${outputFile}`);
}

main().catch((error) => {
  console.error('语音合成失败:', error);
  process.exit(1);
});
