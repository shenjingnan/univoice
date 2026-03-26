/**
 * Doubao TTS PCM 输出示例
 * 演示如何使用 PCM 格式输出音频
 */
import 'dotenv/config';
import { writeFileSync } from 'node:fs';
import { createTTS } from 'univoice';
import { ensureOutputDir, getScriptMeta, getTTSConfig, printPlayTip } from '../../../utils/common';

const { __dirname, basename } = getScriptMeta(import.meta.url);

async function main() {
  const { appId, accessToken, voice } = getTTSConfig();

  // 创建 TTS 实例，指定 PCM 格式输出
  const tts = createTTS({
    provider: 'doubao',
    appId,
    accessToken,
    voice,
    format: 'pcm',
    resourceId: 'seed-tts-2.0',
    sampleRate: 24000,
  });

  console.log('开始合成 PCM 格式语音...');

  try {
    const response = await tts.synthesize({
      text: '欢迎来到杭州！我是您的智能导游。',
    });

    const outputFile = ensureOutputDir(__dirname, basename, 'pcm');
    writeFileSync(outputFile, response.audio);
    console.log(`音频已保存至: ${outputFile}`);
    console.log(`音频大小: ${response.audio.length} bytes`);

    printPlayTip(outputFile);
  } catch (error) {
    console.error('语音合成失败:', error);
    process.exit(1);
  }
}

main();
