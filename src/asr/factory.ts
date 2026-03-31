import { BaseASR } from '@/asr/base';
import type { ASROptions } from '@/types/asr';

// 重新导出 BaseASR 以便外部使用
export { BaseASR } from '@/asr/base';

// biome-ignore lint/suspicious/noExplicitAny: 各 provider 构造函数参数类型不同，用 any 在 Map 层面做适配；类型安全由 createASR 的判别联合参数保证
const providers = new Map<string, new (options: any) => BaseASR>();

export function registerASRProvider(
  type: string,
  // biome-ignore lint/suspicious/noExplicitAny: 同上
  provider: new (options: any) => BaseASR
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
