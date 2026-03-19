/**
 * Minimax TTS speak 流式输入 + 流式输出示例
 * 演示如何将文本流输入转换为流式音频输出
 *
 * speak 方法支持两种输入模式:
 * - speak(string): 字符串输入 - 适用于已知完整文本的场景
 * - speak(textStream): 文本流输入 - 适用于 LLM 流式输出等场景
 *
 * 本示例演示：文本流输入 + 流式输出
 * 场景：模拟 LLM 流式输出，实时转换为语音流
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

/**
 * 模拟 LLM 流式输出
 * 实际场景中，这里可能是 OpenAI SDK 的 stream 对象
 */
async function* mockLLMStream(): AsyncIterable<string> {
  const chunks = [
    '欢迎来到杭州！',
    '我是您的智能导游。',
    '杭州，这座有着2200多年历史的古城，',
    '曾是南宋都城，',
    '如今是现代与古典完美交融的东方名城。',
    '让我们一起开启这段美妙的杭州之旅吧！',
  ];

  for (const chunk of chunks) {
    // 模拟网络延迟
    await new Promise((resolve) => setTimeout(resolve, 100));
    console.log(`[${timestamp()}] 收到文本块: "${chunk}"`);
    yield chunk;
  }

  console.log(`[${timestamp()}] 文本流结束`);
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

  console.log(`\n[${timestamp()}] === speak 流式输入 + 流式输出演示 ===\n`);
  console.log('场景说明: 文本流输入（如 LLM 输出），实时流式音频输出\n');

  // 创建模拟的文本流
  const textStream = mockLLMStream();

  const chunks: Uint8Array[] = [];
  const startTime = Date.now();
  let firstChunkTime = 0;
  let audioChunkCount = 0;

  console.log('开始处理文本流...\n');

  // 使用 speak 传入文本流 + 流式输出
  for await (const { audioChunk } of tts.speak(textStream, { stream: true })) {
    audioChunkCount++;
    if (audioChunkCount === 1) {
      firstChunkTime = Date.now();
      console.log(`\n[${timestamp()}] [首字延迟] ${firstChunkTime - startTime} ms\n`);
    }
    chunks.push(audioChunk);
    console.log(`[${timestamp()}] 收到音频块 #${audioChunkCount}: ${audioChunk.length} bytes`);
  }

  const endTime = Date.now();
  const totalDuration = endTime - startTime;

  // 统计信息
  const totalSize = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  console.log(`\n[${timestamp()}] === 统计信息 ===`);
  console.log(`总耗时: ${totalDuration} ms`);
  console.log(`首字延迟: ${firstChunkTime - startTime} ms`);
  console.log(`音频块数: ${audioChunkCount}`);
  console.log(`音频大小: ${totalSize} bytes`);

  // 保存音频
  const outputFile = ensureOutputDir(__dirname, basename, 'mp3');
  const buffer = Buffer.concat(chunks.map((c) => Buffer.from(c)));
  writeFileSync(outputFile, buffer);
  console.log(`\n音频已保存至: ${outputFile}`);

  // 播放提示
  console.log(`\n播放命令: ffplay -autoexit ${outputFile}`);

  // 适用场景说明
  console.log('\n=== 适用场景 ===');
  console.log('当你需要:');
  console.log('  1. 接收流式文本（如 LLM 输出）');
  console.log('  2. 实时播放或处理音频');
  console.log('可以使用 speak(textStream, { stream: true }) 获取流式音频');
}

main().catch((error) => {
  console.error('语音合成失败:', error);
  process.exit(1);
});
