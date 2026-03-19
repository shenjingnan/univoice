/**
 * Minimax TTS speak 流式输入 + 非流式输出示例
 * 演示如何将文本流输入转换为完整音频输出
 *
 * speak 方法支持两种输入模式:
 * - speak(string): 字符串输入 - 适用于已知完整文本的场景
 * - speak(textStream): 文本流输入 - 适用于 LLM 流式输出等场景
 *
 * 本示例演示：文本流输入 + 非流式输出
 * 场景：模拟 LLM 流式输出，但需要等待完整音频后再使用
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

  console.log(`\n[${timestamp()}] === speak 流式输入 + 非流式输出演示 ===\n`);
  console.log('场景说明: 文本流输入（如 LLM 输出），等待完整音频输出\n');

  const startTime = Date.now();

  // 创建模拟的文本流
  const textStream = mockLLMStream();

  // 使用 speak 传入文本流，不传 stream 选项
  // speak 会自动收集所有文本块，然后返回完整音频
  console.log('开始收集文本流并合成音频...\n');

  const response = await tts.speak(textStream);

  const endTime = Date.now();
  console.log(`\n[${timestamp()}] 音频生成完成，总耗时: ${endTime - startTime} ms`);
  console.log(`音频大小: ${response.audio.length} bytes`);

  // 保存音频
  const outputPath = ensureOutputDir(__dirname, basename, 'mp3');
  writeFileSync(outputPath, response.audio);
  console.log(`\n音频已保存至: ${outputPath}`);

  console.log(`\n播放命令: ffplay -autoexit ${outputPath}`);

  // 适用场景说明
  console.log('\n=== 适用场景 ===');
  console.log('当你需要:');
  console.log('  1. 接收流式文本（如 LLM 输出）');
  console.log('  2. 但需要完整音频后才能使用（如保存文件、二次处理）');
  console.log('可以使用 speak(textStream) 获取完整音频');
  console.log('\n如果需要实时播放，请使用 speak(textStream, { stream: true })');
}

main().catch((error) => {
  console.error('语音合成失败:', error);
  process.exit(1);
});
