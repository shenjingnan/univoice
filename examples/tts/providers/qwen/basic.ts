/**
 * Qwen TTS 基础示例
 * 演示非流式输入 + 流式输出场景（字符串输入 → 流式音频输出）
 *
 * 支持的模型:
 * - cosyvoice-v3-flash (默认，速度快、成本低)
 * - cosyvoice-v3-plus (高质量版本)
 * - cosyvoice-v2
 * - cosyvoice-v1
 *
 * 环境变量:
 * - QWEN_API_KEY: 阿里云 DashScope API Key
 *
 * 使用方法:
 * - 运行默认模型: npx tsx examples/tts/providers/qwen/basic.ts
 * - 指定模型: npx tsx examples/tts/providers/qwen/basic.ts cosyvoice-v3-plus
 * - 查看帮助: npx tsx examples/tts/providers/qwen/basic.ts --help
 */
import 'dotenv/config';
import { writeFileSync } from 'node:fs';
import { createTTS } from 'univoice';
import {
  ensureOutputDir,
  getQwenApiKey,
  getScriptMeta,
  printStats,
  timestamp,
} from '../../../utils/common';

const { __dirname, basename } = getScriptMeta(import.meta.url);

// 支持的模型列表
const SUPPORTED_MODELS = [
  { name: 'cosyvoice-v3-flash', desc: '速度快、成本低（推荐）' },
  { name: 'cosyvoice-v3-plus', desc: '高质量版本' },
  { name: 'cosyvoice-v2', desc: 'V2 版本' },
  { name: 'cosyvoice-v1', desc: 'V1 版本' },
] as const;

type QwenModel = (typeof SUPPORTED_MODELS)[number]['name'];

function printHelp() {
  console.log(`
Qwen TTS 基础示例 - 非流式入/流式出

用法:
  npx tsx examples/tts/providers/qwen/basic.ts [模型名称]

支持的模型:
${SUPPORTED_MODELS.map((m) => `  ${m.name.padEnd(20)} - ${m.desc}`).join('\n')}

示例:
  npx tsx examples/tts/providers/qwen/basic.ts                    # 使用默认模型
  npx tsx examples/tts/providers/qwen/basic.ts cosyvoice-v3-plus  # 使用高质量模型
`);
}

function parseArgs(): { model: QwenModel; showHelp: boolean } {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    return { model: 'cosyvoice-v3-flash', showHelp: true };
  }

  const modelName = args[0] as QwenModel;
  if (modelName && !SUPPORTED_MODELS.some((m) => m.name === modelName)) {
    console.error(`错误: 不支持的模型 "${modelName}"`);
    console.error('支持的模型:', SUPPORTED_MODELS.map((m) => m.name).join(', '));
    process.exit(1);
  }

  return {
    model: modelName || 'cosyvoice-v3-flash',
    showHelp: false,
  };
}

async function main() {
  const { model, showHelp } = parseArgs();

  if (showHelp) {
    printHelp();
    process.exit(0);
  }

  const apiKey = getQwenApiKey();

  // 创建 TTS 实例
  const tts = createTTS({
    provider: 'qwen',
    apiKey,
    model,
    // 龙小淳: 知性积极女
    // 其他选项: longanhuan (欢脱元气女), longanyang (阳光大男孩), longhuhu_v3 (天真烂漫女童)
    voice: 'longxiaochun_v3',
    format: 'mp3',
    volume: 50,
  });

  console.log(`\n[${timestamp()}] === Qwen TTS 基础示例 ===`);
  console.log(`模型: ${model}`);
  console.log(`场景: 字符串输入 → 流式音频输出\n`);

  const text =
    '欢迎来到杭州！我是您的智能导游。杭州，这座有着2200多年历史的古城，曾是南宋都城，如今是现代与古典完美交融的东方名城。让我们一起开启这段美妙的杭州之旅吧！';

  console.log(`输入文本: "${text}"\n`);

  // 使用 speak 方法流式合成语音
  const chunks: Uint8Array[] = [];
  const startTime = Date.now();
  let firstChunkTime = 0;
  let chunkCount = 0;

  for await (const { audioChunk } of tts.speak(text, { stream: true })) {
    chunkCount++;
    if (chunkCount === 1) {
      firstChunkTime = Date.now();
      console.log(`[${timestamp()}] [首字延迟] ${firstChunkTime - startTime} ms\n`);
    }
    chunks.push(audioChunk);
  }

  printStats(startTime, chunkCount, chunks);

  // 保存音频文件
  const outputPath = ensureOutputDir(__dirname, basename, 'mp3');
  const buffer = Buffer.concat(chunks.map((c) => Buffer.from(c)));
  writeFileSync(outputPath, buffer);
  console.log(`\n音频已保存至: ${outputPath}`);
  console.log(`\n播放命令: ffplay -autoexit ${outputPath}`);
}

main();
