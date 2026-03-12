/**
 * Doubao TTS speak 非流式输出示例
 * 演示如何使用 speak() 方法获取完整音频（非流式）
 *
 * speak 方法支持两种输出模式:
 * - speak(text, { stream: true }): 流式音频输出 - 适用于实时播放场景
 * - speak(text) 或 speak(text, { stream: false }): 一次性音频输出 - 适用于需要完整音频的场景
 *
 * 本示例演示：字符串输入 + 非流式输出
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

  console.log(`\n[${timestamp()}] === speak 非流式输出模式演示 ===\n`);

  const text =
    '欢迎来到龙井村。这里是西湖龙井茶的原产地，漫山遍野的茶园层层叠叠，空气中弥漫着淡淡的茶香。春天采茶季节，您还能看到茶农们忙碌的身影。';

  console.log(`输入文本: "${text}"\n`);

  const startTime = Date.now();

  // 使用 speak 不传 stream 选项，返回 Promise<TTSResponse>
  // TTSResponse 包含完整的音频数据
  const response = await tts.speak(text);

  const endTime = Date.now();
  console.log(`[${timestamp()}] 音频生成完成，耗时: ${endTime - startTime} ms`);
  console.log(`音频大小: ${response.audio.length} bytes`);

  // 保存音频
  const outputPath = ensureOutputDir(__dirname, basename);
  writeFileSync(outputPath, response.audio);
  console.log(`\n音频已保存至: ${outputPath}`);

  printPlayTip(outputPath);

  // 对比说明
  console.log('\n=== 与 synthesize 的区别 ===');
  console.log('speak() 和 synthesize() 在非流式输出时功能相似，都返回完整音频');
  console.log('但 speak() 是更统一的 API，支持:');
  console.log('  - 字符串输入');
  console.log('  - 文本流输入（会自动收集完整文本后再合成）');
  console.log('  - 流式/非流式输出切换（通过 stream 选项）');
}

main();
