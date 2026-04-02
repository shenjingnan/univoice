/**
 * Qwen3 TTS Flash Realtime - 直接实例化示例
 * 演示不使用工厂函数 createTTS，直接 new QwenRealtimeTTS() 创建实例
 *
 * 特点:
 * - 直接导入 QwenRealtimeTTS 类并实例化，无需注册 provider
 * - 使用流式文本输入（模拟 LLM 边生成文本边输入 TTS 的场景）
 * - 使用 speak 方法进行流式语音合成，边合成边接收音频块
 *
 * 环境变量:
 * - QWEN_API_KEY: 阿里云 DashScope API Key
 *
 * 使用方法:
 * npx tsx examples/tts/providers/qwen/qwen3-tts-flash-realtime/direct-instance.ts
 */
import 'dotenv/config';
import { writeFileSync } from 'node:fs';
import { QwenRealtimeTTS } from 'univoice/tts/providers';
import {
  DEFAULT_TTS_TEXT,
  ensureOutputDir,
  getQwenApiKey,
  getScriptMeta,
  mockLLMStream,
  timestamp,
} from '../../../../utils/common';

const { __dirname, basename } = getScriptMeta(import.meta.url);

// 固定使用 qwen3-tts-flash-realtime 模型
const MODEL = 'qwen3-tts-flash-realtime';

async function main() {
  const apiKey = getQwenApiKey();

  // 直接实例化 QwenRealtimeTTS，不使用 createTTS 工厂函数
  const tts = new QwenRealtimeTTS({
    apiKey,
    model: MODEL,
    voice: 'Cherry',
    format: 'pcm',
  });

  console.log(`\n[${timestamp()}] === Qwen3 TTS Flash Realtime - 直接实例化 ===`);
  console.log(`模型: ${MODEL}`);
  console.log(`场景: 直接 new QwenRealtimeTTS() → 流式文本输入 + 流式语音合成\n`);

  // 使用 mockLLMStream 模拟 LLM 流式输出，每隔 150ms 发送一个文本块
  const textStream = mockLLMStream(DEFAULT_TTS_TEXT, { delay: 150 });

  const startTime = Date.now();
  const audioChunks: Uint8Array[] = [];
  let firstChunkTime = 0;
  let audioChunkCount = 0;

  // 使用 speak 直接传入流式文本，通过 for await...of 消费流式音频
  // 用法与工厂函数创建的实例完全一致
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
  const outputPath = ensureOutputDir(__dirname, basename, 'pcm');
  const buffer = Buffer.concat(audioChunks.map((c) => Buffer.from(c)));
  writeFileSync(outputPath, buffer);
  console.log(`\n音频已保存至: ${outputPath}`);
  console.log(`\n播放命令: ffplay -autoexit -f s16le -ar 24000 ${outputPath}`);
}

main();
