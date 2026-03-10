/**
 * Doubao ASR streamFrom 文件路径示例
 * 演示如何使用 streamFrom(audioPath) 直接传入音频文件路径
 *
 * streamFrom 文件路径特点:
 * - 简化调用：无需手动读取文件或创建流
 * - 自动处理：内部自动将文件转换为 PCM 流
 * - 实时返回：边发送边接收识别结果
 */
import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { streamFrom } from 'univoice';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 格式化时间戳
 */
function timestamp(): string {
  const now = new Date();
  const ms = String(now.getMilliseconds()).padStart(3, '0');
  const time = now.toTimeString().split(' ')[0];
  return `${time}.${ms}`;
}

async function main() {
  // 从环境变量获取配置
  const appKey = process.env.ASR_BYTEDANCE_APP_KEY;
  const accessKey = process.env.ASR_BYTEDANCE_ACCESS_KEY;

  if (!appKey || !accessKey) {
    console.error('请设置环境变量 ASR_BYTEDANCE_APP_KEY 和 ASR_BYTEDANCE_ACCESS_KEY');
    process.exit(1);
  }

  // 音频文件路径
  const audioPath = path.join(__dirname, 'output', 'doubao-tts-demo.mp3');

  console.log(`\n[${timestamp()}] === ASR streamFrom 文件路径演示 ===\n`);
  console.log(`音频文件: ${audioPath}\n`);

  const startTime = Date.now();
  let firstChunkTime = 0;
  let chunkCount = 0;
  const textParts: string[] = [];

  try {
    console.log('开始流式语音识别...\n');

    // 使用 streamFrom(audioPath) 直接传入文件路径
    for await (const chunk of streamFrom(audioPath, {
      provider: 'doubao',
      appKey,
      accessKey,
      mode: 'streaming',
      language: 'zh-CN',
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
