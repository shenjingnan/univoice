/**
 * Qwen TTS speak 流式输入 + 流式输出示例
 * 演示如何将文本流输入边发边收转换为流式音频输出
 *
 * speak 方法支持两种输入模式:
 * - speak(string): 字符串输入 - 适用于已知完整文本的场景
 * - speak(textStream): 文本流输入 - 适用于 LLM 流式输出等场景
 *
 * 本示例演示：文本流输入 + 流式输出（边发边收）
 * 场景：模拟 LLM 流式输出，同时实时接收音频
 *
 * 环境变量:
 * - QWEN_API_KEY 或 QWEN_API_KEY: 阿里云 DashScope API Key
 */
import 'dotenv/config';
import { writeFileSync } from 'node:fs';
import { createTTS } from 'univoice';
import { ensureOutputDir, getScriptMeta, timestamp } from './utils/common';

const { __dirname, basename } = getScriptMeta(import.meta.url);

/**
 * 模拟 LLM 流式输出
 * 实际场景中，这里可能是 OpenAI SDK 的 stream 对象
 */
async function* mockLLMStream(): AsyncIterable<string> {
  const chunks = [
    '欢迎来到杭州！',
    '我是您的智能导游。',
    '杭州，',
    '这座有着2200多年历史的古城，',
    '曾是南宋都城，',
    '如今是现代与古典完美交融的东方名城。',
    '让我们一起开启这段美妙的杭州之旅吧！',
  ];

  for (const chunk of chunks) {
    // 模拟 LLM 输出延迟
    await new Promise((resolve) => setTimeout(resolve, 100));
    console.log(`[${timestamp()}] LLM 输出: "${chunk}"`);
    yield chunk;
  }

  console.log(`[${timestamp()}] LLM 流结束`);
}

async function main() {
  const apiKey = process.env.QWEN_API_KEY || process.env.QWEN_API_KEY;

  if (!apiKey) {
    console.error('请设置环境变量 QWEN_API_KEY 或 QWEN_API_KEY');
    process.exit(1);
  }

  const tts = createTTS({
    provider: 'qwen',
    apiKey,
    voice: 'longxiaochun_v3',
    format: 'mp3',
    model: 'cosyvoice-v3-flash',
  });

  if (!tts.speak) {
    console.error('当前 TTS 提供商不支持 speak 方法');
    process.exit(1);
  }

  console.log(`\n[${timestamp()}] === speak 流式输入 + 流式输出演示 (边发边收) ===\n`);
  console.log('场景说明: 文本流输入（如 LLM 输出），同时实时接收音频流\n');

  const startTime = Date.now();

  // 创建模拟的文本流
  const textStream = mockLLMStream();

  // 使用 speak 传入文本流，启用 stream 选项
  // speak 会边发边收：在发送文本的同时接收音频
  console.log('开始边发边收...\n');

  const audioChunks: Uint8Array[] = [];
  let chunkCount = 0;

  for await (const { audioChunk } of tts.speak(textStream, { stream: true })) {
    chunkCount++;
    console.log(`[${timestamp()}] 收到音频块 #${chunkCount}: ${audioChunk.length} bytes`);
    audioChunks.push(audioChunk);
  }

  const endTime = Date.now();
  console.log(`\n[${timestamp()}] 音频生成完成，总耗时: ${endTime - startTime} ms`);
  console.log(`音频块数: ${chunkCount}`);
  console.log(`音频大小: ${audioChunks.reduce((sum, c) => sum + c.length, 0)} bytes`);

  // 合并并保存音频
  const totalLength = audioChunks.reduce((sum, c) => sum + c.length, 0);
  const audio = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of audioChunks) {
    audio.set(chunk, offset);
    offset += chunk.length;
  }

  const outputPath = ensureOutputDir(__dirname, basename, 'mp3');
  writeFileSync(outputPath, audio);
  console.log(`\n音频已保存至: ${outputPath}`);

  // 播放提示
  console.log('\n=== 播放提示 ===');
  console.log(`ffplay ${outputPath}`);

  // 适用场景说明
  console.log('\n=== 适用场景 ===');
  console.log('当你需要:');
  console.log('  1. 接收流式文本（如 LLM 输出）');
  console.log('  2. 同时实时播放或处理音频（边发边收）');
  console.log('可以使用 speak(textStream, { stream: true })');
  console.log('\n如果需要等待完整音频后再使用，请使用 speak(textStream)');
}

main();
