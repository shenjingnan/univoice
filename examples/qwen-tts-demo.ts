/**
 * Qwen TTS 使用示例
 * 演示如何使用 univoice SDK 调用阿里云 DashScope CosyVoice TTS 服务
 *
 * 环境变量:
 * - QWEN_API_KEY 或 QWEN_API_KEY: 阿里云 DashScope API Key
 */
import 'dotenv/config';
import { writeFileSync } from 'node:fs';
import { createTTS } from 'univoice';
import { ensureOutputDir, getScriptMeta } from './utils/common';

const { __dirname, basename } = getScriptMeta(import.meta.url);

/**
 * 获取 Qwen API Key
 */
function getQwenApiKey(): string {
  const apiKey = process.env.QWEN_API_KEY || process.env.QWEN_API_KEY;
  if (!apiKey) {
    console.error('请设置环境变量 QWEN_API_KEY 或 QWEN_API_KEY');
    process.exit(1);
  }
  return apiKey;
}

async function main() {
  const apiKey = getQwenApiKey();

  // 创建 TTS 实例
  const tts = createTTS({
    provider: 'qwen',
    apiKey,
    // cosyvoice-v3-flash: 速度快、成本低（推荐）
    // 其他选项: cosyvoice-v3-plus, cosyvoice-v2, cosyvoice-v1
    model: 'cosyvoice-v3-flash',
    // 龙小淳: 知性积极女
    // 其他选项: longanhuan (欢脱元气女), longanyang (阳光大男孩), longhuhu_v3 (天真烂漫女童)
    voice: 'longxiaochun_v3',
    format: 'mp3',
  });

  console.log('开始合成语音...');

  try {
    // 使用 speak 方法合成语音
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
