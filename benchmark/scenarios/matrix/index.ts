/**
 * 矩阵测试统一入口
 */

// 导出提供商配置
export {
  ALL_PROVIDER_MATRIX_CONFIGS,
  DOUBAO_MATRIX_CONFIG,
  doubaoMatrixItems,
  doubaoScenarioConfig,
  GLM_MATRIX_CONFIG,
  getProviderConfig,
  getProviderConfigs,
  glmMatrixItems,
  glmScenarioConfig,
  MIMO_MATRIX_CONFIG,
  MINIMAX_MATRIX_CONFIG,
  mimoMatrixItems,
  mimoScenarioConfig,
  minimaxMatrixItems,
  minimaxScenarioConfig,
  QWEN_MATRIX_CONFIG,
  qwenMatrixItems,
  qwenScenarioConfig,
  XFYUN_MATRIX_CONFIG,
  xfyunMatrixItems,
  xfyunScenarioConfig,
} from './providers';
// 导出运行器
export {
  getProviderMatrixConfig,
  runMatrixScenario,
  runProviderMatrixScenario,
  runSingleMatrixTest,
} from './runner';
// 导出类型
export type {
  AllMatrixRunOptions,
  BenchmarkResult,
  MatrixFilter,
  MatrixItem,
  MatrixRunOptions,
  MatrixScenarioConfig,
  ProviderMatrixConfig,
  ProviderMatrixRunOptions,
} from './types';
// 导出工具函数
export { filterMatrixItems, generateMatrixScenarioName, printMatrixSummary } from './utils';
