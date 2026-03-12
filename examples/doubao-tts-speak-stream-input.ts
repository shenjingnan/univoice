/**
 * Doubao TTS speak 流式输入 + 非流式输出示例
 * 演示如何将文本流输入转换为完整音频输出
 *
 * speak 方法支持两种输入模式:
 * - speak(string): 字符串输入 - 适用于已知完整文本的场景
 * - speak(textStream): 文本流输入 - 适用于 LLM 流式输出等场景
 *
 * 本示例演示：文本流输入 + 非流式输出
 * 场景：模拟 LLM 流式输出，但需要等待完整音频后再使用
 */
import 'dotenv/config';
import { writeFileSync } from 'node:fs';
import { createTTS } from 'univoice';
import {
  ensureOutputDir,
  getScriptMeta,
  getTTSConfig,
  printPlayTip,
  timestamp,
} from './utils/common';

const { __dirname, basename } = getScriptMeta(import.meta.url);

/**
 * 模拟 LLM 流式输出
 * 实际场景中，这里可能是 OpenAI SDK 的 stream 对象
 */
async function* mockLLMStream(): AsyncIterable<string> {
  const chunks = ['欢迎来到', '龙井村。', '这里是', '西湖龙井茶的', '原产地。'];

  for (const chunk of chunks) {
    // 模拟网络延迟
    await new Promise((resolve) => setTimeout(resolve, 100));
    console.log(`[${timestamp()}] 收到文本块: "${chunk}"`);
    yield chunk;
  }

  console.log(`[${timestamp()}] 文本流结束`);
}

async function main() {
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
    console.error('当前 TTS 提供商不支持 speak 方法');
    process.exit(1);
  }

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
  const outputPath = ensureOutputDir(__dirname, basename);
  writeFileSync(outputPath, response.audio);
  console.log(`\n音频已保存至: ${outputPath}`);

  printPlayTip(outputPath);

  // 适用场景说明
  console.log('\n=== 适用场景 ===');
  console.log('当你需要:');
  console.log('  1. 接收流式文本（如 LLM 输出）');
  console.log('  2. 但需要完整音频后才能使用（如保存文件、二次处理）');
  console.log('可以使用 speak(textStream) 获取完整音频');
  console.log('\n如果需要实时播放，请使用 speak(textStream, { stream: true })');
}

main();
