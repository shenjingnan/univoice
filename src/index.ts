// 从子模块重新导出（不导入 provider）
export {
  BaseASR,
  createASR,
  getASRProviders,
  registerASRProvider,
} from '@/asr/index';
export * from '@/asr/utils/index';
export {
  BaseTTS,
  createTTS,
  getTTSProviders,
  registerTTSProvider,
} from '@/tts/index';
export {
  collectAudio,
  pcmToOpus,
  playAudio,
  saveAudio,
  saveTTSResponse,
  teeAudio,
} from '@/tts/utils/index';
export type {
  ASRConnection,
  ASRConnectionState,
  ASRConnectOptions,
  ASROptions,
  ASRProvider,
  ASRProviderType,
  ASRResponse,
  ASRSegment,
  ASRStreamChunk,
  BaseASROptions,
  DoubaoASROptions,
  GlmASROptions,
  QwenASROptions,
  XfyunASROptions,
} from '@/types/asr';
export type { AudioData, AudioFormat, ProviderConfig } from '@/types/index';
export type { OpenAIChatCompletionChunk, OpenAIStream } from '@/types/llm-stream';
export type {
  BaseTTSOptions,
  DoubaoTTSOptions,
  MinimaxTTSOptions,
  QwenRealtimeTTSOptions,
  QwenTTSOptions,
  TextStream,
  TTSConnection,
  TTSConnectionState,
  TTSConnectOptions,
  TTSOptions,
  TTSProvider,
  TTSProviderType,
  TTSRequest,
  TTSResponse,
  TTSStreamChunk,
  TTSVoice,
  XfyunTTSOptions,
} from '@/types/tts';
export type {
  CosyVoiceV1Voice,
  CosyVoiceV2Voice,
  CosyVoiceV3FlashVoice,
  CosyVoiceV3PlusVoice,
  CosyVoiceVoice,
  DoubaoJupiterVoice,
  DoubaoV1Voice,
  DoubaoV2Voice,
  DoubaoVoice,
  MinimaxVoice,
  QwenRealtimeVoice,
  QwenTTSModel,
} from '@/types/voices/index';
