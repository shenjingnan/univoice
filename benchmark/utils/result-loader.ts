/**
 * 结果加载工具
 * 用于从 runs/ 目录加载原子化存储的测试结果
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ResultFilter, SingleTestResult } from '../metrics/types';
import { getRunsDir } from './result-writer';

/**
 * 解析文件名提取元数据
 * 格式：<provider>-<testType>-<scenario>-<YYYYMMDD>-<HHmmss>-<iteration>.json
 */
export function parseResultFilename(filename: string): {
  provider: string;
  testType: 'tts' | 'asr';
  scenario: string;
  date: string;
  time: string;
  iteration: number;
} | null {
  const match = filename.match(
    /^([a-z][a-z0-9-]*)-(tts|asr)-([a-zA-Z0-9_.-]+)-(\d{8})-(\d{6})-(\d{3})\.json$/
  );

  if (!match) {
    return null;
  }

  return {
    provider: match[1],
    testType: match[2] as 'tts' | 'asr',
    scenario: match[3],
    date: match[4],
    time: match[5],
    iteration: Number.parseInt(match[6], 10),
  };
}

/**
 * 检查文件是否匹配筛选条件
 */
function matchesFilter(
  metadata: ReturnType<typeof parseResultFilename>,
  filter: ResultFilter
): boolean {
  if (!metadata) return false;

  // 筛选提供商
  if (filter.providers && filter.providers.length > 0) {
    if (!filter.providers.includes(metadata.provider)) {
      return false;
    }
  }

  // 筛选测试类型
  if (filter.testType && metadata.testType !== filter.testType) {
    return false;
  }

  // 筛选场景
  if (filter.scenario && metadata.scenario !== filter.scenario) {
    return false;
  }

  // 筛选日期范围
  const fileDate = metadata.date;
  if (filter.fromDate && fileDate < filter.fromDate.replace(/-/g, '')) {
    return false;
  }
  if (filter.toDate && fileDate > filter.toDate.replace(/-/g, '')) {
    return false;
  }

  return true;
}

/**
 * 扫描目录获取所有 JSON 文件
 */
function scanDirectory(dir: string, files: string[] = []): string[] {
  if (!existsSync(dir)) {
    return files;
  }

  const entries = readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      scanDirectory(fullPath, files);
    } else if (entry.isFile() && entry.name.endsWith('.json')) {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * 加载单个结果文件
 */
export function loadSingleResult(filePath: string): SingleTestResult | null {
  try {
    const content = readFileSync(filePath, 'utf-8');
    return JSON.parse(content) as SingleTestResult;
  } catch (error) {
    console.warn(`警告: 无法读取文件 ${filePath}: ${error}`);
    return null;
  }
}

/**
 * 加载所有结果
 */
export function loadAllResults(): SingleTestResult[] {
  const runsDir = getRunsDir();
  const files = scanDirectory(runsDir);

  const results: SingleTestResult[] = [];
  for (const file of files) {
    const result = loadSingleResult(file);
    if (result) {
      results.push(result);
    }
  }

  // 按时间戳排序
  results.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  return results;
}

/**
 * 根据筛选条件加载结果
 */
export function loadResults(filter: ResultFilter = {}): SingleTestResult[] {
  const runsDir = getRunsDir();

  // 如果指定了 testType，只扫描对应目录
  let searchDir = runsDir;
  if (filter.testType) {
    searchDir = join(runsDir, filter.testType);
  }

  const files = scanDirectory(searchDir);

  const results: SingleTestResult[] = [];
  for (const file of files) {
    const metadata = parseResultFilename(file.split('/').pop() || '');
    if (matchesFilter(metadata, filter)) {
      const result = loadSingleResult(file);
      if (result) {
        results.push(result);
      }
    }
  }

  // 按时间戳排序
  results.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  return results;
}

/**
 * 获取所有可用的提供商列表
 */
export function getAvailableProviders(): {
  tts: string[];
  asr: string[];
} {
  const runsDir = getRunsDir();
  const ttsProviders = new Set<string>();
  const asrProviders = new Set<string>();

  // 扫描 TTS 目录
  const ttsDir = join(runsDir, 'tts');
  if (existsSync(ttsDir)) {
    const providers = readdirSync(ttsDir, { withFileTypes: true });
    for (const p of providers) {
      if (p.isDirectory()) {
        ttsProviders.add(p.name);
      }
    }
  }

  // 扫描 ASR 目录
  const asrDir = join(runsDir, 'asr');
  if (existsSync(asrDir)) {
    const providers = readdirSync(asrDir, { withFileTypes: true });
    for (const p of providers) {
      if (p.isDirectory()) {
        asrProviders.add(p.name);
      }
    }
  }

  return {
    tts: Array.from(ttsProviders).sort(),
    asr: Array.from(asrProviders).sort(),
  };
}

/**
 * 获取所有可用的场景列表
 */
export function getAvailableScenarios(testType: 'tts' | 'asr', provider?: string): string[] {
  const runsDir = getRunsDir();
  const scenarios = new Set<string>();

  const typeDir = join(runsDir, testType);
  if (!existsSync(typeDir)) {
    return [];
  }

  const providerDirs = provider
    ? [join(typeDir, provider)]
    : readdirSync(typeDir, { withFileTypes: true })
        .filter((e) => e.isDirectory())
        .map((e) => join(typeDir, e.name));

  for (const dir of providerDirs) {
    if (!existsSync(dir)) continue;
    const scenarioDirs = readdirSync(dir, { withFileTypes: true });
    for (const s of scenarioDirs) {
      if (s.isDirectory()) {
        scenarios.add(s.name);
      }
    }
  }

  return Array.from(scenarios).sort();
}

/**
 * 统计结果数量
 */
export function countResults(filter: ResultFilter = {}): {
  total: number;
  byProvider: Record<string, number>;
  byScenario: Record<string, number>;
} {
  const results = loadResults(filter);

  const byProvider: Record<string, number> = {};
  const byScenario: Record<string, number> = {};

  for (const result of results) {
    byProvider[result.provider] = (byProvider[result.provider] || 0) + 1;
    const scenarioKey = `${result.testType}/${result.provider}/${result.scenario}`;
    byScenario[scenarioKey] = (byScenario[scenarioKey] || 0) + 1;
  }

  return {
    total: results.length,
    byProvider,
    byScenario,
  };
}
