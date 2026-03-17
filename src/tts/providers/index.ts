import { registerTTSProvider } from '../factory';
import { DoubaoTTS } from './doubao';
import { GeminiTTS } from './gemini';
import { MinimaxTTS } from './minimax';
import { TTS1 } from './openai';
import { QwenTTS } from './qwen';

// 自动注册所有 provider
registerTTSProvider('doubao', DoubaoTTS);
registerTTSProvider('minimax', MinimaxTTS);
registerTTSProvider('qwen', QwenTTS);
registerTTSProvider('openai', TTS1);
registerTTSProvider('gemini', GeminiTTS);

// 导出所有 provider
export { DoubaoTTS, GeminiTTS, MinimaxTTS, QwenTTS, TTS1 };
