/**
 * TTS speak 流式输入示例
 * 演示如何将文本流输入边发边收转换为流式音频输出
 *
 * speak 方法支持两种输入模式:
 * - speak(string): 字符串输入 - 适用于已知完整文本的场景
 * - speak(textStream): 文本流输入 - 适用于 LLM 流式输出等场景
 *
 * 本示例演示：文本流输入 + 流式输出（边发边收）
 * 场景：模拟 LLM 流式输出，同时实时接收音频
 */
import 'dotenv/config';
import { writeFileSync } from 'node:fs';
import { createTTS } from 'univoice';
import {
  DEFAULT_TTS_TEXT,
  ensureOutputDir,
  getMinimaxApiKey,
  getQwenApiKey,
  getScriptMeta,
  getTTSConfig,
  mockLLMStream,
  timestamp,
} from '../../utils/common';

const { __dirname, basename } = getScriptMeta(import.meta.url);

/**
 * 演示 Doubao TTS 流式输入
 */
async function demoDoubao() {
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

  if (!tts.speak) {
    console.error('Doubao TTS 不支持 speak 方法');
    return;
  }

  console.log(`\n[${timestamp()}] === Doubao TTS 流式输入 + 流式输出演示 ===\n`);
  console.log('场景说明: 文本流输入（如 LLM 输出），同时实时接收音频流\n');

  const startTime = Date.now();
  const textStream = mockLLMStream(DEFAULT_TTS_TEXT);

  const audioChunks: Uint8Array[] = [];
  let chunkCount = 0;

  for await (const { audioChunk } of tts.speak(textStream, { stream: true })) {
    chunkCount++;
    console.log(`[${timestamp()}] 收到音频块 #${chunkCount}: ${audioChunk.length} bytes`);
    audioChunks.push(audioChunk);
  }

  const endTime = Date.now();
  console.log(`\n[${timestamp()}] 音频生成完成，总耗时: ${endTime - startTime} ms`);
  console.log(`音频块数: ${chunkCount}`);
  console.log(`音频大小: ${audioChunks.reduce((sum, c) => sum + c.length, 0)} bytes`);

  const outputPath = ensureOutputDir(__dirname, `${basename}-doubao`, 'pcm');
  const buffer = Buffer.concat(audioChunks.map((c) => Buffer.from(c)));
  writeFileSync(outputPath, buffer);
  console.log(`\n音频已保存至: ${outputPath}`);

  console.log('\n=== 播放提示 ===');
  console.log(`ffplay -autoexit -f s16le -ar 24000 ${outputPath}`);
}

/**
 * 演示 Qwen TTS 流式输入
 */
async function demoQwen() {
  const apiKey = getQwenApiKey();

  const tts = createTTS({
    provider: 'qwen',
    apiKey,
    voice: 'longxiaochun_v3',
    format: 'mp3',
    model: 'cosyvoice-v3-flash',
  });

  if (!tts.speak) {
    console.error('Qwen TTS 不支持 speak 方法');
    return;
  }

  console.log(`\n[${timestamp()}] === Qwen TTS 流式输入 + 流式输出演示 ===\n`);
  console.log('场景说明: 文本流输入（如 LLM 输出），同时实时接收音频流\n');

  const startTime = Date.now();
  const textStream = mockLLMStream(DEFAULT_TTS_TEXT);

  const audioChunks: Uint8Array[] = [];
  let chunkCount = 0;

  for await (const { audioChunk } of tts.speak(textStream, { stream: true })) {
    chunkCount++;
    console.log(`[${timestamp()}] 收到音频块 #${chunkCount}: ${audioChunk.length} bytes`);
    audioChunks.push(audioChunk);
  }

  const endTime = Date.now();
  console.log(`\n[${timestamp()}] 音频生成完成，总耗时: ${endTime - startTime} ms`);
  console.log(`音频块数: ${chunkCount}`);
  console.log(`音频大小: ${audioChunks.reduce((sum, c) => sum + c.length, 0)} bytes`);

  const outputPath = ensureOutputDir(__dirname, `${basename}-qwen`, 'mp3');
  const buffer = Buffer.concat(audioChunks.map((c) => Buffer.from(c)));
  writeFileSync(outputPath, buffer);
  console.log(`\n音频已保存至: ${outputPath}`);

  console.log('\n=== 播放提示 ===');
  console.log(`ffplay -autoexit ${outputPath}`);
}

/**
 * 演示 Minimax TTS 流式输入
 */
async function demoMinimax() {
  const apiKey = getMinimaxApiKey();

  const tts = createTTS({
    provider: 'minimax',
    apiKey,
    model: 'speech-2.8-hd',
    voice: 'male-qn-qingse',
    format: 'mp3',
    speed: 1,
    volume: 1,
  });

  console.log(`\n[${timestamp()}] === Minimax TTS 流式输入 + 流式输出演示 ===\n`);
  console.log('场景说明: 文本流输入（如 LLM 输出），实时流式音频输出\n');

  const startTime = Date.now();
  const textStream = mockLLMStream(DEFAULT_TTS_TEXT);

  const chunks: Uint8Array[] = [];
  let firstChunkTime = 0;
  let audioChunkCount = 0;

  for await (const { audioChunk } of tts.speak(textStream, { stream: true })) {
    audioChunkCount++;
    if (audioChunkCount === 1) {
      firstChunkTime = Date.now();
      console.log(`\n[${timestamp()}] [首字延迟] ${firstChunkTime - startTime} ms\n`);
    }
    chunks.push(audioChunk);
    console.log(`[${timestamp()}] 收到音频块 #${audioChunkCount}: ${audioChunk.length} bytes`);
  }

  const endTime = Date.now();
  const totalSize = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  console.log(`\n[${timestamp()}] === 统计信息 ===`);
  console.log(`总耗时: ${endTime - startTime} ms`);
  console.log(`首字延迟: ${firstChunkTime - startTime} ms`);
  console.log(`音频块数: ${audioChunkCount}`);
  console.log(`音频大小: ${totalSize} bytes`);

  const outputFile = ensureOutputDir(__dirname, `${basename}-minimax`, 'mp3');
  const buffer = Buffer.concat(chunks.map((c) => Buffer.from(c)));
  writeFileSync(outputFile, buffer);
  console.log(`\n音频已保存至: ${outputFile}`);
  console.log(`\n播放命令: ffplay -autoexit ${outputFile}`);
}

// 从命令行参数选择演示的提供商
const provider = process.argv[2] || 'doubao';

async function main() {
  switch (provider) {
    case 'qwen':
      await demoQwen();
      break;
    case 'minimax':
      await demoMinimax();
      break;
    default:
      await demoDoubao();
      break;
  }
}

main().catch(console.error);
