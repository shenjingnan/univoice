/**
 * Doubao TTS 使用示例
 * 演示如何使用 univoice SDK 调用火山引擎 TTS 服务
 */
import 'dotenv/config';
import { writeFileSync } from 'node:fs';
import { createTTS } from '../dist/src/tts';

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
    sampleRate: 24000,
  });

  console.log('开始合成语音...');

  try {
    // 合成语音
    const response = await tts.synthesize({
      text: '你好，欢迎使用 univoice SDK。这是一个统一的语音合成和语音识别 SDK。',
    });

    // 保存音频文件
    const outputFile = `output.${response.format}`;
    writeFileSync(outputFile, response.audio);
    console.log(`音频已保存至: ${outputFile}`);
    console.log(`音频大小: ${response.audio.length} bytes`);
  } catch (error) {
    console.error('语音合成失败:', error);
    process.exit(1);
  }
}

main();
