/**
 * Qwen TTS Opus 输出示例
 * 演示如何使用 Opus 格式输出音频
 *
 * 环境变量:
 * - QWEN_API_KEY: 阿里云 DashScope API Key
 */
import 'dotenv/config';
import { writeFileSync } from 'node:fs';
import { createTTS } from 'univoice';
import { ensureOutputDir, getQwenApiKey, getScriptMeta, timestamp } from '../../../utils/common';

const { __dirname, basename } = getScriptMeta(import.meta.url);

async function main() {
  const apiKey = getQwenApiKey();

  // 创建 TTS 实例，指定 Opus 格式输出
  const tts = createTTS({
    provider: 'qwen',
    apiKey,
    model: 'cosyvoice-v3-flash',
    voice: 'longxiaochun_v3',
    format: 'opus',
  });

  console.log(`\n[${timestamp()}] === Qwen TTS Opus 输出演示 ===\n`);

  const text = '欢迎来到杭州！我是您的智能导游。';

  console.log(`输入文本: "${text}"\n`);

  try {
    const response = await tts.synthesize({
      text,
    });

    const outputFile = ensureOutputDir(__dirname, basename, 'ogg');
    writeFileSync(outputFile, response.audio);
    console.log(`音频已保存至: ${outputFile}`);
    console.log(`音频大小: ${response.audio.length} bytes`);
    console.log(`\n播放命令: ffplay -autoexit ${outputFile}`);
  } catch (error) {
    console.error('语音合成失败:', error);
    process.exit(1);
  }
}

main();
