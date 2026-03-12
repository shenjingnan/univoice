/**
 * ASR listen 非流式模式示例
 * 演示 asr.listen(audioPath) 的使用方式
 *
 * 非流式模式特点:
 * - 输入完整音频，返回完整识别结果
 * - 适合短音频，一次性获取全部识别内容
 */
import 'dotenv/config';
import path from 'node:path';
import { createASR } from 'univoice';
import { getASRConfig, getScriptMeta, timestamp } from './utils/common';

const { __dirname } = getScriptMeta(import.meta.url);

async function main() {
  // 使用 ogg/opus 格式的音频文件
  const audioPath = path.join(__dirname, 'output', 'doubao-tts-demo.ogg');

  console.log(`[${timestamp()}] === ASR listen 非流式模式演示 ===`);
  console.log(`音频文件: ${audioPath}\n`);

  const { appKey, accessKey } = getASRConfig();
  const startTime = Date.now();

  // 创建 ASR 实例（非流式模式不需要指定 mode）
  const asr = createASR({
    provider: 'doubao',
    appKey,
    accessKey,
    language: 'zh-CN',
  });

  // 非流式调用，等待完整识别结果
  const response = await asr.listen(audioPath);
  const totalTime = Date.now() - startTime;

  console.log(`[${timestamp()}] 识别结果: ${response.text}`);
  console.log(`[${timestamp()}] 耗时: ${totalTime} ms`);

  // 显示分段信息（如果有）
  if (response.segments && response.segments.length > 0) {
    console.log('\n分段信息:');
    for (const segment of response.segments) {
      const confidence = segment.confidence ? ` (置信度: ${segment.confidence.toFixed(2)})` : '';
      console.log(`  [${segment.start}ms - ${segment.end}ms] ${segment.text}${confidence}`);
    }
  }
}

main().catch((error) => {
  console.error('语音识别失败:', error);
  process.exit(1);
});
