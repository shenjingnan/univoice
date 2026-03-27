/**
 * Doubao TTS seed-tts-1.0 - 非流式输入/非流式输出示例
 * 演示一次性获取完整音频的场景
 *
 * 模型特点:
 * - V1 版本
 * - 兼容旧版 API
 * - 适用于需要向后兼容的场景
 *
 * 环境变量:
 * - DOUBAO_APP_ID: 火山引擎应用 ID
 * - DOUBAO_ACCESS_TOKEN: 火山引擎访问令牌
 *
 * 使用方法:
 * npx tsx examples/tts/providers/doubao/seed-tts-1.0/non-stream-in-non-stream-out.ts
 */
import 'dotenv/config';
import { writeFileSync } from 'node:fs';
import { createTTS } from 'univoice';
import { ensureOutputDir, getScriptMeta, getTTSConfig, timestamp } from '../../../../utils/common';

const { __dirname, basename } = getScriptMeta(import.meta.url);

// 固定使用 seed-tts-1.0 模型
const RESOURCE_ID = 'seed-tts-1.0';

async function main() {
  const { appId, accessToken } = getTTSConfig();

  // 创建 TTS 实例
  const tts = createTTS({
    provider: 'doubao',
    appId,
    accessToken,
    voice: 'zh_male_lengkugege_emo_v2_mars_bigtts',
    format: 'mp3',
    resourceId: RESOURCE_ID,
    sampleRate: 24000,
  });

  console.log(`\n[${timestamp()}] === Seed TTS 1.0 - 非流式入/非流式出 ===`);
  console.log(`模型: ${RESOURCE_ID}`);
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
