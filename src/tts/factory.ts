import { BaseTTS } from '@/tts/base';
import type { TTSOptions, TTSProviderType } from '@/types/tts';

// biome-ignore lint/suspicious/noExplicitAny: 各 provider 构造函数参数类型不同，用 any 在 Map 层面做适配；类型安全由 createTTS 的判别联合参数保证
const providers = new Map<string, new (options: any) => BaseTTS>();

export function registerTTSProvider(
  type: TTSProviderType,
  // biome-ignore lint/suspicious/noExplicitAny: 同上
  provider: new (options: any) => BaseTTS
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
