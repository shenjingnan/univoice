/**
 * Minimax TTS speech-02-hd - 非流式输入/非流式输出示例
 * 演示一次性获取完整音频的场景
 *
 * 模型特点:
 * - 旧版模型，兼容旧版 API
 * - 高音质版本
 *
 * 环境变量:
 * - MINIMAX_API_KEY: Minimax API Key
 *
 * 使用方法:
 * npx tsx examples/tts/providers/minimax/speech-02/non-stream-in-non-stream-out.ts
 */
import 'dotenv/config';
import { writeFileSync } from 'node:fs';
import { createTTS } from 'univoice';
import {
  ensureOutputDir,
  getMinimaxApiKey,
  getScriptMeta,
  timestamp,
} from '../../../../utils/common';

const { __dirname, basename } = getScriptMeta(import.meta.url);

// 固定使用 speech-02-hd 模型
const MODEL = 'speech-02-hd';

async function main() {
  const apiKey = getMinimaxApiKey();

  // 创建 TTS 实例
  const tts = createTTS({
    provider: 'minimax',
    apiKey,
    voice: 'male-qn-qingse',
    format: 'mp3',
    model: MODEL,
    speed: 1,
    volume: 1,
  });

  console.log(`\n[${timestamp()}] === Speech 02 HD - 非流式入/非流式出 ===`);
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
    const outputPath = ensureOutputDir(__dirname, basename, 'mp3');
    writeFileSync(outputPath, response.audio);
    console.log(`\n音频已保存至: ${outputPath}`);
    console.log(`\n播放命令: ffplay -autoexit ${outputPath}`);
  } catch (error) {
    console.error('语音合成失败:', error);
    process.exit(1);
  }
}

main();
