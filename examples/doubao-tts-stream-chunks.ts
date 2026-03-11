/**
 * Doubao TTS 流式输出示例 - 分块保存
 * 演示如何将流式输出的每个 chunk 单独保存为 PCM 文件
 */
import 'dotenv/config';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createTTS } from 'univoice';
import { getScriptMeta, getTTSConfig } from './utils/common';

const { __dirname, basename } = getScriptMeta(import.meta.url);

async function main() {
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

  const text =
    '欢迎来到龙井村。这里是西湖龙井茶的原产地，漫山遍野的茶园层层叠叠，空气中弥漫着淡淡的茶香。春天采茶季节，您还能看到茶农们忙碌的身影。';

  if (!tts.speak) {
    console.error('当前 TTS 提供商不支持流式输出');
    process.exit(1);
  }

  // 准备输出目录
  const outputDir = path.join(__dirname, 'output', basename);
  await fs.mkdir(outputDir, { recursive: true });

  console.log('开始流式合成并分块保存...\n');

  // 流式获取并保存每个 chunk
  let index = 1;
  for await (const { audioChunk } of tts.speak(text)) {
    const filePath = path.join(outputDir, `${index}.pcm`);
    await fs.writeFile(filePath, audioChunk);
    console.log(`已保存: ${filePath} (${audioChunk.length} bytes)`);
    index++;
  }

  console.log(`\n完成！共保存 ${index - 1} 个音频文件`);
  console.log(`输出目录: ${outputDir}`);

  console.log('\n=== 播放提示 ===');
  console.log('PCM 格式播放命令 (24000 Hz, 16-bit, mono):');
  console.log(`ffplay -f s16le -ar 24000 ${outputDir}/1.pcm`);
}

main();
