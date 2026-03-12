import { registerASRProvider } from '../factory';
import { DoubaoASR } from './doubao';
import { GeminiASR } from './gemini';
import { MinimaxASR } from './minimax';
import { WhisperASR } from './openai';
import { QwenASR } from './qwen';

// 自动注册所有 provider
registerASRProvider('doubao', DoubaoASR);
registerASRProvider('minimax', MinimaxASR);
registerASRProvider('qwen', QwenASR);
registerASRProvider('openai', WhisperASR);
registerASRProvider('gemini', GeminiASR);

// 导出所有 provider
export { DoubaoASR, MinimaxASR, QwenASR, WhisperASR, GeminiASR };
