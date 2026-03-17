/**
 * GLM ASR 使用示例
 * 演示如何使用 univoice SDK 调用智谱 AI GLM ASR 服务（非流式）
 *
 * API 特性：
 * - 端点: https://open.bigmodel.cn/api/paas/v4/audio/transcriptions
 * - 模型: glm-asr-2512
 * - 音频格式: .wav / .mp3
 * - 文件限制: ≤ 25 MB，时长 ≤ 30 秒
 *
 * 特殊参数：
 * - hotwords: 热词列表（提高特定词汇识别准确率）
 * - context: 上下文文本（长文本场景优化）
 */
import 'dotenv/config';
import path from 'node:path';
import 'univoice/asr/providers';
import { createASR } from 'univoice/asr';
import { getScriptMeta } from './utils/common';

const { __dirname } = getScriptMeta(import.meta.url);

async function main() {
  const apiKey = process.env.GLM_API_KEY;

  if (!apiKey) {
    console.error('请设置环境变量 GLM_API_KEY');
    process.exit(1);
  }

  // 音频文件路径
  const audioPath = path.join(__dirname, 'output', 'qwen-tts-speak-string.mp3');

  console.log(`准备识别音频: ${audioPath}`);

  try {
    console.log('开始语音识别...');

    // 创建 ASR 实例
    const asr = createASR({
      provider: 'glm',
      apiKey,
      model: 'glm-asr-2512',
    });

    // 使用非流式模式进行识别（默认）
    const response = await asr.listen(audioPath);

    console.log(`识别结果: ${response.text}`);
  } catch (error) {
    console.error('语音识别失败:', error);
    process.exit(1);
  }
}

main();
