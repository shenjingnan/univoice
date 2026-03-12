/**
 * 豆包 ASR Opus 目录流式识别示例
 *
 * 演示如何从 Opus 数据包目录进行流式语音识别
 *
 * 使用场景:
 * 硬件端不断发送 Opus 裸流，经过 univoice 发送给 ASR 服务识别，实现语音互动功能
 *
 * 技术方案:
 * 1. 读取 Opus 数据包目录
 * 2. 将 Opus 数据包封装成 OGG 容器格式
 * 3. 发送给 Doubao ASR 进行流式识别
 *
 * 用法:
 *   cd examples
 *   npx tsx doubao-asr-stream-opus-demo.ts
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
import { opusPacketsToOggStream } from './utils/opus-packets-to-ogg-stream';

const { __dirname } = getScriptMeta(import.meta.url);
const opusPacketDir = path.join(__dirname, 'output', 'doubao-tts-demo-opus-packets');

async function main() {
  const { appKey, accessKey } = getASRConfig();
  console.log('豆包 ASR Opus 目录流式识别示例');
  console.log('================================');
  console.log(`Opus 数据包目录: ${opusPacketDir}`);
  console.log('');

  try {
    // 使用 createASR 创建实例
    // audioFormat: 'ogg_opus' 表示使用 OGG 容器封装的 Opus 音频
    const asr = createASR({
      provider: 'doubao',
      appKey,
      accessKey,
      audioFormat: 'ogg_opus',
      sampleRate: 48000,
      channel: 1,
    });

    // 将 Opus 数据包目录转换为 OGG 音频流
    // intervalMs: 0 表示无延迟发送，实际场景中可根据网络情况调整
    const oggStream = opusPacketsToOggStream(opusPacketDir, {
      sampleRate: 48000,
      channels: 1,
      intervalMs: 0,
    });

    console.log('开始流式识别...');
    console.time('识别耗时');

    // 使用 listen 方法进行流式识别
    // stream: true 表示启用流式模式，边发边收
    let fullText = '';
    for await (const chunk of asr.listen(oggStream, { stream: true })) {
      const prefix = chunk.isFinal ? '[最终结果]' : '[中间结果]';
      console.log(`${prefix} ${chunk.text}`);

      if (chunk.isFinal) {
        fullText = chunk.text;
      }
    }

    console.timeEnd('识别耗时');
    console.log('');
    console.log(`识别完成! 最终结果: ${fullText}`);
  } catch (error) {
    console.error('识别失败:', error);
    process.exit(1);
  }
}

main();
