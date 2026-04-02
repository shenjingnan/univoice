export * from './asr.js';
export * from './llm-stream.js';
export * from './tts.js';
export * from './voices/index.js';

export interface ProviderConfig {
  apiKey: string;
  baseUrl?: string;
  model?: string;
}

export interface AudioFormat {
  type: 'mp3' | 'wav' | 'ogg' | 'flac' | 'pcm';
  sampleRate?: number;
  channels?: number;
  bitDepth?: number;
}

export interface AudioData {
  buffer: Buffer | Uint8Array;
  format: AudioFormat;
  duration?: number;
}
