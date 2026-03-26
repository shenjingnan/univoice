/**
 * Doubao ASR 流式识别示例
 * 演示 asr.listen(audioPath, { stream: true }) 的使用方式
 */
import 'dotenv/config';
import path from 'node:path';
import 'univoice/asr/providers';
import { createASR } from 'univoice/asr';
import { getASRConfig, getScriptMeta, timestamp } from '../../../utils/common';

const { __dirname } = getScriptMeta(import.meta.url);

async function main() {
  const { appKey, accessKey } = getASRConfig();

  // 音频文件路径
  const audioPath = path.join(__dirname, '..', '..', '..', 'output', 'doubao-tts-demo.mp3');

  console.log(`\n[${timestamp()}] === Doubao ASR 流式识别示例 ===\n`);
  console.log(`音频文件: ${audioPath}\n`);

  const startTime = Date.now();
  let firstChunkTime = 0;
  let chunkCount = 0;
  const textParts: string[] = [];

  try {
    console.log('开始流式语音识别...\n');

    // 创建 ASR 实例
    const asr = createASR({
      provider: 'doubao',
      appKey,
      accessKey,
      language: 'zh-CN',
    });

    // 使用 for await...of 消费流式识别结果
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
