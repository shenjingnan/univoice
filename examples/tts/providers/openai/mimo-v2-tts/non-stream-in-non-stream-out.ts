/**
 * OpenAI TTS mimo-v2-tts - 非流式输入/非流式输出示例
 * 演示使用 chat 模式（兼容 mimo-v2-tts 等服务）一次性获取完整音频
 *
 * 模型特点:
 * - 使用 chat.completions + audio 参数的 TTS 模型
 * - 适用于 mimo-v2-tts 等兼容 OpenAI chat 接口的 TTS 服务
 * - 输出 pcm 格式音频
 *
 * 环境变量:
 * - OPENAI_API_KEY: API Key（必填）
 * - OPENAI_BASE_URL: API 地址（必填，指向 mimo-v2-tts 服务地址）
 * - OPENAI_TTS_MODEL: 模型名称（可选，默认 mimo-v2-tts）
 *
 * 使用方法:
 * npx tsx examples/tts/providers/openai/mimo-v2-tts/non-stream-in-non-stream-out.ts
 */
import 'dotenv/config';
import { writeFileSync } from 'node:fs';
import { createTTS } from 'univoice';
import {
  ensureOutputDir,
  getOpenAIConfig,
  getScriptMeta,
  timestamp,
} from '../../../../utils/common';

const { __dirname, basename } = getScriptMeta(import.meta.url);

// 固定使用 mimo-v2-tts 模型（chat 模式）
const MODEL = 'mimo-v2-tts';

async function main() {
  const { apiKey, baseUrl } = getOpenAIConfig();

  // 创建 TTS 实例，使用 chat 模式
  // mimo-v2-tts 会自动推断为 chat 模式
  const tts = createTTS({
    provider: 'openai',
    apiKey,
    baseUrl,
    voice: 'default_zh',
    format: 'pcm',
    model: MODEL,
  });

  console.log(`\n[${timestamp()}] === OpenAI TTS (chat 模式) - 非流式入/非流式出 ===`);
  console.log(`模型: ${MODEL}`);
  console.log(`场景: 字符串输入 → 完整音频输出\n`);

  const text =
    '欢迎来到龙井村。这里是西湖龙井茶的原产地，漫山遍野的茶园层层叠叠，空气中弥漫着淡淡的茶香。春天采茶季节，您还能看到茶农们忙碌的身影。';

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
    const outputPath = ensureOutputDir(__dirname, basename);
    writeFileSync(outputPath, response.audio);
    console.log(`\n音频已保存至: ${outputPath}`);

    console.log('\nPCM 格式播放命令 (24000 Hz, 16-bit, mono):');
    console.log(`ffplay -autoexit -f s16le -ar 24000 ${outputPath}`);
  } catch (error) {
    console.error('语音合成失败:', error);
    process.exit(1);
  }
}

main();
