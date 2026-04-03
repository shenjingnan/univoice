import { bufferToAudioStream, processAudio } from '@/asr/utils/audio';
import type {
  ASRConnection,
  ASRConnectOptions,
  ASRResponse,
  ASRSegment,
  ASRStreamChunk,
  AudioCodecFormat,
  AudioContainerFormat,
  AudioStream,
  AudioStreamInput,
  BaseASROptions,
  ListenInstanceOptions,
} from '@/types/asr';

export abstract class BaseASR {
  abstract name: string;
  public apiKey: string;
  public baseUrl: string;
  public model: string;
  public language: string;
  public prompt: string;
  public responseFormat: 'json' | 'text' | 'srt' | 'vtt' | 'verbose_json';
  public format: AudioContainerFormat;
  public codec: AudioCodecFormat;

  constructor(options: BaseASROptions) {
    this.apiKey = options.apiKey || '';
    this.baseUrl = options.baseUrl || '';
    this.model = options.model || 'default';
    this.language = options.language || 'zh-CN';
    this.prompt = options.prompt || '';
    this.responseFormat = options.responseFormat || 'json';
    this.format = options.format || 'pcm';
    this.codec = options.codec || 'raw';
  }

  /**
   * 流式输入识别方法
   * 子类必须实现此方法
   *
   * @param audio 音频流
   * @returns 流式识别结果
   */
  abstract listenStream(audio: AudioStream): AsyncIterable<ASRStreamChunk>;

  /**
   * 判断输入是否为 AudioStream
   */
  private isAudioStream(input: AudioStreamInput): input is AudioStream {
    return input !== null && typeof input === 'object' && Symbol.asyncIterator in input;
  }

  /**
   * 判断输入是否为字符串（文件路径）
   */
  private isString(input: AudioStreamInput): input is string {
    return typeof input === 'string';
  }

  /**
   * 适配音频输入为音频流
   */
  private adaptAudioInput(audio: AudioStreamInput): AudioStream {
    if (this.isAudioStream(audio)) return audio;
    if (this.isString(audio)) return this.fileToPcmAudioStream(audio);
    return bufferToAudioStream(audio);
  }

  /**
   * 将音频文件路径转换为 PCM 音频流
   */
  private async *fileToPcmAudioStream(filePath: string): AudioStream {
    const { audioData } = await processAudio(filePath);
    const chunkSize = 3200; // 100ms @ 16kHz 16bit mono

    for (let i = 0; i < audioData.length; i += chunkSize) {
      const end = Math.min(i + chunkSize, audioData.length);
      yield audioData.slice(i, end);
    }
  }

  /**
   * 预建立连接
   * 默认不支持，子类可覆写此方法以支持连接预建立
   *
   * @param options 连接选项
   * @returns ASR 连接实例
   */
  connect(_options?: ASRConnectOptions): Promise<ASRConnection> {
    throw new Error(
      `${this.name} does not support connection pre-establishment. Use listen() directly.`
    );
  }

  /**
   * 创建流式迭代器
   */
  private async *createStreamIterable(audio: AudioStreamInput): AsyncIterable<ASRStreamChunk> {
    const audioStream = this.adaptAudioInput(audio);
    yield* this.listenStream(audioStream);
  }

  /**
   * 收集非流式识别结果
   */
  private async collectASRResponse(audio: AudioStreamInput): Promise<ASRResponse> {
    const segments: ASRSegment[] = [];
    const textParts: string[] = [];

    const audioStream = this.adaptAudioInput(audio);

    for await (const chunk of this.listenStream(audioStream)) {
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

  /**
   * 从音频流、音频数据或音频文件路径进行语音识别（流式模式）
   *
   * @param audio 音频流（AsyncIterable）、音频数据（Buffer/Uint8Array）或音频文件路径
   * @param options 识别选项
   * @returns 流式识别结果
   */
  listen(
    audio: AudioStreamInput,
    options: ListenInstanceOptions & { stream: true }
  ): AsyncIterable<ASRStreamChunk>;

  /**
   * 从音频流、音频数据或音频文件路径进行语音识别（非流式模式）
   *
   * @param audio 音频流（AsyncIterable）、音频数据（Buffer/Uint8Array）或音频文件路径
   * @param options 识别选项
   * @returns 非流式识别结果
   */
  listen(
    audio: AudioStreamInput,
    options?: ListenInstanceOptions & { stream?: false }
  ): Promise<ASRResponse>;

  /**
   * listen 实现
   */
  listen(
    audio: AudioStreamInput,
    options?: ListenInstanceOptions
  ): Promise<ASRResponse> | AsyncIterable<ASRStreamChunk> {
    if (options?.stream === true) {
      return this.createStreamIterable(audio);
    }
    return this.collectASRResponse(audio);
  }
}
