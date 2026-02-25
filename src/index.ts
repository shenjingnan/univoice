export {
  BaseTTS,
  createTTS,
  registerTTSProvider,
  getTTSProviders,
  synthesize,
} from './tts/index';
export { collectAudio, saveAudio, playAudio, teeAudio } from './tts/utils/index';
export type {
  TTSOptions,
  TTSRequest,
  TTSResponse,
  TTSProvider,
  TTSVoice,
  TTSProviderType,
} from '@/types/tts';

export {
  BaseASR,
  createASR,
  registerASRProvider,
  getASRProviders,
  recognize,
} from './asr/index';
export { collectText, saveText } from './asr/utils/index';
export type {
  ASROptions,
  ASRRequest,
  ASRResponse,
  ASRProvider,
  ASRSegment,
  ASRProviderType,
} from '@/types/asr';

export type { ProviderConfig, AudioFormat, AudioData } from '@/types/index';
