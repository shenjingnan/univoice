/**
 * Qwen TTS 非流式输出示例
 * 演示非流式输入 + 非流式输出场景（一次性获取完整音频）
 *
 * 场景说明:
 * - 输入完整文本，一次性返回完整音频
 * - 适用于需要离线存储或批量处理的场景
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
 * - 运行默认模型: npx tsx examples/tts/providers/qwen/non-stream-output.ts
 * - 指定模型: npx tsx examples/tts/providers/qwen/non-stream-output.ts cosyvoice-v3-plus
 * - 指定格式: npx tsx examples/tts/providers/qwen/non-stream-output.ts cosyvoice-v3-flash opus
 */
import 'dotenv/config';
import { writeFileSync } from 'node:fs';
import { createTTS } from 'univoice';
import { ensureOutputDir, getQwenApiKey, getScriptMeta, timestamp } from '../../../utils/common';

const { __dirname, basename } = getScriptMeta(import.meta.url);

// 支持的模型列表
const SUPPORTED_MODELS = [
  { name: 'cosyvoice-v3-flash', desc: '速度快、成本低（推荐）' },
  { name: 'cosyvoice-v3-plus', desc: '高质量版本' },
  { name: 'cosyvoice-v2', desc: 'V2 版本' },
  { name: 'cosyvoice-v1', desc: 'V1 版本' },
] as const;

// 支持的格式列表
const SUPPORTED_FORMATS = ['mp3', 'wav', 'pcm', 'opus', 'flac', 'ogg'] as const;

type QwenModel = (typeof SUPPORTED_MODELS)[number]['name'];
type AudioFormat = (typeof SUPPORTED_FORMATS)[number];

function printHelp() {
  console.log(`
Qwen TTS 非流式输出示例

用法:
  npx tsx examples/tts/providers/qwen/non-stream-output.ts [模型名称] [音频格式]

支持的模型:
${SUPPORTED_MODELS.map((m) => `  ${m.name.padEnd(20)} - ${m.desc}`).join('\n')}

支持的格式:
  ${SUPPORTED_FORMATS.join(', ')}

示例:
  npx tsx examples/tts/providers/qwen/non-stream-output.ts                    # 默认模型、mp3 格式
  npx tsx examples/tts/providers/qwen/non-stream-output.ts cosyvoice-v3-plus  # 指定模型
  npx tsx examples/tts/providers/qwen/non-stream-output.ts cosyvoice-v3-flash opus  # 指定格式
`);
}

function parseArgs(): { model: QwenModel; format: AudioFormat; showHelp: boolean } {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    return { model: 'cosyvoice-v3-flash', format: 'mp3', showHelp: true };
  }

  const modelName = args[0] as QwenModel;
  if (modelName && !SUPPORTED_MODELS.some((m) => m.name === modelName)) {
    console.error(`错误: 不支持的模型 "${modelName}"`);
    console.error('支持的模型:', SUPPORTED_MODELS.map((m) => m.name).join(', '));
    process.exit(1);
  }

  const format = (args[1] as AudioFormat) || 'mp3';
  if (!SUPPORTED_FORMATS.includes(format)) {
    console.error(`错误: 不支持的格式 "${format}"`);
    console.error('支持的格式:', SUPPORTED_FORMATS.join(', '));
    process.exit(1);
  }

  return {
    model: modelName || 'cosyvoice-v3-flash',
    format,
    showHelp: false,
  };
}

function getFormatExtension(format: AudioFormat): string {
  // Opus 格式使用 ogg 容器
  if (format === 'opus') return 'ogg';
  return format;
}

async function main() {
  const { model, format, showHelp } = parseArgs();

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
    voice: 'longxiaochun_v3',
    format,
  });

  console.log(`\n[${timestamp()}] === Qwen TTS 非流式输出示例 ===`);
  console.log(`模型: ${model}`);
  console.log(`格式: ${format}`);
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
    const ext = getFormatExtension(format);
    const outputPath = ensureOutputDir(__dirname, basename, ext);
    writeFileSync(outputPath, response.audio);
    console.log(`\n音频已保存至: ${outputPath}`);

    // 播放提示
    console.log('\n=== 播放提示 ===');
    if (format === 'pcm') {
      console.log(`ffplay -autoexit -f s16le -ar 24000 ${outputPath}`);
    } else {
      console.log(`ffplay -autoexit ${outputPath}`);
    }
  } catch (error) {
    console.error('语音合成失败:', error);
    process.exit(1);
  }
}

main();
