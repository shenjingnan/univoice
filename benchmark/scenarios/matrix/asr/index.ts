/**
 * ASR 矩阵测试统一入口
 */

// 导出提供商配置
export {
  DOUBAO_ASR_MATRIX_CONFIG,
  doubaoASRMatrixItems,
  doubaoASRScenarioConfig,
  getASRProviderConfig,
  getASRProviderConfigs,
  QWEN_ASR_MATRIX_CONFIG,
  qwenASRMatrixItems,
  qwenASRScenarioConfig,
  XFYUN_ASR_MATRIX_CONFIG,
  xfyunASRMatrixItems,
  xfyunASRScenarioConfig,
} from './providers';

// 导出运行器
export {
  getASRProviderMatrixConfig,
  runASRMatrixScenario,
  runASRProviderMatrixScenario,
  runSingleASRMatrixTest,
} from './runner';

// 导出类型
export type {
  ASRAllMatrixRunOptions,
  ASRMatrixFilter,
  ASRMatrixItem,
  ASRMatrixRunOptions,
  ASRMatrixScenarioConfig,
  ASRProviderMatrixConfig,
  ASRProviderMatrixRunOptions,
  BenchmarkResult,
} from './types';

// 导出工具函数
export {
  filterASRMatrixItems,
  generateASRMatrixScenarioName,
  printASRMatrixSummary,
} from './utils';