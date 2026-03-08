/**
 * Doubao ASR listenStream 方法示例
 * 演示如何使用 listenStream() 方法进行流式音频输入识别
 *
 * listenStream 方法特点:
 * - 支持流式音频输入（如实时录音、PCM 文件流）
 * - 实时返回识别结果
 * - 适用于实时语音识别场景
 */
import 'dotenv/config';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createASR } from 'univoice';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 格式化时间戳
 */
function timestamp(): string {
  const now = new Date();
  const ms = String(now.getMilliseconds()).padStart(3, '0');
  const time = now.toTimeString().split(' ')[0];
  return `${time}.${ms}`;
}

/**
 * 创建音频流（从 PCM 文件目录）
 * 按文件名顺序读取 PCM 文件并生成音频流
 *
 * 使用方式：
 * const pcmDir = path.join(__dirname, 'pcm-files');
 * const audioStream = _createAudioStreamFromDir(pcmDir);
 */
// biome-ignore lint/correctness/noUnusedVariables: 示例函数供用户参考
async function* createAudioStreamFromDir(dir: string): AsyncGenerator<Uint8Array> {
  const files = await readdir(dir);
  // 过滤 PCM 文件并按数字顺序排序
  const pcmFiles = files
    .filter((f) => f.endsWith('.pcm'))
    .sort((a, b) => {
      const numA = Number.parseInt(a.replace('.pcm', ''), 10);
      const numB = Number.parseInt(b.replace('.pcm', ''), 10);
      return numA - numB;
    });

  console.log(`找到 ${pcmFiles.length} 个 PCM 文件`);

  for (const file of pcmFiles) {
    const filePath = path.join(dir, file);
    const data = await readFile(filePath);
    console.log(`[${timestamp()}] 读取文件: ${file} (${data.length} bytes)`);
    yield data;
  }
}

/**
 * 创建音频流（从单个音频文件，模拟流式输入）
 * 将音频文件分割成小块模拟流式输入
 */
async function* createAudioStreamFromFile(
  filePath: string,
  chunkSize: number = 3200 // 每次发送 100ms 的音频数据 (16kHz * 16bit * 1ch * 0.1s = 3200 bytes)
): AsyncGenerator<Uint8Array> {
  const data = await readFile(filePath);
  console.log(`读取音频文件: ${filePath} (${data.length} bytes)`);

  let offset = 0;
  let chunkIndex = 0;
  while (offset < data.length) {
    const end = Math.min(offset + chunkSize, data.length);
    const chunk = data.slice(offset, end);
    offset = end;
    chunkIndex++;
    yield chunk;
  }

  console.log(`共发送 ${chunkIndex} 个音频块`);
}

async function main() {
  // 从环境变量获取配置
  const appKey = process.env.ASR_BYTEDANCE_APP_KEY;
  const accessKey = process.env.ASR_BYTEDANCE_ACCESS_KEY;

  if (!appKey || !accessKey) {
    console.error('请设置环境变量 ASR_BYTEDANCE_APP_KEY 和 ASR_BYTEDANCE_ACCESS_KEY');
    process.exit(1);
  }

  console.log(`\n[${timestamp()}] === ASR listenStream 方法演示 ===\n`);

  // 创建 ASR 实例
  const asr = createASR({
    provider: 'doubao',
    appKey,
    accessKey,
    mode: 'streaming',
    language: 'zh-CN',
  });

  // 检查是否支持 listenStream 方法
  if (!asr.listenStream) {
    console.error('当前 ASR 提供商不支持流式音频输入');
    process.exit(1);
  }

  const startTime = Date.now();
  let firstChunkTime = 0;
  let chunkCount = 0;
  const textParts: string[] = [];

  try {
    console.log('开始流式音频输入识别...\n');

    // 方式一：从 PCM 文件目录创建音频流
    // const pcmDir = path.join(__dirname, 'pcm-files');
    // const audioStream = createAudioStreamFromDir(pcmDir);

    // 方式二：从单个音频文件模拟流式输入
    const audioPath = path.join(__dirname, 'output', 'doubao-tts-demo.mp3');
    const audioStream = createAudioStreamFromFile(audioPath);

    // 使用 for await...of 消费流式识别结果
    for await (const chunk of asr.listenStream(audioStream, {
      format: 'pcm',
      sampleRate: 16000,
      bits: 16,
      channel: 1,
    })) {
      chunkCount++;

      if (chunkCount === 1) {
        firstChunkTime = Date.now();
        console.log(`[${timestamp()}] [首块延迟] ${firstChunkTime - startTime} ms\n`);
      }

      // 显示识别状态和文本
      const status = chunk.isFinal ? '最终' : '中间';
      console.log(`[${timestamp()}] [${status}] ${chunk.text}`);

      // 收集最终结果的文本
      if (chunk.isFinal && chunk.text) {
        textParts.push(chunk.text);
      }
    }

    const totalTime = Date.now() - startTime;
    const fullText = textParts.join('');

    console.log(`\n[${timestamp()}] === 统计信息 ===`);
    console.log(`总耗时: ${totalTime} ms`);
    console.log(`总块数: ${chunkCount}`);
    console.log(`\n=== 完整识别结果 ===`);
    console.log(fullText || '(无识别结果)');
  } catch (error) {
    console.error('语音识别失败:', error);
    process.exit(1);
  }
}

main();
