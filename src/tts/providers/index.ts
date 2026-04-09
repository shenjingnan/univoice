import { registerTTSProvider } from '../factory';
import { DoubaoTTS } from './doubao';
import { GeminiTTS } from './gemini';
import { GlmTTS } from './glm';
import { MinimaxTTS } from './minimax';
import { OpenAITTS } from './openai';
import { QwenTTS } from './qwen';
import { QwenRealtimeTTS } from './qwen-realtime';
import { XfyunTTS } from './xfyun';

// 自动注册所有 provider
registerTTSProvider('doubao', DoubaoTTS);
registerTTSProvider('glm', GlmTTS);
registerTTSProvider('minimax', MinimaxTTS);
registerTTSProvider('qwen', QwenTTS);
registerTTSProvider('qwen-realtime', QwenRealtimeTTS);
registerTTSProvider('openai', OpenAITTS);
registerTTSProvider('gemini', GeminiTTS);
registerTTSProvider('xfyun', XfyunTTS);

export { OpenAITTS as TTS1 } from './openai';
// 导出所有 provider
export { DoubaoTTS, GeminiTTS, GlmTTS, MinimaxTTS, OpenAITTS, QwenRealtimeTTS, QwenTTS, XfyunTTS };
