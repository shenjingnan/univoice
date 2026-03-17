/**
 * Qwen ASR 使用示例
 * 演示如何使用 univoice SDK 调用阿里云 DashScope ASR 服务（非流式）
 */
import 'dotenv/config';
import path from 'node:path';
import 'univoice/asr/providers';
import { createASR } from 'univoice/asr';
import { getScriptMeta } from './utils/common';

const { __dirname } = getScriptMeta(import.meta.url);

async function main() {
  const apiKey = process.env.QWEN_API_KEY || process.env.DASHSCOPE_API_KEY;

  if (!apiKey) {
    console.error('请设置环境变量 QWEN_API_KEY 或 DASHSCOPE_API_KEY');
    process.exit(1);
  }

  // 音频文件路径（使用 Qwen TTS 生成的 MP3 文件）
  const audioPath = path.join(__dirname, 'output', 'qwen-tts-speak-string.mp3');

  console.log(`准备识别音频: ${audioPath}`);

  try {
    console.log('开始语音识别...');

    // 创建 ASR 实例
    const asr = createASR({
      provider: 'qwen',
      apiKey,
      model: 'paraformer-realtime-v2',
      language: 'zh-CN',
      format: 'mp3',
    });

    // 使用非流式模式进行识别（默认）
    const response = await asr.listen(audioPath);

    console.log(`识别结果: ${response.text}`);
    if (response.segments && response.segments.length > 0) {
      console.log('\n分段信息:');
      for (const segment of response.segments) {
        console.log(
          `  [${segment.start}ms - ${segment.end}ms] ${segment.text}${segment.confidence ? ` (置信度: ${segment.confidence.toFixed(2)})` : ''}`
        );
      }
    }
  } catch (error) {
    console.error('语音识别失败:', error);
    process.exit(1);
  }
}

main();
