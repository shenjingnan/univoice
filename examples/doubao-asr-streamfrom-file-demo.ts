/**
 * Doubao ASR listen 文件路径示例
 * 演示如何使用 listen(audioPath) 直接传入音频文件路径
 *
 * listen 文件路径特点:
 * - 简化调用：无需手动读取文件或创建流
 * - 自动处理：内部自动将文件转换为 PCM 流
 * - 实时返回：边发送边接收识别结果
 */
import 'dotenv/config';
import path from 'node:path';
import { listen } from 'univoice';
import { getASRConfig, getScriptMeta, timestamp } from './utils/common';

const { __dirname } = getScriptMeta(import.meta.url);

async function main() {
  const { appKey, accessKey } = getASRConfig();

  // 音频文件路径
  const audioPath = path.join(__dirname, 'output', 'doubao-tts-demo.mp3');

  console.log(`\n[${timestamp()}] === ASR listen 文件路径演示 ===\n`);
  console.log(`音频文件: ${audioPath}\n`);

  const startTime = Date.now();
  let firstChunkTime = 0;
  let chunkCount = 0;
  const textParts: string[] = [];

  try {
    console.log('开始流式语音识别...\n');

    // 使用 listen(audioPath) 直接传入文件路径（流式模式）
    for await (const chunk of listen(audioPath, {
      provider: 'doubao',
      appKey,
      accessKey,
      mode: 'streaming',
      language: 'zh-CN',
      stream: true,
    })) {
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
