/**
 * Doubao TTS speak 收集示例
 * 演示如何使用 speak() 方法收集音频块并保存
 *
 * speak 返回 AsyncIterable<TTSStreamChunk>，可手动收集或使用工具函数
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
    '如果人间有天堂，那一定是清晨的西湖、雨后的龙井村、夜晚的钱塘江——杭州，一座来了就会爱上的城市。';

  if (!tts.speak) {
    console.error('当前 TTS 提供商不支持流式输入模式');
    process.exit(1);
  }

  const chunks: Uint8Array[] = [];
  let totalSize = 0;

  // 流式获取音频块
  for await (const { audioChunk } of tts.speak(text)) {
    chunks.push(audioChunk);
    totalSize += audioChunk.length;
    console.log(`收到音频块: ${audioChunk.length} bytes, 累计: ${totalSize} bytes`);
  }

  // 保存到文件
  const outputFile = ensureOutputDir(__dirname, basename);
  await saveAudio(outputFile, chunks);
  console.log(`音频已保存至: ${outputFile}`);
  console.log(`总大小: ${totalSize} bytes`);

  printPlayTip(outputFile);
}

main();
