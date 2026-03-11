import { BaseASR } from '@/asr/base';
import { bufferToAudioStream, processAudio } from '@/asr/utils/audio';
import type {
  ASROptions,
  ASRResponse,
  ASRSegment,
  ASRStreamChunk,
  AudioStream,
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
 * 适配音频输入为音频流
 */
function adaptAudioInput(audio: AudioStreamInput): AudioStream {
  if (isAudioStream(audio)) return audio;
  if (isString(audio)) return fileToPcmAudioStream(audio);
  return bufferToAudioStream(audio);
}

/**
 * 从音频流、音频数据或音频文件路径进行语音识别（非流式）
 *
 * @param audio 音频流（AsyncIterable）、音频数据（Buffer/Uint8Array）或音频文件路径
 * @param options ASR 配置选项（stream 为 false 或不传）
 * @returns 识别结果
 */
export function listen(
  audio: AudioStreamInput,
  options: ListenOptions & { stream?: false }
): Promise<ASRResponse>;

/**
 * 从音频流、音频数据或音频文件路径进行语音识别（流式）
 *
 * @param audio 音频流（AsyncIterable）、音频数据（Buffer/Uint8Array）或音频文件路径
 * @param options ASR 配置选项（stream 为 true）
 * @returns 流式识别结果
 */
export function listen(
  audio: AudioStreamInput,
  options: ListenOptions & { stream: true }
): AsyncIterable<ASRStreamChunk>;

/**
 * listen 实现
 */
export function listen(
  audio: AudioStreamInput,
  options: ListenOptions
): Promise<ASRResponse> | AsyncIterable<ASRStreamChunk> {
  if (options.stream === true) {
    return createStreamIterable(audio, options);
  }
  return collectASRResponse(audio, options);
}

/**
 * 创建流式迭代器
 */
async function* createStreamIterable(
  audio: AudioStreamInput,
  options: ListenOptions
): AsyncIterable<ASRStreamChunk> {
  const { stream: _, ...asrOptions } = options;
  const asr = createASR(asrOptions);
  const audioStream = adaptAudioInput(audio);
  yield* asr.listen(audioStream);
}

/**
 * 收集非流式识别结果
 */
async function collectASRResponse(
  audio: AudioStreamInput,
  options: ListenOptions
): Promise<ASRResponse> {
  const segments: ASRSegment[] = [];
  const textParts: string[] = [];

  const { stream: _, ...asrOptions } = options;
  const asr = createASR(asrOptions);
  const audioStream = adaptAudioInput(audio);

  for await (const chunk of asr.listen(audioStream)) {
    if (chunk.isFinal && chunk.text) {
      textParts.push(chunk.text);
    }
    if (chunk.segment) {
      segments.push(chunk.segment);
    }
  }

  return {
    text: textParts.join(''),
    segments: segments.length > 0 ? segments : undefined,
  };
}
