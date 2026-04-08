import { registerASRProvider } from '../factory';
import { DoubaoASR } from './doubao';
import { GeminiASR } from './gemini';
import { GlmASR } from './glm';
import { MinimaxASR } from './minimax';
import { WhisperASR } from './openai';
import { QwenASR } from './qwen';
import { XfyunASR } from './xfyun';

// 自动注册所有 provider
registerASRProvider('doubao', DoubaoASR);
registerASRProvider('minimax', MinimaxASR);
registerASRProvider('qwen', QwenASR);
registerASRProvider('openai', WhisperASR);
registerASRProvider('gemini', GeminiASR);
registerASRProvider('glm', GlmASR);
registerASRProvider('xfyun', XfyunASR);

// 导出所有 provider
export { DoubaoASR, GeminiASR, GlmASR, MinimaxASR, QwenASR, WhisperASR, XfyunASR };
