import { registerTTSProvider } from '../factory';
import { DoubaoTTS } from './doubao';
import { GeminiTTS } from './gemini';
import { GlmTTS } from './glm';
import { MinimaxTTS } from './minimax';
import { TTS1 } from './openai';
import { QwenTTS } from './qwen';

// 自动注册所有 provider
registerTTSProvider('doubao', DoubaoTTS);
registerTTSProvider('glm', GlmTTS);
registerTTSProvider('minimax', MinimaxTTS);
registerTTSProvider('qwen', QwenTTS);
registerTTSProvider('openai', TTS1);
registerTTSProvider('gemini', GeminiTTS);

// 导出所有 provider
export { DoubaoTTS, GeminiTTS, GlmTTS, MinimaxTTS, QwenTTS, TTS1 };
