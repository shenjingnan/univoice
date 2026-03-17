/**
 * GLM TTS 流式输出示例
 * 演示如何使用 univoice SDK 流式接收 GLM TTS 音频
 *
 * 环境变量:
 * - GLM_API_KEY: 智谱 AI API Key
 */
import 'dotenv/config';
import { createTTS, saveAudio } from 'univoice';
import { ensureOutputDir, getScriptMeta } from './utils/common';

const { __dirname, basename } = getScriptMeta(import.meta.url);

/**
 * 获取 GLM API Key
 */
function getGlmApiKey(): string {
  const apiKey = process.env.GLM_API_KEY;
  if (!apiKey) {
    console.error('请设置环境变量 GLM_API_KEY');
    process.exit(1);
  }
  return apiKey;
}

async function main() {
  const apiKey = getGlmApiKey();

  const tts = createTTS({
    provider: 'glm',
    apiKey,
    model: 'glm-tts',
    voice: 'tongtong',
    format: 'wav',
  });

  const text =
    '欢迎来到杭州！我是您的智能导游。杭州，这座有着2200多年历史的古城，曾是南宋都城，如今是现代与古典完美交融的东方名城。让我们一起开启这段美妙的杭州之旅吧！';

  console.log('开始流式合成语音...');

  // 使用 { stream: true } 开启流式模式
  const stream = tts.speak(text, { stream: true });

  // 收集并统计音频块
  const chunks: Uint8Array[] = [];
  let chunkCount = 0;

  for await (const chunk of stream) {
    chunkCount++;
    chunks.push(chunk.audioChunk);
    console.log(`收到音频块 #${chunkCount}: ${chunk.audioChunk.length} bytes`);
  }

  console.log(`\n流式合成完成！`);
  console.log(`总音频块数: ${chunkCount}`);
  console.log(`总音频大小: ${chunks.reduce((sum, c) => sum + c.length, 0)} bytes`);

  // 保存音频文件
  const outputFile = ensureOutputDir(__dirname, basename, 'wav');
  await saveAudio(outputFile, chunks);
  console.log(`音频已保存至: ${outputFile}`);
}

main();
