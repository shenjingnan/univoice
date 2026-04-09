/**
 * 示例代码共享工具模块
 * 提供公共函数，减少示例代码重复
 */
import { mkdirSync, readdirSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * 获取脚本路径信息
 * @param importMetaUrl - import.meta.url
 * @returns 脚本文件名、目录名和基础名（不含扩展名）
 */
export function getScriptMeta(importMetaUrl: string) {
  const __filename = fileURLToPath(importMetaUrl);
  const __dirname = path.dirname(__filename);
  const basename = path.basename(__filename, path.extname(__filename));
  return { __filename, __dirname, basename };
}

/**
 * 获取项目根目录的绝对路径
 * 基于 examples/ 目录位于项目根目录下的约定，通过向上查找 package.json 来定位
 * @param importMetaUrl - import.meta.url
 * @returns 项目根目录的绝对路径
 */
export function getProjectRoot(importMetaUrl: string): string {
  const { __dirname } = getScriptMeta(importMetaUrl);
  // 从脚本目录向上查找，直到找到包含 package.json 的项目根目录
  let current = __dirname;
  while (current !== path.dirname(current)) {
    if (path.basename(current) === 'examples') {
      return path.dirname(current);
    }
    current = path.dirname(current);
  }
  throw new Error('无法定位项目根目录：未找到 examples/ 目录');
}

/**
 * 获取 examples/ 目录的绝对路径
 * @param importMetaUrl - import.meta.url
 * @returns examples/ 目录的绝对路径
 */
export function getExamplesRoot(importMetaUrl: string): string {
  return path.join(getProjectRoot(importMetaUrl), 'examples');
}

/**
 * 格式化时间戳
 * @returns 格式化的时间字符串，如 "14:30:25.123"
 */
export function timestamp(): string {
  const now = new Date();
  const ms = String(now.getMilliseconds()).padStart(3, '0');
  const time = now.toTimeString().split(' ')[0];
  return `${time}.${ms}`;
}

/**
 * TTS 配置
 */
export interface TTSConfig {
  appId: string;
  accessToken: string;
  voice: string;
}

/**
 * 获取 TTS 配置（从环境变量）
 * @returns TTS 配置对象
 * @throws 如果环境变量未设置则退出进程
 */
export function getTTSConfig(): TTSConfig {
  const appId = process.env.DOUBAO_APP_KEY;
  const accessToken = process.env.DOUBAO_ACCESS_TOKEN;
  const voice = process.env.DOUBAO_VOICE_TYPE || 'zh_female_tianmeixiaoyuan_moon_bigtts';

  if (!appId || !accessToken) {
    console.error('请设置环境变量 DOUBAO_APP_KEY 和 DOUBAO_ACCESS_TOKEN');
    process.exit(1);
  }

  return { appId, accessToken, voice };
}

/**
 * ASR 配置
 */
export interface ASRConfig {
  appKey: string;
  accessKey: string;
}

/**
 * 获取 ASR 配置（从环境变量）
 * @returns ASR 配置对象
 * @throws 如果环境变量未设置则退出进程
 */
export function getASRConfig(): ASRConfig {
  const appKey = process.env.DOUBAO_APP_KEY;
  const accessKey = process.env.DOUBAO_ACCESS_TOKEN;

  if (!appKey || !accessKey) {
    console.error('请设置环境变量 DOUBAO_APP_KEY 和 DOUBAO_ACCESS_TOKEN');
    process.exit(1);
  }

  return { appKey, accessKey };
}

/**
 * 确保输出目录存在并返回输出文件路径
 * @param __dirname - 脚本目录
 * @param basename - 文件基础名
 * @param ext - 文件扩展名，默认 'pcm'
 * @returns 输出文件的完整路径
 */
export function ensureOutputDir(__dirname: string, basename: string, ext = 'pcm'): string {
  const outputDir = path.join(__dirname, 'output');
  mkdirSync(outputDir, { recursive: true });
  return path.join(outputDir, `${basename}.${ext}`);
}

/**
 * 打印 PCM 播放提示
 * @param outputFile - 输出文件路径
 */
export function printPlayTip(outputFile: string): void {
  console.log('\n=== 播放提示 ===');
  console.log('PCM 格式播放命令 (24000 Hz, 16-bit, mono):');
  console.log(`ffplay -autoexit -f s16le -ar 24000 ${outputFile}`);
}

/**
 * 打印统计信息
 * @param startTime - 开始时间戳
 * @param chunkCount - 音频块数量
 * @param chunks - 音频块数组
 */
export function printStats(startTime: number, chunkCount: number, chunks: Uint8Array[]): void {
  const totalTime = Date.now() - startTime;
  console.log(`\n[${timestamp()}] === 统计信息 ===`);
  console.log(`总耗时: ${totalTime} ms`);
  console.log(`总音频块数: ${chunkCount}`);
  console.log(`总音频大小: ${chunks.reduce((sum, c) => sum + c.length, 0)} bytes`);
}

// ============================================
// 提供商配置获取函数
// ============================================

/**
 * 获取 Qwen API Key
 */
export function getQwenApiKey(): string {
  const apiKey = process.env.QWEN_API_KEY;
  if (!apiKey) {
    console.error('请设置环境变量 QWEN_API_KEY');
    process.exit(1);
  }
  return apiKey;
}

/**
 * 获取 Minimax API Key
 */
export function getMinimaxApiKey(): string {
  const apiKey = process.env.MINIMAX_API_KEY;
  if (!apiKey) {
    console.error('请设置环境变量 MINIMAX_API_KEY');
    process.exit(1);
  }
  return apiKey;
}

/**
 * 获取 GLM API Key
 */
export function getGlmApiKey(): string {
  const apiKey = process.env.GLM_API_KEY;
  if (!apiKey) {
    console.error('请设置环境变量 GLM_API_KEY');
    process.exit(1);
  }
  return apiKey;
}

/**
 * OpenAI 配置
 */
export interface OpenAIConfig {
  apiKey: string;
  baseUrl?: string;
  ttsModel?: string;
  asrModel?: string;
}

/**
 * 获取 OpenAI 配置（从环境变量）
 * @returns OpenAI 配置对象
 * @throws 如果环境变量未设置则退出进程
 */
export function getOpenAIConfig(): OpenAIConfig {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('请设置环境变量 OPENAI_API_KEY');
    process.exit(1);
  }
  return {
    apiKey,
    baseUrl: process.env.OPENAI_BASE_URL,
    ttsModel: process.env.OPENAI_TTS_MODEL,
    asrModel: process.env.OPENAI_ASR_MODEL,
  };
}

