/**
 * Doubao TTS PCM → Opus 流式编码示例
 *
 * 演示完整的流式音频编码链路：
 * 1. Doubao TTS 输出 PCM 格式（24kHz）音频流
 * 2. 使用 prism-media opus.Encoder 将 PCM 流式编码为固定 60ms 帧的 Opus 数据包
 * 3. 使用 OGG Muxer 将 Opus 包封装为可播放的 OGG 文件
 *
 * 环境变量:
 * - DOUBAO_APP_KEY: 火山引擎应用 ID
 * - DOUBAO_ACCESS_TOKEN: 火山引擎访问令牌
 * * 使用方法:
 * npx tsx examples/tts/providers/doubao/pcm-to-opus.ts
 */
import 'dotenv/config';
import { Buffer } from 'node:buffer';
import { writeFileSync } from 'node:fs';
import { createTTS } from 'univoice';
import {
  DEFAULT_TTS_TEXT,
  ensureOutputDir,
  getScriptMeta,
  getTTSConfig,
  timestamp,
} from '../../../utils/common';
import { createOggMuxer } from '../../../utils/ogg-muxer-stream';

const { __dirname, basename } = getScriptMeta(import.meta.url);

// ============================================
// 编码参数配置
// ============================================

/** PCM 采样率（与 TTS 输出一致） */
const SAMPLE_RATE = 24000;

/** Opus 固定帧时长（毫秒） */
const FRAME_DURATION_MS = 60;

/** 声道数（单声道） */
const CHANNELS = 1;

/** PCM 位深（16-bit = 2 bytes/sample） */
const BYTES_PER_SAMPLE = 2;

/** 每帧 PCM 字节数 = 采样率 × 帧时长(秒) × 每采样字节数 */
const FRAME_SIZE_BYTES = (SAMPLE_RATE / 1000) * FRAME_DURATION_MS * BYTES_PER_SAMPLE; // 2880

