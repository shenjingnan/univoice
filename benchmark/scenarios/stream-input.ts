/**
 * 流式输入测试场景
 * 测试不同流式输入速度对 TTS 性能的影响
 */

import { textFixtures } from '../fixtures/texts';
import type { BenchmarkResult, ScenarioConfig, StreamInputConfig } from '../metrics/types';
import { getLatencyFromResult, getProviderConfigs, runTTSTest } from '../runners/tts-runner';

/**
 * 场景配置
 */
export const scenarioConfig: ScenarioConfig = {
  name: 'stream-input',
  description: '测试不同流式输入速度对 TTS 性能的影响',
  testType: 'tts',
  inputMode: 'stream',
  outputMode: 'stream',
  iterations: 3,
  timeout: 120000,
};

/**
 * 流式输入配置
 */
export const streamInputConfigs: StreamInputConfig[] = [
  { name: 'fast', interval: 50, description: '快速流式（50ms 间隔）' },
  { name: 'normal', interval: 100, description: '正常流式（100ms 间隔）' },
  { name: 'slow', interval: 200, description: '慢速流式（200ms 间隔）' },
];

/**
 * 运行流式输入测试场景
 */
export async function runStreamInputScenario(options?: {
  providers?: string[];
  iterations?: number;
  streamConfigs?: StreamInputConfig[];
}): Promise<BenchmarkResult[]> {
  const results: BenchmarkResult[] = [];
  const providerConfigs = getProviderConfigs()
    .filter((p) => !options?.providers || options.providers.includes(p.provider))
    .filter((p) => p.streamInput); // 只测试支持流式输入的提供商

  const iterations = options?.iterations || scenarioConfig.iterations;
  const streamConfigs = options?.streamConfigs || streamInputConfigs;

  console.log('\n=== 流式输入测试场景 ===\n');
  console.log(`测试目标: 评估不同流式输入速度下的首包延迟`);

  // 只使用中等长度文本进行测试
  const testTexts = textFixtures.filter((t) => t.category === 'medium');

  for (const providerConfig of providerConfigs) {
    console.log(`\n--- ${providerConfig.displayName} ---`);

    // 导入 provider 模块
    await import(`../../src/tts/providers/${providerConfig.provider}`);

    for (const text of testTexts) {
      console.log(`\n  文本: "${text.name}" (${text.text.length} 字符)`);

      for (const streamConfig of streamConfigs) {
        console.log(`\n    流式配置: ${streamConfig.description}`);

        for (let i = 0; i < iterations; i++) {
          const result = await runTTSTest(providerConfig, text, {
            inputMode: 'stream',
            outputMode: 'stream',
            streamConfig,
          });
          results.push(result);

          const status = result.status === 'success' ? '✓' : '✗';
          const latency = getLatencyFromResult(result);
          console.log(
            `      [${i + 1}/${iterations}] ${status} 首包: ${latency.firstChunk}ms, 总计: ${latency.total}ms`
          );
        }
      }
    }
  }

  return results;
}
