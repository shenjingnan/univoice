// 导出 Provider 类（命名导出，可被 tree-shake）

// 导入 providers 以触发自动注册（副作用导入）
import './providers/index';

export * from '@/types/tts';
// 导出工厂函数和基类
export { BaseTTS } from './base';
export { createTTS, getTTSProviders, registerTTSProvider } from './factory';
export { DoubaoTTS } from './providers/doubao';
export { GeminiTTS } from './providers/gemini';
export { MinimaxTTS } from './providers/minimax';
export { OpenAITTS, OpenAITTS as TTS1 } from './providers/openai';
export { QwenTTS } from './providers/qwen';
export { XfyunTTS } from './providers/xfyun';
// 导出工具函数
export * from './utils/index';
