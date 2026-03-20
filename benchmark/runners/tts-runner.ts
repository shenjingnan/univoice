/**
 * TTS 性能测试运行器
 */
import 'dotenv/config';
import type { BaseTTS } from '../../src/tts/base';
import { createTTS } from '../../src/tts/factory';
import { MetricsCollector } from '../metrics/collector';
import type {
  BenchmarkConfig,
  BenchmarkResult,
  StreamInputConfig,
  TextFixture,
} from '../metrics/types';

/**
 * 提供商配置
 */
export interface ProviderConfig {
  /** 提供商标识 */
  provider: string;
  /** 显示名称 */
  displayName: string;
  /** 模型名称 */
  model: string;
  /** 音色 */
  voice: string;
  /** 是否支持流式输入 */
  streamInput: boolean;
  /** 是否支持流式输出 */
  streamOutput: boolean;
  /** 创建实例的配置 */
  createConfig: Record<string, unknown>;
}

/**
 * 从环境变量获取提供商配置
 */
export function getProviderConfigs(): ProviderConfig[] {
  const configs: ProviderConfig[] = [];

  // Doubao
  if (process.env.DOUBAO_APP_KEY && process.env.DOUBAO_ACCESS_TOKEN) {
    configs.push({
      provider: 'doubao',
      displayName: '豆包',
      model: 'seed-tts-2.0',
      voice: process.env.DOUBAO_VOICE_TYPE || 'zh_female_tianmeixiaoyuan_moon_bigtts',
      streamInput: true,
      streamOutput: true,
      createConfig: {
        appId: process.env.DOUBAO_APP_KEY,
        accessToken: process.env.DOUBAO_ACCESS_TOKEN,
        resourceId: process.env.DOUBAO_RESOURCE_ID || 'seed-tts-2.0',
        format: 'mp3',
        sampleRate: 24000,
      },
    });
  }

  // Qwen
  if (process.env.QWEN_API_KEY) {
    configs.push({
      provider: 'qwen',
      displayName: '通义千问',
      model: 'cosyvoice-v3-flash',
      voice: 'longxiaochun_v3',
      streamInput: true,
      streamOutput: true,
      createConfig: {
        apiKey: process.env.QWEN_API_KEY,
        model: 'cosyvoice-v3-flash',
        voice: 'longxiaochun_v3',
        format: 'mp3',
      },
    });
  }

  // Minimax
  if (process.env.MINIMAX_API_KEY) {
    configs.push({
      provider: 'minimax',
      displayName: 'MiniMax',
      model: 'speech-2.8-hd',
      voice: 'male-qn-qingse',
      streamInput: true,
      streamOutput: true,
      createConfig: {
        apiKey: process.env.MINIMAX_API_KEY,
        groupId: process.env.MINIMAX_GROUP_ID,
        model: 'speech-2.8-hd',
        voice: 'male-qn-qingse',
        format: 'mp3',
      },
    });
  }

  // GLM
  if (process.env.GLM_API_KEY) {
    configs.push({
      provider: 'glm',
      displayName: '智谱 GLM',
      model: 'glm-tts',
      voice: 'tongtong',
      streamInput: false,
      streamOutput: true,
      createConfig: {
        apiKey: process.env.GLM_API_KEY,
        model: 'glm-tts',
        voice: 'tongtong',
        format: 'pcm',
      },
    });
  }

  return configs;
}

/**
 * 创建文本流生成器
 */
function createTextStream(
  text: string,
  chunkSize: number,
  interval: number
): AsyncGenerator<string> {
  return (async function* () {
    // 按字符数分割
    for (let i = 0; i < text.length; i += chunkSize) {
      const chunk = text.slice(i, i + chunkSize);
      yield chunk;
      if (interval > 0) {
        await new Promise((resolve) => setTimeout(resolve, interval));
      }
    }
  })();
}

/**
 * 测试非流式输入、非流式输出
 */
