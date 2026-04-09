import { BaseTTS } from '@/tts/base';
import { normalizeTextStream } from '@/tts/utils/normalize-text-stream';
import type { OpenAITTSOptions, TTSRequest, TTSResponse, TTSStreamChunk } from '@/types/tts';

/**
 * chat 模式返回的音频数据接口
 * OpenAI SDK 类型中 message.audio 可能未完整定义，使用此接口进行类型安全访问
 */
interface ChatCompletionAudioData {
  data: string;
  id?: string;
}

interface ChatCompletionMessageWithAudio {
  audio?: ChatCompletionAudioData | null;
}

interface ChatCompletionDeltaWithAudio {
  audio?: ChatCompletionAudioData | null;
}

/**
 * OpenAI TTS provider
 *
 * 支持两种 API 模式：
 * - speech 模式：使用 audio.speech API（标准 OpenAI TTS，如 tts-1、tts-1-hd、gpt-4o-mini-tts）
 * - chat 模式：使用 chat.completions + audio 参数（兼容 mimo-v2-tts 等服务）
 *
 * 默认根据 model 名称自动推断 apiMode：
 * - tts-1、tts-1-hd、gpt-4o-mini-tts -> speech
 * - 其他 -> chat
 */
export class OpenAITTS extends BaseTTS {
  name = 'openai';

  /** API 调用模式 */
  public apiMode: 'speech' | 'chat';

  /** 懒初始化的 OpenAI 客户端实例 */
  private _client: InstanceType<typeof import('openai').default> | null = null;

  constructor(options: OpenAITTSOptions) {
    super(options);
    this.baseUrl = options.baseUrl || 'https://api.openai.com/v1';
    this.model = options.model || 'tts-1';
    this.voice = options.voice || 'alloy';
    this.apiMode = options.apiMode ?? this.inferApiMode(this.model);
  }

  /**
   * 根据模型名推断 API 模式
   */
  private inferApiMode(model: string): 'speech' | 'chat' {
    if (model.startsWith('tts-1') || model === 'gpt-4o-mini-tts') {
      return 'speech';
    }
    return 'chat';
  }

  /**
   * 懒初始化 OpenAI SDK 客户端
   */
  private async getClient() {
    if (!this._client) {
      const { default: OpenAI } = await import('openai');
      this._client = new OpenAI({
        apiKey: this.apiKey,
        baseURL: this.baseUrl,
      });
    }
    return this._client;
  }

  /**
   * 将通用 format 映射到 chat API 的音频格式
   * chat API 使用 pcm16 而非 pcm
   */
  private mapFormatForChatApi(format: string): string {
    if (format === 'pcm') return 'pcm16';
    return format;
  }

  /**
   * 将通用 format 映射到 speech API 的音频格式
   * speech API 支持: mp3 | opus | aac | flac | wav | pcm
   * 需要将 ogg_opus 映射为 opus，ogg 映射为 opus
   */
  private mapFormatForSpeechApi(format: string): 'mp3' | 'opus' | 'aac' | 'flac' | 'wav' | 'pcm' {
    const mapping: Record<string, 'mp3' | 'opus' | 'aac' | 'flac' | 'wav' | 'pcm'> = {
      mp3: 'mp3',
      opus: 'opus',
      aac: 'aac',
      flac: 'flac',
      wav: 'wav',
      pcm: 'pcm',
      ogg: 'opus',
      ogg_opus: 'opus',
    };
    return mapping[format] ?? 'mp3';
  }

  async synthesize(request: TTSRequest): Promise<TTSResponse> {
    if (!this.apiKey) {
      throw new Error('OpenAI API key 是必填项');
    }

    if (this.apiMode === 'speech') {
      return this.synthesizeViaSpeechApi(request);
    }
    return this.synthesizeViaChatApi(request);
  }

  /**
   * speech 模式 - 使用 audio.speech API
   */
  private async synthesizeViaSpeechApi(request: TTSRequest): Promise<TTSResponse> {
    const client = await this.getClient();
    const opts = this.buildRequestOptions(request);
    const format = opts.format || this.format;

    const response = await client.audio.speech.create({
      model: opts.model || this.model,
      voice: opts.voice || this.voice,
      input: request.text,
      response_format: this.mapFormatForSpeechApi(format),
      speed: opts.speed,
    });

    const buffer = Buffer.from(await response.arrayBuffer());
    return { audio: buffer, format };
  }

  /**
   * chat 模式 - 使用 chat.completions + audio 参数（非流式）
   */
  private async synthesizeViaChatApi(request: TTSRequest): Promise<TTSResponse> {
    const client = await this.getClient();
    const opts = this.buildRequestOptions(request);
    const audioFormat = this.mapFormatForChatApi(opts.format || this.format);

    const completion = await client.chat.completions.create({
      model: opts.model || this.model,
      messages: [{ role: 'assistant', content: request.text }],
      audio: { voice: opts.voice || this.voice, format: audioFormat as 'pcm16' },
    });

    const audioData = (completion.choices[0]?.message as unknown as ChatCompletionMessageWithAudio)
      ?.audio?.data;
    if (!audioData) {
      throw new Error('chat 模式未返回音频数据');
    }

    const audio = Buffer.from(audioData, 'base64');
    return { audio, format: opts.format || this.format };
  }

  /**
   * 流式语音合成
   */
  protected override async *speakStream(
    input: string | import('@/types/tts').TextStream
  ): AsyncIterable<TTSStreamChunk> {
    if (!this.apiKey) {
      throw new Error('OpenAI API key 是必填项');
    }

    // 标准化输入为文本
    const textChunks: string[] = [];
    for await (const chunk of normalizeTextStream(input)) {
      textChunks.push(chunk);
    }
    const text = textChunks.join('');

    if (this.apiMode === 'speech') {
      yield* this.speakStreamViaSpeechApi(text);
    } else {
      yield* this.speakStreamViaChatApi(text);
    }
  }

  /**
   * speech 模式流式 - 读取 audio.speech 二进制流按块 yield
   */
  private async *speakStreamViaSpeechApi(text: string): AsyncIterable<TTSStreamChunk> {
    const client = await this.getClient();
    const opts = this.buildRequestOptions({ text });
    const format = opts.format || this.format;

    const response = await client.audio.speech.create({
      model: opts.model || this.model,
      voice: opts.voice || this.voice,
      input: text,
      response_format: this.mapFormatForSpeechApi(format),
      speed: opts.speed,
    });

    if (!response.body) {
      throw new Error('speech API 未返回响应体');
    }

    const reader = response.body.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value.length > 0) {
          yield { audioChunk: Buffer.from(value) };
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * chat 模式流式 - 从 stream 的 delta.audio.data 提取 base64 音频块
   */
  private async *speakStreamViaChatApi(text: string): AsyncIterable<TTSStreamChunk> {
    const client = await this.getClient();
    const opts = this.buildRequestOptions({ text });
    const audioFormat = this.mapFormatForChatApi(opts.format || this.format);

    const stream = await client.chat.completions.create({
      model: opts.model || this.model,
      messages: [{ role: 'assistant', content: text }],
      audio: { voice: opts.voice || this.voice, format: audioFormat as 'pcm16' },
      stream: true,
    });

    for await (const chunk of stream) {
      if (!chunk.choices?.length) continue;
      const audio = (chunk.choices[0].delta as unknown as ChatCompletionDeltaWithAudio)?.audio;
      if (audio?.data) {
        yield { audioChunk: Buffer.from(audio.data, 'base64') };
      }
    }
  }
}

/**
 * 向后兼容别名
 */
export const TTS1 = OpenAITTS;
