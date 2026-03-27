/**
 * GLM TTS glm-tts - 非流式输入/非流式输出示例
 * 演示一次性获取完整音频的场景
 *
 * 模型特点:
 * - 智谱 AI 语音合成模型
 * - 支持 wav / pcm 格式
 * - 推荐用于一般场景
 *
 * 环境变量:
 * - GLM_API_KEY: 智谱 AI API Key
 *
 * 使用方法:
 * npx tsx examples/tts/providers/glm/glm-tts/non-stream-in-non-stream-out.ts
 */
import 'dotenv/config';
import { writeFileSync } from 'node:fs';
import { createTTS } from 'univoice';
import { ensureOutputDir, getGlmApiKey, getScriptMeta, timestamp } from '../../../../utils/common';

const { __dirname, basename } = getScriptMeta(import.meta.url);

// 固定使用 glm-tts 模型
const MODEL = 'glm-tts';

async function main() {
  const apiKey = getGlmApiKey();

  // 创建 TTS 实例
  const tts = createTTS({
    provider: 'glm',
    apiKey,
    voice: 'tongtong',
    format: 'wav',
    model: MODEL,
  });

  console.log(`\n[${timestamp()}] === GLM TTS - 非流式入/非流式出 ===`);
  console.log(`模型: ${MODEL}`);
  console.log(`场景: 字符串输入 → 完整音频输出\n`);

  const text =
    '欢迎来到龙井村。这里是西湖龙井茶的原产地，漫山遍野的茶园层层叠叠，空气中弥漫着淡淡的茶香。春天采茶季节，您还能看到茶农们忙碌的身影。';

  console.log(`输入文本: "${text}"\n`);

  try {
    const startTime = Date.now();

    // 使用 synthesize 方法一次性获取完整音频
    const response = await tts.synthesize({ text });

    const endTime = Date.now();

    console.log(`[${timestamp()}] 合成完成`);
    console.log(`耗时: ${endTime - startTime} ms`);
    console.log(`音频大小: ${response.audio.length} bytes`);

    // 保存音频文件
    const outputPath = ensureOutputDir(__dirname, basename, 'wav');
    writeFileSync(outputPath, response.audio);
    console.log(`\n音频已保存至: ${outputPath}`);
    console.log(`\n播放命令: ffplay -autoexit ${outputPath}`);
  } catch (error) {
    console.error('语音合成失败:', error);
    process.exit(1);
  }
}

main();
