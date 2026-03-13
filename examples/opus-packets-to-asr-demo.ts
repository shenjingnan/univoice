/**
 * Opus 数据包转 PCM 并进行 ASR 流式识别示例
 *
 * 演示如何将 Opus 数据包目录解码为 PCM 并进行流式语音识别
 *
 * 工作流程：
 * 1. 读取 Opus 数据包目录
 * 2. 使用 @discordjs/opus 解码 Opus → PCM (24kHz)
 * 3. 使用 ffmpeg 重采样 24kHz → 16kHz
 * 4. 使用 asr.listen(stream, { stream: true }) 进行流式识别
 *
 * 用法:
 *   cd examples
 *   npx tsx opus-packets-to-asr-demo.ts
 *
 * 注意: app-key 和 access-key 可通过环境变量配置:
 *   ASR_BYTEDANCE_APP_KEY
 *   ASR_BYTEDANCE_ACCESS_KEY
 */

import 'univoice/asr/providers';
import { createASR } from 'univoice/asr';
import 'dotenv/config';
import path from 'node:path';
import { getASRConfig, getScriptMeta } from './utils/common';
import { opusPacketsToPcmStream } from './utils/opus-packets-to-pcm-stream';

const { __dirname } = getScriptMeta(import.meta.url);
const opusPacketsDir = path.join(__dirname, 'output', 'doubao-tts-demo-opus-packets');

async function main() {
  const { appKey, accessKey } = getASRConfig();
  console.log('Opus 数据包转 PCM 进行 ASR 流式识别示例');
  console.log('========================================');
  console.log(`Opus 数据包目录: ${opusPacketsDir}`);
  console.log('');

  try {
    // 使用 createASR 创建实例
    const asr = createASR({
      provider: 'doubao',
      appKey,
      accessKey,
      sampleRate: 16000,
      bits: 16,
      channel: 1,
    });

    // 创建 PCM 流（从 Opus 数据包转换）
    // Opus 数据包由 TTS 生成，采样率为 24000Hz
    // ASR 需要 16000Hz 的 PCM 数据
    const audioStream = opusPacketsToPcmStream(opusPacketsDir, {
      opusSampleRate: 24000, // TTS 生成的 Opus 采样率
      targetSampleRate: 16000, // ASR 需要的采样率
    });

    console.time('识别耗时');
    console.log('开始流式识别...\n');

    let finalText = '';
    for await (const chunk of asr.listen(audioStream, { stream: true })) {
      const prefix = chunk.isFinal ? '[最终]' : '[中间]';
      console.log(`${prefix} ${chunk.text}`);
      if (chunk.isFinal) {
        finalText = chunk.text;
      }
    }

    console.timeEnd('识别耗时');
    console.log('');
    console.log('识别完成!');
    if (finalText) {
      console.log(`最终识别结果: ${finalText}`);
    }
  } catch (error) {
    console.error('识别失败:', error);
    process.exit(1);
  }
}

main();
