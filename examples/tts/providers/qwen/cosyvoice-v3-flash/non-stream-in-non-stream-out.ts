/**
 * CosyVoice v3 Flash - 非流式输入/非流式输出示例
 * 演示一次性获取完整音频的场景
 *
 * 模型特点:
 * - 速度快、成本低
 * - 适用于离线存储或批量处理
 * - 推荐作为默认选择
 *
 * 环境变量:
 * - QWEN_API_KEY: 阿里云 DashScope API Key
 *
 * 使用方法:
 * npx tsx examples/tts/providers/qwen/cosyvoice-v3-flash/non-stream-in-non-stream-out.ts
 */
import 'dotenv/config';
import { writeFileSync } from 'node:fs';
import { createTTS } from 'univoice';
import { ensureOutputDir, getQwenApiKey, getScriptMeta, timestamp } from '../../../../utils/common';

const { __dirname, basename } = getScriptMeta(import.meta.url);

// 固定使用 cosyvoice-v3-flash 模型
const MODEL = 'cosyvoice-v3-flash';

async function main() {
  const apiKey = getQwenApiKey();

  // 创建 TTS 实例
  const tts = createTTS({
    provider: 'qwen',
    apiKey,
    model: MODEL,
    voice: 'longxiaochun_v3',
    format: 'mp3',
  });

  console.log(`\n[${timestamp()}] === CosyVoice v3 Flash - 非流式入/非流式出 ===`);
  console.log(`模型: ${MODEL}`);
  console.log(`场景: 字符串输入 → 完整音频输出\n`);

  const text = '欢迎来到杭州！我是您的智能导游。';

  console.log(`输入文本: "${text}"\n`);

  try {
    const startTime = Date.now();

    // 使用 synthesize 方法一次性获取完整音频
    const response = await tts.synthesize({ text });

    const endTime = Date.now();

    console.log(`[${timestamp()}] 合成完成`);
    console.log(`耗时: ${endTime - startTime} ms`);
    console.log(`音频大小: ${response.audio.length} bytes`);

    // 保存音频文件
    const outputPath = ensureOutputDir(__dirname, basename, 'mp3');
    writeFileSync(outputPath, response.audio);
    console.log(`\n音频已保存至: ${outputPath}`);
    console.log(`\n播放命令: ffplay -autoexit ${outputPath}`);
  } catch (error) {
    console.error('语音合成失败:', error);
    process.exit(1);
  }
}

main();
