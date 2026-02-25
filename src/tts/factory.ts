import type { TTSOptions, TTSProvider, TTSProviderType, TTSResponse } from '@/types/tts';
import { BaseTTS } from '@/tts/base';

const providers = new Map<string, new (options: TTSOptions) => BaseTTS>();

export function registerTTSProvider(
  type: TTSProviderType,
  provider: new (options: TTSOptions) => BaseTTS
): void {
  providers.set(type, provider);
}

export function createTTS(options: TTSOptions): TTSProvider {
  const ProviderClass = providers.get(options.provider);
  if (!ProviderClass) {
    throw new Error(`TTS provider "${options.provider}" not found`);
  }
  return new ProviderClass(options);
}

export function getTTSProviders(): string[] {
  return Array.from(providers.keys());
}

export async function synthesize(text: string, options: TTSOptions): Promise<TTSResponse> {
  const tts = createTTS(options);
  return tts.synthesize({ text, options });
}
