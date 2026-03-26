/**
 * OpenAI ASR 基础示例
 * 演示如何使用 univoice SDK 调用 OpenAI Whisper ASR 服务
 */
import 'dotenv/config';
import path from 'node:path';
import 'univoice/asr/providers';
import { createASR } from 'univoice/asr';
import { getScriptMeta, timestamp } from '../../../utils/common';

const { __dirname } = getScriptMeta(import.meta.url);

/**
 * 获取 OpenAI API Key
 */
function getOpenAIApiKey(): string {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('请设置环境变量 OPENAI_API_KEY');
    process.exit(1);
  }
  return apiKey;
}

async function main() {
  const apiKey = getOpenAIApiKey();

  // 音频文件路径
  const audioPath = path.join(__dirname, '..', '..', '..', 'output', 'doubao-tts-demo.mp3');

  console.log(`\n[${timestamp()}] === OpenAI ASR 基础示例 ===\n`);
  console.log(`音频文件: ${audioPath}\n`);

  try {
    // 创建 ASR 实例
    const asr = createASR({
      provider: 'openai',
      apiKey,
      model: 'whisper-1',
    });

    // 识别音频
    const result = await asr.listen(audioPath);

    console.log(`识别结果: ${result.text || '(无识别结果)'}`);
  } catch (error) {
    console.error('语音识别失败:', error);
    process.exit(1);
  }
}

main();
