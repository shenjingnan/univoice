// 导入所有 provider 以触发注册（副作用导入）
import '@/asr/providers/doubao';
import '@/asr/providers/minimax';
import '@/asr/providers/qwen';
import '@/asr/providers/openai';
import '@/asr/providers/gemini';

export { BaseASR } from '@/asr/base';
export { createASR, getASRProviders, recognize, registerASRProvider } from '@/asr/factory';

export * from '@/asr/utils/index';
export * from '@/types/asr';
