/**
 * Doubao TTS 流式输出示例 - 收集 chunks 后保存
 * 演示如何手动收集音频块，适合需要在保存前处理数据的场景
 */
import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createTTS, saveAudio } from 'univoice';

const __filename = fileURLToPath(import.meta.url);
const basename = path.basename(__filename, path.extname(__filename));

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

  const text =
    '如果人间有天堂，那一定是清晨的西湖、雨后的龙井村、夜晚的钱塘江——杭州，一座来了就会爱上的城市。';

  if (!tts.speak) {
    console.error('当前 TTS 提供商不支持流式输出');
    process.exit(1);
  }

  const chunks: Uint8Array[] = [];
  let totalSize = 0;

  // 流式获取音频块
  for await (const chunk of tts.speak({ text })) {
    chunks.push(chunk);
    totalSize += chunk.length;
    console.log(`收到音频块: ${chunk.length} bytes, 累计: ${totalSize} bytes`);
  }

  // 保存到文件
  await saveAudio(`${basename}.pcm`, chunks);
  console.log(`音频已保存至: ${basename}.pcm`);
  console.log(`总大小: ${totalSize} bytes`);

  console.log('\n=== 播放提示 ===');
  console.log('PCM 格式播放命令 (24000 Hz, 16-bit, mono):');
  console.log(`ffplay -f s16le -ar 24000 ${basename}.pcm`);
}

main();
