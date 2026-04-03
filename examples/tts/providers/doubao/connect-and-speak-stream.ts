/**
 * Doubao TTS - 连接预建立 + 流式合成示例
 * 演示 connect() → connection.speak(stream, { stream: true }) → connection.close() 流程
 *
 * 适用场景:
 * - 需要降低首次合成延迟（预先建立 WebSocket 连接）
 * - LLM 流式输出文本实时合成语音
 *
 * 环境变量:
 * - DOUBAO_APP_KEY: 豆包应用 App Key
 * - DOUBAO_ACCESS_TOKEN: 豆包访问令牌
 * - DOUBAO_VOICE_TYPE: 音色（可选，默认 zh_female_tianmeixiaoyuan_moon_bigtts）
 *
 * 使用方法:
 * npx tsx examples/tts/providers/doubao/connect-and-speak-stream.ts
 */
import 'dotenv/config';
import { writeFileSync } from 'node:fs';
import { DoubaoTTS } from 'univoice/tts';
import {
  DEFAULT_TTS_TEXT,
  ensureOutputDir,
  getScriptMeta,
  getTTSConfig,
  mockLLMStream,
  timestamp,
} from '../../../utils/common';

const { __dirname, basename } = getScriptMeta(import.meta.url);

async function main() {
  const { appId, accessToken, voice } = getTTSConfig();

  const tts = new DoubaoTTS({
    appId,
    accessToken,
    voice,
    format: 'mp3',
    resourceId: 'seed-tts-2.0',
    sampleRate: 24000,
  });

  console.log(`\n[${timestamp()}] === Doubao TTS - 连接预建立（流式合成） ===\n`);

  try {
    // ========== 预建立连接 ==========
    const connectStartTime = Date.now();
    console.log(`[${timestamp()}] 正在建立连接...`);

    const connection = await tts.connect();

    const connectTime = Date.now() - connectStartTime;
    console.log(`[${timestamp()}] 连接已建立 (${connectTime} ms)\n`);

    // ========== 流式合成 ==========
    const streamStartTime = Date.now();
    let firstChunkTime = 0;
    let chunkCount = 0;
    const audioChunks: Uint8Array[] = [];

    console.log(`[${timestamp()}] 开始流式合成...`);

    for await (const chunk of connection.speak(mockLLMStream(DEFAULT_TTS_TEXT), { stream: true })) {
      chunkCount++;
      if (chunkCount === 1) {
        firstChunkTime = Date.now();
        console.log(`[${timestamp()}] 首包延迟: ${firstChunkTime - streamStartTime} ms`);
      }
      audioChunks.push(chunk.audioChunk);
    }

    const streamTime = Date.now() - streamStartTime;
    const totalSize = audioChunks.reduce((sum, c) => sum + c.length, 0);
    const outputFile = ensureOutputDir(__dirname, basename, 'mp3');
    writeFileSync(outputFile, Buffer.concat(audioChunks));

    console.log(`[${timestamp()}] 合成完成 (${streamTime} ms)`);
    console.log(`音频块数: ${chunkCount}`);
    console.log(`音频大小: ${totalSize} bytes`);
    console.log(`保存至: ${outputFile}\n`);
    console.log(`播放命令: ffplay -autoexit ${outputFile}`);

    // ========== 关闭连接 ==========
    connection.close();
    console.log(`[${timestamp()}] 连接已关闭`);

    // ========== 统计信息 ==========
    console.log(`\n[${timestamp()}] === 统计信息 ===`);
    console.log(`连接预建立耗时: ${connectTime} ms`);
    console.log(`流式合成耗时: ${streamTime} ms`);
    console.log(`首包延迟: ${firstChunkTime ? firstChunkTime - streamStartTime : 'N/A'} ms`);
  } catch (error) {
    console.error('语音合成失败:', error);
    process.exit(1);
  }
}

main();
