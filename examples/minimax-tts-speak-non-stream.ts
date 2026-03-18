/**
 * Minimax TTS speak 非流式输出示例
 * 演示如何使用 speak() 方法获取完整音频（非流式）
 *
 * speak 方法支持两种输出模式:
 * - speak(text, { stream: true }): 流式音频输出 - 适用于实时播放场景
 * - speak(text) 或 speak(text, { stream: false }): 一次性音频输出 - 适用于需要完整音频的场景
 *
 * 本示例演示：字符串输入 + 非流式输出
 *
 * 环境变量:
 * - MINIMAX_API_KEY: Minimax API Key
 */
import 'dotenv/config';
import { writeFileSync } from 'node:fs';
import { createTTS } from 'univoice';
import { ensureOutputDir, getScriptMeta, printPlayTip, timestamp } from './utils/common';

const { __dirname, basename } = getScriptMeta(import.meta.url);

/**
 * 获取 Minimax API Key
 */
function getMinimaxApiKey(): string {
  const apiKey = process.env.MINIMAX_API_KEY;
  if (!apiKey) {
    console.error('请设置环境变量 MINIMAX_API_KEY');
    process.exit(1);
  }
  return apiKey;
}

async function main() {
  const apiKey = getMinimaxApiKey();

  // 创建 TTS 实例
  const tts = createTTS({
    provider: 'minimax',
    apiKey,
    // speech-2.8-hd: 精准还原真实语气（推荐）
    model: 'speech-2.8-hd',
    // 青春男声
    voice: 'male-qn-qingse',
    format: 'mp3',
    speed: 1,
    volume: 1,
  });

  console.log(`\n[${timestamp()}] === speak 非流式输出模式演示 ===\n`);

  const text =
    '欢迎来到杭州！我是您的智能导游。杭州，这座有着2200多年历史的古城，曾是南宋都城，如今是现代与古典完美交融的东方名城。让我们一起开启这段美妙的杭州之旅吧！';

  console.log(`输入文本: "${text}"\n`);

  const startTime = Date.now();

  // 使用 speak 不传 stream 选项，返回 Promise<TTSResponse>
  // TTSResponse 包含完整的音频数据
  const response = await tts.speak(text);

  const endTime = Date.now();
  console.log(`[${timestamp()}] 音频生成完成，耗时: ${endTime - startTime} ms`);
  console.log(`音频大小: ${response.audio.length} bytes`);

  // 保存音频
  const outputPath = ensureOutputDir(__dirname, basename, 'mp3');
  writeFileSync(outputPath, response.audio);
  console.log(`\n音频已保存至: ${outputPath}`);

  printPlayTip(outputPath);

  // 对比说明
  console.log('\n=== 非流式 vs 流式模式 ===');
  console.log('非流式模式特点:');
  console.log('  - 返回完整音频数据，适合保存文件');
  console.log('  - 等待全部音频生成完成后返回');
  console.log('  - 适用于需要完整音频的场景（如下载、存储）');
  console.log('\n流式模式特点:');
  console.log('  - 音频块实时返回，首字延迟更低');
  console.log('  - 适用于实时播放场景');
  console.log('  - 参见示例: minimax-tts-speak-string.ts');
}

main().catch((error) => {
  console.error('语音合成失败:', error);
  process.exit(1);
});
