import { BaseASR } from '@/asr/base';
import type {
  ASROptions,
  ASRResponse,
  ASRStreamChunk,
  AudioStreamInput,
  ListenOptions,
} from '@/types/asr';

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

/**
 * 从音频流、音频数据或音频文件路径进行语音识别
 *
 * @param audio 音频流（AsyncIterable）、音频数据（Buffer/Uint8Array）或音频文件路径
 * @param options ASR 配置选项
 * @returns 根据 stream 参数返回不同的结果类型：
 *   - stream: true 时返回 AsyncIterable<ASRStreamChunk>
 *   - stream: false 或不传时返回 Promise<ASRResponse>
 */
export function listen<T extends ListenOptions>(
  audio: AudioStreamInput,
  options: T
): T['stream'] extends true ? AsyncIterable<ASRStreamChunk> : Promise<ASRResponse>;

/**
 * listen 实现
 */
export function listen(
  audio: AudioStreamInput,
  options: ListenOptions
): Promise<ASRResponse> | AsyncIterable<ASRStreamChunk> {
  const { stream, ...asrOptions } = options;
  const asr = createASR(asrOptions);

  // 使用条件语句确保类型正确
  if (stream === true) {
    return asr.listen(audio, { stream: true });
  }
  return asr.listen(audio, { stream: false });
}
