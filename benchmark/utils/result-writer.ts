/**
 * 结果写入工具
 * 用于将单次测试结果保存为独立的 JSON 文件
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { BenchmarkResult, SingleTestResult } from '../metrics/types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = join(__filename, '..', '..', '..');

/**
 * 获取结果存储根目录
 */
export function getResultsRootDir(): string {
  return join(__dirname, 'benchmark', 'results');
}

/**
 * 获取运行结果目录（存放原子化 JSON）
 */
export function getRunsDir(): string {
  return join(getResultsRootDir(), 'runs');
}

/**
 * 获取最新报告目录
 */
export function getLatestDir(): string {
  return join(getResultsRootDir(), 'latest');
}

/**
 * 生成文件名
 * 格式：<provider>-<testType>-<scenario>-<YYYYMMDD>-<HHmmss>-<iteration>.json
 */
export function generateResultFilename(
  provider: string,
  testType: 'tts' | 'asr',
  scenario: string,
  timestamp: Date,
  iteration: number
): string {
  const year = timestamp.getFullYear();
  const month = String(timestamp.getMonth() + 1).padStart(2, '0');
  const day = String(timestamp.getDate()).padStart(2, '0');
  const hours = String(timestamp.getHours()).padStart(2, '0');
  const minutes = String(timestamp.getMinutes()).padStart(2, '0');
  const seconds = String(timestamp.getSeconds()).padStart(2, '0');
  const iterStr = String(iteration).padStart(3, '0');

  // 将斜杠替换为下划线，避免路径重复展开
  const safeScenario = scenario.replace(/\//g, '_');
  return `${provider}-${testType}-${safeScenario}-${year}${month}${day}-${hours}${minutes}${seconds}-${iterStr}.json`;
}

/**
 * 获取结果存储目录路径
 * 格式：runs/<testType>/<provider>/<scenario>/
 */
export function getResultDir(testType: 'tts' | 'asr', provider: string, scenario: string): string {
  return join(getRunsDir(), testType, provider, scenario);
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
 * 保存单次测试结果
 * @param result 单次测试结果
 * @returns 保存的文件路径
 */
export function saveSingleResult(result: SingleTestResult): string {
  const timestamp = new Date(result.timestamp);
  const dir = getResultDir(result.testType, result.provider, result.scenario);
  ensureDir(dir);

  const filename = generateResultFilename(
    result.provider,
    result.testType,
    result.scenario,
    timestamp,
    result.iteration
  );

  const filePath = join(dir, filename);
  writeFileSync(filePath, JSON.stringify(result, null, 2));

  return filePath;
}

/**
 * 批量保存测试结果
 * @param results 测试结果数组
 * @returns 保存的文件路径列表
 */
export function saveBatchResults(results: SingleTestResult[]): string[] {
  return results.map((result) => saveSingleResult(result));
}

/**
 * 从 BenchmarkResult 转换为 SingleTestResult
 * 只保留原始准确率数据（expectedText, actualText）
 */
export function toSingleTestResult(result: BenchmarkResult, iteration: number): SingleTestResult {
  // 提取原始准确率数据
  let rawAccuracy: SingleTestResult['accuracy'];
  if (result.accuracy) {
    rawAccuracy = {
      expectedText: result.accuracy.expectedText,
      actualText: result.accuracy.actualText,
    };
  }

  return {
    ...result,
    iteration,
    accuracy: rawAccuracy,
  };
}
