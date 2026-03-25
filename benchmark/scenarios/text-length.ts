/**
 * 文本长度测试场景
 * 测试不同文本长度对 TTS 性能的影响
 */

import { textFixtures } from '../fixtures/texts';
import type { BenchmarkResult, ScenarioConfig } from '../metrics/types';
import { getLatencyFromResult, getProviderConfigs, runTTSTest } from '../runners/tts-runner';

/**
 * 场景配置
 */
export const scenarioConfig: ScenarioConfig = {
  name: 'text-length',
  description: '测试不同文本长度对 TTS 性能的影响',
  testType: 'tts',
  inputMode: 'non-stream',
  outputMode: 'stream',
  iterations: 3,
  timeout: 60000,
};

/**
 * 运行文本长度测试场景
 */
export async function runTextLengthScenario(options?: {
  providers?: string[];
  iterations?: number;
}): Promise<BenchmarkResult[]> {
  const results: BenchmarkResult[] = [];
  const providerConfigs = getProviderConfigs().filter(
    (p) => !options?.providers || options.providers.includes(p.provider)
  );
  const iterations = options?.iterations || scenarioConfig.iterations;

  console.log('\n=== 文本长度测试场景 ===\n');
  console.log(`测试目标: 评估不同文本长度下的首包延迟和总延迟`);

  for (const providerConfig of providerConfigs) {
    console.log(`\n--- ${providerConfig.displayName} ---`);

    // 导入 provider 模块
    await import(`../../src/tts/providers/${providerConfig.provider}`);

    for (const text of textFixtures) {
      console.log(`\n  文本: "${text.name}" (${text.text.length} 字符, ${text.category})`);

      for (let i = 0; i < iterations; i++) {
        const result = await runTTSTest(providerConfig, text, {
          inputMode: 'non-stream',
          outputMode: 'stream',
        });
        results.push(result);

        const status = result.status === 'success' ? '✓' : '✗';
        const latency = getLatencyFromResult(result);
        console.log(
          `    [${i + 1}/${iterations}] ${status} 首包: ${latency.firstChunk}ms, 总计: ${latency.total}ms`
        );
      }
    }
  }

  return results;
}
