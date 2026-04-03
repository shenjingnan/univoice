/**
 * Doubao TTS - 连接预建立 + 非流式合成示例
 * 演示 connect() → connection.speak(text) → connection.close() 流程
 *
 * 适用场景:
 * - 需要降低首次合成延迟（预先建立 WebSocket 连接）
 * - 多次合成复用同一连接
 *
 * 环境变量:
 * - DOUBAO_APP_KEY: 豆包应用 App Key
 * - DOUBAO_ACCESS_TOKEN: 豆包访问令牌
 * - DOUBAO_VOICE_TYPE: 音色（可选，默认 zh_female_tianmeixiaoyuan_moon_bigtts）
 *
 * 使用方法:
 * npx tsx examples/tts/providers/doubao/connect-and-synthesize.ts
 */
import 'dotenv/config';
import { writeFileSync } from 'node:fs';
import { DoubaoTTS } from 'univoice/tts';
import {
  DEFAULT_TTS_TEXT,
  ensureOutputDir,
  getScriptMeta,
  getTTSConfig,
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

  console.log(`\n[${timestamp()}] === Doubao TTS - 连接预建立（非流式合成） ===\n`);

  try {
    // ========== 预建立连接 ==========
    const connectStartTime = Date.now();
    console.log(`[${timestamp()}] 正在建立连接...`);

    const connection = await tts.connect();

    const connectTime = Date.now() - connectStartTime;
    console.log(`[${timestamp()}] 连接已建立 (${connectTime} ms)\n`);

    // ========== 非流式合成 ==========
    const synthesizeStartTime = Date.now();
    console.log(`[${timestamp()}] 开始非流式合成...`);

    const response = await connection.speak(DEFAULT_TTS_TEXT);

    const synthesizeTime = Date.now() - synthesizeStartTime;
    const outputFile = ensureOutputDir(__dirname, basename, response.format);
    writeFileSync(outputFile, response.audio);

    console.log(`[${timestamp()}] 合成完成 (${synthesizeTime} ms)`);
    console.log(`音频大小: ${response.audio.length} bytes`);
    console.log(`保存至: ${outputFile}\n`);
    console.log(`播放命令: ffplay -autoexit ${outputFile}`);

    // ========== 关闭连接 ==========
    connection.close();
    console.log(`[${timestamp()}] 连接已关闭`);

    // ========== 统计信息 ==========
    console.log(`\n[${timestamp()}] === 统计信息 ===`);
    console.log(`连接预建立耗时: ${connectTime} ms`);
    console.log(`非流式合成耗时: ${synthesizeTime} ms`);
  } catch (error) {
    console.error('语音合成失败:', error);
    process.exit(1);
  }
}

main();
