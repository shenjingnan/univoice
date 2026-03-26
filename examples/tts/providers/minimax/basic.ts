/**
 * Minimax TTS 基础示例
 * 演示如何使用 univoice SDK 调用 Minimax TTS 服务
 *
 * 环境变量:
 * - MINIMAX_API_KEY: Minimax API Key
 */
import 'dotenv/config';
import { writeFileSync } from 'node:fs';
import { createTTS } from 'univoice';
import { ensureOutputDir, getMinimaxApiKey, getScriptMeta } from '../../../utils/common';

const { __dirname, basename } = getScriptMeta(import.meta.url);

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

  console.log('开始合成语音...');

  try {
    const response = await tts.synthesize({
      text: '欢迎来到杭州！我是您的智能导游。杭州，这座有着2200多年历史的古城，曾是南宋都城，如今是现代与古典完美交融的东方名城。让我们一起开启这段美妙的杭州之旅吧！',
    });

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
