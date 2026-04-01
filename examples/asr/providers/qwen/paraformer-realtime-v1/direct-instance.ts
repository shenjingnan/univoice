/**
 * Paraformer Realtime v1 - 直接实例化示例（Opus 数据包）
 * 演示不使用工厂函数 createASR，直接 new QwenASR() 创建实例
 *
 * 特点:
 * - 直接导入 QwenASR 类并实例化，无需注册 provider
 * - 使用本地 opus 数据包（16kHz, 60ms 帧）解码为 PCM 后模拟实时音频流
 * - 通过 decodeOpusStream（univoice/asr 内置）将裸 Opus 帧解码为 PCM
 * - 支持双向流式通信，边发边收
 * - v1 特点：支持 16kHz 采样率、中文识别
 *
 * 环境变量:
 * - QWEN_API_KEY: 阿里云 DashScope API Key
 *
 * 使用方法:
 * npx tsx examples/asr/providers/qwen/paraformer-realtime-v1/direct-instance.ts
 */
import 'dotenv/config';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { decodeOpusStream, QwenASR } from 'univoice/asr';
import {
  getExamplesRoot,
  getQwenApiKey,
  readOpusPackets,
  timestamp,
} from '../../../../utils/common';

async function main() {
  const apiKey = getQwenApiKey();

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

  console.log(
    `\n[${timestamp()}] === Paraformer Realtime v1 - 直接实例化 / 流式入/流式出（Opus 数据包）===`
  );
  console.log(`场景: 直接 new QwenASR() → Opus 数据包流式发送 → 实时识别结果输出\n`);
  console.log(`数据包目录: ${opusDir}\n`);

  try {
    // 直接实例化 QwenASR，不使用 createASR 工厂函数
    const asr = new QwenASR({
      apiKey,
      model: 'paraformer-realtime-v1',
      // Qwen 专用参数（可选）:
      // enableItn: true,         // 启用逆文本标准化（数字转阿拉伯数字等）
      // enablePunc: true,        // 启用标点预测
      // enableWords: true,       // 启用词级时间戳
      // audioFormat: { sampleRate: 16000 },  // 指定音频采样率
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

    // 流式识别 - 用法与工厂函数创建的实例完全一致
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
