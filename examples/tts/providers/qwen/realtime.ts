/**
 * Qwen Realtime TTS 示例
 * 演示 Qwen Realtime API 的指令控制功能
 *
 * 与 CosyVoice 的区别:
 * - CosyVoice (provider: 'qwen'): 标准语音合成，支持多种音色
 * - Realtime (provider: 'qwen-realtime'): 实时语音合成，支持 instructions 指令控制
 *
 * 支持的模型:
 * - qwen3-tts-instruct-flash-realtime (默认，支持 instructions 指令控制)
 * - qwen3-tts-flash-realtime
 *
 * 环境变量:
 * - QWEN_API_KEY: 阿里云 DashScope API Key
 *
 * 使用方法:
 * - 运行默认设置: npx tsx examples/tts/providers/qwen/realtime.ts
 * - 指定指令: npx tsx examples/tts/providers/qwen/realtime.ts "用开心的语气说"
 */
import 'dotenv/config';
import { writeFileSync } from 'node:fs';
import { createTTS } from 'univoice';
import { ensureOutputDir, getQwenApiKey, getScriptMeta, timestamp } from '../../../utils/common';

const { __dirname, basename } = getScriptMeta(import.meta.url);

// 预设指令示例
const PRESET_INSTRUCTIONS = {
  happy: '用开心愉悦的语气说话',
  sad: '用悲伤低沉的语气说话',
  excited: '用兴奋激动的语气说话',
  calm: '用平静温和的语气说话',
  professional: '用专业正式的语气说话',
};

function printHelp() {
  console.log(`
Qwen Realtime TTS 示例 - 指令控制语音合成

用法:
  npx tsx examples/tts/providers/qwen/realtime.ts [指令]

预设指令:
  happy        - 开心愉悦的语气
  sad          - 悲伤低沉的语气
  excited      - 兴奋激动的语气
  calm         - 平静温和的语气
  professional - 专业正式的语气

示例:
  npx tsx examples/tts/providers/qwen/realtime.ts                    # 无指令
  npx tsx examples/tts/providers/qwen/realtime.ts happy              # 使用预设指令
  npx tsx examples/tts/providers/qwen/realtime.ts "用小孩子语气说话"  # 自定义指令
`);
}

function parseArgs(): { instructions: string | undefined; showHelp: boolean } {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    return { instructions: undefined, showHelp: true };
  }

  const arg = args[0];
  if (!arg) {
    return { instructions: undefined, showHelp: false };
  }

  // 检查是否是预设指令
  if (arg in PRESET_INSTRUCTIONS) {
    return {
      instructions: PRESET_INSTRUCTIONS[arg as keyof typeof PRESET_INSTRUCTIONS],
      showHelp: false,
    };
  }

  // 自定义指令
  return { instructions: arg, showHelp: false };
}

async function main() {
  const { instructions, showHelp } = parseArgs();

  if (showHelp) {
    printHelp();
    process.exit(0);
  }

  const apiKey = getQwenApiKey();

  // 创建 Realtime TTS 实例
  const tts = createTTS({
    provider: 'qwen-realtime',
    apiKey,
    model: 'qwen3-tts-instruct-flash-realtime',
    // Cherry: 甜美女声
    // 其他选项: Ethan (沉稳男声), Luna (温柔女声)
    voice: 'Cherry',
    format: 'pcm',
    sampleRate: 24000,
    // Realtime 专用选项
    realtime: {
      mode: 'server_commit', // 服务端自动判断何时输出音频
      instructions, // 指令控制
      optimizeInstructions: true, // 启用指令优化
    },
  });

  console.log(`\n[${timestamp()}] === Qwen Realtime TTS 示例 ===`);
  console.log(`模型: qwen3-tts-instruct-flash-realtime`);
  console.log(`音色: Cherry (甜美女声)`);
  if (instructions) {
    console.log(`指令: "${instructions}"`);
  }
  console.log(`\n场景: 实时语音合成 + 指令控制\n`);

  const text =
    '欢迎来到杭州！我是您的智能导游。杭州，这座有着2200多年历史的古城，曾是南宋都城，如今是现代与古典完美交融的东方名城。';

  console.log(`输入文本: "${text}"\n`);

  try {
    const chunks: Uint8Array[] = [];
    const startTime = Date.now();
    let firstChunkTime = 0;
    let chunkCount = 0;

    // 流式合成语音
    for await (const { audioChunk } of tts.speak(text, { stream: true })) {
      chunkCount++;
      if (chunkCount === 1) {
        firstChunkTime = Date.now();
        console.log(`[${timestamp()}] [首字延迟] ${firstChunkTime - startTime} ms\n`);
      }
      console.log(`[${timestamp()}] 收到音频块 #${chunkCount}: ${audioChunk.length} bytes`);
      chunks.push(audioChunk);
    }

    const endTime = Date.now();
    const totalSize = chunks.reduce((sum, c) => sum + c.length, 0);

    console.log(`\n[${timestamp()}] === 统计信息 ===`);
    console.log(`总耗时: ${endTime - startTime} ms`);
    console.log(`首字延迟: ${firstChunkTime - startTime} ms`);
    console.log(`音频块数: ${chunkCount}`);
    console.log(`音频大小: ${totalSize} bytes`);

    // 保存音频文件
    const outputPath = ensureOutputDir(__dirname, basename, 'pcm');
    const buffer = Buffer.concat(chunks.map((c) => Buffer.from(c)));
    writeFileSync(outputPath, buffer);
    console.log(`\n音频已保存至: ${outputPath}`);

    console.log('\n=== 播放提示 ===');
    console.log(`ffplay -f s16le -ar 24000 ${outputPath}`);
  } catch (error) {
    console.error('语音合成失败:', error);
    process.exit(1);
  }
}

main();
