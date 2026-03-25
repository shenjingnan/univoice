/**
 * 音频格式测试场景
 * 测试不同音频格式对 TTS/ASR 性能的影响
 */

import { textFixtures } from '../fixtures/texts';
import type { BenchmarkResult, ScenarioConfig } from '../metrics/types';
import type { ProviderConfig } from '../runners/tts-runner';
import { getLatencyFromResult, getProviderConfigs, runTTSTest } from '../runners/tts-runner';

/**
 * 场景配置
 */
export const scenarioConfig: ScenarioConfig = {
  name: 'audio-format',
  description: '测试不同音频格式对 TTS 性能的影响',
  testType: 'tts',
  inputMode: 'non-stream',
  outputMode: 'stream',
  iterations: 3,
  timeout: 60000,
};

/**
 * 支持的音频格式
 */
export const audioFormats = [
  { format: 'mp3', description: 'MP3 格式（有损压缩）' },
  { format: 'wav', description: 'WAV 格式（无损）' },
  { format: 'pcm', description: 'PCM 格式（原始音频）' },
] as const;

/**
 * 运行音频格式测试场景
 */
export async function runAudioFormatScenario(options?: {
  providers?: string[];
  iterations?: number;
  formats?: readonly (typeof audioFormats)[number][];
}): Promise<BenchmarkResult[]> {
  const results: BenchmarkResult[] = [];
  const providerConfigs = getProviderConfigs().filter(
    (p) => !options?.providers || options.providers.includes(p.provider)
  );
  const iterations = options?.iterations || scenarioConfig.iterations;
  const formats = options?.formats || audioFormats;

  console.log('\n=== 音频格式测试场景 ===\n');
  console.log(`测试目标: 评估不同音频格式对性能的影响`);

  // 使用短文本进行快速测试
  const testText = textFixtures.find((t) => t.category === 'short') || textFixtures[0];

  for (const providerConfig of providerConfigs) {
    console.log(`\n--- ${providerConfig.displayName} ---`);

    // 导入 provider 模块
    await import(`../../src/tts/providers/${providerConfig.provider}`);

    for (const { format, description } of formats) {
      console.log(`\n  格式: ${description}`);

      for (let i = 0; i < iterations; i++) {
        // 创建带格式配置的提供商配置
        const formatConfig: ProviderConfig = {
          ...providerConfig,
          createConfig: {
            ...providerConfig.createConfig,
            format,
          },
        };

        const result = await runTTSTest(formatConfig, testText, {
          inputMode: 'non-stream',
          outputMode: 'stream',
        });
        results.push(result);

        const status = result.status === 'success' ? '✓' : '✗';
        const size = result.quality.dataSize;
        const latency = getLatencyFromResult(result);
        console.log(
          `    [${i + 1}/${iterations}] ${status} 首包: ${latency.firstChunk}ms, 大小: ${size} bytes`
        );
      }
    }
  }

  return results;
}
