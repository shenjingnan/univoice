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
 *   DOUBAO_APP_KEY
 *   DOUBAO_ACCESS_KEY
 */

import 'univoice/asr/providers';
import { createASR } from 'univoice/asr';
import 'dotenv/config';
import path from 'node:path';
import { getASRConfig, getScriptMeta } from './utils/common';
import { pcmDirectoryToAudioStream } from './utils/pcm-directory-to-stream';

const { __dirname } = getScriptMeta(import.meta.url);
const pcmFileDir = path.join(__dirname, 'output', 'doubao-tts-stream-chunks');

async function main() {
  const { appKey, accessKey } = getASRConfig();
  console.log('豆包 ASR PCM 目录流式识别示例');
  console.log('============================');
  console.log(`PCM 目录: ${pcmFileDir}`);
  console.log('');

  try {
    // 使用 createASR 创建实例（async 为默认模式，性能最优）
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

    const audioStream = pcmDirectoryToAudioStream(pcmFileDir, { intervalMs: 0 });

    console.time('listen');
    for await (const chunk of asr.listen(audioStream, { stream: true })) {
      console.log(`[识别结果] isFinal: ${chunk.isFinal}, text: ${chunk.text}`);
    }
    console.timeEnd('listen');
    console.log('');
    console.log('识别完成!');
  } catch (error) {
    console.error('识别失败:', error);
    process.exit(1);
  }
}

main();