/**
 * 科大讯飞 ASR 配置
 */
export interface XfyunASRConfig {
  appId: string;
  apiKey: string;
  apiSecret: string;
}

/**
 * 获取科大讯飞 ASR 配置（从环境变量）
 * @returns 科大讯飞 ASR 配置对象
 * @throws 如果环境变量未设置则退出进程
 */
export function getXfyunASRConfig(): XfyunASRConfig {
  const appId = process.env.XFYUN_APP_ID;
  const apiKey = process.env.XFYUN_API_KEY;
  const apiSecret = process.env.XFYUN_API_SECRET;
  if (!appId || !apiKey || !apiSecret) {
    console.error('请设置环境变量 XFYUN_APP_ID、XFYUN_API_KEY 和 XFYUN_API_SECRET');
    process.exit(1);
  }
  return { appId, apiKey, apiSecret };
}

/** 讯飞 TTS 配置（复用 XfyunASRConfig 接口） */
export type XfyunTTSConfig = XfyunASRConfig;

/**
 * 获取科大讯飞 TTS 配置（从环境变量）
 * @returns 科大讯飞 TTS 配置对象
 * @throws 如果环境变量未设置则退出进程
 */
export function getXfyunTTSConfig(): XfyunTTSConfig {
  const appId = process.env.XFYUN_APP_ID;
  const apiKey = process.env.XFYUN_API_KEY;
  const apiSecret = process.env.XFYUN_API_SECRET;
  if (!appId || !apiKey || !apiSecret) {
    console.error('请设置环境变量 XFYUN_APP_ID、XFYUN_API_KEY 和 XFYUN_API_SECRET');
    process.exit(1);
  }
  return { appId, apiKey, apiSecret };
}

// ============================================
// 模拟数据生成函数
// ============================================

/**
 * 默认 TTS 演示文本（杭州导游）
 */
export const DEFAULT_TTS_TEXT =
  '欢迎来到杭州！我是您的智能导游。杭州，这座有着2200多年历史的古城，曾是南宋都城，如今是现代与古典完美交融的东方名城。让我们一起开启这段美妙的杭州之旅吧！';

/**
 * 模拟 LLM 流式输出
 * 实际场景中，这里可能是 OpenAI SDK 的 stream 对象
 * @param text - 要流式输出的文本，按句子标点切分为多个 chunk
 * @param options - 配置选项
 * @param options.delay - 每个文本块的延迟时间（毫秒），默认 100ms
 */
export async function* mockLLMStream(
  text: string,
  options?: { delay?: number }
): AsyncIterable<string> {
  const delay = options?.delay ?? 100;
  // 按句子级标点切分，保留标点在当前 chunk 末尾
  const chunks = text.match(/[^。！？；]+[。！？；]?/g) ?? [text];

  for (const chunk of chunks) {
    await new Promise((resolve) => setTimeout(resolve, delay));
    console.log(`[${timestamp()}] LLM 输出: "${chunk}"`);
    yield chunk;
  }

  console.log(`[${timestamp()}] LLM 流结束`);
}

/**
 * 从目录中按顺序读取 Opus 文件，返回 AsyncIterable<Buffer>
 */
export async function* readOpusPackets(directory: string): AsyncIterable<Buffer> {
  const files = readdirSync(directory)
    .filter((f) => f.toLowerCase().endsWith('.opus'))
    .sort((a, b) => {
      const numA = Number.parseInt(a.match(/^(\d+)/)?.[1] ?? '0', 10);
      const numB = Number.parseInt(b.match(/^(\d+)/)?.[1] ?? '0', 10);
      return numA - numB;
    });

  for (const file of files) {
    yield await readFile(path.join(directory, file));
  }
}
