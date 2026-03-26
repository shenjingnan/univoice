/**
 * GLM TTS 基础示例
 * 演示如何使用 univoice SDK 调用智谱 AI GLM TTS 服务
 *
 * 环境变量:
 * - GLM_API_KEY: 智谱 AI API Key
 */
import 'dotenv/config';
import { writeFileSync } from 'node:fs';
import { createTTS } from 'univoice';
import { ensureOutputDir, getGlmApiKey, getScriptMeta } from '../../../utils/common';

const { __dirname, basename } = getScriptMeta(import.meta.url);

async function main() {
  const apiKey = getGlmApiKey();

  // 创建 TTS 实例
  const tts = createTTS({
    provider: 'glm',
    apiKey,
    // 模型：glm-tts
    model: 'glm-tts',
    // 音色：童童（默认）
    // 其他选项: xiaochen (小晨), chuichui (吹吹), jam, kazi (卡子), douji (豆汁), luodo (螺蛳), female (女声), male (男声)
    voice: 'tongtong',
    // 音频格式：wav / pcm
    format: 'wav',
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
