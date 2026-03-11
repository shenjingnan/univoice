import type { ASROptions, ASRProvider, ASRStreamChunk, AudioStream } from '@/types/asr';

export abstract class BaseASR implements ASRProvider {
  abstract name: string;
  public apiKey: string;
  public baseUrl: string;
  public model: string;
  public language: string;
  public prompt: string;
  public responseFormat: 'json' | 'text' | 'srt' | 'vtt' | 'verbose_json';

  constructor(options: ASROptions) {
    this.apiKey = options.apiKey || '';
    this.baseUrl = options.baseUrl || '';
    this.model = options.model || 'default';
    this.language = options.language || 'zh-CN';
    this.prompt = options.prompt || '';
    this.responseFormat = options.responseFormat || 'json';
  }

  /**
   * 流式输入识别方法
   * 子类必须实现此方法
   *
   * @param audio 音频流
   * @returns 流式识别结果
   */
  abstract listen(audio: AudioStream): AsyncIterable<ASRStreamChunk>;
}
