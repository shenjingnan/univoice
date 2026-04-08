/**
 * 讯飞超拟人 TTS - 直接实例化示例
 * 演示不使用工厂函数 createTTS，直接 new XfyunTTS() 创建实例
 *
 * 特点:
 * - 直接导入 XfyunTTS 类并实例化，无需注册 provider
 * - 使用流式文本输入（模拟 LLM 边生成文本边输入 TTS 的场景）
 * - 使用 speak 方法进行流式语音合成，边合成边接收音频块
 * - 真正的边发边收：流式文本输入，流式音频输出
 *
 * 环境变量:
 * - XFYUN_APP_ID: 讯飞应用 ID
 * - XFYUN_API_KEY: 讯飞 API Key
 * - XFYUN_API_SECRET: 讯飞 API Secret
 *
 * 使用方法:
 * npx tsx examples/tts/providers/xfyun/super-human/direct-instance.ts
 */
import 'dotenv/config';
import { writeFileSync } from 'node:fs';
import { XfyunTTS } from 'univoice/tts/providers';
import {
  DEFAULT_TTS_TEXT,
  ensureOutputDir,
  getScriptMeta,
  getXfyunTTSConfig,
  mockLLMStream,
  printStats,
  timestamp,
} from '../../../../utils/common';

const { __dirname, basename } = getScriptMeta(import.meta.url);

async function main() {
  const { appId, apiKey, apiSecret } = getXfyunTTSConfig();

  // 直接实例化 XfyunTTS，不使用 createTTS 工厂函数
  const tts = new XfyunTTS({
    appId,
    apiKey,
    apiSecret,
    voice: 'x5_lingyuzhao_flow',
    format: 'mp3',
    sampleRate: 24000,
  });

  if (!tts.speak) {
    console.error('当前 TTS 提供商不支持流式语音合成');
    process.exit(1);
  }

  console.log(`\n[${timestamp()}] === 讯飞超拟人 TTS - 直接实例化 ===`);
  console.log(`发音人: x5_lingyuzhao_flow`);
  console.log(`场景: 直接 new XfyunTTS() → 流式文本输入 + 流式语音合成\n`);

  // 使用 mockLLMStream 模拟 LLM 流式输出，每隔 150ms 发送一个文本块
  const textStream = mockLLMStream(DEFAULT_TTS_TEXT, { delay: 150 });

  const chunks: Uint8Array[] = [];
  const startTime = Date.now();
  let firstChunkTime = 0;
  let chunkCount = 0;

  // 使用 speak 直接传入流式文本，通过 for await...of 消费流式音频
  // 用法与工厂函数创建的实例完全一致
  for await (const { audioChunk } of tts.speak(textStream, { stream: true })) {
    chunkCount++;
    if (chunkCount === 1) {
      firstChunkTime = Date.now();
      console.log(`[${timestamp()}] [首字延迟] ${firstChunkTime - startTime} ms\n`);
    }
    console.log(`[${timestamp()}] 收到音频块 #${chunkCount}: ${audioChunk.length} bytes`);
    chunks.push(audioChunk);
  }

  printStats(startTime, chunkCount, chunks);

  // 保存音频
  const outputPath = ensureOutputDir(__dirname, basename, 'mp3');
  const buffer = Buffer.concat(chunks.map((c) => Buffer.from(c)));
  writeFileSync(outputPath, buffer);
  console.log(`\n音频已保存至: ${outputPath}`);
  console.log(`\n播放命令: ffplay -autoexit ${outputPath}`);
}

main();
