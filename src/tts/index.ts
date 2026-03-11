// 导入所有 provider 以触发注册（副作用导入）
import '@/tts/providers/doubao';
import '@/tts/providers/minimax';
import '@/tts/providers/qwen';
import '@/tts/providers/openai';
import '@/tts/providers/gemini';

export { BaseTTS } from '@/tts/base';
export { createTTS, getTTSProviders, registerTTSProvider } from '@/tts/factory';

export * from '@/tts/utils/index';
export * from '@/types/tts';
