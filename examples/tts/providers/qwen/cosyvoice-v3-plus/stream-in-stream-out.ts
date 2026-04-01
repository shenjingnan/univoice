/**
 * CosyVoice v3 Plus - 流式输入/流式输出示例
 * 演示 LLM 流式输出转语音的场景
 *
 * 模型特点:
 * - 高质量版本
 * - 适用于高质量音频制作
 * - 音质更佳，成本略高
 *
 * 环境变量:
 * - QWEN_API_KEY: 阿里云 DashScope API Key
 *
 * 使用方法:
 * npx tsx examples/tts/providers/qwen/cosyvoice-v3-plus/stream-in-stream-out.ts
 */
import 'dotenv/config';
import { writeFileSync } from 'node:fs';
import { createTTS } from 'univoice';
import {
  DEFAULT_TTS_TEXT,
  ensureOutputDir,
  getQwenApiKey,
  getScriptMeta,
  mockLLMStream,
  timestamp,
} from '../../../../utils/common';

const { __dirname, basename } = getScriptMeta(import.meta.url);

// 固定使用 cosyvoice-v3-plus 模型
const MODEL = 'cosyvoice-v3-plus';

async function main() {
  const apiKey = getQwenApiKey();

  // 创建 TTS 实例
  const tts = createTTS({
    provider: 'qwen',
    apiKey,
    model: MODEL,
    voice: 'longxiaochun_v3',
    format: 'mp3',
  });

  console.log(`\n[${timestamp()}] === CosyVoice v3 Plus - 流式入/流式出 ===`);
  console.log(`模型: ${MODEL}`);
  console.log(`场景: LLM 流式输出 → 实时语音合成\n`);

  // 模拟 LLM 流式输出
  const textStream = mockLLMStream(DEFAULT_TTS_TEXT, { delay: 150 }); // 每隔 150ms 发送一个文本块

  const startTime = Date.now();
  const audioChunks: Uint8Array[] = [];
  let firstChunkTime = 0;
  let audioChunkCount = 0;

  // 边发边收：流式输入 + 流式输出
  for await (const { audioChunk } of tts.speak(textStream, { stream: true })) {
    audioChunkCount++;
    if (audioChunkCount === 1) {
      firstChunkTime = Date.now();
      console.log(`\n[${timestamp()}] [首字延迟] ${firstChunkTime - startTime} ms\n`);
    }
    console.log(`[${timestamp()}] 收到音频块 #${audioChunkCount}: ${audioChunk.length} bytes`);
    audioChunks.push(audioChunk);
  }

  const endTime = Date.now();
  const totalSize = audioChunks.reduce((sum, chunk) => sum + chunk.length, 0);

  console.log(`\n[${timestamp()}] === 统计信息 ===`);
  console.log(`总耗时: ${endTime - startTime} ms`);
  console.log(`首字延迟: ${firstChunkTime - startTime} ms`);
  console.log(`音频块数: ${audioChunkCount}`);
  console.log(`音频大小: ${totalSize} bytes`);

  // 保存音频文件
  const outputPath = ensureOutputDir(__dirname, basename, 'mp3');
  const buffer = Buffer.concat(audioChunks.map((c) => Buffer.from(c)));
  writeFileSync(outputPath, buffer);
  console.log(`\n音频已保存至: ${outputPath}`);
  console.log(`\n播放命令: ffplay -autoexit ${outputPath}`);
}

main();
