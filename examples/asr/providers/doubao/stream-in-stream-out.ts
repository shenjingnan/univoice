/**
 * Doubao ASR - 流式入/流式出示例
 * 演示实时音频流识别的场景
 *
 * 特点:
 * - 使用 WebSocket 二进制协议
 * - 默认 streaming 模式
 * - 边发边收，实时返回识别片段
 *
 * 环境变量:
 * - DOUBAO_APP_KEY: 火山引擎 App Key
 * - DOUBAO_ACCESS_TOKEN: 火山引擎 Access Token
 *
 * 使用方法:
 * npx tsx examples/asr/providers/doubao/stream-in-stream-out.ts
 */
import 'dotenv/config';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import 'univoice/asr/providers';
import { createASR } from 'univoice/asr';
import { getASRConfig, getScriptMeta, timestamp } from '../../../utils/common';

const { __dirname } = getScriptMeta(import.meta.url);

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
  const { appKey, accessKey } = getASRConfig();

  // 音频文件路径 - 使用 TTS 生成的音频文件
  const audioPath = path.join(__dirname, '..', '..', '..', 'output', 'doubao-tts-demo.mp3');

  // 检查文件是否存在
  try {
    await stat(audioPath);
  } catch {
    console.error(`音频文件不存在: ${audioPath}`);
    console.error('请先运行 TTS 示例生成音频文件:');
    console.error('npx tsx examples/tts/providers/doubao/basic.ts');
    process.exit(1);
  }

  console.log(`\n[${timestamp()}] === Doubao ASR - 流式入/流式出 ===`);
  console.log(`场景: 音频流输入 → 实时识别结果输出\n`);
  console.log(`音频文件: ${audioPath}\n`);

  try {
    // 创建 ASR 实例（默认 streaming 模式）
    const asr = createASR({
      provider: 'doubao',
      appKey,
      accessKey,
      language: 'zh-CN',
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
