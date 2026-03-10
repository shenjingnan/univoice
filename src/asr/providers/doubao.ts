import { Buffer } from 'node:buffer';
import WebSocket from 'ws';
import { BaseASR } from '@/asr/base';
import { registerASRProvider } from '@/asr/factory';
import {
  buildAudioOnlyRequest,
  buildAuthHeaders,
  buildFullClientRequest,
  type FullClientRequestParams,
  getErrorMessage,
  parseResponse,
  type SAUCResponsePayload,
  type SAUCUtterance,
} from '@/asr/protocols/sauc';
import { DEFAULT_SAMPLE_RATE, processAudio, splitAudio } from '@/asr/utils/audio';
import type {
  ASROptions,
  ASRRequest,
  ASRResponse,
  ASRSegment,
  ASRStreamChunk,
  AudioStream,
} from '@/types/asr';
import type {
  ASROptions,
  ASRRequest,
  ASRResponse,
  ASRSegment,
  ASRStreamChunk,
  AudioStream,
} from '@/types/asr';

/**
 * 豆包 ASR 提供商
 * 使用 WebSocket 二进制协议实现语音识别
 */
export class DoubaoASR extends BaseASR {
  name = 'doubao';

  // 豆包专用配置
  public appKey: string;
  public accessKey: string;
  public resourceId: string;
  public mode: 'streaming' | 'nostream' | 'async';

  // 音频配置
  public sampleRate: number;
  public bits: number;
  public channel: number;
  public segmentDuration: number;

  // 识别配置
  public enableItn: boolean;
  public enablePunc: boolean;
  public enableDdc: boolean;
  public showUtterances: boolean;

  constructor(options: ASROptions) {
    super(options);

    // 豆包专用配置
    this.appKey = options.appKey || '';
    this.accessKey = options.accessKey || options.apiKey || '';
    this.resourceId = options.resourceId || 'volc.bigasr.sauc.duration';
    this.mode = options.mode || 'nostream';

    // 音频配置
    this.sampleRate = options.sampleRate || DEFAULT_SAMPLE_RATE;
    this.bits = options.bits || 16;
    this.channel = options.channel || 1;
    this.segmentDuration = options.segmentDuration || 200;

    // 识别配置
    this.enableItn = options.enableItn ?? true;
    this.enablePunc = options.enablePunc ?? true;
    this.enableDdc = options.enableDdc ?? false;
    this.showUtterances = options.showUtterances ?? true;

    // WebSocket 基础 URL
    this.baseUrl = options.baseUrl || 'wss://openspeech.bytedance.com/api/v3/sauc';
  }

  /**
   * 获取 WebSocket URL
   */
  private getWebSocketUrl(): string {
    switch (this.mode) {
      case 'streaming':
        return `${this.baseUrl}/bigmodel`;
      case 'async':
        return `${this.baseUrl}/bigmodel_async`;
      default:
        return `${this.baseUrl}/bigmodel_nostream`;
    }
  }

  /**
   * 构建 Full Client Request 参数
   */
  private buildFullClientRequestParams(): FullClientRequestParams {
    return {
      user: {
        uid: 'univoice-sdk',
      },
      audio: {
        format: 'wav',
        codec: 'raw',
        rate: this.sampleRate,
        bits: this.bits,
        channel: this.channel,
        language: this.language,
      },
      request: {
        model_name: 'bigmodel',
        enable_itn: this.enableItn,
        enable_punc: this.enablePunc,
        enable_ddc: this.enableDdc,
        show_utterances: this.showUtterances,
      },
    };
  }

