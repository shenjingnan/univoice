import { Buffer } from 'node:buffer';
import { createHmac } from 'node:crypto';

/**
 * 科大讯飞 IAT（语音听写）WebSocket API 协议实现
 * 参考文档: docs/tmp/xfyun/中英文识别大模型.md
 */

/**
 * 协议配置选项
 */
export interface XfyunProtocolOptions {
  appId: string;
  apiKey: string;
  apiSecret: string;
  /** 音频编码格式: raw=PCM, lame=MP3 */
  encoding: string;
  sampleRate: number;
  bitDepth: number;
  channels: number;
  domain: string;
  language: string;
  accent: string;
  eos: number;
  dwa?: string;
  ltc?: number;
  resId?: string;
  dhw?: string;
}

/**
 * 生成鉴权 URL
 * 使用 HMAC-SHA256 签名，将 authorization、date、host 附加到 query string
 */
export function buildAuthUrl(
  host = 'iat.xf-yun.com',
  path = '/v1',
  apiKey: string,
  apiSecret: string
): string {
  const date = new Date().toUTCString();
  const signatureOrigin = `host: ${host}\ndate: ${date}\nGET ${path} HTTP/1.1`;
  const signatureSha = createHmac('sha256', apiSecret).update(signatureOrigin).digest();
  const signature = signatureSha.toString('base64');
  const authorizationOrigin = `api_key="${apiKey}", algorithm="hmac-sha256", headers="host date request-line", signature="${signature}"`;
  const authorization = Buffer.from(authorizationOrigin).toString('base64');

  const params = new URLSearchParams({
    authorization,
    date,
    host,
  });

  return `wss://${host}${path}?${params.toString()}`;
}

/**
 * 创建首帧（包含 parameter + payload，status=0）
 */
export function createFirstFrame(
  options: XfyunProtocolOptions,
  audioBase64: string,
  seq: number
): string {
  const frame: Record<string, unknown> = {
    header: {
      app_id: options.appId,
      status: 0,
    },
    parameter: {
      iat: {
        domain: options.domain,
        language: options.language,
        accent: options.accent,
        eos: options.eos,
        ...(options.dwa ? { dwa: options.dwa } : {}),
        ...(options.ltc ? { ltc: options.ltc } : {}),
        result: {
          encoding: 'utf8',
          compress: 'raw',
          format: 'json',
        },
      },
    },
    payload: {
      audio: {
        encoding: options.encoding,
        sample_rate: options.sampleRate,
        channels: options.channels,
        bit_depth: options.bitDepth,
        seq,
        status: 0,
        audio: audioBase64,
      },
    },
  };

  if (options.resId) {
    (frame.header as Record<string, unknown>).res_id = options.resId;
  }
  if (options.dhw) {
    (frame.parameter as Record<string, Record<string, unknown>>).iat.dhw = options.dhw;
  }

  return JSON.stringify(frame);
}

/**
 * 创建中间帧（只有 header + payload，status=1）
 */
export function createMiddleFrame(
  options: XfyunProtocolOptions,
  audioBase64: string,
  seq: number
): string {
  return JSON.stringify({
    header: {
      app_id: options.appId,
      ...(options.resId ? { res_id: options.resId } : {}),
      status: 1,
    },
    payload: {
      audio: {
        encoding: options.encoding,
        sample_rate: options.sampleRate,
        channels: options.channels,
        bit_depth: options.bitDepth,
        seq,
        status: 1,
        audio: audioBase64,
      },
    },
  });
}

/**
 * 创建末帧（status=2，audio 为空）
 */
export function createLastFrame(options: XfyunProtocolOptions, seq: number): string {
  return JSON.stringify({
    header: {
      app_id: options.appId,
      ...(options.resId ? { res_id: options.resId } : {}),
      status: 2,
    },
    payload: {
      audio: {
        encoding: options.encoding,
        sample_rate: options.sampleRate,
        channels: options.channels,
        bit_depth: options.bitDepth,
        seq,
        status: 2,
        audio: '',
      },
    },
  });
}

/**
 * 科大讯飞 IAT 响应结构
 */
export interface XfyunResponse {
  header: {
    code: number;
    message: string;
    sid: string;
    status: number;
  };
  payload?: {
    result?: {
      compress: string;
      encoding: string;
      format: string;
      seq: number;
      status: number;
      text: string;
    };
  };
}

/**
 * 解析 WebSocket 消息为 JSON
 */
export function parseResponse(data: unknown): XfyunResponse {
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
  return JSON.parse(text) as XfyunResponse;
}

/**
 * 二次 base64 解码识别结果文本
 * 服务端返回的 text 字段是 base64 编码的 JSON 字符串
 */
export function decodeResultText(base64Text: string): {
  sn: number;
  ls: boolean;
  ws: Array<{ bg: number; cw: Array<{ w: string }> }>;
} {
  const jsonStr = Buffer.from(base64Text, 'base64').toString('utf8');
  return JSON.parse(jsonStr);
}

/**
 * 从识别结果中提取纯文本
 * 从 ws[].cw[].w 中提取字词拼接
 */
export function extractTextFromResult(result: { ws: Array<{ cw: Array<{ w: string }> }> }): string {
  return result.ws.map((wsItem) => wsItem.cw.map((cwItem) => cwItem.w).join('')).join('');
}

/**
 * 判断响应是否成功（code=0）
 */
export function isSuccessResponse(response: XfyunResponse): boolean {
  return response.header.code === 0;
}

/**
 * 判断响应是否为最后一帧（status=2）
 */
export function isFinishedResponse(response: XfyunResponse): boolean {
  return response.header.status === 2;
}

/**
 * 判断响应是否包含识别结果（有 payload.result 字段）
 */
export function hasResultPayload(response: XfyunResponse): boolean {
  return response.payload?.result != null;
}
