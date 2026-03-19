/**
 * 音频测试数据管理
 * 用于 ASR 性能测试
 */
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AudioFixture } from '../runners/asr-runner';
import { textFixtures } from './texts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = join(__filename, '..'); // benchmark/fixtures/

/**
 * 音频文件配置
 * 对应 texts.ts 中的文本
 */
const audioConfigs = [
  {
    name: 'short-greeting',
    textFixture: 'simple-greeting',
    filename: 'short-greeting.mp3',
    estimatedDuration: 2,
    format: 'mp3',
  },
  {
    name: 'medium-intro',
    textFixture: 'intro-paragraph',
    filename: 'medium-intro.mp3',
    estimatedDuration: 15,
    format: 'mp3',
  },
  {
    name: 'long-article',
    textFixture: 'article-long',
    filename: 'long-article.mp3',
    estimatedDuration: 60,
    format: 'mp3',
  },
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

  // 检查至少有一个音频文件存在
  return audioConfigs.some((config) => existsSync(join(audioDir, config.filename)));
}

/**
 * 获取音频 fixture 列表
 */
export async function getAudioFixtures(): Promise<AudioFixture[]> {
  const audioDir = getAudioDir();
  const fixtures: AudioFixture[] = [];

  for (const config of audioConfigs) {
    const filePath = join(audioDir, config.filename);
    if (existsSync(filePath)) {
      // 尝试获取实际文件大小来估算时长
      let duration = config.estimatedDuration;
      try {
        const stats = await stat(filePath);
        // MP3 文件大小估算：128kbps ≈ 16KB/s
        // 使用文件大小估算时长（秒）
        const estimatedFromSize = Math.round((stats.size / 1024 / 16) * 0.8);
        if (estimatedFromSize > 0) {
          duration = estimatedFromSize;
        }
      } catch {
        // 使用预估时长
      }

      fixtures.push({
        name: config.name,
        path: filePath,
        duration,
        format: config.format,
      });
    }
  }

  return fixtures;
}

/**
 * 使用 TTS 服务生成音频文件
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

    const outputPath = join(audioDir, config.filename);
    console.log(`生成音频: ${config.name} (${textFixture.text.length} 字符)...`);

    try {
      // 使用非流式合成获取完整音频
      const response = await tts.synthesize({ text: textFixture.text });

      // 保存音频文件
      writeFileSync(outputPath, response.audio);
      console.log(`  ✓ 已保存: ${outputPath}`);
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
    const filePath = join(audioDir, config.filename);
    if (existsSync(filePath)) {
      unlinkSync(filePath);
    }
  }
}
