/**
 * LLM 流式输出转 TTS 语音示例
 * 演示如何将 LLM（如 OpenAI）的流式输出直接转换为语音，实现实时语音合成
 */
import 'dotenv/config';
import { writeFileSync } from 'node:fs';
import OpenAI from 'openai';
import { createTTS } from '@/index';
import {
  ensureOutputDir,
  getScriptMeta,
  getTTSConfig,
  printPlayTip,
  printStats,
  timestamp,
} from '../../utils/common';

const { __dirname, basename } = getScriptMeta(import.meta.url);

async function main() {
  // 1. 初始化 OpenAI 客户端
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_BASE_URL,
  });

  // 2. 初始化 TTS (使用 doubao)
  const { appId, accessToken, voice } = getTTSConfig();

  const tts = createTTS({
    provider: 'doubao',
    appId,
    accessToken,
    voice,
    format: 'pcm',
    resourceId: 'seed-tts-2.0',
    sampleRate: 24000,
  });

  if (!tts.speak) {
    console.error('当前 TTS 提供商不支持流式输入模式');
    process.exit(1);
  }

  console.log('=== OpenAI Stream -> TTS 示例 ===\n');

  // 3. 创建 OpenAI 流式请求
  console.log('创建 OpenAI 流式请求...');
  const openaiStream = await openai.chat.completions.stream({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'user',
        content: '请用一句话介绍美丽杭州',
      },
    ],
    stream: true,
  });

  console.log('开始将 OpenAI 流转换为语音...\n');

  // 4. 直接将 OpenAI stream 传入 TTS speak
  // 注意：这里直接传入 openaiStream，无需手动转换
  const chunks: Uint8Array[] = [];
  const startTime = Date.now();
  let firstChunkTime = 0;
  let chunkCount = 0;

  try {
    for await (const { audioChunk } of tts.speak(openaiStream, { stream: true })) {
      chunkCount++;
      if (chunkCount === 1) {
        firstChunkTime = Date.now();
        console.log(`\n[${timestamp()}] [首字延迟] ${firstChunkTime - startTime} ms\n`);
      }
      chunks.push(audioChunk);
    }
  } catch (error) {
    console.error(`[${timestamp()}] [错误] ${(error as Error).message}`);
  }

  printStats(startTime, chunkCount, chunks);

  // 保存音频
  const outputPath = ensureOutputDir(__dirname, basename);
  const buffer = Buffer.concat(chunks.map((c) => Buffer.from(c)));
  writeFileSync(outputPath, buffer);
  console.log(`\n音频已保存至: ${outputPath}`);

  printPlayTip(outputPath);
}

main().catch(console.error);
