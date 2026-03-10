/**
 * 豆包 ASR PCM 目录流式识别示例
 *
 * 演示如何从 PCM 文件目录进行流式语音识别
 *
 * 用法:
 *   cd examples
 *   npx tsx doubao-asr-stream-pcm-demo.ts
 *
 * 注意: app-key 和 access-key 可通过环境变量配置:
 *   ASR_BYTEDANCE_APP_KEY
 *   ASR_BYTEDANCE_ACCESS_KEY
 */

import { createASR } from '@/asr';
import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pcmDirectoryToAudioStream } from './utils/pcm-directory-to-stream';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pcmFileDir = path.join(__dirname, 'output', 'doubao-tts-stream-chunks');

// 命令行参数优先，否则使用环境变量
const finalAppKey = process.env.ASR_BYTEDANCE_APP_KEY;
const finalAccessKey = process.env.ASR_BYTEDANCE_ACCESS_KEY;

async function main() {
  console.log('豆包 ASR PCM 目录流式识别示例');
  console.log('============================');
  console.log(`PCM 目录: ${pcmFileDir}`);
  console.log('');

  try {
    // 使用 createASR 创建实例
    const asr = createASR({
      provider: 'doubao',
      appKey: finalAppKey,
      accessKey: finalAccessKey,
      mode: 'streaming',
      sampleRate: 16000,
      bits: 16,
      channel: 1,
    });

    if (!asr.streamFrom) {
      throw new Error('Provider does not support streamFrom');
    }

    const audioStream = pcmDirectoryToAudioStream(pcmFileDir, { intervalMs: 0 });

    for await (const chunk of asr.streamFrom(audioStream)) {
      console.log(`[识别结果] isFinal: ${chunk.isFinal}, text: ${chunk.text}`);
    }

    console.log('');
    console.log('识别完成!');
  } catch (error) {
    console.error('识别失败:', error);
    process.exit(1);
  }
}

main();
