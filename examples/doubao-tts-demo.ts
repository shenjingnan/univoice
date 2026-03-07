/**
 * Doubao TTS 使用示例
 * 演示如何使用 univoice SDK 调用火山引擎 TTS 服务
 */
import 'dotenv/config';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createTTS } from 'univoice';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const basename = path.basename(__filename, path.extname(__filename));

async function main() {
  // 从环境变量获取配置
  const appId = process.env.TTS_BYTEDANCE_APPID;
  const accessToken = process.env.TTS_BYTEDANCE_TOKEN;
  const voice = process.env.TTS_BYTEDANCE_VOICE_TYPE || 'zh_female_tianmeixiaoyuan_moon_bigtts';

  if (!appId || !accessToken) {
    console.error('请设置环境变量 TTS_BYTEDANCE_APPID 和 TTS_BYTEDANCE_TOKEN');
    process.exit(1);
  }

  // 创建 TTS 实例
  const tts = createTTS({
    provider: 'doubao',
    appId,
    accessToken,
    voice,
    format: 'mp3',
    resourceId: 'seed-tts-2.0',
    sampleRate: 24000,
  });

  console.log('开始合成语音...');

  try {
    // 合成语音
    const response = await tts.synthesize({
      text: '欢迎来到杭州！我是您的智能导游。杭州，这座有着2200多年历史的古城，曾是南宋都城，如今是现代与古典完美交融的东方名城。让我们一起开启这段美妙的杭州之旅吧！',
    });

    // 保存音频文件
    const outputDir = path.join(__dirname, 'output');
    mkdirSync(outputDir, { recursive: true });
    const outputFile = path.join(outputDir, `${basename}.${response.format}`);
    writeFileSync(outputFile, response.audio);
    console.log(`音频已保存至: ${outputFile}`);
    console.log(`音频大小: ${response.audio.length} bytes`);
  } catch (error) {
    console.error('语音合成失败:', error);
    process.exit(1);
  }
}

main();
