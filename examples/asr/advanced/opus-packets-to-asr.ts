/**
 * Opus 数据包转 PCM 并进行 ASR 流式识别示例
 *
 * 演示如何将 Opus 数据包目录解码为 PCM 并进行流式语音识别
 *
 * 工作流程：
 * 1. 读取 Opus 数据包目录
 * 2. 使用 decodeOpusStream 解码 Opus → PCM (16kHz)
 * 3. 使用 asr.listen(stream, { stream: true }) 进行流式识别
 */
import 'univoice/asr/providers';
import { createASR, decodeOpusStream } from 'univoice/asr';
import 'dotenv/config';
import path from 'node:path';
import { getASRConfig, getScriptMeta, readOpusPackets } from '../../utils/common';

const { __dirname } = getScriptMeta(import.meta.url);
const opusPacketsDir = path.join(__dirname, '..', '..', 'output', 'doubao-tts-demo-opus-packets');

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
      audioFormat: {
        sampleRate: 16000,
        bits: 16,
        channel: 1,
      },
    });

    // 创建 PCM 流（从 Opus 数据包转换）
    const audioStream = decodeOpusStream(readOpusPackets(opusPacketsDir), {
      sampleRate: 16000,
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
