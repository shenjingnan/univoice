/**
 * CosyVoice v3-flash - 连接预建立示例
 * 演示 connect() → connection.speak() → connection.close() 完整流程
 *
 * 适用场景:
 * - 需要降低首次合成延迟（预先建立 WebSocket 连接）
 * - 多次合成复用同一连接
 *
 * 环境变量:
 * - QWEN_API_KEY: 阿里云 DashScope API Key
 *
 * 使用方法:
 * npx tsx examples/tts/providers/qwen/cosyvoice-v3-flash/connect-and-speak.ts
 */
import 'dotenv/config';
import { writeFileSync } from 'node:fs';
import { QwenTTS } from 'univoice/tts/providers';
import {
  DEFAULT_TTS_TEXT,
  ensureOutputDir,
  getQwenApiKey,
  getScriptMeta,
  mockLLMStream,
  timestamp,
} from '../../../../utils/common';

const { __dirname, basename } = getScriptMeta(import.meta.url);

// 固定使用 cosyvoice-v3-flash 模型
const MODEL = 'cosyvoice-v3-flash';

async function main() {
  const apiKey = getQwenApiKey();

  // 直接实例化 QwenTTS
  const tts = new QwenTTS({
    apiKey,
    model: MODEL,
    voice: 'longxiaochun_v3',
    format: 'mp3',
  });

  console.log(`\n[${timestamp()}] === CosyVoice v3-flash - 连接预建立 ===`);
  console.log(`模型: ${MODEL}`);
  console.log(`场景: 预建立连接 → 流式合成 → 关闭连接\n`);

  try {
    // 第一阶段: 预建立连接
    const connectStartTime = Date.now();
    console.log(`[${timestamp()}] 正在建立连接...`);

    const connection = await tts.connect();

    const connectTime = Date.now() - connectStartTime;
    console.log(`[${timestamp()}] 连接已建立 (${connectTime} ms)\n`);

    // 第二阶段: 在已建立的连接上进行流式合成
    const textStream = mockLLMStream(DEFAULT_TTS_TEXT, { delay: 150 });
    const speakStartTime = Date.now();
    let firstChunkTime = 0;
    let chunkCount = 0;
    const chunks: Uint8Array[] = [];

    console.log(`[${timestamp()}] 开始流式合成...\n`);

    for await (const { audioChunk } of connection.speak(textStream, { stream: true })) {
      chunkCount++;
      if (chunkCount === 1) {
        firstChunkTime = Date.now();
        console.log(`[${timestamp()}] [首字延迟] ${firstChunkTime - speakStartTime} ms\n`);
      }
      console.log(`[${timestamp()}] 收到音频块 #${chunkCount}: ${audioChunk.length} bytes`);
      chunks.push(audioChunk);
    }

    const endTime = Date.now();

    // 第三阶段: 关闭连接
    connection.close();
    console.log(`\n[${timestamp()}] 连接已关闭`);

    // 保存音频文件
    const totalSize = chunks.reduce((sum, c) => sum + c.length, 0);

    console.log(`\n[${timestamp()}] === 统计信息 ===`);
    console.log(`连接预建立耗时: ${connectTime} ms`);
    console.log(`首字延迟: ${firstChunkTime - speakStartTime} ms`);
    console.log(`总耗时: ${endTime - connectStartTime} ms`);
    console.log(`音频块数: ${chunkCount}`);
    console.log(`音频大小: ${totalSize} bytes`);

    const outputPath = ensureOutputDir(__dirname, basename, 'mp3');
    const buffer = Buffer.concat(chunks.map((c) => Buffer.from(c)));
    writeFileSync(outputPath, buffer);
    console.log(`\n音频已保存至: ${outputPath}`);
    console.log(`\n播放命令: ffplay -autoexit ${outputPath}`);
  } catch (error) {
    console.error('语音合成失败:', error);
    process.exit(1);
  }
}

main();
