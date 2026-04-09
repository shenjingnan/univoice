/**
 * OpenAI TTS 基础示例
 * 演示如何使用 univoice SDK 调用 OpenAI TTS 服务（speech 模式）
 *
 * 环境变量:
 * - OPENAI_API_KEY: OpenAI API Key（必填）
 * - OPENAI_BASE_URL: 自定义 API 地址（可选）
 *
 * 使用方法:
 * npx tsx examples/tts/providers/openai/basic.ts
 */
import 'dotenv/config';
import { writeFileSync } from 'node:fs';
import { createTTS } from 'univoice';
import { ensureOutputDir, getOpenAIConfig, getScriptMeta } from '../../../utils/common';

const { __dirname, basename } = getScriptMeta(import.meta.url);

async function main() {
  const { apiKey, baseUrl } = getOpenAIConfig();

  // 创建 TTS 实例，默认使用 speech 模式（tts-1 模型）
  const tts = createTTS({
    provider: 'openai',
    apiKey,
    baseUrl,
    // 模型：tts-1（默认）
    // 其他选项: tts-1-hd（高清）, gpt-4o-mini-tts
    model: 'tts-1',
    // 音色：alloy（默认）
    // 其他选项: echo, fable, onyx, nova, shimmer
    voice: 'alloy',
    // 音频格式：mp3（默认）
    // speech 模式还支持: opus, aac, flac, wav, pcm
    format: 'mp3',
  });

  console.log('开始合成语音...');

  try {
    // 使用 speak 方法一次性合成语音
    const response = await tts.speak(
      '欢迎来到杭州！我是您的智能导游。杭州，这座有着2200多年历史的古城，曾是南宋都城，如今是现代与古典完美交融的东方名城。让我们一起开启这段美妙的杭州之旅吧！'
    );

    // 保存音频文件
    const outputFile = ensureOutputDir(__dirname, basename, response.format);
    writeFileSync(outputFile, response.audio);
    console.log(`音频已保存至: ${outputFile}`);
    console.log(`音频大小: ${response.audio.length} bytes`);
  } catch (error) {
    console.error('语音合成失败:', error);
    process.exit(1);
  }
}

main();
