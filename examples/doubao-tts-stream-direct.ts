/**
 * Doubao TTS 流式输出示例 - 直接保存流
 * 演示如何直接将流保存到文件，适合简单快速保存的场景
 */
import 'dotenv/config';
import { createTTS, saveAudio } from 'univoice';
import { ensureOutputDir, getScriptMeta, getTTSConfig, printPlayTip } from './utils/common';

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

  const text =
    '欢迎来到龙井村。这里是西湖龙井茶的原产地，漫山遍野的茶园层层叠叠，空气中弥漫着淡淡的茶香。春天采茶季节，您还能看到茶农们忙碌的身影。';

  if (!tts.speak) {
    console.error('当前 TTS 提供商不支持流式输出');
    process.exit(1);
  }

  // 直接将流保存到文件
  const outputFile = ensureOutputDir(__dirname, basename);
  await saveAudio(outputFile, tts.speak(text));
  console.log(`音频已保存至: ${outputFile}`);

  printPlayTip(outputFile);
}

main();
