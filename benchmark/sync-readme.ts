#!/usr/bin/env node
/**
 * 将 benchmark 结果同步到 README.md 和 docs/content
 * 独立脚本，需要手动执行 pnpm benchmark:sync
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { BenchmarkReport, ProviderSummary } from './metrics/types';
import { generateDocsReport, generateMarkdownReport, syncToFile } from './utils/report-generator';

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

  // 同步到 README.md
  const readmeMarkdown = generateMarkdownReport(report);
  syncToFile(readmePath, readmeMarkdown);

  console.log('✓ README.md 性能基准测试章节已更新');

  // 同步到 docs/content/benchmark.mdx（完整文件生成，不使用标记替换）
  const docsPath = join(__dirname, '..', 'docs', 'content', 'benchmark.mdx');
  const docsReport = generateDocsReport(report);

  const docsContent = [
    '---',
    'title: 性能基准测试',
    '---',
    '',
    '本文档展示 univoice SDK 各语音服务提供商的性能基准测试数据，数据由自动化 benchmark 测试生成并自动同步。',
    '',
    '<Callout type="warning">',
    '  本报告仅反映在使用 **univoice** 时不同服务商和模型之间的**相对性能差异**，仅供参考，不代表服务商和模型的绝对性能。实际结果受网络环境、测试环境、服务商负载等多种因素影响。',
    '</Callout>',
    '',
    docsReport,
    '',
    '<Callout type="info">',
    '  以上数据由 benchmark 自动化测试生成。如需了解测试方法，请查看项目',
    '  [benchmark 目录](https://github.com/shenjingnan/univoice/tree/main/benchmark)。',
    '</Callout>',
    '',
  ].join('\n');

  writeFileSync(docsPath, docsContent);
  console.log('✓ docs/content/benchmark.mdx 性能基准测试章节已更新');
  console.log(`  更新时间: ${new Date().toLocaleString('zh-CN')}`);
  console.log(
    `  TTS 提供商: ${report.ttsProviders.map((p: ProviderSummary) => p.capabilities.displayName).join(', ') || '无'}`
  );
  console.log(
    `  ASR 提供商: ${report.asrProviders.map((p: ProviderSummary) => p.capabilities.displayName).join(', ') || '无'}`
  );
}

syncReadme();
