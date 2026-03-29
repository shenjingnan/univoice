/**
 * 矩阵测试运行器
 */
import 'dotenv/config';
import { createTTS } from 'univoice/tts';
import { MetricsCollector } from '../../metrics/collector';
import type { BenchmarkConfig, BenchmarkResult, MatrixItem } from '../../metrics/types';
import { saveSingleResult, toSingleTestResult } from '../../utils/result-writer';
import { getProviderConfigs } from './providers';
import type { AllMatrixRunOptions, ProviderMatrixConfig, ProviderMatrixRunOptions } from './types';
import {
  filterMatrixItems,
  generateMatrixScenarioName,
  printMatrixSummary,
  printProgress,
} from './utils';

/**
 * 估算音频时长（秒）
 */
function estimateAudioDuration(audioSize: number, format: string): number {
  if (audioSize === 0) return 0;

  const bitrateKbps: Record<string, number> = {
    mp3: 128,
    wav: 256,
    pcm: 256,
    ogg: 112,
    ogg_opus: 112,
    opus: 64,
  };

  const kbps = bitrateKbps[format] || 128;
  return ((audioSize / 1024) * 8) / kbps;
}

/**
 * 计算音频码率（kbps）
 */
function calculateBitrate(audioSize: number, duration: number): number {
  if (duration === 0) return 0;
  return (audioSize * 8) / duration / 1000;
}

/**
 * 运行单个矩阵测试
 */
export async function runSingleMatrixTest(
  matrixConfig: MatrixItem,
  text: { text: string },
  scenarioName: string,
  createConfig: Record<string, unknown>
): Promise<BenchmarkResult> {
  // 导入 provider 模块
  await import('univoice/tts/providers');

  // 创建 TTS 实例
  const tts = createTTS({
    ...createConfig,
    model: matrixConfig.model,
    voice: matrixConfig.voice,
    format: matrixConfig.format,
    sampleRate: matrixConfig.sampleRate,
  } as Parameters<typeof createTTS>[0]);

  const config: BenchmarkConfig = {
    inputMode: 'non-stream',
    outputMode: 'stream',
    format: matrixConfig.format,
    textLength: text.text.length,
    voice: matrixConfig.voice,
    sampleRate: matrixConfig.sampleRate,
  };

  const collector = new MetricsCollector();
  collector.setTextLength(text.text.length);
  collector.startCollecting();

  try {
    let totalAudioSize = 0;
    for await (const { audioChunk } of tts.speak(text.text, { stream: true })) {
      collector.addChunk(audioChunk);
      totalAudioSize += audioChunk.length;
    }
    collector.endCollecting();

    const result = collector.buildResult(
      tts.name,
      tts.model,
      'tts',
      scenarioName,
      config,
      'success'
    );

    // 更新质量指标
    const duration = estimateAudioDuration(totalAudioSize, matrixConfig.format);
    const bitrate = calculateBitrate(totalAudioSize, duration);
    result.quality.audioDuration = Math.round(duration * 10) / 10;
    result.quality.bitrate = Math.round(bitrate);

    // 原子化保存
    const singleResult = toSingleTestResult(result, 1);
    saveSingleResult(singleResult);

    return result;
  } catch (error) {
    collector.endCollecting();
    const result = collector.buildResult(
      matrixConfig.provider,
      matrixConfig.model,
      'tts',
      scenarioName,
      config,
      'error',
      error instanceof Error ? error.message : String(error)
    );

    // 保存失败结果
    const singleResult = toSingleTestResult(result, 1);
    saveSingleResult(singleResult);

    return result;
  }
}

/**
 * 运行单个提供商的矩阵测试场景
 */
export async function runProviderMatrixScenario(
  providerConfig: ProviderMatrixConfig,
  options?: ProviderMatrixRunOptions
): Promise<BenchmarkResult[]> {
  // 动态导入以避免循环依赖
  const { textFixtures } = await import('../../fixtures/texts');

  const results: BenchmarkResult[] = [];
  const iterations = options?.iterations || providerConfig.scenarioConfig.iterations;
  const interval = options?.interval ?? 1000;

  // 使用第一个文本进行测试
  const text = textFixtures[0];
  if (!text) {
    throw new Error('没有可用的文本测试数据');
  }

  // 应用过滤条件
  const filteredItems = filterMatrixItems(providerConfig.items, options?.filter);

  if (filteredItems.length === 0) {
    console.warn('⚠️ 没有匹配的矩阵测试项，请检查过滤条件');
    return results;
  }

  // 打印摘要
  printMatrixSummary(
    providerConfig.displayName,
    filteredItems,
    providerConfig.items.length,
    iterations,
    options?.filter
  );

  let currentTest = 0;
  const totalTests = filteredItems.length * iterations;

  console.log('开始执行矩阵测试...\n');

  for (const matrixConfig of filteredItems) {
    const scenarioName = generateMatrixScenarioName(matrixConfig);
    const createConfig = providerConfig.createConfigFactory(matrixConfig);

    for (let i = 0; i < iterations; i++) {
      currentTest++;

      const result = await runSingleMatrixTest(matrixConfig, text, scenarioName, createConfig);
      results.push(result);

      // 打印进度
      printProgress(currentTest, totalTests, scenarioName, i + 1, result);

      // 回调
      options?.onProgress?.(currentTest, totalTests, matrixConfig, result);

      // 测试间隔
      await new Promise((resolve) => setTimeout(resolve, interval));
    }
  }

  console.log(`\n矩阵测试完成! 共执行 ${currentTest} 次测试`);

  return results;
}

/**
 * 运行矩阵测试场景（支持全量或指定提供商）
 */
export async function runMatrixScenario(options?: AllMatrixRunOptions): Promise<BenchmarkResult[]> {
  const allResults: BenchmarkResult[] = [];
  const providerConfigs = getProviderConfigs();

  // 过滤提供商
  const targetProviders = options?.providers
    ? providerConfigs.filter((p) => options.providers?.includes(p.provider))
    : providerConfigs;

  if (targetProviders.length === 0) {
    console.warn('⚠️ 没有匹配的提供商');
    return allResults;
  }

  // 运行每个提供商的测试
  for (const providerConfig of targetProviders) {
    const results = await runProviderMatrixScenario(providerConfig, {
      ...options,
      provider: providerConfig.provider,
    });
    allResults.push(...results);
  }

  return allResults;
}

/**
 * 根据提供商名称获取矩阵测试配置
 */
export function getProviderMatrixConfig(providerName: string): ProviderMatrixConfig | undefined {
  const configs = getProviderConfigs();
  return configs.find((c) => c.provider === providerName);
}
