/**
 * Doubao TTS 流式输入示例
 * 演示如何使用 streamFrom() 方法实现流式文本输入，适用于 LLM 流式输出转语音等场景
 *
 * 流式输入模式对比:
 * - stream(text): 完整文本输入 - 适用于已知完整文本的场景
 * - streamFrom(textStream): 流式文本输入 - 适用于文本逐步生成的场景（如 LLM 输出）
 */
import 'dotenv/config';
import * as fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createTTS } from 'univoice';

const __filename = fileURLToPath(import.meta.url);
const basename = path.basename(__filename, path.extname(__filename));

/**
 * 模拟 LLM 流式输出的文本生成器
 * 在实际应用中，这里可以替换为真实的 LLM API 调用
 */
async function* generateText(): AsyncGenerator<string> {
  const segments = [
    '欢迎来到',
    '龙井村。',
    '这里是西湖龙井茶的',
    '原产地，',
    '漫山遍野的茶园',
    '层层叠叠，',
    '空气中弥漫着',
    '淡淡的茶香。',
  ];

  for (const segment of segments) {
    // 模拟 LLM 输出延迟
    await new Promise((resolve) => setTimeout(resolve, 100));
    console.log(`[LLM 输出] "${segment}"`);
    yield segment;
  }
}

async function main() {
  const appId = process.env.TTS_BYTEDANCE_APPID;
  const accessToken = process.env.TTS_BYTEDANCE_TOKEN;
  const voice = process.env.TTS_BYTEDANCE_VOICE_TYPE || 'zh_female_tianmeixiaoyuan_moon_bigtts';

  if (!appId || !accessToken) {
    console.error('请设置环境变量 TTS_BYTEDANCE_APPID 和 TTS_BYTEDANCE_TOKEN');
    process.exit(1);
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

  if (!tts.streamFrom) {
    console.error('当前 TTS 提供商不支持流式输入模式');
    process.exit(1);
  }

  console.log('=== 流式输入模式演示 ===\n');
  console.log('模拟 LLM 流式输出转语音场景\n');

  const chunks: Uint8Array[] = [];
  const startTime = Date.now();
  let firstChunkTime = 0;
  let chunkCount = 0;

  await tts.streamFrom(generateText(), {
    onAudioChunk: (chunk) => {
      chunkCount++;
      if (chunkCount === 1) {
        firstChunkTime = Date.now();
        console.log(`\n[首字延迟] ${firstChunkTime - startTime} ms\n`);
      }
      console.log(`[音频块 #${chunkCount}] ${chunk.length} bytes`);
      chunks.push(chunk);
    },
    onEvent: (event) => {
      console.log(`[事件] ${event}`);
    },
    onError: (error) => {
      console.error(`[错误] ${error.message}`);
    },
  });

  const totalTime = Date.now() - startTime;
  console.log('\n=== 统计信息 ===');
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

main();
