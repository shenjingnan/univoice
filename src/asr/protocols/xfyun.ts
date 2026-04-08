import { Buffer } from 'node:buffer';
import { createHmac } from 'node:crypto';

/**
 * 科大讯飞 IAT（语音听写）WebSocket API v2 协议实现
 * 参考文档: wss://iat-api.xfyun.cn/v2/iat
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
  domain: string;
  language: string;
  accent: string;
  eos: number;
  dwa?: string;
  ltc?: number;
  dhw?: string;
  /** 标点符号控制 */
  ptt?: number;
  /** 语言区域 */
  rlang?: string;
  /** 返回词级时间戳 */
  vinfo?: number;
  /** 返回数值的阿拉伯数字格式 */
  nunum?: number;
  /** 返回候选句子数量 */
  nbest?: number;
  /** 自定义热词的权重信息 */
  wbest?: number;
}

/**
 * 生成鉴权 URL
 * 使用 HMAC-SHA256 签名，将 authorization、date、host 附加到 query string
 */
export function buildAuthUrl(
  host = 'iat-api.xfyun.cn',
  path = '/v2/iat',
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
 * 创建首帧（包含 common + business + data，status=0）
 */
export function createFirstFrame(options: XfyunProtocolOptions, audioBase64: string): string {
  const frame: Record<string, unknown> = {
    common: {
      app_id: options.appId,
    },
    business: {
      language: options.language,
      domain: options.domain,
      accent: options.accent,
      eos: options.eos,
      ...(options.dwa ? { dwa: options.dwa } : {}),
      ...(options.ltc ? { ltc: options.ltc } : {}),
      ...(options.dhw ? { dhw: options.dhw } : {}),
      ...(options.ptt != null ? { ptt: options.ptt } : {}),
      ...(options.rlang ? { rlang: options.rlang } : {}),
      ...(options.vinfo != null ? { vinfo: options.vinfo } : {}),
      ...(options.nunum != null ? { nunum: options.nunum } : {}),
      ...(options.nbest != null ? { nbest: options.nbest } : {}),
      ...(options.wbest != null ? { wbest: options.wbest } : {}),
    },
    data: {
      status: 0,
      format: `audio/L16;rate=${options.sampleRate}`,
      encoding: options.encoding,
      audio: audioBase64,
    },
  };

  return JSON.stringify(frame);
}

/**
 * 创建中间帧（只有 data，status=1）
 */
export function createMiddleFrame(options: XfyunProtocolOptions, audioBase64: string): string {
  return JSON.stringify({
    data: {
      status: 1,
      format: `audio/L16;rate=${options.sampleRate}`,
      encoding: options.encoding,
      audio: audioBase64,
    },
  });
}

/**
 * 创建末帧（data.status=2，无需额外参数）
 */
export function createLastFrame(): string {
  return JSON.stringify({
    data: {
      status: 2,
    },
  });
}

/**
 * 科大讯飞 IAT v2 响应结构
 */
export interface XfyunResponse {
  code: number;
  message: string;
  sid: string;
  data?: {
    status: number;
    result?: {
      sn: number;
      ls: boolean;
      bg: number;
      ed: number;
      pgs?: string;
      rg?: [number, number];
      ws: Array<{
        bg: number;
        cw: Array<{ w: string }>;
      }>;
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
  return response.code === 0;
}

/**
 * 判断响应是否为最后一帧（data.status=2）
 */
export function isFinishedResponse(response: XfyunResponse): boolean {
  return response.data?.status === 2;
}

/**
 * 判断响应是否包含识别结果（有 data.result 字段）
 */
export function hasResultPayload(response: XfyunResponse): boolean {
  return response.data?.result != null;
}