async function testNonStreamInOut(
  tts: BaseTTS,
  text: string,
  config: BenchmarkConfig
): Promise<BenchmarkResult> {
  const collector = new MetricsCollector();
  collector.setTextLength(text.length);
  collector.startCollecting();

  try {
    const response = await tts.synthesize({ text });
    collector.addChunk(new Uint8Array(response.audio));
    collector.endCollecting();

    return collector.buildResult(
      tts.name,
      tts.model,
      'tts',
      'non-stream-in-non-stream-out',
      config,
      'success'
    );
  } catch (error) {
    collector.endCollecting();
    return collector.buildResult(
      tts.name,
      tts.model,
      'tts',
      'non-stream-in-non-stream-out',
      config,
      'error',
      error instanceof Error ? error.message : String(error)
    );
  }
}

/**
 * 测试非流式输入、流式输出
 */
async function testNonStreamInStreamOut(
  tts: BaseTTS,
  text: string,
  config: BenchmarkConfig
): Promise<BenchmarkResult> {
  const collector = new MetricsCollector();
  collector.setTextLength(text.length);
  collector.startCollecting();

  try {
    for await (const { audioChunk } of tts.speak(text, { stream: true })) {
      collector.addChunk(audioChunk);
    }
    collector.endCollecting();

    return collector.buildResult(
      tts.name,
      tts.model,
      'tts',
      'non-stream-in-stream-out',
      config,
      'success'
    );
  } catch (error) {
    collector.endCollecting();
    return collector.buildResult(
      tts.name,
      tts.model,
      'tts',
      'non-stream-in-stream-out',
      config,
      'error',
      error instanceof Error ? error.message : String(error)
    );
  }
}

/**
 * 测试流式输入、流式输出
 */
async function testStreamInOut(
  tts: BaseTTS,
  text: string,
  streamConfig: StreamInputConfig,
  config: BenchmarkConfig
): Promise<BenchmarkResult> {
  const collector = new MetricsCollector();
  collector.setTextLength(text.length);
  collector.startCollecting();

  try {
    // 创建文本流（每次发送 5 个字符）
    const textStream = createTextStream(text, 5, streamConfig.interval);

    for await (const { audioChunk } of tts.speak(textStream, { stream: true })) {
      collector.addChunk(audioChunk);
    }
    collector.endCollecting();

    return collector.buildResult(
      tts.name,
      tts.model,
      'tts',
      `stream-in-stream-out-${streamConfig.name}`,
      config,
      'success'
    );
  } catch (error) {
    collector.endCollecting();
    return collector.buildResult(
      tts.name,
      tts.model,
      'tts',
      `stream-in-stream-out-${streamConfig.name}`,
      config,
      'error',
      error instanceof Error ? error.message : String(error)
    );
  }
}

/**
 * 运行单个 TTS 测试
 */
export async function runTTSTest(
  providerConfig: ProviderConfig,
  text: TextFixture,
  options: {
    inputMode: 'stream' | 'non-stream';
    outputMode: 'stream' | 'non-stream';
    streamConfig?: StreamInputConfig;
  }
): Promise<BenchmarkResult> {
  // 创建 TTS 实例
  const tts = createTTS({
    provider: providerConfig.provider,
    model: providerConfig.model,
    voice: providerConfig.voice,
    format: 'mp3',
    ...providerConfig.createConfig,
  } as Parameters<typeof createTTS>[0]);

  const config: BenchmarkConfig = {
    inputMode: options.inputMode,
    outputMode: options.outputMode,
    format: 'mp3',
    textLength: text.text.length,
  };

  // 根据输入输出模式选择测试方法
  if (options.inputMode === 'non-stream' && options.outputMode === 'non-stream') {
    return testNonStreamInOut(tts, text.text, config);
  }

  if (options.inputMode === 'non-stream' && options.outputMode === 'stream') {
    return testNonStreamInStreamOut(tts, text.text, config);
  }

  if (options.inputMode === 'stream' && options.outputMode === 'stream') {
    if (!providerConfig.streamInput) {
      // 不支持流式输入，跳过
      const collector = new MetricsCollector();
      return collector.buildResult(
        providerConfig.provider,
        providerConfig.model,
        'tts',
        'stream-in-stream-out',
        config,
        'error',
        'Provider does not support stream input'
      );
    }
    if (!options.streamConfig) {
      const collector = new MetricsCollector();
      return collector.buildResult(
        providerConfig.provider,
        providerConfig.model,
        'tts',
        'stream-in-stream-out',
        config,
        'error',
        'Stream config is required for stream input mode'
      );
    }
    return testStreamInOut(tts, text.text, options.streamConfig, config);
  }

  // 不支持的组合
  const collector = new MetricsCollector();
  return collector.buildResult(
    providerConfig.provider,
    providerConfig.model,
    'tts',
    'unsupported',
    config,
    'error',
    'Unsupported input/output mode combination'
  );
}

