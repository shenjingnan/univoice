import { BaseASR } from '@/asr/base';
import type { ASROptions, ASRProvider, ASRProviderType, ASRResponse } from '@/types/asr';

const providers = new Map<string, new (options: ASROptions) => BaseASR>();

export function registerASRProvider(
  type: ASRProviderType,
  provider: new (options: ASROptions) => BaseASR
): void {
  providers.set(type, provider);
}

export function createASR(options: ASROptions): ASRProvider {
  const ProviderClass = providers.get(options.provider);
  if (!ProviderClass) {
    throw new Error(`ASR provider "${options.provider}" not found`);
  }
  return new ProviderClass(options);
}

export function getASRProviders(): string[] {
  return Array.from(providers.keys());
}

export async function recognize(
  audio: Buffer | Uint8Array | string,
  options: ASROptions
): Promise<ASRResponse> {
  const asr = createASR(options);
  return asr.recognize({ audio, options });
}
