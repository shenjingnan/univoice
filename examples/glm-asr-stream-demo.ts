/**
 * GLM ASR 流式识别示例
 * 演示如何使用 createASR() + asr.listen() 方法进行流式语音识别
 *
 * listen 方法特点：
 * - 实时返回识别结果，适用于长音频场景
 * - 返回 AsyncIterable<ASRStreamChunk>，可通过 for await...of 消费
 * - 每个 chunk 包含 text（文本片段）和 isFinal（是否为最终结果）
 *
 * API 使用方式：
 * - 先通过 createASR() 创建 ASR 实例
 * - 调用 asr.listen() 方法，支持文件路径、Buffer 多种输入
 * - 通过 options.stream 参数控制流式/非流式模式
 */
import 'dotenv/config';
import path from 'node:path';
import 'univoice/asr/providers';
import { createASR } from 'univoice/asr';
import { getScriptMeta, timestamp } from './utils/common';

const { __dirname } = getScriptMeta(import.meta.url);

async function main() {
  const apiKey = process.env.GLM_API_KEY;

  if (!apiKey) {
    console.error('请设置环境变量 GLM_API_KEY');
    process.exit(1);
  }

  // 音频文件路径
  const audioPath = path.join(__dirname, 'output', 'qwen-tts-speak-string.mp3');

  console.log(`\n[${timestamp()}] === GLM ASR 流式识别演示 ===\n`);
  console.log(`音频文件: ${audioPath}\n`);

  const startTime = Date.now();
  let firstChunkTime = 0;
  let chunkCount = 0;
  const textParts: string[] = [];

  try {
    console.log('开始流式语音识别...\n');

    // 创建 ASR 实例
    const asr = createASR({
      provider: 'glm',
      apiKey,
      model: 'glm-asr-2512',
    });

    // 使用 for await...of 消费流式识别结果
    // 新 API: 直接传入文件路径，通过 options.stream 控制流式模式
    for await (const chunk of asr.listen(audioPath, { stream: true })) {
      chunkCount++;

      if (chunkCount === 1) {
        firstChunkTime = Date.now();
        console.log(`[${timestamp()}] [首块延迟] ${firstChunkTime - startTime} ms\n`);
      }

      // 显示识别状态和文本
      const status = chunk.isFinal ? '最终' : '中间';
      console.log(`[${timestamp()}] [${status}] ${chunk.text}`);

      // 收集最终结果的文本
      if (chunk.isFinal && chunk.text) {
        textParts.push(chunk.text);
      }
    }

    const totalTime = Date.now() - startTime;
    const fullText = textParts.join('');

    console.log(`\n[${timestamp()}] === 统计信息 ===`);
    console.log(`总耗时: ${totalTime} ms`);
    console.log(`总块数: ${chunkCount}`);
    console.log(`\n=== 完整识别结果 ===`);
    console.log(fullText || '(无识别结果)');
  } catch (error) {
    console.error('语音识别失败:', error);
    process.exit(1);
  }
}

main();
