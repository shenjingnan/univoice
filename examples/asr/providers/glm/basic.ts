/**
 * GLM ASR 基础示例
 * 演示如何使用 univoice SDK 调用智谱 AI GLM ASR 服务
 */
import 'dotenv/config';
import path from 'node:path';
import 'univoice/asr/providers';
import { createASR } from 'univoice/asr';
import { getGlmApiKey, getScriptMeta, timestamp } from '../../../utils/common';

const { __dirname } = getScriptMeta(import.meta.url);

async function main() {
  const apiKey = getGlmApiKey();

  // 音频文件路径
  const audioPath = path.join(__dirname, '..', '..', '..', 'output', 'glm-tts-demo.wav');

  console.log(`\n[${timestamp()}] === GLM ASR 基础示例 ===\n`);
  console.log(`音频文件: ${audioPath}\n`);

  try {
    // 创建 ASR 实例
    const asr = createASR({
      provider: 'glm',
      apiKey,
      model: 'glm-asr',
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
