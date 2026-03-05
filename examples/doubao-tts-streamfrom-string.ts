/**
 * Doubao TTS streamFrom 字符串输入示例
 * 演示如何使用 streamFrom() 方法直接传入完整文本字符串
 *
 * streamFrom 支持两种输入模式:
 * - streamFrom(textStream): 流式文本输入 - 适用于 LLM 流式输出场景
 * - streamFrom(string): 字符串输入 - 适用于已知完整文本的场景
 *
 * 与 stream() 方法的区别:
 * - stream(text): 明确表示发送完整文本，内部逐字符发送
 * - streamFrom(string): 统一接口，字符串转单次 AsyncIterable
 */
import 'dotenv/config';
import * as fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createTTS } from 'univoice';

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

  console.log(`\n[${timestamp()}] === streamFrom 字符串输入模式演示 ===\n`);

  const text =
    '欢迎来到龙井村。这里是西湖龙井茶的原产地，漫山遍野的茶园层层叠叠，空气中弥漫着淡淡的茶香。春天采茶季节，您还能看到茶农们忙碌的身影。';

  console.log(`输入文本: "${text}"\n`);

  const chunks: Uint8Array[] = [];
  const startTime = Date.now();
  let firstChunkTime = 0;
  let chunkCount = 0;

  // 使用 streamFrom 直接传入字符串
  await tts.streamFrom(text, {
    onAudioChunk: (chunk) => {
      chunkCount++;
      if (chunkCount === 1) {
        firstChunkTime = Date.now();
        console.log(`[${timestamp()}] [首字延迟] ${firstChunkTime - startTime} ms\n`);
      }
      chunks.push(chunk);
    },
    onEvent: (event) => {
      console.log(`[${timestamp()}] [事件] ${event}`);
    },
    onError: (error) => {
      console.error(`[${timestamp()}] [错误] ${error.message}`);
    },
  });

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

main();
