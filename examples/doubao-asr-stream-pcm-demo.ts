#!/usr/bin/env npx tsx
/**
 * 豆包 ASR PCM 目录流式识别示例
 *
 * 演示如何从 PCM 文件目录进行流式语音识别
 *
 * 用法:
 *   npx tsx examples/doubao-asr-stream-pcm-demo.ts \
 *     --dir /path/to/pcm/files
 *
 * 注意: app-key 和 access-key 可通过环境变量配置:
 *   ASR_BYTEDANCE_APP_KEY
 *   ASR_BYTEDANCE_ACCESS_KEY
 */

import 'dotenv/config';
import { parseArgs } from 'node:util';
import { createASR, streamFrom } from '@/asr';
import { pcmDirectoryToAudioStream } from './utils/pcm-directory-to-stream';

// 从环境变量获取默认值
const defaultAppKey = process.env.ASR_BYTEDANCE_APP_KEY;
const defaultAccessKey = process.env.ASR_BYTEDANCE_ACCESS_KEY;

const {
  values: { dir = '', 'app-key': appKey, 'access-key': accessKey, help },
} = parseArgs({
  options: {
    dir: {
      type: 'string',
      short: 'd',
      description: 'PCM 文件目录路径',
    },
    'app-key': {
      type: 'string',
      description: '豆包 App Key',
    },
    'access-key': {
      type: 'string',
      description: '豆包 Access Key',
    },
    help: {
      type: 'boolean',
      short: 'h',
      description: '显示帮助信息',
    },
  },
  strict: true,
});

if (help) {
  console.log(`
豆包 ASR PCM 目录流式识别示例

用法:
  npx tsx examples/doubao-asr-stream-pcm-demo.ts [选项]

选项:
  --dir, -d <path>       PCM 文件目录路径 (必需)
  --app-key <key>        豆包 App Key (可由环境变量 ASR_BYTEDANCE_APP_KEY 配置)
  --access-key <key>     豆包 Access Key (可由环境变量 ASR_BYTEDANCE_ACCESS_KEY 配置)
  --help, -h             显示帮助信息

环境变量:
  ASR_BYTEDANCE_APP_KEY     豆包 App Key
  ASR_BYTEDANCE_ACCESS_KEY  豆包 Access Key

示例:
  # 使用环境变量配置密钥
  npx tsx examples/doubao-asr-stream-pcm-demo.ts \\
    --dir ./examples/output/doubao-tts-stream-chunks

  # 使用命令行参数覆盖环境变量
  npx tsx examples/doubao-asr-stream-pcm-demo.ts \\
    --dir ./examples/output/doubao-tts-stream-chunks \\
    --app-key YOUR_APP_KEY \\
    --access-key YOUR_ACCESS_KEY
`);
  process.exit(0);
}

// 命令行参数优先，否则使用环境变量
const finalAppKey = appKey || defaultAppKey;
const finalAccessKey = accessKey || defaultAccessKey;

if (!dir || !finalAppKey || !finalAccessKey) {
  console.error('错误: 请提供 --dir 参数，并确保设置了 app-key 和 access-key');
  console.error('可以通过环境变量或命令行参数配置:');
  console.error('  环境变量: ASR_BYTEDANCE_APP_KEY, ASR_BYTEDANCE_ACCESS_KEY');
  console.error('  命令行参数: --app-key, --access-key');
  console.error('使用 --help 查看帮助信息');
  process.exit(1);
}

async function main() {
  console.log('豆包 ASR PCM 目录流式识别示例');
  console.log('============================');
  console.log(`PCM 目录: ${dir}`);
  console.log('');

  try {
    // 方式1: 使用快捷函数 streamFrom
    console.log('方式1: 使用 streamFrom 快捷函数');
    console.log('----------------------------------------');

    const audioStream1 = pcmDirectoryToAudioStream(dir, { intervalMs: 100 });

    for await (const chunk of streamFrom(audioStream1, {
      provider: 'doubao',
      appKey: finalAppKey,
      accessKey: finalAccessKey,
      mode: 'streaming',
      sampleRate: 16000,
      bits: 16,
      channel: 1,
    })) {
      console.log(`[识别结果] isFinal: ${chunk.isFinal}, text: ${chunk.text}`);
      if (chunk.segment) {
        console.log(
          `  分段: [${chunk.segment.start}ms - ${chunk.segment.end}ms] ${chunk.segment.text}`
        );
      }
    }

    console.log('');
    console.log('方式2: 使用 createASR + streamFrom');
    console.log('----------------------------------------');

    // 方式2: 使用 createASR 创建实例
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

    const audioStream2 = pcmDirectoryToAudioStream(dir!, { intervalMs: 100 });

    for await (const chunk of asr.streamFrom(audioStream2, 100)) {
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
