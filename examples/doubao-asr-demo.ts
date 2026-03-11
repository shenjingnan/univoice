/**
 * Doubao ASR 使用示例
 * 演示如何使用 univoice SDK 调用火山引擎 ASR 服务
 */
import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { listen } from 'univoice';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  // 从环境变量获取配置
  const appKey = process.env.ASR_BYTEDANCE_APP_KEY;
  const accessKey = process.env.ASR_BYTEDANCE_ACCESS_KEY;

  if (!appKey || !accessKey) {
    console.error('请设置环境变量 ASR_BYTEDANCE_APP_KEY 和 ASR_BYTEDANCE_ACCESS_KEY');
    process.exit(1);
  }

  // 音频文件路径（请替换为实际的音频文件路径）
  const audioPath = path.join(__dirname, 'output', 'doubao-tts-demo.mp3');

  console.log(`准备识别音频: ${audioPath}`);

  try {
    console.log('开始语音识别...');

    // 执行流式语音识别
    for await (const chunk of listen(audioPath, {
      provider: 'doubao',
      appKey,
      accessKey,
      mode: 'nostream',
      language: 'zh-CN',
    })) {
      console.log(`识别文本: ${chunk.text}`);
      if (chunk.isFinal) {
        console.log('识别完成');
      }
      if (chunk.segment) {
        console.log(
          `  [${chunk.segment.start}ms - ${chunk.segment.end}ms] ${chunk.segment.text}${chunk.segment.confidence ? ` (置信度: ${chunk.segment.confidence.toFixed(2)})` : ''}`
        );
      }
    }
  } catch (error) {
    console.error('语音识别失败:', error);
    process.exit(1);
  }
}

main();
