/**
 * ASR 矩阵测试运行器
 */
import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { createASR } from 'univoice/asr';
import { MetricsCollector } from '../../../metrics/collector';
import type { ASRMatrixItem, BenchmarkConfig, BenchmarkResult } from '../../../metrics/types';
import { saveSingleResult, toSingleTestResult } from '../../../utils/result-writer';
import { getASRProviderConfigs } from './providers';
import type { ASRAllMatrixRunOptions, ASRProviderMatrixConfig, ASRProviderMatrixRunOptions } from './types';
import {
  filterASRMatrixItems,
  generateASRMatrixScenarioName,
  printASRMatrixSummary,
  printASRProgress,
} from './utils';

/**
 * 估算音频时长（秒）
 */
function estimateAudioDuration(fileSize: number, format: string): number {
  if (fileSize === 0) return 0;

  // 简单估算：根据文件大小和格式估算时长
  const bitrateKbps: Record<string, number> = {
    mp3: 128,
    wav: 256,
    pcm: 256, // 16kHz, 16bit, mono
  };

  const kbps = bitrateKbps[format] || 128;
  return ((fileSize / 1024) * 8) / kbps;
}

/**
 * 运行单个 ASR 矩阵测试
 */
export async function runSingleASRMatrixTest(
  matrixConfig: ASRMatrixItem,
  audioFile: string,
  scenarioName: string,
  createConfig: Record<string, unknown>
): Promise<BenchmarkResult> {
  // 导入 provider 模块
  await import('univoice/asr/providers');

  // 创建 ASR 实例
  const asr = createASR({
    ...createConfig,
    model: matrixConfig.model,
    language: matrixConfig.language,
    format: matrixConfig.format,
  } as Parameters<typeof createASR>[0]);

  const config: BenchmarkConfig = {
    inputMode: 'non-stream',
    outputMode: 'stream',
    format: matrixConfig.format,
  };

  const collector = new MetricsCollector();
  collector.startCollecting();

  try {
    // 读取音频文件获取文件大小
    const audioBuffer = await readFile(audioFile);

    // 获取音频时长
    const audioDuration = estimateAudioDuration(audioBuffer.length, matrixConfig.format);
    config.audioDuration = audioDuration;

    // 执行流式识别
    let actualText = '';

    for await (const chunk of asr.listen(audioFile, { stream: true })) {
      const text = chunk.text || '';
      if (text) {
        actualText += text;
        // 模拟数据块（ASR 的输出是文本块）
        collector.addChunk(Buffer.from(text));
      }
    }

    collector.endCollecting();

    const result = collector.buildResult(
      asr.name,
      asr.model,
      'asr',
      scenarioName,
      config,
      'success'
    );

    // 设置识别文本长度
    result.quality.textLength = actualText.length;

    // 原子化保存
    const singleResult = toSingleTestResult(result, 1);
    saveSingleResult(singleResult);

    return result;
  } catch (error) {
    collector.endCollecting();
    const result = collector.buildResult(
      matrixConfig.provider,
      matrixConfig.model,
      'asr',
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
 * 运行单个提供商的 ASR 矩阵测试场景
 */
export async function runASRProviderMatrixScenario(
  providerConfig: ASRProviderMatrixConfig,
  audioFile: string,
  options?: ASRProviderMatrixRunOptions
): Promise<BenchmarkResult[]> {
  const results: BenchmarkResult[] = [];
  const iterations = options?.iterations || providerConfig.scenarioConfig.iterations;
  const interval = options?.interval ?? 1000;

  // 应用过滤条件
  const filteredItems = filterASRMatrixItems(providerConfig.items, options?.filter);

  if (filteredItems.length === 0) {
    console.warn('⚠️ 没有匹配的 ASR 矩阵测试项，请检查过滤条件');
    return results;
  }

  // 打印摘要
  printASRMatrixSummary(
    providerConfig.displayName,
    filteredItems,
    providerConfig.items.length,
    iterations,
    options?.filter
  );

  let currentTest = 0;
  const totalTests = filteredItems.length * iterations;

  console.log('开始执行 ASR 矩阵测试...\n');

  for (const matrixConfig of filteredItems) {
    const scenarioName = generateASRMatrixScenarioName(matrixConfig);
    const createConfig = providerConfig.createConfigFactory(matrixConfig);

    for (let i = 0; i < iterations; i++) {
      currentTest++;

      const result = await runSingleASRMatrixTest(matrixConfig, audioFile, scenarioName, createConfig);
      results.push(result);

      // 打印进度
      printASRProgress(currentTest, totalTests, scenarioName, i + 1, result);

      // 回调
      options?.onProgress?.(currentTest, totalTests, matrixConfig, result);

      // 测试间隔
      await new Promise((resolve) => setTimeout(resolve, interval));
    }
  }

  console.log(`\nASR 矩阵测试完成! 共执行 ${currentTest} 次测试`);

  return results;
}

/**
 * 运行 ASR 矩阵测试场景（支持全量或指定提供商）
 */
export async function runASRMatrixScenario(
  audioFile: string,
  options?: ASRAllMatrixRunOptions
): Promise<BenchmarkResult[]> {
  const allResults: BenchmarkResult[] = [];
  const providerConfigs = getASRProviderConfigs();

  // 过滤提供商
  const targetProviders = options?.providers
    ? providerConfigs.filter((p) => options.providers?.includes(p.provider))
    : providerConfigs;

  if (targetProviders.length === 0) {
    console.warn('⚠️ 没有匹配的 ASR 提供商');
    return allResults;
  }

  // 运行每个提供商的测试
  for (const providerConfig of targetProviders) {
    const results = await runASRProviderMatrixScenario(providerConfig, audioFile, {
      ...options,
      provider: providerConfig.provider,
    });
    allResults.push(...results);
  }

  return allResults;
}

/**
 * 根据提供商名称获取 ASR 矩阵测试配置
 */
export function getASRProviderMatrixConfig(providerName: string): ASRProviderMatrixConfig | undefined {
  const configs = getASRProviderConfigs();
  return configs.find((c) => c.provider === providerName);
}