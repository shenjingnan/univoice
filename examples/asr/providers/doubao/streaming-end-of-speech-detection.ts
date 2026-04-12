/**
 * Doubao ASR - 流式端点检测示例（VAD / End-of-Speech）
 *
 * 核心演示内容：
 * 1. 使用 decodeOpusStream 将 Opus 数据包解码为 PCM 音频流
 * 2. 展示 ASR 实时返回中间识别结果
 * 3. 【重点】展示 VAD 端点检测：ASR 判断用户说完话后返回 isFinal=true，
 *    并附带 segment 信息（含 start_time 和 end_time 时间戳）
 *
 * 场景说明：
 * - 音频数据：本地 opus 数据包（16kHz），通过 decodeOpusStream 解码为 PCM 流
 * - 编码格式：PCM（Opus → PCM 解码）
 * - 检测机制：Doubao ASR 内置 VAD，当检测到语音结束后标记 isFinal=true
 *
 * 预期输出流程：
 *   [时间] → 开始流式识别...
 *   [时间] [中间结果 #1] 你好...
 *   [时间] [中间结果 #2] 你好世界...
 *   [时间] ★★★ [最终结果 / VAD 端点触发] ★★★
 *   [时间]   └─ 语音分段: [80ms - 3280ms] "你好世界" (置信度: 100%)
 *   [时间]   └─ VAD 检测: 用户说话结束于第 3.28s
 *   ...
 *   [时间] === 端点检测统计摘要 ===
 *
 * 环境变量:
 * - DOUBAO_APP_KEY: 火山引擎 App Key
 * - DOUBAO_ACCESS_TOKEN: 火山引擎 Access Token
 *
 * 使用方法:
 * npx tsx examples/asr/providers/doubao/streaming-end-of-speech-detection.ts
 */
import 'dotenv/config';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import 'univoice/asr/providers';
import { createASR, decodeOpusStream } from 'univoice/asr';
import { getASRConfig, getExamplesRoot, readOpusPackets, timestamp } from '../../../utils/common';

// ============================================
// 格式化输出工具
// ============================================

/** 格式化时间为秒 */
function formatTime(ms: number): string {
  return `${(ms / 1000).toFixed(2)}s`;
}

/** 格式化分隔线 */
function separator(char = '-', width = 50): string {
  return char.repeat(width);
}

// ============================================
// 主函数
// ============================================

