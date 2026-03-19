/**
 * Qwen ASR 流式音频输入示例
 *
 * 演示如何直接使用音频流（AudioStream）作为输入进行流式语音识别
 * 通过模拟实时音频流场景，展示流式输入的实际应用
 *
 * 核心特点：
 * - 直接使用 AudioStream（AsyncIterable<Buffer>）作为输入
 * - 模拟实时音频流：从文件读取音频数据，按时间间隔分块发送
 * - 使用 asr.listen(audioStream, { stream: true }) 进行流式识别
 * - 实时显示识别结果（中间结果和最终结果）
 *
 * 用法:
 *   cd examples
 *   npx tsx qwen-asr-stream-input-demo.ts
 *
 * 注意: API Key 可通过环境变量配置:
 *   QWEN_API_KEY 或 QWEN_API_KEY
 */
import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import 'univoice/asr/providers';
import type { AudioStream } from 'univoice/asr';
import { createASR } from 'univoice/asr';
import { getScriptMeta, timestamp } from './utils/common';

const { __dirname } = getScriptMeta(import.meta.url);

/**
 * 创建模拟实时音频流的选项
 */
interface SimulatedStreamOptions {
  /** 每块音频的时长（毫秒），默认 100ms */
  chunkDurationMs?: number;
  /** 发送间隔（毫秒），默认与 chunkDurationMs 相同，模拟实时输入 */
  intervalMs?: number;
  /** 是否显示详细的流发送信息 */
  verbose?: boolean;
}

/**
 * 创建模拟实时音频流
 *
 * 从音频文件读取数据，按指定时间间隔分块发送，模拟实时音频输入场景
 *
 * 对于 MP3 文件，由于是压缩格式，我们按固定字节大小分块
 * 对于 PCM 文件，可以根据采样率和位深计算精确的时间分块
 *
 * @param filePath 音频文件路径
 * @param options 流选项
 * @returns 音频流（AsyncIterable<Buffer>）
 */
async function* createSimulatedAudioStream(
  filePath: string,
  options?: SimulatedStreamOptions
): AudioStream {
  const { chunkDurationMs = 100, intervalMs, verbose = false } = options || {};
  const effectiveInterval = intervalMs ?? chunkDurationMs;

  // 读取整个文件
  const buffer = await readFile(filePath);

  // 计算分块大小
  // 对于 MP3 文件，假设平均比特率为 128kbps
  // 128kbps = 16000 bytes/s = 16 bytes/ms
  // 对于 100ms 的块，约 1600 字节
  // 这里使用 4096 字节作为默认块大小，大约 200-300ms 的音频
  const chunkSize = 4096;
  const totalChunks = Math.ceil(buffer.length / chunkSize);

  if (verbose) {
    console.log(`[流创建] 文件大小: ${buffer.length} 字节`);
    console.log(`[流创建] 分块大小: ${chunkSize} 字节`);
    console.log(`[流创建] 总块数: ${totalChunks}`);
    console.log(`[流创建] 发送间隔: ${effectiveInterval} ms`);
  }

  for (let i = 0; i < totalChunks; i++) {
    const start = i * chunkSize;
    const end = Math.min(start + chunkSize, buffer.length);
    const chunk = buffer.subarray(start, end);

    if (verbose) {
      console.log(`[流发送] 块 ${i + 1}/${totalChunks}, 大小: ${chunk.length} 字节`);
    }

    yield chunk;

    // 如果不是最后一块，等待指定的间隔
    if (i < totalChunks - 1 && effectiveInterval > 0) {
      await new Promise((resolve) => setTimeout(resolve, effectiveInterval));
    }
  }

  if (verbose) {
    console.log('[流完成] 所有音频块已发送');
  }
}

async function main() {
  const apiKey = process.env.QWEN_API_KEY || process.env.QWEN_API_KEY;

  if (!apiKey) {
    console.error('请设置环境变量 QWEN_API_KEY 或 QWEN_API_KEY');
    process.exit(1);
  }

  // 音频文件路径（使用 Qwen TTS 生成的 MP3 文件）
  const audioPath = path.join(__dirname, 'output', 'qwen-tts-speak-string.mp3');

  console.log('\n========================================');
  console.log('Qwen ASR 流式音频输入示例');
  console.log('========================================');
  console.log(`音频文件: ${audioPath}`);
  console.log(`模式: 直接使用 AudioStream 作为输入`);
  console.log('');

  const startTime = Date.now();
  let firstChunkTime = 0;
  let chunkCount = 0;
  let intermediateCount = 0;
  let finalCount = 0;
  const textParts: string[] = [];

  try {
    console.log('创建 ASR 实例...\n');

    // 创建 ASR 实例
    // 注意：当使用 AudioStream 作为输入时，需要明确指定采样率
    // 对于 MP3 文件，paraformer-realtime-v2 模型会自动检测采样率
    // 但使用流式输入时，最好显式指定正确的采样率
    const asr = createASR({
      provider: 'qwen',
      apiKey,
      model: 'paraformer-realtime-v2',
      language: 'zh-CN',
      format: 'mp3',
      audioFormat: {
        sampleRate: 24000, // 匹配音频文件的实际采样率
      },
    });

    console.log('创建模拟实时音频流...\n');

    // 创建模拟实时音频流
    // 参数说明：
    // - chunkDurationMs: 每块音频的时长（仅用于计算块大小）
    // - intervalMs: 发送间隔，模拟实时输入（设为 0 表示尽快发送）
    // - verbose: 显示详细的流发送信息
    const audioStream = createSimulatedAudioStream(audioPath, {
      chunkDurationMs: 100,
      intervalMs: 50, // 50ms 间隔，模拟比实时更快的发送
      verbose: false,
    });

    console.log('开始流式语音识别...\n');
    console.log('提示: 中间结果会实时更新，最终结果标记为 [最终]\n');
    console.log('----------------------------------------');

    // 使用 for await...of 消费流式识别结果
    // 关键：直接传入 AudioStream，而非文件路径
    for await (const chunk of asr.listen(audioStream, { stream: true })) {
      chunkCount++;

      if (chunkCount === 1) {
        firstChunkTime = Date.now();
        console.log(`\n[${timestamp()}] [首块延迟] ${firstChunkTime - startTime} ms\n`);
      }

      // 显示识别状态和文本
      if (chunk.isFinal) {
        finalCount++;
        console.log(`[${timestamp()}] [最终] ${chunk.text}`);

        // 收集最终结果的文本
        if (chunk.text) {
          textParts.push(chunk.text);
        }
      } else {
        intermediateCount++;
        // 中间结果用单行更新（可选：使用 readline 实现更优雅的更新）
        process.stdout.write(`\r[${timestamp()}] [中间] ${chunk.text}`);
      }
    }

    // 确保换行
    console.log('\n----------------------------------------');

    const totalTime = Date.now() - startTime;
    const fullText = textParts.join('');

    console.log(`\n[${timestamp()}] === 统计信息 ===`);
    console.log(`总耗时: ${totalTime} ms`);
    console.log(`识别结果块数: ${chunkCount}`);
    console.log(`  - 中间结果: ${intermediateCount}`);
    console.log(`  - 最终结果: ${finalCount}`);

    console.log(`\n=== 完整识别结果 ===`);
    console.log(fullText || '(无识别结果)');
  } catch (error) {
    console.error('语音识别失败:', error);
    process.exit(1);
  }
}

main();
