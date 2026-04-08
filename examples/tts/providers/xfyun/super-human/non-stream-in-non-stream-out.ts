/**
 * 讯飞超拟人 TTS - 非流式输入/非流式输出示例
 * 演示一次性获取完整音频的场景
 *
 * 特点:
 * - 基于讯飞超拟人语音合成 WebSocket 协议
 * - 支持 mp3 / pcm / wav 等多种格式
 * - 一次性发送完整文本，等待所有音频返回
 *
 * 环境变量:
 * - XFYUN_APP_ID: 讯飞应用 ID
 * - XFYUN_API_KEY: 讯飞 API Key
 * - XFYUN_API_SECRET: 讯飞 API Secret
 *
 * 使用方法:
 * npx tsx examples/tts/providers/xfyun/super-human/non-stream-in-non-stream-out.ts
 */
import 'dotenv/config';
import { writeFileSync } from 'node:fs';
import { createTTS } from 'univoice';
import {
  ensureOutputDir,
  getScriptMeta,
  getXfyunTTSConfig,
  timestamp,
} from '../../../../utils/common';

const { __dirname, basename } = getScriptMeta(import.meta.url);

async function main() {
  const { appId, apiKey, apiSecret } = getXfyunTTSConfig();

  // 创建 TTS 实例
  const tts = createTTS({
    provider: 'xfyun',
    appId,
    apiKey,
    apiSecret,
    voice: 'x5_lingyuzhao_flow',
    format: 'mp3',
    sampleRate: 24000,
  });

  console.log(`\n[${timestamp()}] === 讯飞超拟人 TTS - 非流式入/非流式出 ===`);
  console.log(`发音人: x5_lingyuzhao_flow`);
  console.log(`格式: mp3`);
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
