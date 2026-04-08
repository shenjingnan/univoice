/**
 * TTS 性能测试运行器
 */
import 'dotenv/config';
import type { BaseTTS } from 'univoice/tts';
import { createTTS } from 'univoice/tts';
import { MetricsCollector } from '../metrics/collector';
import type {
  BenchmarkConfig,
  BenchmarkResult,
  LatencyMetrics,
  StreamInputConfig,
  TextFixture,
} from '../metrics/types';
import { saveSingleResult, toSingleTestResult } from '../utils/result-writer';

/**
 * 从 BenchmarkResult 的 chunks 计算延迟指标
 * 支持新旧两种格式
 */
export function getLatencyFromResult(result: BenchmarkResult): LatencyMetrics {
  // 旧格式兼容：如果存在 latency 字段，直接返回
  const legacyResult = result as unknown as { latency?: LatencyMetrics };
  if (legacyResult.latency) {
    return legacyResult.latency;
  }

  // 新格式：从 chunks 计算
  const chunks = result.throughput.chunks;
  if (!chunks || chunks.length === 0) {
    return { firstChunk: 0, total: 0 };
  }

  const firstChunk = chunks[0].relativeTime;
  const total = chunks[chunks.length - 1].relativeTime;

  return {
    firstChunk,
    total,
    perChar:
      result.quality.textLength && result.quality.textLength > 0
        ? total / result.quality.textLength
        : undefined,
  };
}

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
  /** 音频格式 */
  format?: 'mp3' | 'pcm' | 'opus' | 'wav' | 'ogg' | 'flac';
  /** 采样率 */
  sampleRate?: 16000 | 24000 | 48000;
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
        sampleRate: 24000,
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
        sampleRate: 24000,
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
        sampleRate: 16000,
      },
    });
  }

  // Xfyun
  if (process.env.XFYUN_APP_ID && process.env.XFYUN_API_KEY && process.env.XFYUN_API_SECRET) {
    configs.push({
      provider: 'xfyun',
      displayName: '科大讯飞',
      model: 'super-human-tts',
      voice: 'x5_lingxiaoxuan_flow',
      streamInput: true,
      streamOutput: true,
      createConfig: {
        appId: process.env.XFYUN_APP_ID,
        apiKey: process.env.XFYUN_API_KEY,
        apiSecret: process.env.XFYUN_API_SECRET,
        model: 'super-human-tts',
        voice: 'x5_lingxiaoxuan_flow',
        format: 'mp3',
        sampleRate: 24000,
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
 * 估算音频时长（秒）
 * 基于 MP3 文件大小和平均比特率估算
 * @param audioSize 音频大小（字节）
 * @param format 音频格式
 * @returns 估算时长（秒）
 */
function estimateAudioDuration(audioSize: number, format: string): number {
  if (audioSize === 0) return 0;

  // 不同格式的平均比特率估算
  const bitrateKbps: Record<string, number> = {
    mp3: 128, // MP3 平均比特率
    wav: 256, // WAV 无压缩，较高
    pcm: 256, // PCM 原始
    ogg: 112, // OGG Vorbis
  };

  const kbps = bitrateKbps[format] || 128;
  // 时长 = 大小(KB) * 8 / 比特率(kbps)
  return ((audioSize / 1024) * 8) / kbps;
}

/**
 * 计算音频码率（kbps）
 * @param audioSize 音频大小（字节）
 * @param duration 时长（秒）
 * @returns 码率（kbps）
 */
function calculateBitrate(audioSize: number, duration: number): number {
  if (duration === 0) return 0;
  // 码率 = 大小(bytes) * 8 / 时长(s) / 1000
  return (audioSize * 8) / duration / 1000;
}

/**
 * 更新结果的质量指标
 */
function updateQualityMetrics(result: BenchmarkResult, audioSize: number, format: string): void {
  const duration = estimateAudioDuration(audioSize, format);
  const bitrate = calculateBitrate(audioSize, duration);

  result.quality.audioDuration = Math.round(duration * 10) / 10; // 保留一位小数
  result.quality.bitrate = Math.round(bitrate);
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

    const result = collector.buildResult(
      tts.name,
      tts.model,
      'tts',
      'non-stream-in-non-stream-out',
      config,
      'success'
    );

    // 更新质量指标
    updateQualityMetrics(result, response.audio.length, config.format);

    return result;
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
    let totalAudioSize = 0;
    for await (const { audioChunk } of tts.speak(text, { stream: true })) {
      collector.addChunk(audioChunk);
      totalAudioSize += audioChunk.length;
    }
    collector.endCollecting();

    const result = collector.buildResult(
      tts.name,
      tts.model,
      'tts',
      'non-stream-in-stream-out',
      config,
      'success'
    );

    // 更新质量指标
    updateQualityMetrics(result, totalAudioSize, config.format);

    return result;
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

    let totalAudioSize = 0;
    for await (const { audioChunk } of tts.speak(textStream, { stream: true })) {
      collector.addChunk(audioChunk);
      totalAudioSize += audioChunk.length;
    }
    collector.endCollecting();

    const result = collector.buildResult(
      tts.name,
      tts.model,
      'tts',
      `stream-in-stream-out-${streamConfig.name}`,
      config,
      'success'
    );

    // 更新质量指标
    updateQualityMetrics(result, totalAudioSize, config.format);

    return result;
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
  // 从 createConfig 中提取采样率
  const sampleRate = providerConfig.createConfig.sampleRate as number | undefined;

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
    voice: providerConfig.voice,
    sampleRate,
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
  /** 是否原子化保存每次测试结果 */
  atomicSave?: boolean;
  /** 任务间隔时间（毫秒），默认 1000 */
  interval?: number;
}): Promise<BenchmarkResult[]> {
  const results: BenchmarkResult[] = [];
  let globalIteration = 0;

  // 导入所有 provider 模块（自动注册）
  await import('univoice/tts/providers');

  const providerConfigs = getProviderConfigs().filter(
    (p) => !options?.providers || options.providers.includes(p.provider)
  );
  const iterations = options?.iterations || 3;
  const atomicSave = options?.atomicSave ?? true;
  const interval = options?.interval ?? 1000;

  // 流式输入配置
  const streamConfigs: StreamInputConfig[] = [
    { name: 'fast', interval: 50, description: '快速流式（50ms）' },
    { name: 'normal', interval: 100, description: '正常流式（100ms）' },
    { name: 'slow', interval: 200, description: '慢速流式（200ms）' },
  ];

  console.log(`\n=== TTS 性能测试 ===\n`);
  console.log(`已配置的提供商: ${providerConfigs.map((p) => p.displayName).join(', ')}`);
  console.log(`每项测试重复: ${iterations} 次`);
  console.log(`原子化保存: ${atomicSave ? '启用' : '禁用'}\n`);

  for (const providerConfig of providerConfigs) {
    console.log(`\n--- 测试提供商: ${providerConfig.displayName} ---\n`);

    // 测试不同文本长度
    const { textFixtures } = await import('../fixtures/texts');

    for (const text of textFixtures.slice(0, 3)) {
      // 只测试前 3 个文本以节省时间
      console.log(`\n  文本: "${text.name}" (${text.text.length} 字符)`);

      // 1. 非流式输入 + 非流式输出
      for (let i = 0; i < iterations; i++) {
        globalIteration++;
        const result = await runTTSTest(providerConfig, text, {
          inputMode: 'non-stream',
          outputMode: 'non-stream',
        });
        results.push(result);

        // 原子化保存
        if (atomicSave) {
          const singleResult = toSingleTestResult(result, globalIteration);
          saveSingleResult(singleResult);
          console.log(
            `    [${i + 1}/${iterations}] 非流式入/出: 首包 ${getLatencyFromResult(result).firstChunk}ms, 总计 ${getLatencyFromResult(result).total}ms ✓ 已保存`
          );
        } else {
          console.log(
            `    [${i + 1}/${iterations}] 非流式入/出: 首包 ${getLatencyFromResult(result).firstChunk}ms, 总计 ${getLatencyFromResult(result).total}ms`
          );
        }

        // 每次测试后等待，避免连接复用问题
        await new Promise((resolve) => setTimeout(resolve, interval));
      }

      // 2. 非流式输入 + 流式输出
      if (providerConfig.streamOutput) {
        for (let i = 0; i < iterations; i++) {
          globalIteration++;
          const result = await runTTSTest(providerConfig, text, {
            inputMode: 'non-stream',
            outputMode: 'stream',
          });
          results.push(result);

          // 原子化保存
          if (atomicSave) {
            const singleResult = toSingleTestResult(result, globalIteration);
            saveSingleResult(singleResult);
            console.log(
              `    [${i + 1}/${iterations}] 非流式入/流式出: 首包 ${getLatencyFromResult(result).firstChunk}ms, 总计 ${getLatencyFromResult(result).total}ms ✓ 已保存`
            );
          } else {
            console.log(
              `    [${i + 1}/${iterations}] 非流式入/流式出: 首包 ${getLatencyFromResult(result).firstChunk}ms, 总计 ${getLatencyFromResult(result).total}ms`
            );
          }

          await new Promise((resolve) => setTimeout(resolve, interval));
        }
      }

      // 3. 流式输入 + 流式输出（仅测试 normal 配置）
      if (providerConfig.streamInput && providerConfig.streamOutput) {
        const streamConfig = streamConfigs[1]; // normal
        for (let i = 0; i < iterations; i++) {
          globalIteration++;
          const result = await runTTSTest(providerConfig, text, {
            inputMode: 'stream',
            outputMode: 'stream',
            streamConfig,
          });
          results.push(result);

          // 原子化保存
          if (atomicSave) {
            const singleResult = toSingleTestResult(result, globalIteration);
            saveSingleResult(singleResult);
            console.log(
              `    [${i + 1}/${iterations}] 流式入/出: 首包 ${getLatencyFromResult(result).firstChunk}ms, 总计 ${getLatencyFromResult(result).total}ms ✓ 已保存`
            );
          } else {
            console.log(
              `    [${i + 1}/${iterations}] 流式入/出: 首包 ${getLatencyFromResult(result).firstChunk}ms, 总计 ${getLatencyFromResult(result).total}ms`
            );
          }

          await new Promise((resolve) => setTimeout(resolve, interval));
        }
      }
    }
  }

  return results;
}
