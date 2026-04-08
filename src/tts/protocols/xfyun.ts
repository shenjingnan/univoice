import { Buffer } from 'node:buffer';
import { buildAuthUrl } from '@/asr/protocols/xfyun';

/**
 * 科大讯飞超拟人语音合成 WebSocket 协议实现
 * 参考文档: wss://cbm01.cn-huabei-1.xf-yun.com/v1/private/mcd9m97e6
 */

/** TTS 协议请求选项 */
export interface XfyunTTSProtocolOptions {
  appId: string;
  vcn: string;
  speed: number;
  volume: number;
  pitch: number;
  encoding: string;
  sampleRate: number;
  oralLevel?: string;
  sparkAssist?: number;
  stopSplit?: number;
  remain?: number;
  reg?: number;
  rdn?: number;
  rhy?: number;
  bgs?: number;
}

/** TTS 响应结构 */
export interface XfyunTTSResponse {
  header: {
    code: number;
    message: string;
    sid: string;
    status: number;
  };
  payload?: {
    audio?: {
      encoding: string;
      sample_rate: number;
      channels: number;
      bit_depth: number;
      status: number;
      seq: number;
      frame_size: number;
      audio: string;
    };
  };
}

/**
 * 生成讯飞超拟人 TTS 鉴权 URL
 */
export function buildTTSAuthUrl(apiKey: string, apiSecret: string): string {
  return buildAuthUrl('cbm01.cn-huabei-1.xf-yun.com', '/v1/private/mcd9m97e6', apiKey, apiSecret);
}

/**
 * 将音频格式映射为讯飞编码
 * mp3 -> lame, pcm -> raw, opus -> opus
 */
export function mapAudioEncoding(format: string): string {
  const encodingMap: Record<string, string> = {
    mp3: 'lame',
    pcm: 'raw',
    opus: 'opus',
  };
  return encodingMap[format] || 'lame';
}

/**
 * 创建 TTS 请求体
 * @param options 协议选项
 * @param text 待合成文本
 * @param status 数据状态：0-开始, 1-中间, 2-结束（一次性合成直接传 2）
 * @param seq 数据序号
 */
export function createRequestPayload(
  options: XfyunTTSProtocolOptions,
  text: string,
  status: number,
  seq: number
): string {
  const payload: Record<string, unknown> = {
    header: {
      app_id: options.appId,
      status,
    },
    parameter: {
      tts: {
        vcn: options.vcn,
        speed: options.speed,
        volume: options.volume,
        pitch: options.pitch,
        bgs: options.bgs ?? 0,
        reg: options.reg ?? 0,
        rdn: options.rdn ?? 0,
        rhy: options.rhy ?? 0,
        audio: {
          encoding: options.encoding,
          sample_rate: options.sampleRate,
          channels: 1,
          bit_depth: 16,
          frame_size: 0,
        },
      },
    },
    payload: {
      text: {
        encoding: 'utf8',
        compress: 'raw',
        format: 'plain',
        status,
        seq,
        text: Buffer.from(text).toString('base64'),
      },
    },
  };

  // 仅 x4 系列发音人支持 oral 参数
  if (
    options.oralLevel ||
    options.sparkAssist != null ||
    options.stopSplit != null ||
    options.remain != null
  ) {
    (payload.parameter as Record<string, unknown>).oral = {
      ...(options.oralLevel ? { oral_level: options.oralLevel } : {}),
      ...(options.sparkAssist != null ? { spark_assist: options.sparkAssist } : {}),
      ...(options.stopSplit != null ? { stop_split: options.stopSplit } : {}),
      ...(options.remain != null ? { remain: options.remain } : {}),
    };
  }

  return JSON.stringify(payload);
}

/**
 * 解析 TTS WebSocket 响应
 */
export function parseTTSResponse(data: unknown): XfyunTTSResponse {
  let text: string;
  if (Buffer.isBuffer(data)) {
    text = data.toString('utf8');
  } else if (data instanceof ArrayBuffer) {
    text = new TextDecoder().decode(data);
  } else if (Array.isArray(data)) {
    text = Buffer.concat(data).toString('utf8');
  } else {
    text = String(data);
  }
  return JSON.parse(text) as XfyunTTSResponse;
}

/**
 * 从 TTS 响应中提取音频数据（base64）
 */
export function extractAudioFromResponse(response: XfyunTTSResponse): string | null {
  return response.payload?.audio?.audio ?? null;
}

/**
 * 判断 TTS 响应是否成功
 */
export function isTTSSuccessResponse(response: XfyunTTSResponse): boolean {
  return response.header.code === 0;
}

/**
 * 判断 TTS 响应是否为最后一帧（status=2）
 */
export function isTTSFinishedResponse(response: XfyunTTSResponse): boolean {
  return response.header.status === 2;
}
