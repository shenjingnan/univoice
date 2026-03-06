/**
 * OpenAI stream 直接传入 TTS speak 的示例
 * 演示如何将 OpenAI SDK 的流式输出直接转换为语音
 */
import 'dotenv/config';
import * as fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import OpenAI from 'openai';
import { createTTS } from '@/index';

const __filename = fileURLToPath(import.meta.url);
const basename = path.basename(__filename, path.extname(__filename));

/**
 * 格式化时间戳
 */
function timestamp(): string {
  const now = new Date();
  const ms = String(now.getMilliseconds()).padStart(3, '0');
  const time = now.toTimeString().split(' ')[0];
  return `${time}.${ms}`;
}

async function main() {
  // 1. 初始化 OpenAI 客户端
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_BASE_URL,
  });

  // 2. 初始化 TTS (使用 doubao)
  const appId = process.env.TTS_BYTEDANCE_APPID;
  const accessToken = process.env.TTS_BYTEDANCE_TOKEN;
  const voice = process.env.TTS_BYTEDANCE_VOICE_TYPE || 'zh_female_tianmeixiaoyuan_moon_bigtts';

  if (!appId || !accessToken) {
    throw new Error('请设置 TTS_BYTEDANCE_APPID 和 TTS_BYTEDANCE_TOKEN 环境变量');
  }

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
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    messages: [
      {
        role: 'user',
        content: '请用一句话介绍 TypeScript',
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
    for await (const { audioChunk } of tts.speak(openaiStream)) {
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

  const totalTime = Date.now() - startTime;
  console.log(`\n[${timestamp()}] === 统计信息 ===`);
  console.log(`总耗时: ${totalTime} ms`);
  console.log(`总音频块数: ${chunkCount}`);
  console.log(`总音频大小: ${chunks.reduce((sum, c) => sum + c.length, 0)} bytes`);

  // 保存音频
  const outputPath = `${basename}.pcm`;
  const buffer = Buffer.concat(chunks.map((c) => Buffer.from(c)));
  fs.writeFileSync(outputPath, buffer);
  console.log(`\n音频已保存至: ${outputPath}`);

  console.log('\n=== 播放提示 ===');
  console.log('PCM 格式播放命令 (24000 Hz, 16-bit, mono):');
  console.log(`ffplay -f s16le -ar 24000 ${outputPath}`);
}

main().catch(console.error);
