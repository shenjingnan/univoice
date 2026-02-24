export {
  BaseTTS,
  createTTS,
  registerTTSProvider,
  getTTSProviders,
  synthesize,
} from './tts/index.js';
export { collectAudio, saveAudio, playAudio, teeAudio } from './tts/utils/index.js';
export type {
  TTSOptions,
  TTSRequest,
  TTSResponse,
  TTSProvider,
  TTSVoice,
  TTSProviderType,
} from './types/tts.js';

export {
  BaseASR,
  createASR,
  registerASRProvider,
  getASRProviders,
  recognize,
} from './asr/index.js';
export { collectText, saveText } from './asr/utils/index.js';
export type {
  ASROptions,
  ASRRequest,
  ASRResponse,
  ASRProvider,
  ASRSegment,
  ASRProviderType,
} from './types/asr.js';

export type { ProviderConfig, AudioFormat, AudioData } from './types/index.js';
