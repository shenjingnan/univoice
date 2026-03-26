/**
 * ASR 矩阵测试类型定义
 */
import type {
  ASRMatrixFilter,
  ASRMatrixItem,
  ASRMatrixScenarioConfig,
  BenchmarkResult,
} from '../../../metrics/types';

/**
 * ASR 提供商矩阵配置
 * 用于定义单个提供商的 ASR 矩阵测试配置
 */
export interface ASRProviderMatrixConfig {
  /** 提供商标识 */
  provider: string;
  /** 显示名称 */
  displayName: string;
  /** 矩阵测试项列表 */
  items: ASRMatrixItem[];
  /** 场景配置 */
  scenarioConfig: ASRMatrixScenarioConfig;
  /**
   * 创建 ASR 配置的工厂函数
   * @param matrixConfig ASR 矩阵测试配置
   * @returns ASR 配置对象
   */
  createConfigFactory: (matrixConfig: ASRMatrixItem) => Record<string, unknown>;
}

/**
 * ASR 矩阵测试运行选项
 */
export interface ASRMatrixRunOptions {
  /** 迭代次数 */
  iterations?: number;
  /** 过滤条件 */
  filter?: ASRMatrixFilter;
  /** 任务间隔时间（毫秒），默认 1000 */
  interval?: number;
  /** 进度回调 */
  onProgress?: (
    current: number,
    total: number,
    config: ASRMatrixItem,
    result: BenchmarkResult
  ) => void;
}

/**
 * 单提供商 ASR 矩阵测试运行选项
 */
export interface ASRProviderMatrixRunOptions extends ASRMatrixRunOptions {
  /** 指定提供商（单提供商模式） */
  provider: string;
}

/**
 * 全量 ASR 矩阵测试运行选项
 */
export interface ASRAllMatrixRunOptions extends ASRMatrixRunOptions {
  /** 指定提供商列表（可选，不指定则运行全部） */
  providers?: string[];
}

// 重新导出类型
export type {
  ASRMatrixFilter,
  ASRMatrixItem,
  ASRMatrixScenarioConfig,
  BenchmarkResult,
};