async function main() {
  const { appKey, accessKey } = getASRConfig();

  // Opus 数据包目录
  const examplesRoot = getExamplesRoot(import.meta.url);
  const opusDir = path.join(examplesRoot, 'assets/16khz_16bit_1channel');

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

  console.log();
  console.log(separator('='));
  console.log('  Doubao ASR - 流式端点检测演示（VAD / End-of-Speech）');
  console.log(separator('='));
  console.log();
  console.log(`音频源: ${opusDir}`);
  console.log(`格式: Opus → PCM (decodeOpusStream), 16kHz, 单声道`);
  console.log();

  try {
    // ---------------------------------------------------------------
    // 阶段 1: 创建 ASR 实例（开启 VAD 端点检测）
    // ---------------------------------------------------------------
    const asr = createASR({
      provider: 'doubao',
      appKey,
      accessKey,
      language: 'zh-CN',
      audioFormat: {
        sampleRate: 16000,
      },
      // 开启 VAD 端点检测：静音 800ms 后自动判停，输出 definite 结果
      endWindowSize: 800,
    });

    console.log(`[${timestamp()}] ASR 实例已创建 (provider=doubao, VAD endWindowSize=800ms)`);

    // ---------------------------------------------------------------
    // 阶段 2: 将 Opus 数据包解码为 PCM 音频流
    // ---------------------------------------------------------------
    const audioStream = decodeOpusStream(readOpusPackets(opusDir), {
      sampleRate: 16000,
    });

    console.log(`[${timestamp()}] 音频流已构建 (Opus → PCM, 16kHz)\n`);

    // ---------------------------------------------------------------
    // 阶段 3: 流式识别 + 端点检测
    // ---------------------------------------------------------------
    const startTime = Date.now();
    let firstResultTime = 0;
    let chunkCount = 0;
    let intermediateCount = 0;
    let finalResultTime = 0;
    let vadEndpointTriggered = false;
    const results: Array<{
      text: string;
      time: number;
      segment?: { start: number; end: number; text: string; confidence: number };
    }> = [];

    console.log(`[${timestamp()}] \u25b6 开始流式识别...`);
    console.log(separator('-'));
    console.log();

    for await (const chunk of asr.listen(audioStream, { stream: true })) {
      chunkCount++;
      const now = Date.now();

      if (chunkCount === 1) {
        firstResultTime = now;
        console.log(`[${timestamp()}] \u23f3 [首字延迟] ${now - startTime} ms`);
        console.log(separator('-'));
        console.log();
      }

      // 检测 VAD 端点（definite utterance）或最终结果（isLastPackage）
      const isVadEndpoint = chunk.segment?.confidence === 1;

      if (isVadEndpoint || chunk.isFinal) {
        // ====== VAD 判停 / 最终结果 ======
        finalResultTime = now;

        // 收到首个 VAD 端点或最终结果后，记录并退出循环（避免服务端重复推送）
        if (vadEndpointTriggered) {
          break;
        }
        vadEndpointTriggered = true;

        if (isVadEndpoint && !chunk.isFinal) {
          console.log(
            `[${timestamp()}] \u2605\u2605\u2605 [VAD 端点触发 / definite] \u2605\u2605\u2605`
          );
        } else {
          console.log(
            `[${timestamp()}] \u2605\u2605\u2605 [最终结果 / VAD 端点触发] \u2605\u2605\u2605`
          );
        }
        console.log(`[${timestamp()}] 识别文本: "${chunk.text || '(空)'}"`);

        if (chunk.segment) {
          const seg = chunk.segment;
          console.log();
          console.log(`[${timestamp()}]   \u2514\u2500 语音分段信息:`);
          console.log(`[${timestamp()}]     \u2514\u2500 文本: "${seg.text}"`);
          console.log(
            `[${timestamp()}]     \u2514\u2500 时间范围: [${seg.start}ms - ${seg.end}ms] (${formatTime(seg.start)} - ${formatTime(seg.end)})`
          );
          console.log(
            `[${timestamp()}]     \u2514\u2500 语音时长: ${seg.end - seg.start}ms (${formatTime(seg.end - seg.start)})`
          );
          console.log(
            `[${timestamp()}]     \u2514\u2500 置信度: ${((seg.confidence ?? 0) * 100).toFixed(0)}%`
          );
          console.log();
          console.log(`[${timestamp()}]   \u2514\u2500 \u2713 VAD 检测结论:`);
          console.log(`[${timestamp()}]     \u2514\u2500 ASR 判断用户已停止说话`);
          console.log(
            `[${timestamp()}]     \u2514\u2500 语音结束位置: 第 ${formatTime(seg.end)} 处`
          );
          console.log(
            `[${timestamp()}]     \u2514\u2500 从开始识别到检测到端点: ${finalResultTime - startTime}ms`
          );

          results.push({
            text: chunk.text || '',
            time: now,
            segment: {
              start: seg.start,
              end: seg.end,
              text: seg.text,
              confidence: seg.confidence ?? 0,
            },
          });
        }

        console.log();
      } else {
        // ====== 中间结果 ======
        intermediateCount++;
        console.log(`[${timestamp()}] [中间结果 #${intermediateCount}] ${chunk.text || '(空)'}`);
      }
    }

    const endTime = Date.now();

    // ---------------------------------------------------------------
    // 阶段 4: 输出统计摘要
    // ---------------------------------------------------------------
    console.log(separator('='));
    console.log(`[${timestamp()}] === 端点检测统计摘要 ===`);
    console.log(separator('-'));
    console.log(
      `  总耗时:           ${endTime - startTime} ms (${formatTime(endTime - startTime)})`
    );
    console.log(
      `  首字延迟:         ${firstResultTime - startTime} ms (${formatTime(firstResultTime - startTime)})`
    );
    console.log(
      `  端点检测时刻:     +${finalResultTime - startTime} ms 自识别开始 (${
        finalResultTime ? formatTime(finalResultTime - startTime) : 'N/A'
      })`
    );
    console.log(`  总接收结果块数:   ${chunkCount}`);
    console.log(`    - 中间结果:     ${intermediateCount} 块`);
    console.log(`    - 最终结果:     ${chunkCount - intermediateCount} 块 (VAD 触发)`);
    console.log(separator('-'));

    if (results.length > 0) {
      console.log();
      console.log(`  完整识别结果:`);
      for (let i = 0; i < results.length; i++) {
        const r = results[i];
        console.log(`    [${i + 1}] "${r.text}"`);
        if (r.segment) {
          console.log(
            `         时段: [${r.segment.start}ms - ${r.segment.end}ms], 置信度: ${(r.segment.confidence * 100).toFixed(0)}%`
          );
        }
      }
    } else {
      console.log();
      console.log(`  完整识别结果: (无)`);
    }

    console.log(separator('='));
    console.log();
  } catch (error) {
    console.error('语音识别失败:', error);
    process.exit(1);
  }
}

main();
