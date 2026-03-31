/**
 * Doubao ASR - 流式入/流式出示例（Ogg Opus 格式）
 * 使用 Ogg Opus 格式直接流式输入 ASR，无需本地解码
 *
 * 特点:
 * - 使用 createOggMuxer（univoice/asr 内置）将裸 Opus 帧封装为 Ogg Opus 格式
 * - 直接以 Ogg Opus 编码流式发送，无需本地解码为 PCM
 * - WebSocket 二进制协议，边发边收，实时返回识别片段
 *
 * 环境变量:
 * - DOUBAO_APP_KEY: 火山引擎 App Key
 * - DOUBAO_ACCESS_TOKEN: 火山引擎 Access Token
 *
 * 使用方法:
 * npx tsx examples/asr/providers/doubao/ogg-opus-stream-in-stream-out.ts
 */
import 'dotenv/config';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import 'univoice/asr/providers';
import { createASR, createOggMuxer } from 'univoice/asr';
import { getASRConfig, getExamplesRoot, readOpusPackets, timestamp } from '../../../utils/common';

async function main() {
  const { appKey, accessKey } = getASRConfig();

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

  console.log(`\n[${timestamp()}] === Doubao ASR - 流式入/流式出（Ogg Opus 格式）===`);
  console.log(`场景: Opus 数据包 → Ogg Opus 封装 → 流式发送 → 实时识别结果输出\n`);
  console.log(`数据包目录: ${opusDir}\n`);

  try {
    // 创建 ASR 实例，使用 Ogg/Opus 格式（无需本地解码）
    const asr = createASR({
      provider: 'doubao',
      appKey,
      accessKey,
      language: 'zh-CN',
      format: 'ogg',
      codec: 'opus',
      audioFormat: {
        sampleRate: 16000,
      },
    });

    // 将 opus 数据包封装为 Ogg Opus 流
    const audioStream = createOggMuxer(readOpusPackets(opusDir), {
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
