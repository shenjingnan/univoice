import { BaseTTS } from '@/tts/base';
import type { TTSOptions, TTSProviderType } from '@/types/tts';

const providers = new Map<string, new (options: TTSOptions) => BaseTTS>();

export function registerTTSProvider(
  type: TTSProviderType,
  provider: new (options: TTSOptions) => BaseTTS
): void {
  providers.set(type, provider);
}

export function createTTS(options: TTSOptions): BaseTTS {
  const ProviderClass = providers.get(options.provider);
  if (!ProviderClass) {
    throw new Error(`TTS provider "${options.provider}" not found`);
  }
  return new ProviderClass(options);
}

export function getTTSProviders(): string[] {
  return Array.from(providers.keys());
}
