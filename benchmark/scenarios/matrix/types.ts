/**
 * 矩阵测试类型定义
 */
import type {
  BenchmarkResult,
  MatrixFilter,
  MatrixItem,
  MatrixScenarioConfig,
} from '../../metrics/types';

/**
 * 提供商矩阵配置
 * 用于定义单个提供商的矩阵测试配置
 */
export interface ProviderMatrixConfig {
  /** 提供商标识 */
  provider: string;
  /** 显示名称 */
  displayName: string;
  /** 矩阵测试项列表 */
  items: MatrixItem[];
  /** 场景配置 */
  scenarioConfig: MatrixScenarioConfig;
  /**
   * 创建 TTS 配置的工厂函数
   * @param matrixConfig 矩阵测试配置
   * @returns TTS 配置对象
   */
  createConfigFactory: (matrixConfig: MatrixItem) => Record<string, unknown>;
}

/**
 * 矩阵测试运行选项
 */
export interface MatrixRunOptions {
  /** 迭代次数 */
  iterations?: number;
  /** 过滤条件 */
  filter?: MatrixFilter;
  /** 任务间隔时间（毫秒），默认 1000 */
  interval?: number;
  /** 进度回调 */
  onProgress?: (
    current: number,
    total: number,
    config: MatrixItem,
    result: BenchmarkResult
  ) => void;
}

/**
 * 单提供商矩阵测试运行选项
 */
export interface ProviderMatrixRunOptions extends MatrixRunOptions {
  /** 指定提供商（单提供商模式） */
  provider: string;
}

/**
 * 全量矩阵测试运行选项
 */
export interface AllMatrixRunOptions extends MatrixRunOptions {
  /** 指定提供商列表（可选，不指定则运行全部） */
  providers?: string[];
}

// 重新导出类型
export type { BenchmarkResult, MatrixFilter, MatrixItem, MatrixScenarioConfig };
