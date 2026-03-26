/**
 * ASR listen 流式模式示例
 * 演示 asr.listen(audioPath, { stream: true }) 的使用方式
 *
 * 流式模式特点:
 * - 输入完整音频，实时返回识别片段
 * - 适合长音频，可以更早看到识别结果
 */
import 'dotenv/config';
import path from 'node:path';
import 'univoice/asr/providers';
import { createASR } from 'univoice/asr';
import { getASRConfig, getScriptMeta, timestamp } from '../../utils/common';

const { __dirname } = getScriptMeta(import.meta.url);

async function main() {
  // 使用 ogg/opus 格式的音频文件
  const audioPath = path.join(__dirname, '..', '..', 'output', 'doubao-tts-demo.ogg');

  console.log(`[${timestamp()}] === ASR listen 流式模式演示 ===`);
  console.log(`音频文件: ${audioPath}\n`);

  const { appKey, accessKey } = getASRConfig();
  const startTime = Date.now();
  let firstChunkTime = 0;
  let chunkCount = 0;
  const textParts: string[] = [];

  // 创建 ASR 实例（async 为默认模式，性能最优）
  const asr = createASR({
    provider: 'doubao',
    appKey,
    accessKey,
    language: 'zh-CN',
  });

  console.log('开始流式识别...\n');

  // 流式调用，实时获取识别片段
  for await (const chunk of asr.listen(audioPath, { stream: true })) {
    chunkCount++;

    // 记录首块延迟
    if (chunkCount === 1) {
      firstChunkTime = Date.now();
      console.log(`[${timestamp()}] 首块延迟: ${firstChunkTime - startTime} ms\n`);
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
  console.log(`\n完整识别结果: ${fullText || '(无识别结果)'}`);
}

main().catch((error) => {
  console.error('语音识别失败:', error);
  process.exit(1);
});
