import { BaseASR } from '@/asr/base';
import type {
  ASROptions,
  ASRProvider,
  ASRProviderType,
  ASRResponse,
  ASRStreamChunk,
  AudioStream,
} from '@/types/asr';

// 重新导出 BaseASR 以便外部使用
export { BaseASR } from '@/asr/base';

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

export async function listen(
  audio: Buffer | Uint8Array | string,
  options: ASROptions
): Promise<ASRResponse> {
  const asr = createASR(options);
  return asr.listen({ audio, options });
}

/**
 * 流式语音识别
 * 实时返回识别结果，支持 for await...of 语法
 *
 * @param audio 音频数据，可以是 Buffer、Uint8Array 或文件路径
 * @param options ASR 配置选项
 * @returns 流式识别结果
 * @throws 如果提供商不支持流式输出
 */
export async function* stream(
  audio: Buffer | Uint8Array | string,
  options: ASROptions
): AsyncIterable<ASRStreamChunk> {
  const asr = createASR(options);
  if (!asr.stream) {
    throw new Error(`Provider ${options.provider} does not support streaming`);
  }
  yield* asr.stream({ audio, options });
}

/**
 * 从音频流进行流式识别
 *
 * @param audio 音频流（AsyncIterable）
 * @param options ASR 配置选项
 * @param intervalMs 发包间隔（毫秒），可选
 * @returns 流式识别结果
 * @throws 如果提供商不支持流式输入
 */
export async function* streamFrom(
  audio: AudioStream,
  options: ASROptions,
  intervalMs?: number
): AsyncIterable<ASRStreamChunk> {
  const asr = createASR(options);
  if (!asr.streamFrom) {
    throw new Error(`Provider ${options.provider} does not support streaming input`);
  }
  yield* asr.streamFrom(audio, intervalMs);
}
