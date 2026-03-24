/**
 * ASR 性能测试运行器
 */
import 'dotenv/config';
import type { BaseASR } from '../../src/asr/base';
import { createASR } from '../../src/asr/factory';
import type { AudioStream } from '../../src/types/asr';
import { MetricsCollector } from '../metrics/collector';
import type {
  AudioFixture,
  BenchmarkConfig,
  BenchmarkResult,
  RawAccuracyData,
} from '../metrics/types';
import { saveSingleResult, toSingleTestResult } from '../utils/result-writer';

/**
 * ASR 提供商配置
 */
export interface ASRProviderConfig {
  /** 提供商标识 */
  provider: string;
  /** 显示名称 */
  displayName: string;
  /** 模型名称 */
  model: string;
  /** 是否支持流式输入 */
  streamInput: boolean;
  /** 是否支持流式输出 */
  streamOutput: boolean;
  /** 创建实例的配置 */
  createConfig: Record<string, unknown>;
}

/**
 * 从环境变量获取 ASR 提供商配置
 */
export function getASRProviderConfigs(): ASRProviderConfig[] {
  const configs: ASRProviderConfig[] = [];

  // Qwen
  if (process.env.QWEN_API_KEY) {
    configs.push({
      provider: 'qwen',
      displayName: '通义千问',
      model: 'paraformer-realtime-v2',
      streamInput: true,
      streamOutput: true,
      createConfig: {
        apiKey: process.env.QWEN_API_KEY,
        model: 'paraformer-realtime-v2',
        language: 'zh-CN',
        format: 'pcm',
        audioFormat: {
          sampleRate: 16000,
        },
      },
    });
  }

  // Doubao
  if (process.env.DOUBAO_APP_KEY && process.env.DOUBAO_ACCESS_TOKEN) {
    configs.push({
      provider: 'doubao',
      displayName: '豆包',
      model: 'bigmodel',
      streamInput: true,
      streamOutput: true,
      createConfig: {
        appKey: process.env.DOUBAO_APP_KEY,
        accessKey: process.env.DOUBAO_ACCESS_TOKEN,
        resourceId: process.env.DOUBAO_RESOURCE_ID,
        language: 'zh-CN',
        format: 'pcm',
        audioFormat: {
          sampleRate: 16000,
        },
      },
    });
  }

  // GLM
  if (process.env.GLM_API_KEY) {
    configs.push({
      provider: 'glm',
      displayName: '智谱 GLM',
      model: 'glm-asr-2512',
      streamInput: false, // 模拟支持
      streamOutput: true,
      createConfig: {
        apiKey: process.env.GLM_API_KEY,
        model: 'glm-asr-2512',
        language: 'zh-CN',
        format: 'pcm',
        audioFormat: {
          sampleRate: 16000,
        },
      },
    });
  }

  return configs;
}

/**
 * 创建音频流
 */
async function* createAudioStream(buffer: Buffer, chunkSize = 4096): AudioStream {
  for (let i = 0; i < buffer.length; i += chunkSize) {
    yield buffer.subarray(i, Math.min(i + chunkSize, buffer.length));
  }
}

/**
 * 测试流式输入 ASR
 */
async function testStreamInput(
  asr: BaseASR,
  audioBuffer: Buffer,
  audioDuration: number,
  config: BenchmarkConfig,
  expectedText?: string
): Promise<BenchmarkResult> {
  const collector = new MetricsCollector();
  collector.startCollecting();

  try {
    const audioStream = createAudioStream(audioBuffer);
    let textLength = 0;
    let recognizedText = '';

    for await (const chunk of asr.listen(audioStream, { stream: true })) {
      collector.addChunk(new Uint8Array(Buffer.from(chunk.text)));
      if (chunk.isFinal && chunk.text) {
        textLength += chunk.text.length;
        recognizedText += chunk.text;
      }
    }

    collector.endCollecting();
    collector.setTextLength(textLength);

    // 计算 RTF
    const totalTime = collector.getLatencyMetrics().total;
    const rtf = audioDuration > 0 ? totalTime / 1000 / audioDuration : 0;

    const result = collector.buildResult(
      asr.name,
      asr.model,
      'asr',
      'stream-input-stream-output',
      { ...config, audioDuration },
      'success'
    );

    // 添加 RTF
    result.latency.rtf = rtf;

    // 存储原始准确率数据（不计算，由分析阶段处理）
    if (expectedText || recognizedText) {
      result.accuracy = {
        expectedText,
        actualText: recognizedText,
      } as RawAccuracyData;
    }

    return result;
  } catch (error) {
    collector.endCollecting();
    return collector.buildResult(
      asr.name,
      asr.model,
      'asr',
      'stream-input-stream-output',
      config,
      'error',
      error instanceof Error ? error.message : String(error)
    );
  }
}

/**
 * 测试非流式输入 ASR
 */
async function testNonStreamInput(
  asr: BaseASR,
  audioBuffer: Buffer,
  audioDuration: number,
  config: BenchmarkConfig,
  expectedText?: string
): Promise<BenchmarkResult> {
  const collector = new MetricsCollector();
  collector.startCollecting();

  try {
    const response = await asr.listen(audioBuffer);
    collector.addChunk(new Uint8Array(Buffer.from(response.text)));
    collector.endCollecting();
    collector.setTextLength(response.text.length);

    // 计算 RTF
    const totalTime = collector.getLatencyMetrics().total;
    const rtf = audioDuration > 0 ? totalTime / 1000 / audioDuration : 0;

    const result = collector.buildResult(
      asr.name,
      asr.model,
      'asr',
      'non-stream-input-non-stream-output',
      { ...config, audioDuration },
      'success'
    );

    result.latency.rtf = rtf;

    // 存储原始准确率数据（不计算，由分析阶段处理）
    if (expectedText || response.text) {
      result.accuracy = {
        expectedText,
        actualText: response.text,
      } as RawAccuracyData;
    }

    return result;
  } catch (error) {
    collector.endCollecting();
    return collector.buildResult(
      asr.name,
      asr.model,
      'asr',
      'non-stream-input-non-stream-output',
      config,
      'error',
      error instanceof Error ? error.message : String(error)
    );
  }
}

