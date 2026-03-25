/**
 * 指标收集器
 * 用于收集和计算性能指标
 */
import { randomUUID } from 'node:crypto';
import type {
  BenchmarkConfig,
  BenchmarkResult,
  ChunkDetail,
  QualityMetrics,
  ThroughputMetrics,
} from './types';

/**
 * 计时器
 */
export class Timer {
  private startTime = 0;
  private firstChunkTime = 0;
  private endTime = 0;
  private isStarted = false;

  /**
   * 开始计时
   */
  start(): void {
    this.startTime = Date.now();
    this.isStarted = true;
  }

  /**
   * 记录首包时间
   */
  recordFirstChunk(): void {
    if (this.isStarted && this.firstChunkTime === 0) {
      this.firstChunkTime = Date.now();
    }
  }

  /**
   * 结束计时
   */
  end(): void {
    this.endTime = Date.now();
  }

  /**
   * 获取首包延迟
   */
  getFirstChunkLatency(): number {
    return this.firstChunkTime > 0 ? this.firstChunkTime - this.startTime : 0;
  }

  /**
   * 获取总延迟
   */
  getTotalLatency(): number {
    return this.endTime - this.startTime;
  }

  /**
   * 获取开始时间
   */
  getStartTime(): number {
    return this.startTime;
  }
}

/**
 * 指标收集器
 */
export class MetricsCollector {
  private timer = new Timer();
  private chunks: Uint8Array[] = [];
  private chunkDetails: ChunkDetail[] = [];
  private textLength = 0;

  /**
   * 开始收集
   */
  startCollecting(): void {
    this.timer.start();
    this.chunks = [];
    this.chunkDetails = [];
    this.textLength = 0;
  }

  /**
   * 添加数据块
   */
  addChunk(chunk: Uint8Array): void {
    // 记录当前时间
    const now = Date.now();
    const relativeTime = now - this.timer.getStartTime();

    // 记录 chunk 详情（包含绝对时间戳和相对时间）
    this.chunkDetails.push({
      timestamp: now,
      relativeTime,
      size: chunk.length,
    });

    this.chunks.push(chunk);
    this.timer.recordFirstChunk();
  }

  /**
   * 设置文本长度
   */
  setTextLength(length: number): void {
    this.textLength = length;
  }

  /**
   * 结束收集
   */
  endCollecting(): void {
    this.timer.end();
  }

  /**
   * 获取吞吐量指标
   */
  getThroughputMetrics(): ThroughputMetrics {
    const total = this.timer.getTotalLatency();
    const totalSize = this.chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const chunkCount = this.chunks.length;

    return {
      dataRate: total > 0 ? totalSize / total : 0,
      chunkCount,
      avgChunkSize: chunkCount > 0 ? totalSize / chunkCount : 0,
      chunks: this.chunkDetails,
    };
  }

  /**
   * 获取质量指标
   */
  getQualityMetrics(): QualityMetrics {
    const totalSize = this.chunks.reduce((sum, chunk) => sum + chunk.length, 0);

    return {
      dataSize: totalSize,
      textLength: this.textLength > 0 ? this.textLength : undefined,
    };
  }

  /**
   * 构建测试结果
   */
  buildResult(
    provider: string,
    model: string,
    testType: 'tts' | 'asr',
    scenario: string,
    config: BenchmarkConfig,
    status: 'success' | 'error' | 'timeout' = 'success',
    error?: string
  ): BenchmarkResult {
    return {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      provider,
      model,
      testType,
      scenario,
      config,
      startTime: this.timer.getStartTime(),
      throughput: this.getThroughputMetrics(),
      quality: this.getQualityMetrics(),
      status,
      error,
    };
  }
}

/**
 * 计算百分位数
 */
export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;

  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

/**
 * 计算平均值
 */
export function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/**
 * 计算成功率
 */
export function successRate(results: { status: string }[]): number {
  if (results.length === 0) return 0;
  const successCount = results.filter((r) => r.status === 'success').length;
  return successCount / results.length;
}

/**
 * 格式化毫秒为可读字符串
 */
export function formatMs(ms: number): string {
  if (ms < 1000) return `${ms.toFixed(0)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
  return `${(ms / 60000).toFixed(2)}min`;
}

/**
 * 格式化字节为可读字符串
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)}MB`;
}
