/**
 * Doubao ASR 使用示例
 * 演示如何使用 univoice SDK 调用火山引擎 ASR 服务（非流式）
 */
import 'dotenv/config';
import path from 'node:path';
import 'univoice/asr/providers';
import { createASR } from 'univoice/asr';
import { getASRConfig, getScriptMeta } from './utils/common';

const { __dirname } = getScriptMeta(import.meta.url);

async function main() {
  const { appKey, accessKey } = getASRConfig();

  // 音频文件路径（请替换为实际的音频文件路径）
  const audioPath = path.join(__dirname, 'output', 'doubao-tts-demo.mp3');

  console.log(`准备识别音频: ${audioPath}`);

  try {
    console.log('开始语音识别...');

    // 创建 ASR 实例
    const asr = createASR({
      provider: 'doubao',
      appKey,
      accessKey,
      language: 'zh-CN',
    });

    // 使用实例方法进行识别
    const response = await asr.listen(audioPath, { stream: false });

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
