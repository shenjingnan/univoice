/**
 * Doubao TTS 流式输出示例 - 直接保存流
 * 演示如何直接将流保存到文件，适合简单快速保存的场景
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
    '欢迎来到龙井村。这里是西湖龙井茶的原产地，漫山遍野的茶园层层叠叠，空气中弥漫着淡淡的茶香。春天采茶季节，您还能看到茶农们忙碌的身影。';

  if (!tts.speak) {
    console.error('当前 TTS 提供商不支持流式输出');
    process.exit(1);
  }

  // 直接将流保存到文件
  await saveAudio(`${basename}.pcm`, tts.speak(text));
  console.log(`音频已保存至: ${basename}.pcm`);

  console.log('\n=== 播放提示 ===');
  console.log('PCM 格式播放命令 (24000 Hz, 16-bit, mono):');
  console.log(`ffplay -f s16le -ar 24000 ${basename}.pcm`);
}

main();
