/**
 * Qwen TTS 流式输入示例
 * 演示流式输入 + 流式输出场景（LLM 流式输出转语音）
 *
 * 场景说明:
 * - 模拟 LLM 流式输出文本，边发边收
 * - 适用于需要实时将 LLM 输出转为语音的场景
 *
 * 支持的模型:
 * - cosyvoice-v3-flash (默认，速度快、成本低)
 * - cosyvoice-v3-plus (高质量版本)
 * - cosyvoice-v2
 * - cosyvoice-v1
 *
 * 环境变量:
 * - QWEN_API_KEY: 阿里云 DashScope API Key
 *
 * 使用方法:
 * - 运行默认模型: npx tsx examples/tts/providers/qwen/stream-input.ts
 * - 指定模型: npx tsx examples/tts/providers/qwen/stream-input.ts cosyvoice-v3-plus
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
} from '../../../utils/common';

const { __dirname, basename } = getScriptMeta(import.meta.url);

// 支持的模型列表
const SUPPORTED_MODELS = [
  { name: 'cosyvoice-v3-flash', desc: '速度快、成本低（推荐）' },
  { name: 'cosyvoice-v3-plus', desc: '高质量版本' },
  { name: 'cosyvoice-v2', desc: 'V2 版本' },
  { name: 'cosyvoice-v1', desc: 'V1 版本' },
] as const;

type QwenModel = (typeof SUPPORTED_MODELS)[number]['name'];

function parseArgs(): { model: QwenModel } {
  const modelName = process.argv[2] as QwenModel;
  if (modelName && !SUPPORTED_MODELS.some((m) => m.name === modelName)) {
    console.error(`错误: 不支持的模型 "${modelName}"`);
    console.error('支持的模型:', SUPPORTED_MODELS.map((m) => m.name).join(', '));
    process.exit(1);
  }

  return { model: modelName || 'cosyvoice-v3-flash' };
}

async function main() {
  const { model } = parseArgs();
  const apiKey = getQwenApiKey();

  // 创建 TTS 实例
  const tts = createTTS({
    provider: 'qwen',
    apiKey,
    model,
    voice: 'longxiaochun_v3',
    format: 'mp3',
  });

  console.log(`\n[${timestamp()}] === Qwen TTS 流式输入示例 ===`);
  console.log(`模型: ${model}`);
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
