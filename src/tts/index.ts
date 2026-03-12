// 导出 Provider 类（命名导出，可被 tree-shake）

export * from '@/types/tts';
// 导出工厂函数和基类
export { BaseTTS } from './base';
export { createTTS, getTTSProviders, registerTTSProvider } from './factory';
export { DoubaoTTS } from './providers/doubao';
export { GeminiTTS } from './providers/gemini';
export { MinimaxTTS } from './providers/minimax';
export { TTS1 } from './providers/openai';
export { QwenTTS } from './providers/qwen';
// 导出工具函数
export * from './utils/index';
