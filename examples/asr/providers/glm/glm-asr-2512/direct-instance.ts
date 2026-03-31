/**
 * GLM ASR 2512 - 直接实例化示例
 * 演示不使用工厂函数 createASR，直接 new GlmASR() 创建实例
 *
 * 特点:
 * - 直接导入 GlmASR 类并实例化，无需注册 provider
 * - 使用本地 wav 文件模拟流式输入
 * - GLM ASR 不支持真正的流式输入，音频流会被完整收集后一次性发送
 * - 输出支持流式（Event Stream），可以实时获取识别片段
 *
 * 环境变量:
 * - GLM_API_KEY: 智谱 AI API Key
 *
 * 使用方法:
 * npx tsx examples/asr/providers/glm/glm-asr-2512/direct-instance.ts
 */
import 'dotenv/config';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { GlmASR } from 'univoice/asr/providers';
import { getGlmApiKey, getScriptMeta, timestamp } from '../../../../utils/common';

const { __dirname } = getScriptMeta(import.meta.url);

/**
 * 将音频文件模拟为音频流
 * @param audioPath 音频文件路径
 * @param chunkSize 每次发送的块大小（字节），默认 4096
 * @param delay 每次发送的延迟（毫秒），默认 50ms
 */
async function* mockAudioStream(
  audioPath: string,
  chunkSize = 4096,
  delay = 50
): AsyncIterable<Buffer> {
  const fileStream = createReadStream(audioPath, { highWaterMark: chunkSize });

  for await (const chunk of fileStream) {
    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
    yield Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
  }
}

async function main() {
  const apiKey = getGlmApiKey();

  // 音频文件路径 - 使用 TTS 生成的音频文件
  const audioPath = path.join(__dirname, '..', '..', '..', '..', 'output', 'glm-tts-demo.wav');

  // 检查文件是否存在
  try {
    await stat(audioPath);
  } catch {
    console.error(`音频文件不存在: ${audioPath}`);
    console.error('请先运行 TTS 示例生成音频文件:');
    console.error('npx tsx examples/tts/providers/glm/basic.ts');
    process.exit(1);
  }

  console.log(`\n[${timestamp()}] === GLM ASR 2512 - 直接实例化 / 流式入/流式出 ===`);
  console.log(`场景: 直接 new GlmASR() → 模拟流式输入 → 实时识别结果输出\n`);
  console.log(`注意: GLM ASR 不支持真正的流式输入，音频流会被完整收集后一次性发送\n`);
  console.log(`音频文件: ${audioPath}\n`);

  try {
    // 直接实例化 GlmASR，不使用 createASR 工厂函数
    const asr = new GlmASR({
      apiKey,
      model: 'glm-asr-2512',
      // GLM 专用参数（可选）:
      // hotwords: ['智谱', 'GLM'],
      // context: '这是一段关于人工智能的对话',
    });

    // 创建模拟音频流
    const audioStream = mockAudioStream(audioPath);

    const startTime = Date.now();
    let firstResultTime = 0;
    let chunkCount = 0;
    const results: string[] = [];

    console.log(`[${timestamp()}] 开始流式识别...\n`);

    // 流式识别 - 用法与工厂函数创建的实例完全一致
    for await (const chunk of asr.listen(audioStream, { stream: true })) {
      chunkCount++;
      if (chunkCount === 1) {
        firstResultTime = Date.now();
        console.log(`[${timestamp()}] [首字延迟] ${firstResultTime - startTime} ms\n`);
      }

      const status = chunk.isFinal ? '最终' : '中间';
      console.log(`[${timestamp()}] [${status}] ${chunk.text || '(空)'}`);

      if (chunk.isFinal && chunk.text) {
        results.push(chunk.text);
      }
    }

    const endTime = Date.now();

    console.log(`\n[${timestamp()}] === 统计信息 ===`);
    console.log(`总耗时: ${endTime - startTime} ms`);
    console.log(`首字延迟: ${firstResultTime - startTime} ms`);
    console.log(`结果块数: ${chunkCount}`);
    console.log(`\n完整识别结果: ${results.join('') || '(无)'}`);
  } catch (error) {
    console.error('语音识别失败:', error);
    process.exit(1);
  }
}

main();
