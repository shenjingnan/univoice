/**
 * 科大讯飞 ASR - 流式入/流式出示例（Opus 数据包）
 * 使用本地 opus 数据包模拟实时语音流识别
 *
 * 特点:
 * - 使用本地 opus 数据包（16kHz, 60ms 帧）解码为 PCM 后模拟实时音频流
 * - 通过 decodeOpusStream（univoice/asr 内置）将裸 Opus 帧解码为 PCM
 * - WebSocket 二进制协议，边发边收，实时返回识别片段
 *
 * 环境变量:
 * - XFYUN_APP_ID: 科大讯飞 AppID
 * - XFYUN_API_KEY: 科大讯飞 API Key
 * - XFYUN_API_SECRET: 科大讯飞 API Secret
 *
 * 使用方法:
 * npx tsx examples/asr/providers/xfyun/stream-in-stream-out.ts
 */
import 'dotenv/config';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import 'univoice/asr/providers';
import { createASR, decodeOpusStream } from 'univoice/asr';
import {
  getExamplesRoot,
  getXfyunASRConfig,
  readOpusPackets,
  timestamp,
} from '../../../utils/common';

async function main() {
  const { appId, apiKey, apiSecret } = getXfyunASRConfig();

  // opus 数据包目录
  const examplesRoot = getExamplesRoot(import.meta.url);
  const opusDir = path.join(examplesRoot, 'assets/16khz_opus_60ms_opus-packets');

  // 检查目录是否存在
  try {
    const dirStat = await stat(opusDir);
    if (!dirStat.isDirectory()) {
      throw new Error('not a directory');
    }
  } catch {
    console.error(`Opus 数据包目录不存在: ${opusDir}`);
    process.exit(1);
  }

  console.log(`\n[${timestamp()}] === 科大讯飞 ASR - 流式入/流式出（Opus 数据包）===`);
  console.log(`场景: Opus 数据包流式发送 → 实时识别结果输出\n`);
  console.log(`数据包目录: ${opusDir}\n`);

  try {
    // 创建 ASR 实例，使用 PCM 格式（opus 解码后的数据）
    const asr = createASR({
      provider: 'xfyun',
      appId,
      apiKey,
      apiSecret,
      language: 'zh-CN',
      dwa: 'wpgs',
    });

    // 将 opus 数据包解码为 PCM 流（16kHz, 16bit, mono）
    const audioStream = decodeOpusStream(readOpusPackets(opusDir), {
      sampleRate: 16000,
    });

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
