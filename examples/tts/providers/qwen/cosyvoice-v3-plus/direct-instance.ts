/**
 * CosyVoice v3-plus - 直接实例化示例
 * 演示不使用工厂函数 createTTS，直接 new QwenTTS() 创建实例
 *
 * 特点:
 * - 直接导入 QwenTTS 类并实例化，无需注册 provider
 * - 使用流式文本输入（模拟 LLM 边生成文本边输入 TTS 的场景）
 * - 使用 speak 方法进行流式语音合成，边合成边接收音频块
 * - v3-plus 仅支持 longanyang、longanhuan 两种音色
 *
 * 环境变量:
 * - QWEN_API_KEY: 阿里云 DashScope API Key
 *
 * 使用方法:
 * npx tsx examples/tts/providers/qwen/cosyvoice-v3-plus/direct-instance.ts
 */
import 'dotenv/config';
import { writeFileSync } from 'node:fs';
import { QwenTTS } from 'univoice/tts/providers';
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

  // 直接实例化 QwenTTS，不使用 createTTS 工厂函数
  // v3-plus 仅支持 longanyang、longanhuan 两种音色
  const tts = new QwenTTS({
    apiKey,
    model: MODEL,
    voice: 'longanyang',
    format: 'mp3',
  });

  console.log(`\n[${timestamp()}] === CosyVoice v3-plus - 直接实例化 ===`);
  console.log(`模型: ${MODEL}`);
  console.log(`场景: 直接 new QwenTTS() → 流式文本输入 + 流式语音合成\n`);

  // 使用 mockLLMStream 模拟 LLM 流式输出，每隔 150ms 发送一个文本块
  const textStream = mockLLMStream(DEFAULT_TTS_TEXT, { delay: 150 });

  const chunks: Uint8Array[] = [];
  const startTime = Date.now();
  let firstChunkTime = 0;
  let chunkCount = 0;

  // 使用 speak 直接传入流式文本，通过 for await...of 消费流式音频
  // 用法与工厂函数创建的实例完全一致
  for await (const { audioChunk } of tts.speak(textStream, { stream: true })) {
    chunkCount++;
    if (chunkCount === 1) {
      firstChunkTime = Date.now();
      console.log(`[${timestamp()}] [首字延迟] ${firstChunkTime - startTime} ms\n`);
    }
    console.log(`[${timestamp()}] 收到音频块 #${chunkCount}: ${audioChunk.length} bytes`);
    chunks.push(audioChunk);
  }

  const endTime = Date.now();
  const totalSize = chunks.reduce((sum, c) => sum + c.length, 0);

  console.log(`\n[${timestamp()}] === 统计信息 ===`);
  console.log(`总耗时: ${endTime - startTime} ms`);
  console.log(`首字延迟: ${firstChunkTime - startTime} ms`);
  console.log(`音频块数: ${chunkCount}`);
  console.log(`音频大小: ${totalSize} bytes`);

  // 保存音频文件
  const outputPath = ensureOutputDir(__dirname, basename, 'mp3');
  const buffer = Buffer.concat(chunks.map((c) => Buffer.from(c)));
  writeFileSync(outputPath, buffer);
  console.log(`\n音频已保存至: ${outputPath}`);
  console.log(`\n播放命令: ffplay -autoexit ${outputPath}`);
}

main();