  /**
   * 执行语音识别
   */
  async listen(request: ASRRequest): Promise<ASRResponse> {
    // 合并请求选项
    const opts = this.buildRequestOptions(request);

    // 验证必要参数
    if (!this.appKey) {
      throw new Error('appKey is required for Doubao ASR');
    }
    if (!this.accessKey) {
      throw new Error('accessKey is required for Doubao ASR');
    }

    // 处理音频数据
    // 注意：使用 wavData（完整 WAV 文件数据，包含 header）而非 audioData（纯 PCM 数据）
    // 因为豆包服务端期望接收完整 WAV 格式的数据
    const { wavData, segmentSize, wavInfo } = await processAudio(
      request.audio,
      opts.segmentDuration || this.segmentDuration
    );

    // 分割音频
    const segments = splitAudio(wavData, segmentSize);
    if (segments.length === 0) {
      throw new Error('No audio data to send');
    }

    // 创建 WebSocket 连接
    const url = this.getWebSocketUrl();
    const headers = buildAuthHeaders({
      appKey: this.appKey,
      accessKey: this.accessKey,
      resourceId: this.resourceId,
    });

    const ws = new WebSocket(url, { headers });

    try {
      // 等待连接建立
      await this.waitForConnection(ws);

      // 初始化序列号
      let sequence = 1;
      const responses: SAUCResponsePayload[] = [];

      // 发送 Full Client Request
      const fullClientRequest = buildFullClientRequest(
        this.buildFullClientRequestParams(),
        sequence++
      );
      ws.send(fullClientRequest);

      // 等待服务端确认
      const initResponse = await this.receiveMessage(ws);
      if (initResponse.code !== 0) {
        throw new Error(`Init failed: ${getErrorMessage(initResponse.code)}`);
      }

      // 发送音频数据
      for (let i = 0; i < segments.length; i++) {
        const isLast = i === segments.length - 1;
        const audioRequest = buildAudioOnlyRequest(sequence, segments[i], isLast);
        ws.send(audioRequest);

        if (!isLast) {
          sequence++;
        }

        // 接收响应
        const response = await this.receiveMessage(ws);
        if (response.code !== 0) {
          throw new Error(`ASR error: ${getErrorMessage(response.code)}`);
        }

        if (response.payloadMsg) {
          responses.push(response.payloadMsg);
        }

        // 如果是最后一包，结束循环
        if (response.isLastPackage) {
          break;
        }
      }

      // 合并结果
      // 计算音频时长（毫秒）
      const durationMs = Math.round((wavInfo.frameCount / wavInfo.sampleRate) * 1000);
      return this.buildASRResponse(responses, durationMs);
    } finally {
      ws.close();
    }
  }

  /**
   * 流式语音识别
   * 实时返回识别结果，支持 for await...of 语法
   */
  async *stream(request: ASRRequest): AsyncIterable<ASRStreamChunk> {
    // 合并请求选项
    const opts = this.buildRequestOptions(request);

    // 验证必要参数
    if (!this.appKey) {
      throw new Error('appKey is required for Doubao ASR');
    }
    if (!this.accessKey) {
      throw new Error('accessKey is required for Doubao ASR');
    }

    // 处理音频数据
    const { wavData, segmentSize } = await processAudio(
      request.audio,
      opts.segmentDuration || this.segmentDuration
    );

    // 分割音频
    const segments = splitAudio(wavData, segmentSize);
    if (segments.length === 0) {
      throw new Error('No audio data to send');
    }

    // 创建 WebSocket 连接
    const url = this.getWebSocketUrl();
    const headers = buildAuthHeaders({
      appKey: this.appKey,
      accessKey: this.accessKey,
      resourceId: this.resourceId,
    });

    const ws = new WebSocket(url, { headers });

    try {
      // 等待连接建立
      await this.waitForConnection(ws);

      // 初始化序列号
      let sequence = 1;

      // 发送 Full Client Request
      const fullClientRequest = buildFullClientRequest(
        this.buildFullClientRequestParams(),
        sequence++
      );
      ws.send(fullClientRequest);

      // 等待服务端确认
      const initResponse = await this.receiveMessage(ws);
      if (initResponse.code !== 0) {
        throw new Error(`Init failed: ${getErrorMessage(initResponse.code)}`);
      }

      // 发送音频数据
      for (let i = 0; i < segments.length; i++) {
        const isLast = i === segments.length - 1;
        const audioRequest = buildAudioOnlyRequest(sequence, segments[i], isLast);
        ws.send(audioRequest);

        if (!isLast) {
          sequence++;
        }

        // 接收响应
        const response = await this.receiveMessage(ws);
        if (response.code !== 0) {
          throw new Error(`ASR error: ${getErrorMessage(response.code)}`);
        }

        // 实时 yield 识别结果
        if (response.payloadMsg?.result) {
          const result = response.payloadMsg.result;
          const chunk: ASRStreamChunk = {
            text: result.text,
            isFinal: response.isLastPackage,
          };

          // 如果有 utterances，添加第一个 utterance 的分段信息
          if (result.utterances && result.utterances.length > 0) {
            const utt = result.utterances[0];
            chunk.segment = {
              id: 0,
              start: utt.start_time,
              end: utt.end_time,
              text: utt.text,
              confidence: utt.definite ? 1.0 : 0.8,
            };
          }

          yield chunk;
        }

        // 如果是最后一包，结束循环
        if (response.isLastPackage) {
          break;
        }
      }
    } finally {
      ws.close();
    }
  }

  /**
   * 等待 WebSocket 连接建立
   */
  private waitForConnection(ws: WebSocket): Promise<void> {
    return new Promise((resolve, reject) => {
      ws.once('open', () => resolve());
      ws.once('error', (error) => reject(error));
    });
  }

