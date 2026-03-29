/**
 * Paraformer Realtime v2 - 流式入/流式出示例
 * 演示实时音频流识别的场景
 *
 * 模型特点:
 * - 支持多语言识别
 * - 支持任意采样率
 * - 推荐作为默认选择
 *
 * 环境变量:
 * - QWEN_API_KEY: 阿里云 DashScope API Key
 *
 * 使用方法:
 * npx tsx examples/asr/providers/qwen/paraformer-realtime-v2/stream-in-stream-out.ts
 */
import 'dotenv/config';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import 'univoice/asr/providers';
import { createASR } from 'univoice/asr';
import { getQwenApiKey, getScriptMeta, timestamp } from '../../../../utils/common';

const { __dirname } = getScriptMeta(import.meta.url);

// 固定使用 paraformer-realtime-v2 模型
const MODEL = 'paraformer-realtime-v2';

/**
 * 将音频文件模拟为音频流
 * @param audioPath 音频文件路径
 * @param chunkSize 每次发送的块大小（字节），默认 4096
 * @param delay 每次发送的延迟（毫秒），默认 50ms
 */
async function* mockAudioStream(
  audioPath: string,
  chunkSize = 4096,
  delay = 50
): AsyncIterable<Buffer> {
  const fileStream = createReadStream(audioPath, { highWaterMark: chunkSize });

  for await (const chunk of fileStream) {
    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
    yield Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
  }
}

async function main() {
  const apiKey = getQwenApiKey();

  // 音频文件路径 - 使用 TTS 生成的音频文件
  const audioPath = path.join(__dirname, '..', '..', '..', '..', 'output', 'qwen-tts-demo.mp3');

  // 检查文件是否存在
  try {
    await stat(audioPath);
  } catch {
    console.error(`音频文件不存在: ${audioPath}`);
    console.error('请先运行 TTS 示例生成音频文件:');
    console.error('npx tsx examples/tts/providers/qwen/basic.ts');
    process.exit(1);
  }

  console.log(`\n[${timestamp()}] === Paraformer Realtime v2 - 流式入/流式出 ===`);
  console.log(`模型: ${MODEL}`);
  console.log(`场景: 音频流输入 → 实时识别结果输出\n`);
  console.log(`音频文件: ${audioPath}\n`);

  try {
    // 创建 ASR 实例
    const asr = createASR({
      provider: 'qwen',
      apiKey,
      model: MODEL,
    });

    // 创建模拟音频流
    const audioStream = mockAudioStream(audioPath);

    const startTime = Date.now();
    let firstResultTime = 0;
    let chunkCount = 0;
    const results: string[] = [];

    console.log(`[${timestamp()}] 开始流式识别...\n`);

    // 流式识别 - 边发边收
    for await (const chunk of asr.listen(audioStream, { stream: true })) {
      chunkCount++;
      if (chunkCount === 1) {
        firstResultTime = Date.now();
        console.log(`[${timestamp()}] [首字延迟] ${firstResultTime - startTime} ms\n`);
      }

      const status = chunk.isFinal ? '最终' : '中间';
      console.log(`[${timestamp()}] [${status}] ${chunk.text || '(空)'}`);

      if (chunk.isFinal && chunk.text) {
        results.push(chunk.text);
      }
    }

    const endTime = Date.now();

    console.log(`\n[${timestamp()}] === 统计信息 ===`);
    console.log(`总耗时: ${endTime - startTime} ms`);
    console.log(`首字延迟: ${firstResultTime - startTime} ms`);
    console.log(`结果块数: ${chunkCount}`);
    console.log(`\n完整识别结果: ${results.join('') || '(无)'}`);
  } catch (error) {
    console.error('语音识别失败:', error);
    process.exit(1);
  }
}

main();
