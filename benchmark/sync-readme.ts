#!/usr/bin/env node
/**
 * 将 benchmark 结果同步到 README.md
 * 独立脚本，需要手动执行 pnpm benchmark:sync
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { BenchmarkReport, ProviderSummary } from './metrics/types';
import { generateMarkdownReport } from './utils/report-generator';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PERFORMANCE_TABLE_START = '<!-- PERFORMANCE_TABLE_START -->';
const PERFORMANCE_TABLE_END = '<!-- PERFORMANCE_TABLE_END -->';

/**
 * 同步 README.md 中的性能基准测试表格
 */
function syncReadme(): void {
  // 读取 benchmark JSON
  const jsonPath = join(__dirname, 'results/latest/benchmark.json');

  if (!existsSync(jsonPath)) {
    console.error('❌ 未找到 benchmark 结果文件，请先运行 pnpm benchmark');
    console.error(`   期望路径: ${jsonPath}`);
    process.exit(1);
  }

  const report: BenchmarkReport = JSON.parse(readFileSync(jsonPath, 'utf-8'));

  // 读取 README.md
  const readmePath = join(__dirname, '..', 'README.md');

  if (!existsSync(readmePath)) {
    console.error('❌ 未找到 README.md 文件');
    process.exit(1);
  }

  const readme = readFileSync(readmePath, 'utf-8');

  // 查找标记位置
  const startIndex = readme.indexOf(PERFORMANCE_TABLE_START);
  const endIndex = readme.indexOf(PERFORMANCE_TABLE_END);

  if (startIndex === -1 || endIndex === -1) {
    console.error('❌ 未找到性能表格标记，请确保 README.md 中包含:');
    console.error(`   ${PERFORMANCE_TABLE_START}`);
    console.error(`   ${PERFORMANCE_TABLE_END}`);
    process.exit(1);
  }

  // 生成新的性能表格内容
  const markdown = generateMarkdownReport(report);

  // 构建新的内容（保留标记注释）
  const beforeTable = readme.slice(0, startIndex + PERFORMANCE_TABLE_START.length);
  const afterTable = readme.slice(endIndex);

  // 替换标记之间的内容
  const newReadme = `${beforeTable}

${markdown}

${afterTable}`;

  writeFileSync(readmePath, newReadme);

  console.log('✓ README.md 性能基准测试章节已更新');
  console.log(`  更新时间: ${new Date().toLocaleString('zh-CN')}`);
  console.log(
    `  TTS 提供商: ${report.ttsProviders.map((p: ProviderSummary) => p.capabilities.displayName).join(', ') || '无'}`
  );
  console.log(
    `  ASR 提供商: ${report.asrProviders.map((p: ProviderSummary) => p.capabilities.displayName).join(', ') || '无'}`
  );
}

syncReadme();
