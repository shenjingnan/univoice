/**
 * 讯飞超拟人 TTS - 流式输入/流式输出示例
 * 演示实时语音合成场景，使用 WebSocket 双向流式协议
 *
 * 特点:
 * - 基于讯飞超拟人语音合成 WebSocket 协议
 * - 支持 mp3 / pcm / wav 等多种格式
 * - 真正的边发边收：流式文本输入，流式音频输出
 * - 适用于 LLM 流式输出转语音等场景
 *
 * 环境变量:
 * - XFYUN_APP_ID: 讯飞应用 ID
 * - XFYUN_API_KEY: 讯飞 API Key
 * - XFYUN_API_SECRET: 讯飞 API Secret
 *
 * 使用方法:
 * npx tsx examples/tts/providers/xfyun/super-human/stream-in-stream-out.ts
 */
import 'dotenv/config';
import { writeFileSync } from 'node:fs';
import { createTTS } from 'univoice';
import {
  DEFAULT_TTS_TEXT,
  ensureOutputDir,
  getScriptMeta,
  getXfyunTTSConfig,
  mockLLMStream,
  printStats,
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

  if (!tts.speak) {
    console.error('当前 TTS 提供商不支持流式输入模式');
    process.exit(1);
  }

  console.log(`\n[${timestamp()}] === 讯飞超拟人 TTS - 流式入/流式出 ===`);
  console.log(`发音人: x5_lingyuzhao_flow`);
  console.log(`格式: mp3`);
  console.log(`场景: 实时语音合成（模拟 LLM 流式输出）\n`);

  const chunks: Uint8Array[] = [];
  const startTime = Date.now();
  let firstChunkTime = 0;
  let chunkCount = 0;

  // 使用 mockLLMStream 模拟 LLM 流式输出，通过 speak 消费流式音频
  const textStream = mockLLMStream(DEFAULT_TTS_TEXT, { delay: 150 });
  for await (const { audioChunk } of tts.speak(textStream, { stream: true })) {
    chunkCount++;
    if (chunkCount === 1) {
      firstChunkTime = Date.now();
      console.log(`[${timestamp()}] [首字延迟] ${firstChunkTime - startTime} ms\n`);
    }
    console.log(`[${timestamp()}] 收到音频块 #${chunkCount}: ${audioChunk.length} bytes`);
    chunks.push(audioChunk);
  }

  printStats(startTime, chunkCount, chunks);

  // 保存音频
  const outputPath = ensureOutputDir(__dirname, basename, 'mp3');
  const buffer = Buffer.concat(chunks.map((c) => Buffer.from(c)));
  writeFileSync(outputPath, buffer);
  console.log(`\n音频已保存至: ${outputPath}`);
  console.log(`\n播放命令: ffplay -autoexit ${outputPath}`);
}

main();