  /**
   * 接收 WebSocket 消息
   */
  private receiveMessage(ws: WebSocket): Promise<ReturnType<typeof parseResponse>> {
    return new Promise((resolve, reject) => {
      const handleMessage = (data: WebSocket.RawData) => {
        ws.off('message', handleMessage);
        ws.off('error', handleError);

        try {
          const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer);
          const response = parseResponse(buffer);
          resolve(response);
        } catch (error) {
          reject(error);
        }
      };

      const handleError = (error: Error) => {
        ws.off('message', handleMessage);
        ws.off('error', handleError);
        reject(error);
      };

      ws.on('message', handleMessage);
      ws.on('error', handleError);
    });
  }

  /**
   * 构建 ASR 响应
   */
  private buildASRResponse(responses: SAUCResponsePayload[], duration: number): ASRResponse {
    // 合并所有响应的文本
    let fullText = '';
    const allUtterances: SAUCUtterance[] = [];

    for (const response of responses) {
      if (response.result) {
        fullText += response.result.text;
        if (response.result.utterances) {
          allUtterances.push(...response.result.utterances);
        }
      }
    }

    // 构建分段信息
    const segments: ASRSegment[] | undefined = this.showUtterances
      ? allUtterances.map((utt, index) => ({
          id: index,
          start: utt.start_time,
          end: utt.end_time,
          text: utt.text,
          confidence: utt.definite ? 1.0 : 0.8,
        }))
      : undefined;

    return {
      text: fullText,
      language: this.language,
      duration,
      segments,
    };
  }

  /**
   * 构建 PCM 格式的 Full Client Request 参数
   * 使用实例属性配置音频格式
   */
  private buildPcmFullClientRequestParams(): FullClientRequestParams {
    return {
      user: {
        uid: 'univoice-sdk',
      },
      audio: {
        format: 'pcm',
        codec: 'raw',
        rate: this.sampleRate,
        bits: this.bits,
        channel: this.channel,
        language: this.language,
      },
      request: {
        model_name: 'bigmodel',
        enable_itn: this.enableItn,
        enable_punc: this.enablePunc,
        enable_ddc: this.enableDdc,
        show_utterances: this.showUtterances,
      },
    };
  }

  /**
   * 流式输入识别方法
   * 接收音频流进行识别
   */
  async *streamFrom(audio: AudioStream): AsyncIterable<ASRStreamChunk> {
    // 验证必要参数
    if (!this.appKey) {
      throw new Error('appKey is required for Doubao ASR');
    }
    if (!this.accessKey) {
      throw new Error('accessKey is required for Doubao ASR');
    }

    // 创建 WebSocket 连接
    const url = this.getWebSocketUrl();
    const headers = buildAuthHeaders({
      appKey: this.appKey,
      accessKey: this.accessKey,
      resourceId: this.resourceId,
    });

    const ws = new WebSocket(url, { headers });

    try {
      // 等待连接建立
      await this.waitForConnection(ws);

      // 初始化序列号
      let sequence = 1;

      // 发送 Full Client Request
      const fullClientRequest = buildFullClientRequest(
        this.buildPcmFullClientRequestParams(),
        sequence++
      );
      ws.send(fullClientRequest);

      // 等待服务端确认
      const initResponse = await this.receiveMessage(ws);
      if (initResponse.code !== 0) {
        throw new Error(`Init failed: ${getErrorMessage(initResponse.code)}`);
      }

      // 遍历音频流
      for await (const chunk of audio) {
        const data = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        const isLast = false; // 流模式下无法确定是否为最后一包

        // 发送音频数据
        const audioRequest = buildAudioOnlyRequest(sequence, data, isLast);
        ws.send(audioRequest);
        sequence++;
      }

      // 发送最后一包
      const lastRequest = buildAudioOnlyRequest(sequence, Buffer.alloc(0), true);
      ws.send(lastRequest);

      // 接收所有响应
      while (true) {
        const response = await this.receiveMessage(ws);
        if (response.code !== 0) {
          throw new Error(`ASR error: ${getErrorMessage(response.code)}`);
        }

        if (response.payloadMsg?.result) {
          const result = response.payloadMsg.result;
          const chunk: ASRStreamChunk = {
            text: result.text,
            isFinal: response.isLastPackage,
          };

          if (result.utterances && result.utterances.length > 0) {
            const utt = result.utterances[0];
            chunk.segment = {
              id: 0,
              start: utt.start_time,
              end: utt.end_time,
              text: utt.text,
              confidence: utt.definite ? 1.0 : 0.8,
            };
          }

          yield chunk;
        }

        if (response.isLastPackage) {
          break;
        }
      }
    } finally {
      ws.close();
    }
  }
}

registerASRProvider('doubao', DoubaoASR);
