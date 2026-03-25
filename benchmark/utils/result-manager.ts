/**
 * 结果管理工具
 * 用于增量测试和结果合并
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { BenchmarkReport, BenchmarkResult, IncrementalTestResult } from '../metrics/types';
import { getLatencyFromResult } from '../runners/tts-runner';

const __filename = fileURLToPath(import.meta.url);
const __dirname = join(__filename, '..', '..');

/**
 * 获取结果目录路径
 */
export function getResultsDir(): string {
  return join(__dirname, 'results');
}

/**
 * 获取历史记录目录路径
 */
export function getHistoryDir(): string {
  return join(getResultsDir(), 'history');
}

/**
 * 获取最新报告目录路径
 */
export function getLatestDir(): string {
  return join(getResultsDir(), 'latest');
}

/**
 * 生成时间戳文件名
 */
export function generateTimestampFilename(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}-${minutes}-${seconds}.json`;
}

/**
 * 确保目录存在
 */
function ensureDir(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

/**
 * 保存增量测试结果
 */
export function saveIncrementalResult(result: IncrementalTestResult): string {
  const historyDir = getHistoryDir();
  ensureDir(historyDir);

  const filename = generateTimestampFilename();
  const filePath = join(historyDir, filename);

  writeFileSync(filePath, JSON.stringify(result, null, 2));
  console.log(`✓ 增量结果已保存: ${filePath}`);

  return filePath;
}

/**
 * 读取所有历史结果
 */
export function loadHistoryResults(): IncrementalTestResult[] {
  const historyDir = getHistoryDir();
  if (!existsSync(historyDir)) {
    return [];
  }

  const files = readdirSync(historyDir)
    .filter((f) => f.endsWith('.json'))
    .sort();

  const results: IncrementalTestResult[] = [];

  for (const file of files) {
    try {
      const content = readFileSync(join(historyDir, file), 'utf-8');
      const result = JSON.parse(content) as IncrementalTestResult;
      results.push(result);
    } catch (error) {
      console.warn(`警告: 无法读取历史文件 ${file}: ${error}`);
    }
  }

  return results;
}

/**
 * 合并多个测试结果
 */
export function mergeResults(results: IncrementalTestResult[]): BenchmarkReport {
  const allResults: BenchmarkResult[] = [];
  const ttsProviders = new Map<
    string,
    { displayName: string; streamInput: boolean; streamOutput: boolean }
  >();
  const asrProviders = new Map<
    string,
    { displayName: string; streamInput: boolean; streamOutput: boolean }
  >();

  for (const result of results) {
    allResults.push(...result.results);

    // 收集提供商信息
    for (const provider of result.ttsProviders) {
      ttsProviders.set(provider.provider, {
        displayName: provider.displayName,
        streamInput: provider.streamInput,
        streamOutput: provider.streamOutput,
      });
    }

    for (const provider of result.asrProviders) {
      asrProviders.set(provider.provider, {
        displayName: provider.displayName,
        streamInput: provider.streamInput,
        streamOutput: provider.streamOutput,
      });
    }
  }

  // 构建提供商摘要
  const ttsProviderSummaries = Array.from(ttsProviders.entries()).map(([provider, info]) => {
    const providerResults = allResults.filter(
      (r) => r.provider === provider && r.testType === 'tts'
    );
    const successResults = providerResults.filter((r) => r.status === 'success');
    const firstChunkLatencies = successResults.map((r) => getLatencyFromResult(r).firstChunk);

    return {
      provider,
      capabilities: {
        provider,
        displayName: info.displayName,
        streamInput: info.streamInput,
        streamOutput: info.streamOutput,
        protocol: 'websocket' as const,
      },
      performance: {
        avgFirstChunkLatency:
          firstChunkLatencies.length > 0
            ? firstChunkLatencies.reduce((a, b) => a + b, 0) / firstChunkLatencies.length
            : 0,
        successRate:
          providerResults.length > 0 ? successResults.length / providerResults.length : 0,
        sampleCount: providerResults.length,
      },
    };
  });

  const asrProviderSummaries = Array.from(asrProviders.entries()).map(([provider, info]) => {
    const providerResults = allResults.filter(
      (r) => r.provider === provider && r.testType === 'asr'
    );
    const successResults = providerResults.filter((r) => r.status === 'success');
    const firstChunkLatencies = successResults.map((r) => getLatencyFromResult(r).firstChunk);

    return {
      provider,
      capabilities: {
        provider,
        displayName: info.displayName,
        streamInput: info.streamInput,
        streamOutput: info.streamOutput,
        protocol: 'websocket' as const,
      },
      performance: {
        avgFirstChunkLatency:
          firstChunkLatencies.length > 0
            ? firstChunkLatencies.reduce((a, b) => a + b, 0) / firstChunkLatencies.length
            : 0,
        successRate:
          providerResults.length > 0 ? successResults.length / providerResults.length : 0,
        sampleCount: providerResults.length,
      },
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    environment: results[0]?.environment || {
      node: process.version,
      platform: process.platform,
      arch: process.arch,
    },
    ttsProviders: ttsProviderSummaries,
    asrProviders: asrProviderSummaries,
    results: allResults,
  };
}

/**
 * 保存合并后的报告
 */
export function saveMergedReport(report: BenchmarkReport, mdContent: string): void {
  const latestDir = getLatestDir();
  ensureDir(latestDir);

  const jsonPath = join(latestDir, 'benchmark.json');
  const mdPath = join(latestDir, 'benchmark.md');

  writeFileSync(jsonPath, JSON.stringify(report, null, 2));
  console.log(`✓ 合并报告已保存: ${jsonPath}`);

  writeFileSync(mdPath, mdContent);
  console.log(`✓ Markdown 报告已保存: ${mdPath}`);
}

/**
 * 创建增量测试结果
 */
export function createIncrementalResult(report: BenchmarkReport): IncrementalTestResult {
  return {
    timestamp: report.generatedAt,
    environment: report.environment,
    ttsProviders: report.ttsProviders.map((p) => ({
      provider: p.provider,
      displayName: p.capabilities.displayName,
      streamInput: p.capabilities.streamInput,
      streamOutput: p.capabilities.streamOutput,
    })),
    asrProviders: report.asrProviders.map((p) => ({
      provider: p.provider,
      displayName: p.capabilities.displayName,
      streamInput: p.capabilities.streamInput,
      streamOutput: p.capabilities.streamOutput,
    })),
    results: report.results,
  };
}
