/**
 * Doubao TTS 流式输出示例
 * 演示如何使用 speak() 方法流式获取音频数据，并使用 saveToFile() 保存
 */
import 'dotenv/config';
import { createTTS } from 'univoice';
import { saveToFile } from 'univoice/tts';

async function main() {
  // 从环境变量获取配置
  const appId = process.env.TTS_BYTEDANCE_APPID;
  const accessToken = process.env.TTS_BYTEDANCE_TOKEN;
  const voice = process.env.TTS_BYTEDANCE_VOICE_TYPE || 'zh_female_tianmeixiaoyuan_moon_bigtts';

  if (!appId || !accessToken) {
    console.error('请设置环境变量 TTS_BYTEDANCE_APPID 和 TTS_BYTEDANCE_TOKEN');
    process.exit(1);
  }

  // 创建 TTS 实例
  const tts = createTTS({
    provider: 'doubao',
    appId,
    accessToken,
    voice,
    format: 'pcm',
    resourceId: 'seed-tts-2.0',
    sampleRate: 24000,
  });

  const text = '来杭州吧，在西湖边撑一把油纸伞，品一口龙井茶，让江南烟雨洗去你所有的疲惫。';

  // 检查是否支持流式输出
  if (!tts.speak) {
    console.error('当前 TTS 提供商不支持流式输出');
    process.exit(1);
  }

  console.log('=== 方式 1: 收集 chunks 后保存 ===');
  try {
    const chunks: Uint8Array[] = [];
    let totalSize = 0;

    // 流式获取音频块
    for await (const chunk of tts.speak({ text })) {
      chunks.push(chunk);
      totalSize += chunk.length;
      console.log(`收到音频块: ${chunk.length} bytes, 累计: ${totalSize} bytes`);
    }

    // 保存到文件
    await saveToFile('output-chunks.pcm', chunks);
    console.log('音频已保存至: output-chunks.pcm');
    console.log(`总大小: ${totalSize} bytes`);
  } catch (error) {
    console.error('方式 1 失败:', error);
  }

  console.log('\n=== 方式 2: 直接保存流 ===');
  try {
    // 直接将流保存到文件
    await saveToFile('output-stream.pcm', tts.speak({ text }));
    console.log('音频已保存至: output-stream.pcm');
  } catch (error) {
    console.error('方式 2 失败:', error);
  }

  console.log('\n=== 播放提示 ===');
  console.log('PCM 格式播放命令 (24000 Hz, 16-bit, mono):');
  console.log('ffplay -f s16le -ar 24000 output-chunks.pcm');
}

main();
