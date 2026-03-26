/**
 * ASR listen 非流式模式示例
 * 演示 asr.listen(audioPath) 的使用方式
 *
 * 非流式模式特点:
 * - 输入完整音频，等待识别完成
 * - 返回完整识别结果
 */
import 'dotenv/config';
import path from 'node:path';
import 'univoice/asr/providers';
import { createASR } from 'univoice/asr';
import { getASRConfig, getScriptMeta, timestamp } from '../../utils/common';

const { __dirname } = getScriptMeta(import.meta.url);

async function main() {
  // 使用音频文件
  const audioPath = path.join(__dirname, '..', '..', 'output', 'doubao-tts-demo.mp3');

  console.log(`[${timestamp()}] === ASR listen 非流式模式演示 ===`);
  console.log(`音频文件: ${audioPath}\n`);

  const { appKey, accessKey } = getASRConfig();

  // 创建 ASR 实例
  const asr = createASR({
    provider: 'doubao',
    appKey,
    accessKey,
    language: 'zh-CN',
  });

  console.log('开始识别...\n');

  const startTime = Date.now();

  // 非流式调用，等待完整结果
  const result = await asr.listen(audioPath);

  const totalTime = Date.now() - startTime;

  console.log(`[${timestamp()}] 识别完成`);
  console.log(`总耗时: ${totalTime} ms`);
  console.log(`\n识别结果: ${result.text || '(无识别结果)'}`);
}

main().catch((error) => {
  console.error('语音识别失败:', error);
  process.exit(1);
});