/**
 * 运行完整的 TTS 测试套件
 */
export async function runTTSSuite(options?: {
  providers?: string[];
  iterations?: number;
}): Promise<BenchmarkResult[]> {
  const results: BenchmarkResult[] = [];

  // 导入所有 provider 模块（自动注册）
  await import('../../src/tts/providers');

  const providerConfigs = getProviderConfigs().filter(
    (p) => !options?.providers || options.providers.includes(p.provider)
  );
  const iterations = options?.iterations || 3;

  // 流式输入配置
  const streamConfigs: StreamInputConfig[] = [
    { name: 'fast', interval: 50, description: '快速流式（50ms）' },
    { name: 'normal', interval: 100, description: '正常流式（100ms）' },
    { name: 'slow', interval: 200, description: '慢速流式（200ms）' },
  ];

  console.log(`\n=== TTS 性能测试 ===\n`);
  console.log(`已配置的提供商: ${providerConfigs.map((p) => p.displayName).join(', ')}`);
  console.log(`每项测试重复: ${iterations} 次\n`);

  for (const providerConfig of providerConfigs) {
    console.log(`\n--- 测试提供商: ${providerConfig.displayName} ---\n`);

    // 测试不同文本长度
    const { textFixtures } = await import('../fixtures/texts');

    for (const text of textFixtures.slice(0, 3)) {
      // 只测试前 3 个文本以节省时间
      console.log(`\n  文本: "${text.name}" (${text.text.length} 字符)`);

      // 1. 非流式输入 + 非流式输出
      for (let i = 0; i < iterations; i++) {
        const result = await runTTSTest(providerConfig, text, {
          inputMode: 'non-stream',
          outputMode: 'non-stream',
        });
        results.push(result);
        console.log(
          `    [${i + 1}/${iterations}] 非流式入/出: 首包 ${result.latency.firstChunk}ms, 总计 ${result.latency.total}ms`
        );
        // 每次测试后等待 1 秒，避免连接复用问题
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      // 2. 非流式输入 + 流式输出
      if (providerConfig.streamOutput) {
        for (let i = 0; i < iterations; i++) {
          const result = await runTTSTest(providerConfig, text, {
            inputMode: 'non-stream',
            outputMode: 'stream',
          });
          results.push(result);
          console.log(
            `    [${i + 1}/${iterations}] 非流式入/流式出: 首包 ${result.latency.firstChunk}ms, 总计 ${result.latency.total}ms`
          );
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }

      // 3. 流式输入 + 流式输出（仅测试 normal 配置）
      if (providerConfig.streamInput && providerConfig.streamOutput) {
        const streamConfig = streamConfigs[1]; // normal
        for (let i = 0; i < iterations; i++) {
          const result = await runTTSTest(providerConfig, text, {
            inputMode: 'stream',
            outputMode: 'stream',
            streamConfig,
          });
          results.push(result);
          console.log(
            `    [${i + 1}/${iterations}] 流式入/出: 首包 ${result.latency.firstChunk}ms, 总计 ${result.latency.total}ms`
          );
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }
    }
  }

  return results;
}
