/**
 * 科大讯飞 ASR - 流式入/流式出示例（PCM 文件）
 * 使用本地 PCM 文件模拟实时语音流识别
 *
 * 特点:
 * - 直接读取 PCM 文件（16kHz, 16bit, mono），无需解码
 * - 启用动态修正（dwa: 'wpgs'），支持中间结果动态修正
 * - WebSocket 二进制协议，边发边收，实时返回累积识别结果
 *
 * 环境变量:
 * - XFYUN_APP_ID: 科大讯飞 AppID
 * - XFYUN_API_KEY: 科大讯飞 API Key
 * - XFYUN_API_SECRET: 科大讯飞 API Secret
 *
 * 使用方法:
 * npx tsx examples/asr/providers/xfyun/pcm-stream-in-stream-out.ts
 */
import 'dotenv/config';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import 'univoice/asr/providers';
import { createASR } from 'univoice/asr';
import { getExamplesRoot, getXfyunASRConfig, timestamp } from '../../../utils/common';

/**
 * 将 Node.js ReadStream 包装为 AsyncIterable<Buffer>
 * @param filePath - 文件路径
 * @param highWaterMark - 每次读取的字节数，默认 1280（讯飞建议的 40ms PCM 数据量）
 */
async function* pcmFileStream(filePath: string, highWaterMark = 1280): AsyncIterable<Buffer> {
  const stream = createReadStream(filePath, { highWaterMark });
  for await (const chunk of stream) {
    yield Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
  }
}

async function main() {
  const { appId, apiKey, apiSecret } = getXfyunASRConfig();

  // PCM 文件路径
  const examplesRoot = getExamplesRoot(import.meta.url);
  const pcmFile = path.join(examplesRoot, 'assets/16k_10.pcm');

  console.log(`\n[${timestamp()}] === 科大讯飞 ASR - 流式入/流式出（PCM 文件）===`);
  console.log(`场景: PCM 文件流式发送 → 实时识别结果输出（含动态修正）\n`);
  console.log(`PCM 文件: ${pcmFile}\n`);

  try {
    // 创建 ASR 实例，启用动态修正
    const asr = createASR({
      provider: 'xfyun',
      appId,
      apiKey,
      apiSecret,
      language: 'zh-CN',
      dwa: 'wpgs',
    });

    // 从 PCM 文件创建音频流
    const audioStream = pcmFileStream(pcmFile);

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
    console.log(`首字延迟: ${firstResultTime ? firstResultTime - startTime : 'N/A'} ms`);
    console.log(`结果块数: ${chunkCount}`);
    console.log(`\n完整识别结果: ${results.join('') || '(无)'}`);
  } catch (error) {
    console.error('语音识别失败:', error);
    process.exit(1);
  }
}

main();
