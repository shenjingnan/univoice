import { BaseASR } from '@/asr/base';
import type { ASROptions } from '@/types/asr';

// 重新导出 BaseASR 以便外部使用
export { BaseASR } from '@/asr/base';

const providers = new Map<string, new (options: ASROptions) => BaseASR>();

export function registerASRProvider(
  type: string,
  provider: new (options: ASROptions) => BaseASR
): void {
  providers.set(type, provider);
}

export function createASR(options: ASROptions): BaseASR {
  const ProviderClass = providers.get(options.provider);
  if (!ProviderClass) {
    throw new Error(`ASR provider "${options.provider}" not found`);
  }
  return new ProviderClass(options);
}

export function getASRProviders(): string[] {
  return Array.from(providers.keys());
}