/** 每帧 PCM 采样数 */
const FRAME_SIZE_SAMPLES = (SAMPLE_RATE / 1000) * FRAME_DURATION_MS; // 1440

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
  console.log(`TTS 格式: PCM (${SAMPLE_RATE} Hz, ${CHANNELS}ch, 16bit)`);
  console.log(
    `Opus 帧: ${FRAME_DURATION_MS}ms (${FRAME_SIZE_SAMPLES} samples/frame, ${FRAME_SIZE_BYTES} bytes/frame)`
  );
  console.log(`输入文本: "${DEFAULT_TTS_TEXT}"\n`);

  // 动态导入 prism-media
  let prismMedia: typeof import('prism-media');
  try {
    prismMedia = await import('prism-media');
  } catch {
    console.error('prism-media 未安装，Opus 编码需要此依赖。\n' + '安装命令: pnpm add prism-media');
    process.exit(1);
  }

  // 创建 Opus 编码器（Transform Stream）
  const encoder = new prismMedia.opus.Encoder({
    frameSize: FRAME_SIZE_SAMPLES,
    channels: CHANNELS,
    rate: SAMPLE_RATE,
  });

  // 收集编码后的 Opus packets
  const opusPackets: Buffer[] = [];
  encoder.on('data', (packet: Buffer) => {
    opusPackets.push(packet);
  });

  // PCM 帧缓冲区：累积 PCM 数据直到凑够一整帧
  let pcmBuffer = Buffer.alloc(0);
  let totalPcmBytes = 0;
  let chunkCount = 0;
  let frameCount = 0;
  const startTime = Date.now();

  try {
    // 从 TTS 流式获取 PCM 音频数据
    for await (const { audioChunk } of tts.speak(DEFAULT_TTS_TEXT, { stream: true })) {
      chunkCount++;
      const chunk = Buffer.from(audioChunk);
      totalPcmBytes += chunk.length;
      console.log(`[${timestamp()}] PCM chunk #${chunkCount}: ${chunk.length} bytes`);

      // 将新数据追加到缓冲区
      pcmBuffer = Buffer.concat([pcmBuffer, chunk]);

      // 每凑够一帧就编码一次
      while (pcmBuffer.length >= FRAME_SIZE_BYTES) {
        const frame = pcmBuffer.subarray(0, FRAME_SIZE_BYTES);
        pcmBuffer = pcmBuffer.subarray(FRAME_SIZE_BYTES);

        frameCount++;
        encoder.write(frame);
        console.log(
          `[${timestamp()}] Opus frame #${frameCount}: ${FRAME_SIZE_BYTES} bytes PCM → 编码中...`
        );
      }
    }

    // 处理尾部不足一帧的数据（用静音填充）
    if (pcmBuffer.length > 0) {
      console.log(
        `[${timestamp()}] 尾部填充: ${pcmBuffer.length} bytes → 补零至 ${FRAME_SIZE_BYTES} bytes`
      );
      const paddedFrame = Buffer.alloc(FRAME_SIZE_BYTES);
      pcmBuffer.copy(paddedFrame);
      encoder.write(paddedFrame);
      frameCount++;
    }

    // 结束编码器（刷新内部缓冲区）
    encoder.end();

    // 等待编码器完成所有数据处理
    await new Promise<void>((resolve) => {
      encoder.on('finish', () => resolve());
      encoder.on('error', (err: Error) => {
        console.error('编码器错误:', err);
        resolve();
      });
    });

    // 统计信息
    const totalTime = Date.now() - startTime;
    const totalOpusSize = opusPackets.reduce((sum, p) => sum + p.length, 0);

    console.log(`\n[${timestamp()}] === 编码统计 ===`);
    console.log(`总耗时: ${totalTime} ms`);
    console.log(`PCM 总大小: ${totalPcmBytes} bytes (${(totalPcmBytes / 1024).toFixed(1)} KB)`);
    console.log(`PCM chunks: ${chunkCount}`);
    console.log(`Opus 帧数: ${frameCount}`);
    console.log(`Opus packets: ${opusPackets.length}`);
    console.log(`Opus 总大小: ${totalOpusSize} bytes (${(totalOpusSize / 1024).toFixed(1)} KB)`);
    console.log(`压缩比: ${(totalPcmBytes / Math.max(totalOpusSize, 1)).toFixed(1)}:1`);

    // 将 Opus 裸包封装为 OGG 容器格式（这样才能被播放器识别和播放）
    console.log(`\n[${timestamp()}] 正在将 Opus 包封装为 OGG 格式...`);

    // 将数组转为 AsyncIterable（createOggMuxer 要求 AsyncIterable 输入）
    async function* opusPacketStream(): AsyncIterable<Buffer> {
      for (const packet of opusPackets) {
        yield packet;
      }
    }

    const oggPages: Buffer[] = [];
    for await (const page of createOggMuxer(opusPacketStream(), {
      sampleRate: SAMPLE_RATE,
      channels: CHANNELS,
      frameSizeMs: FRAME_DURATION_MS,
    })) {
      oggPages.push(page);
    }

    const oggData = Buffer.concat(oggPages);

    // 保存为 .ogg 文件
    const outputFile = ensureOutputDir(__dirname, basename, 'ogg');
    writeFileSync(outputFile, oggData);
    console.log(`OGG 文件已保存至: ${outputFile}`);
    console.log(`OGG 总大小: ${oggData.length} bytes (${(oggData.length / 1024).toFixed(1)} KB)`);

    // 同时也保存裸 Opus 包（供开发者参考/调试使用）
    const rawOpusFile = ensureOutputDir(__dirname, `${basename}-raw`, 'opus');
    const rawOpusData = Buffer.concat(opusPackets);
    writeFileSync(rawOpusFile, rawOpusData);
    console.log(`裸 Opus 包已保存至: ${rawOpusFile} （仅供调试，不可直接播放）`);

    console.log('\n=== 播放提示 ===');
    console.log(`ffplay -autoexit ${outputFile}`);
  } catch (error) {
    console.error('处理失败:', error);
    process.exit(1);
  }
}

main();
