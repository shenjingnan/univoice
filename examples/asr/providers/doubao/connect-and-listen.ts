/**
 * Doubao ASR - 连接预建立示例（Opus 数据包）
 * 演示 connect() → connection.listen() → connection.close() 完整流程
 *
 * 适用场景:
 * - 需要降低首次识别延迟（预先建立 WebSocket 连接）
 * - 多次识别复用同一连接
 *
 * 环境变量:
 * - DOUBAO_APP_KEY: 豆包应用 App Key
 * - DOUBAO_ACCESS_TOKEN: 豆包访问令牌
 *
 * 使用方法:
 * npx tsx examples/asr/providers/doubao/connect-and-listen.ts
 */
import 'dotenv/config';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { DoubaoASR, decodeOpusStream } from 'univoice/asr';
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

  console.log(`\n[${timestamp()}] === Doubao ASR - 连接预建立 ===`);
  console.log(`场景: 预建立连接 → 流式识别 → 关闭连接\n`);
  console.log(`数据包目录: ${opusDir}\n`);

  try {
    // 直接实例化 DoubaoASR
    const asr = new DoubaoASR({
      appKey,
      accessKey,
      language: 'zh-CN',
    });

    // 第一阶段: 预建立连接
    const connectStartTime = Date.now();
    console.log(`[${timestamp()}] 正在建立连接...`);

    const connection = await asr.connect();

    const connectTime = Date.now() - connectStartTime;
    console.log(`[${timestamp()}] 连接已建立 (${connectTime} ms)\n`);

    // 第二阶段: 在已建立的连接上进行流式识别
    const audioStream = decodeOpusStream(readOpusPackets(opusDir), { sampleRate: 16000 });
    const listenStartTime = Date.now();
    let firstResultTime = 0;
    let chunkCount = 0;
    const results: string[] = [];

    console.log(`[${timestamp()}] 开始流式识别...\n`);

    for await (const chunk of connection.listen(audioStream, { stream: true })) {
      chunkCount++;
      if (chunkCount === 1) {
        firstResultTime = Date.now();
        console.log(`[${timestamp()}] [首字延迟] ${firstResultTime - listenStartTime} ms\n`);
      }

      const status = chunk.isFinal ? '最终' : '中间';
      console.log(`[${timestamp()}] [${status}] ${chunk.text || '(空)'}`);

      if (chunk.isFinal && chunk.text) {
        results.push(chunk.text);
      }
    }

    const endTime = Date.now();

    // 第三阶段: 关闭连接
    connection.close();
    console.log(`\n[${timestamp()}] 连接已关闭`);

    console.log(`\n[${timestamp()}] === 统计信息 ===`);
    console.log(`连接预建立耗时: ${connectTime} ms`);
    console.log(`首字延迟: ${firstResultTime - listenStartTime} ms`);
    console.log(`总耗时: ${endTime - connectStartTime} ms`);
    console.log(`结果块数: ${chunkCount}`);
    console.log(`\n完整识别结果: ${results.join('') || '(无)'}`);
  } catch (error) {
    console.error('语音识别失败:', error);
    process.exit(1);
  }
}

main();
