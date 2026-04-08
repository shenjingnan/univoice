// 导出 Provider 类（命名导出，可被 tree-shake）

export * from '@/types/asr';
// 导出工厂函数和基类
export { BaseASR } from './base';
export { createASR, getASRProviders, registerASRProvider } from './factory';
export { DoubaoASR } from './providers/doubao';
export { GeminiASR } from './providers/gemini';
export { MinimaxASR } from './providers/minimax';
export { WhisperASR } from './providers/openai';
export { QwenASR } from './providers/qwen';
export { XfyunASR } from './providers/xfyun';
// 导出工具函数
export * from './utils/index';
