/**
 * Doubao ASR - 非流式入/非流式出示例
 * 演示一次性处理完整音频文件的场景
 *
 * 特点:
 * - 直接传入文件路径
 * - 一次性返回完整识别结果
 * - 支持分段信息输出
 *
 * 环境变量:
 * - DOUBAO_APP_KEY: 火山引擎 App Key
 * - DOUBAO_ACCESS_TOKEN: 火山引擎 Access Token
 *
 * 使用方法:
 * npx tsx examples/asr/providers/doubao/non-stream-in-non-stream-out.ts
 */
import 'dotenv/config';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import 'univoice/asr/providers';
import { createASR } from 'univoice/asr';
import { getASRConfig, getScriptMeta, timestamp } from '../../../utils/common';

const { __dirname } = getScriptMeta(import.meta.url);

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

  console.log(`\n[${timestamp()}] === Doubao ASR - 非流式入/非流式出 ===`);
  console.log(`场景: 文件路径输入 → 完整识别结果输出\n`);
  console.log(`音频文件: ${audioPath}\n`);

  try {
    // 创建 ASR 实例
    const asr = createASR({
      provider: 'doubao',
      appKey,
      accessKey,
      language: 'zh-CN',
    });

    const startTime = Date.now();

    // 非流式识别 - 一次性返回完整结果
    const result = await asr.listen(audioPath);

    const endTime = Date.now();

    console.log(`[${timestamp()}] 识别完成`);
    console.log(`耗时: ${endTime - startTime} ms`);
    console.log(`\n识别结果: ${result.text || '(无识别结果)'}`);

    // 显示分段信息（如果有）
    if (result.segments && result.segments.length > 0) {
      console.log(`\n分段信息:`);
      for (const segment of result.segments) {
        console.log(`  [${segment.start}ms - ${segment.end}ms] ${segment.text}`);
      }
    }
  } catch (error) {
    console.error('语音识别失败:', error);
    process.exit(1);
  }
}

main();
