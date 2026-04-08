/**
 * 音频测试数据管理
 * 用于 ASR 性能测试
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AudioFixture } from '../metrics/types';
import { textFixtures } from './texts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = join(__filename, '..'); // benchmark/fixtures/

/**
 * 标准音频格式配置
 * 用于 ASR 测试的统一格式
 */
export const STANDARD_AUDIO_FORMAT = {
  /** 采样率 16kHz */
  sampleRate: 16000,
  /** 单声道 */
  channels: 1,
  /** 16-bit PCM */
  bitDepth: 16,
  /** 格式标识 */
  format: 'pcm' as const,
} as const;

/**
 * 获取 PCM 文件扩展名
 */
export function getPCMFilename(originalFilename: string): string {
  const baseName = originalFilename.replace(/\.[^.]+$/, '');
  return `${baseName}.pcm`;
}

/**
 * 音频文件配置
 * 对应 texts.ts 中的文本
 */
const audioConfigs = [
  // {
  //   name: 'short-greeting',
  //   textFixture: 'simple-greeting',
  //   filename: 'short-greeting.mp3',
  //   estimatedDuration: 2,
  //   format: 'mp3',
  // },
  {
    name: 'medium-intro',
    textFixture: 'intro-paragraph',
    filename: 'medium-intro.mp3',
    estimatedDuration: 15,
    format: 'mp3',
  },
  // {
  //   name: 'long-article',
  //   textFixture: 'article-long',
  //   filename: 'long-article.mp3',
  //   estimatedDuration: 60,
  //   format: 'mp3',
  // },
];

/**
 * 获取音频目录路径
 */
export function getAudioDir(): string {
  return join(__dirname, 'audio');
}

/**
 * 检查音频文件是否存在
 */
export function hasAudioFixtures(): boolean {
  const audioDir = getAudioDir();
  if (!existsSync(audioDir)) {
    return false;
  }

  // 检查至少有一个 PCM 文件存在
  return audioConfigs.some((config) => {
    const pcmFilename = getPCMFilename(config.filename);
    return existsSync(join(audioDir, pcmFilename));
  });
}

/**
 * 使用 ffmpeg 将音频文件转换为标准 PCM 格式
 * @param inputPath 输入文件路径
 * @param outputPath 输出文件路径
 */
