import { BaseASR } from '@/asr/base';
import { bufferToAudioStream, processAudio } from '@/asr/utils/audio';
import type {
  ASROptions,
  ASRProviderType,
  ASRStreamChunk,
  AudioStream,
  AudioStreamInput,
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
 * 判断输入是否为 AudioStream
 */
function isAudioStream(input: AudioStreamInput): input is AudioStream {
  return input !== null && typeof input === 'object' && Symbol.asyncIterator in input;
}

/**
 * 判断输入是否为字符串（文件路径）
 */
function isString(input: AudioStreamInput): input is string {
  return typeof input === 'string';
}

/**
 * 将音频文件路径转换为 PCM 音频流
 */
async function* fileToPcmAudioStream(filePath: string): AudioStream {
  const { audioData } = await processAudio(filePath);
  const chunkSize = 3200; // 100ms @ 16kHz 16bit mono

  for (let i = 0; i < audioData.length; i += chunkSize) {
    const end = Math.min(i + chunkSize, audioData.length);
    yield audioData.slice(i, end);
  }
}

/**
 * 从音频流、音频数据或音频文件路径进行流式识别
 *
 * @param audio 音频流（AsyncIterable）、音频数据（Buffer/Uint8Array）或音频文件路径
 * @param options ASR 配置选项
 * @returns 流式识别结果
 */
export async function* streamFrom(
  audio: AudioStreamInput,
  options: ASROptions
): AsyncIterable<ASRStreamChunk> {
  const asr = createASR(options);

  // 根据输入类型适配
  let audioStream: AudioStream;
  if (isAudioStream(audio)) {
    audioStream = audio;
  } else if (isString(audio)) {
    audioStream = fileToPcmAudioStream(audio);
  } else {
    // Buffer 或 Uint8Array
    audioStream = bufferToAudioStream(audio);
  }

  yield* asr.streamFrom(audioStream);
}
