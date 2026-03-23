/**
 * Opus 数据包流式 OGG 封装 + ASR 流式识别示例
 *
 * 演示如何将 Opus 数据包流式封装为 OGG 容器，并直接进行流式 ASR 识别
 *
 * 工作流程：
 * 1. 读取 Opus 数据包目录
 * 2. 使用 createOggMuxer 将 Opus 数据包流式封装为 OGG 页面流
 * 3. 使用 asr.listen(oggStream, { stream: true, format: 'ogg', codec: 'opus' }) 进行流式识别
 *
 * 与 opus-packets-to-asr-demo.ts 的区别：
 * - 本示例直接使用 OGG/Opus 格式发送给 ASR，无需解码为 PCM
 * - 减少了 Opus → PCM 的转换开销
 * - 可能具有更低的延迟
 *
 * 用法:
 *   cd examples
 *   npx tsx opus-packets-stream-to-asr-demo.ts
 *
 * 注意: app-key 和 access-key 可通过环境变量配置:
 *   DOUBAO_APP_KEY
 *   DOUBAO_ACCESS_KEY
 */

import 'univoice/asr/providers';
import { createASR } from 'univoice/asr';
import 'dotenv/config';
import { existsSync, readdirSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { getASRConfig, getScriptMeta } from './utils/common';
import { createOggMuxer } from './utils/ogg-muxer-stream';

const { __dirname } = getScriptMeta(import.meta.url);
const opusPacketsDir = path.join(__dirname, 'output', 'doubao-tts-demo-opus-packets');

/**
 * 从文件名中提取数字用于排序
 */
function extractNumber(filename: string): number {
  const baseName = filename.replace(/\.[^.]+$/, '');
  const match = baseName.match(/^(\d+)/);
  if (match) {
    return Number.parseInt(match[1], 10);
  }
  return Number.POSITIVE_INFINITY;
}

/**
 * 获取目录中按数字排序的 Opus 文件列表
 */
function getSortedOpusFiles(directory: string): string[] {
  const files = readdirSync(directory);
  const opusFiles = files.filter((f) => f.toLowerCase().endsWith('.opus'));

  if (opusFiles.length === 0) {
    throw new Error(`No Opus files found in directory: ${directory}`);
  }

  // 按文件名中的数字排序
  opusFiles.sort((a, b) => extractNumber(a) - extractNumber(b));

  // 返回完整路径
  return opusFiles.map((f) => path.join(directory, f));
}

/**
 * 创建 Opus 数据包流
 */
async function* readOpusPackets(directory: string): AsyncIterable<Buffer> {
  const files = getSortedOpusFiles(directory);
  console.log(`找到 ${files.length} 个 Opus 文件`);

  for (const file of files) {
    const data = await readFile(file);
    yield data;
  }
}

async function main() {
  const { appKey, accessKey } = getASRConfig();
  console.log('Opus 数据包流式 OGG 封装 + ASR 流式识别示例');
  console.log('================================================');
  console.log(`Opus 数据包目录: ${opusPacketsDir}`);
  console.log('');

  // 验证目录存在
  if (!existsSync(opusPacketsDir)) {
    console.error(`错误: Opus 数据包目录不存在: ${opusPacketsDir}`);
    console.error('请先运行 doubao-tts-demo.ts 生成 Opus 数据包');
    process.exit(1);
  }

  try {
    // 使用 createASR 创建实例
    // 配置为 OGG/Opus 格式
    const asr = createASR({
      provider: 'doubao',
      appKey,
      accessKey,
      format: 'ogg', // 使用 OGG 容器格式
      codec: 'opus', // 使用 Opus 编码
      audioFormat: {
        sampleRate: 16000, // OGG Opus 文件声明的采样率
        bits: 16,
        channel: 1,
      },
    });

    // 创建 Opus 数据包流
    const opusPackets = readOpusPackets(opusPacketsDir);

    // 创建 OGG 流（流式封装）
    // TTS 生成的 Opus 采样率为 24000Hz，帧大小为 60ms
    const oggStream = createOggMuxer(opusPackets, {
      sampleRate: 16000, // TTS 生成的采样率
      channels: 1,
      frameSizeMs: 60, // TTS 生成的帧大小
    });

    console.time('识别耗时');
    console.log('开始流式识别...\n');

    let finalText = '';
    for await (const chunk of asr.listen(oggStream, { stream: true })) {
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