export function convertToPCM(inputPath: string, outputPath: string): void {
  const args = [
    '-y', // 覆盖输出文件
    '-i',
    inputPath,
    '-f',
    's16le', // 16-bit little-endian PCM
    '-acodec',
    'pcm_s16le',
    '-ar',
    String(STANDARD_AUDIO_FORMAT.sampleRate),
    '-ac',
    String(STANDARD_AUDIO_FORMAT.channels),
    outputPath,
  ];

  try {
    execFileSync('ffmpeg', args, { stdio: 'pipe' });
  } catch (error) {
    throw new Error(`音频转换失败: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * 批量转换所有音频文件为 PCM 格式
 * @returns 转换后的文件路径列表
 */
export function convertAllToPCM(): string[] {
  const audioDir = getAudioDir();
  const convertedFiles: string[] = [];

  for (const config of audioConfigs) {
    const inputPath = join(audioDir, config.filename);
    const pcmFilename = getPCMFilename(config.filename);
    const outputPath = join(audioDir, pcmFilename);

    if (existsSync(inputPath) && !existsSync(outputPath)) {
      console.log(`  转换: ${config.filename} -> ${pcmFilename}`);
      convertToPCM(inputPath, outputPath);
      convertedFiles.push(outputPath);
    }
  }

  return convertedFiles;
}

/**
 * 获取音频 fixture 列表
 * 优先返回 PCM 格式文件
 */
export async function getAudioFixtures(): Promise<AudioFixture[]> {
  const audioDir = getAudioDir();
  const fixtures: AudioFixture[] = [];

  for (const config of audioConfigs) {
    // 优先使用 PCM 文件
    const pcmFilename = getPCMFilename(config.filename);
    const pcmPath = join(audioDir, pcmFilename);
    const mp3Path = join(audioDir, config.filename);

    // 确定 PCM 文件路径和格式
    const filePath = existsSync(pcmPath) ? pcmPath : mp3Path;
    const fileFormat = existsSync(pcmPath) ? 'pcm' : config.format;

    if (existsSync(filePath)) {
      // 尝试获取实际文件大小来估算时长
      let duration = config.estimatedDuration;
      try {
        const stats = await stat(filePath);
        if (fileFormat === 'pcm') {
          // PCM 文件大小计算时长: sampleRate * channels * bitDepth/8
          // 16kHz * 1 * 2 = 32000 bytes/s
          const bytesPerSecond =
            STANDARD_AUDIO_FORMAT.sampleRate *
            STANDARD_AUDIO_FORMAT.channels *
            (STANDARD_AUDIO_FORMAT.bitDepth / 8);
          duration = Math.round(stats.size / bytesPerSecond);
        } else {
          // MP3 文件大小估算：128kbps ≈ 16KB/s
          const estimatedFromSize = Math.round((stats.size / 1024 / 16) * 0.8);
          if (estimatedFromSize > 0) {
            duration = estimatedFromSize;
          }
        }
      } catch {
        // 使用预估时长
      }

      // 获取对应的预期文本（用于准确率计算）
      const textFixture = textFixtures.find((t) => t.name === config.textFixture);

      fixtures.push({
        name: config.name,
        path: filePath,
        duration,
        format: fileFormat,
        textFixture: config.textFixture,
        expectedText: textFixture?.text,
        // 添加 PCM 格式的详细信息
        audioFormat: existsSync(pcmPath)
          ? {
              sampleRate: STANDARD_AUDIO_FORMAT.sampleRate,
              channels: STANDARD_AUDIO_FORMAT.channels,
              bitDepth: STANDARD_AUDIO_FORMAT.bitDepth,
            }
          : undefined,
      });
    }
  }

  return fixtures;
}

/**
 * 使用 TTS 服务生成音频文件
 * 生成 MP3 后自动转换为 PCM 格式
 */
export async function generateAudioFixtures(options?: { provider?: string }): Promise<void> {
  // 动态导入 TTS 相关模块
  const { createTTS } = await import('../../src/tts/factory');
  await import('../../src/tts/providers'); // 注册所有 provider

  const { getProviderConfigs } = await import('../runners/tts-runner');

  const providerConfigs = getProviderConfigs();
  if (providerConfigs.length === 0) {
    throw new Error('没有可用的 TTS 提供商配置，请检查环境变量');
  }

  // 选择提供商（优先使用指定的，否则选择第一个可用的）
  const providerConfig = options?.provider
    ? providerConfigs.find((p) => p.provider === options.provider)
    : providerConfigs[0];

  if (!providerConfig) {
    throw new Error(
      `指定的 TTS 提供商 "${options?.provider}" 不可用，可用的提供商: ${providerConfigs.map((p) => p.provider).join(', ')}`
    );
  }

  console.log(`使用 TTS 提供商: ${providerConfig.displayName}`);

  // 确保音频目录存在
  const audioDir = getAudioDir();
  if (!existsSync(audioDir)) {
    mkdirSync(audioDir, { recursive: true });
  }

  // 创建 TTS 实例
  const tts = createTTS({
    provider: providerConfig.provider,
    model: providerConfig.model,
    voice: providerConfig.voice,
    format: 'mp3',
    ...providerConfig.createConfig,
  } as Parameters<typeof createTTS>[0]);

  // 为每个配置生成音频
  for (const config of audioConfigs) {
    const textFixture = textFixtures.find((t) => t.name === config.textFixture);
    if (!textFixture) {
      console.log(`⚠️ 找不到文本 fixture: ${config.textFixture}`);
      continue;
    }

    const mp3Path = join(audioDir, config.filename);
    const pcmFilename = getPCMFilename(config.filename);
    const pcmPath = join(audioDir, pcmFilename);
    console.log(`生成音频: ${config.name} (${textFixture.text.length} 字符)...`);

    try {
      // 使用非流式合成获取完整音频
      const response = await tts.synthesize({ text: textFixture.text });

      // 保存 MP3 文件
      writeFileSync(mp3Path, response.audio);
      console.log(`  ✓ 已保存 MP3: ${mp3Path}`);

      // 转换为 PCM 格式
      convertToPCM(mp3Path, pcmPath);
      console.log(`  ✓ 已转换 PCM: ${pcmPath}`);
    } catch (error) {
      console.error(`  ✗ 生成失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  console.log('\n音频生成完成！');
}

/**
 * 清理音频文件
 */
export function clearAudioFixtures(): void {
  const audioDir = getAudioDir();
  if (!existsSync(audioDir)) {
    return;
  }

  for (const config of audioConfigs) {
    // 清理 MP3 文件
    const mp3Path = join(audioDir, config.filename);
    if (existsSync(mp3Path)) {
      unlinkSync(mp3Path);
    }

    // 清理 PCM 文件
    const pcmFilename = getPCMFilename(config.filename);
    const pcmPath = join(audioDir, pcmFilename);
    if (existsSync(pcmPath)) {
      unlinkSync(pcmPath);
    }
  }
}
