/**
 * Doubao ASR 使用示例
 * 演示如何使用 univoice SDK 调用火山引擎 ASR 服务
 */
import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createASR } from 'univoice';

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
  const audioPath = './output/doubao-tts-demo.mp3';

  console.log(`准备识别音频: ${audioPath}`);

  // 创建 ASR 实例
  const asr = createASR({
    provider: 'doubao',
    appKey,
    accessKey,
    mode: 'nostream',
    language: 'zh-CN',
  });

  try {
    console.log('开始语音识别...');

    // 执行语音识别
    const result = await asr.recognize({
      audio: audioPath,
    });

    console.log('\n--- 识别结果 ---');
    console.log(`识别文本: ${result.text}`);
    if (result.duration) {
      console.log(`音频时长: ${result.duration} ms`);
    }
    if (result.segments && result.segments.length > 0) {
      console.log('\n分段信息:');
      for (const segment of result.segments) {
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
