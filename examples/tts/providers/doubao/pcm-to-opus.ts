/**
 * Doubao TTS PCM → Opus 流式编码示例
 *
 * 演示使用 univoice SDK 内置的 pcmToOpus 函数，
 * 将 TTS 流式输出的 PCM 音频编码为 Opus（可选 OGG 封装）。
 *
 * 完整链路：TTS (PCM) → pcmToOpus() → OGG 文件
 *
 * 环境变量:
 * - DOUBAO_APP_KEY: 火山引擎应用 ID
 * - DOUBAO_ACCESS_TOKEN: 火山引擎访问令牌
 *
 * 使用方法:
 * npx tsx examples/tts/providers/doubao/pcm-to-opus.ts
 */
import 'dotenv/config';
import { Buffer } from 'node:buffer';
import { writeFileSync } from 'node:fs';
import { createTTS, pcmToOpus } from 'univoice';
import {
  DEFAULT_TTS_TEXT,
  ensureOutputDir,
  getScriptMeta,
  getTTSConfig,
  timestamp,
} from '../../../utils/common';

const { __dirname, basename } = getScriptMeta(import.meta.url);

// ============================================
// 编码参数配置
// ============================================

/** PCM 采样率（与 TTS 输出一致） */
const SAMPLE_RATE = 24000;

/** Opus 帧时长（毫秒） */
const FRAME_DURATION_MS = 60;

async function main() {
  const { appId, accessToken, voice } = getTTSConfig();

  // 创建 TTS 实例，PCM 格式输出，24kHz
  const tts = createTTS({
    provider: 'doubao',
    appId,
    accessToken,
    voice,
    format: 'pcm',
    resourceId: 'seed-tts-2.0',
    sampleRate: SAMPLE_RATE,
  });

  console.log(`\n[${timestamp()}] === PCM → Opus → OGG 流式编码 ===`);
  console.log(`TTS 格式: PCM (${SAMPLE_RATE} Hz, 1ch, 16bit)`);
  console.log(
    `Opus 帧: ${FRAME_DURATION_MS}ms (${(SAMPLE_RATE / 1000) * FRAME_DURATION_MS * 2} bytes/frame)`
  );
  console.log(`输入文本: "${DEFAULT_TTS_TEXT}"\n`);

  const startTime = Date.now();
  let chunkCount = 0;
  let totalOpusBytes = 0;

  try {
    // TTS 流式输出 PCM → pcmToOpus 流式编码为 OGG 封装的 Opus
    const pcmStream = tts.speak(DEFAULT_TTS_TEXT, { stream: true });
    const oggStream = pcmToOpus(pcmStream, {
      sampleRate: SAMPLE_RATE,
      frameDurationMs: FRAME_DURATION_MS,
      ogg: true,
    });

    // 收集 OGG 页面并写入文件
    const oggPages: Buffer[] = [];
    for await (const page of oggStream) {
      chunkCount++;
      totalOpusBytes += page.length;
      oggPages.push(page);
    }

    const oggData = Buffer.concat(oggPages);
    const totalTime = Date.now() - startTime;

    // 统计信息
    console.log(`\n[${timestamp()}] === 编码统计 ===`);
    console.log(`总耗时: ${totalTime} ms`);
    console.log(`OGG chunks: ${chunkCount}`);
    console.log(`OGG 总大小: ${totalOpusBytes} bytes (${(totalOpusBytes / 1024).toFixed(1)} KB)`);

    // 保存为 .ogg 文件
    const outputFile = ensureOutputDir(__dirname, basename, 'ogg');
    writeFileSync(outputFile, oggData);
    console.log(`OGG 文件已保存至: ${outputFile}`);

    console.log('\n=== 播放提示 ===');
    console.log(`ffplay -autoexit ${outputFile}`);
  } catch (error) {
    console.error('处理失败:', error);
    process.exit(1);
  }
}

main();