/**
 * 运行单个 ASR 测试
 */
export async function runASRTest(
  providerConfig: ASRProviderConfig,
  audioBuffer: Buffer,
  audioDuration: number,
  options: {
    inputMode: 'stream' | 'non-stream';
    expectedText?: string;
  }
): Promise<BenchmarkResult> {
  // 创建 ASR 实例
  const asr = createASR({
    provider: providerConfig.provider,
    model: providerConfig.model,
    ...providerConfig.createConfig,
  } as Parameters<typeof createASR>[0]);

  const config: BenchmarkConfig = {
    inputMode: options.inputMode,
    outputMode: 'stream',
    format: 'pcm',
  };

  if (options.inputMode === 'stream') {
    return testStreamInput(asr, audioBuffer, audioDuration, config, options.expectedText);
  }

  return testNonStreamInput(asr, audioBuffer, audioDuration, config, options.expectedText);
}

/**
 * 运行完整的 ASR 测试套件
 */
export async function runASRSuite(options?: {
  providers?: string[];
  iterations?: number;
  audioFiles?: AudioFixture[];
  /** 是否原子化保存每次测试结果 */
  atomicSave?: boolean;
}): Promise<BenchmarkResult[]> {
  const results: BenchmarkResult[] = [];
  let globalIteration = 0;

  // 导入所有 provider 模块（自动注册）
  await import('../../src/asr/providers');

  const providerConfigs = getASRProviderConfigs().filter(
    (p) => !options?.providers || options.providers.includes(p.provider)
  );
  const iterations = options?.iterations || 3;
  const atomicSave = options?.atomicSave ?? true;

  console.log(`\n=== ASR 性能测试 ===\n`);
  console.log(`已配置的提供商: ${providerConfigs.map((p) => p.displayName).join(', ')}`);
  console.log(`每项测试重复: ${iterations} 次`);
  console.log(`原子化保存: ${atomicSave ? '启用' : '禁用'}\n`);

  // 如果没有提供音频文件，使用默认的
  // 实际使用时应该提供真实的音频文件
  const audioFiles: AudioFixture[] = options?.audioFiles || [];

  if (audioFiles.length === 0) {
    console.log('警告: 没有提供音频测试文件，跳过 ASR 测试');
    return results;
  }

  for (const providerConfig of providerConfigs) {
    console.log(`\n--- 测试提供商: ${providerConfig.displayName} ---\n`);

    for (const audio of audioFiles) {
      console.log(`\n  音频: "${audio.name}" (${audio.duration}s, ${audio.format})`);

      // 读取音频文件
      const { readFile } = await import('node:fs/promises');
      const audioBuffer = await readFile(audio.path);

      // 测试流式输入
      if (providerConfig.streamInput) {
        for (let i = 0; i < iterations; i++) {
          globalIteration++;
          try {
            const result = await runASRTest(providerConfig, audioBuffer, audio.duration, {
              inputMode: 'stream',
              expectedText: audio.expectedText,
            });

            // 原子化保存
            if (atomicSave) {
              const singleResult = toSingleTestResult(result, globalIteration);
              saveSingleResult(singleResult);
              console.log(
                `    [${i + 1}/${iterations}] 流式入: 首包 ${result.latency.firstChunk}ms, RTF ${result.latency.rtf?.toFixed(2) || 'N/A'} ✓ 已保存`
              );
            } else {
              console.log(
                `    [${i + 1}/${iterations}] 流式入: 首包 ${result.latency.firstChunk}ms, RTF ${result.latency.rtf?.toFixed(2) || 'N/A'}`
              );
            }

            results.push(result);
          } catch (error) {
            console.error(
              `    [${i + 1}/${iterations}] 流式入: 失败 - ${error instanceof Error ? error.message : String(error)}`
            );
          }
          // 每次测试后等待 1 秒，避免连接复用问题
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }

      // 测试非流式输入
      for (let i = 0; i < iterations; i++) {
        globalIteration++;
        try {
          const result = await runASRTest(providerConfig, audioBuffer, audio.duration, {
            inputMode: 'non-stream',
            expectedText: audio.expectedText,
          });

          // 原子化保存
          if (atomicSave) {
            const singleResult = toSingleTestResult(result, globalIteration);
            saveSingleResult(singleResult);
            console.log(
              `    [${i + 1}/${iterations}] 非流式入: 总计 ${result.latency.total}ms, RTF ${result.latency.rtf?.toFixed(2) || 'N/A'} ✓ 已保存`
            );
          } else {
            console.log(
              `    [${i + 1}/${iterations}] 非流式入: 总计 ${result.latency.total}ms, RTF ${result.latency.rtf?.toFixed(2) || 'N/A'}`
            );
          }

          results.push(result);
        } catch (error) {
          console.error(
            `    [${i + 1}/${iterations}] 非流式入: 失败 - ${error instanceof Error ? error.message : String(error)}`
          );
        }
        // 每次测试后等待 1 秒，避免连接复用问题
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  }

  return results;
}
