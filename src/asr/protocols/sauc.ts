/**
 * 豆包 ASR SAUC 协议实现
 * 基于 WebSocket 二进制协议
 */

import { Buffer } from 'node:buffer';
import { randomUUID } from 'node:crypto';
import { gunzipSync, gzipSync } from 'node:zlib';

/**
 * 协议版本
 */
export enum ProtocolVersion {
  V1 = 0b0001,
}

/**
 * 消息类型
 */
export enum MessageType {
  /** 客户端发送包含请求参数的 full client request */
  CLIENT_FULL_REQUEST = 0b0001,
  /** 客户端发送包含音频数据的 audio only request */
  CLIENT_AUDIO_ONLY_REQUEST = 0b0010,
  /** 服务端下发包含识别结果的 full server response */
  SERVER_FULL_RESPONSE = 0b1001,
  /** 服务端处理错误时下发的消息类型 */
  SERVER_ERROR_RESPONSE = 0b1111,
}

/**
 * 消息类型特定标志
 */
export enum MessageTypeSpecificFlags {
  /** header后4个字节不为sequence number */
  NO_SEQUENCE = 0b0000,
  /** header后4个字节为sequence number且为正 */
  POS_SEQUENCE = 0b0001,
  /** header后4个字节不为sequence number，仅指示此为最后一包（负包） */
  NEG_SEQUENCE = 0b0010,
  /** header后4个字节为sequence number且需要为负数（最后一包/负包） */
  NEG_WITH_SEQUENCE = 0b0011,
}

/**
 * 序列化方式
 */
export enum SerializationType {
  NO_SERIALIZATION = 0b0000,
  JSON = 0b0001,
}

/**
 * 压缩方式
 */
export enum CompressionType {
  NONE = 0b0000,
  GZIP = 0b0001,
}

/**
 * ASR 请求头构建器
 */
export class ASRRequestHeader {
  private messageType: MessageType = MessageType.CLIENT_FULL_REQUEST;
  private messageTypeSpecificFlags: MessageTypeSpecificFlags =
    MessageTypeSpecificFlags.POS_SEQUENCE;
  private serializationType: SerializationType = SerializationType.JSON;
  private compressionType: CompressionType = CompressionType.GZIP;
  private reservedData: number = 0x00;

  withMessageType(messageType: MessageType): this {
    this.messageType = messageType;
    return this;
  }

  withMessageTypeSpecificFlags(flags: MessageTypeSpecificFlags): this {
    this.messageTypeSpecificFlags = flags;
    return this;
  }

  withSerializationType(serializationType: SerializationType): this {
    this.serializationType = serializationType;
    return this;
  }

  withCompressionType(compressionType: CompressionType): this {
    this.compressionType = compressionType;
    return this;
  }

  toBytes(): Buffer {
    const header = Buffer.alloc(4);
    header[0] = (ProtocolVersion.V1 << 4) | 0b0001; // version + header size (4 bytes)
    header[1] = (this.messageType << 4) | this.messageTypeSpecificFlags;
    header[2] = (this.serializationType << 4) | this.compressionType;
    header[3] = this.reservedData;
    return header;
  }

  static default(): ASRRequestHeader {
    return new ASRRequestHeader();
  }
}

/**
 * ASR 响应结构
 */
export interface ASRResponseMessage {
  code: number;
  event: number;
  isLastPackage: boolean;
  payloadSequence: number;
  payloadSize: number;
  payloadMsg: SAUCResponsePayload | null;
}

/**
 * SAUC 响应 payload 结构
 */
export interface SAUCResponsePayload {
  audio_info?: {
    duration: number;
  };
  result?: {
    text: string;
    utterances?: SAUCUtterance[];
  };
}

/**
 * SAUC 分句信息
 */
export interface SAUCUtterance {
  text: string;
  start_time: number;
  end_time: number;
  definite: boolean;
  words?: SAUCWord[];
}

/**
 * SAUC 词信息
 */
export interface SAUCWord {
  text: string;
  start_time: number;
  end_time: number;
  blank_duration: number;
}

/**
 * 构建鉴权请求头
 */
export function buildAuthHeaders(options: {
  appKey: string;
  accessKey: string;
  resourceId?: string;
  connectId?: string;
}): Record<string, string> {
  const connectId = options.connectId || randomUUID();
  return {
    'X-Api-App-Key': options.appKey,
    'X-Api-Access-Key': options.accessKey,
    'X-Api-Resource-Id': options.resourceId || 'volc.bigasr.sauc.duration',
    'X-Api-Connect-Id': connectId,
  };
}

/**
 * Full Client Request 参数
 */
export interface FullClientRequestParams {
  user?: {
    uid?: string;
    did?: string;
    platform?: string;
    sdk_version?: string;
    app_version?: string;
  };
  audio: {
    format: 'pcm' | 'wav' | 'ogg' | 'mp3';
    codec?: 'raw' | 'opus';
    rate?: number;
    bits?: number;
    channel?: number;
    language?: string;
  };
  request: {
    model_name: string;
    enable_itn?: boolean;
    enable_punc?: boolean;
    enable_ddc?: boolean;
    show_utterances?: boolean;
    enable_nonstream?: boolean;
    result_type?: 'full' | 'single';
    /** 强制判停时间（ms），静音超过此时长直接判停输出 definite */
    end_window_size?: number;
    /** 语义切分最大静音阈值（ms） */
    vad_segment_duration?: number;
    /** 强制语音时间（ms），音频超过此时长后才尝试判停 */
    force_to_speech_time?: number;
    corpus?: {
      boosting_table_name?: string;
      boosting_table_id?: string;
      correct_table_name?: string;
      correct_table_id?: string;
      context?: string;
    };
  };
}

/**
 * 构建 Full Client Request 消息
 */
export function buildFullClientRequest(
  params: FullClientRequestParams,
  sequence: number,
  useGzip: boolean = true
): Buffer {
  const header = ASRRequestHeader.default().withMessageTypeSpecificFlags(
    MessageTypeSpecificFlags.POS_SEQUENCE
  );

  const payloadJson = JSON.stringify(params);
  const payloadBytes = Buffer.from(payloadJson, 'utf-8');
  const compressedPayload = useGzip ? gzipSync(payloadBytes) : payloadBytes;

  const headerBytes = header.toBytes();
  const sequenceBytes = Buffer.alloc(4);
  sequenceBytes.writeInt32BE(sequence, 0);

  const payloadSizeBytes = Buffer.alloc(4);
  payloadSizeBytes.writeUInt32BE(compressedPayload.length, 0);

  return Buffer.concat([headerBytes, sequenceBytes, payloadSizeBytes, compressedPayload]);
}

/**
 * 构建 Audio Only Request 消息
 */
export function buildAudioOnlyRequest(
  sequence: number,
  segment: Buffer,
  isLast: boolean = false,
  useGzip: boolean = true
): Buffer {
  const header = ASRRequestHeader.default()
    .withMessageType(MessageType.CLIENT_AUDIO_ONLY_REQUEST)
    .withSerializationType(SerializationType.NO_SERIALIZATION);

  if (isLast) {
    header.withMessageTypeSpecificFlags(MessageTypeSpecificFlags.NEG_WITH_SEQUENCE);
  } else {
    header.withMessageTypeSpecificFlags(MessageTypeSpecificFlags.POS_SEQUENCE);
  }

  const compressedSegment = useGzip ? gzipSync(segment) : segment;

  const headerBytes = header.toBytes();
  const sequenceBytes = Buffer.alloc(4);
  // 如果是最后一包，序列号需要为负数
  sequenceBytes.writeInt32BE(isLast ? -sequence : sequence, 0);

  const payloadSizeBytes = Buffer.alloc(4);
  payloadSizeBytes.writeUInt32BE(compressedSegment.length, 0);

  return Buffer.concat([headerBytes, sequenceBytes, payloadSizeBytes, compressedSegment]);
}

/**
 * 解析服务端响应
 */
export function parseResponse(data: Buffer): ASRResponseMessage {
  const response: ASRResponseMessage = {
    code: 0,
    event: 0,
    isLastPackage: false,
    payloadSequence: 0,
    payloadSize: 0,
    payloadMsg: null,
  };

  if (data.length < 4) {
    throw new Error('Response data too short');
  }

  const headerSize = data[0] & 0x0f;
  const messageType = (data[1] >> 4) & 0x0f;
  const messageTypeSpecificFlags = data[1] & 0x0f;
  const serializationMethod = (data[2] >> 4) & 0x0f;
  const messageCompression = data[2] & 0x0f;

  let payload = data.slice(headerSize * 4);

  // 解析 message type specific flags
  if (messageTypeSpecificFlags & 0x01) {
    response.payloadSequence = payload.readInt32BE(0);
    payload = payload.slice(4);
  }
  if (messageTypeSpecificFlags & 0x02) {
    response.isLastPackage = true;
  }
  if (messageTypeSpecificFlags & 0x04) {
    response.event = payload.readInt32BE(0);
    payload = payload.slice(4);
  }

  // 解析 message type
  if (messageType === MessageType.SERVER_FULL_RESPONSE) {
    response.payloadSize = payload.readUInt32BE(0);
    payload = payload.slice(4);
  } else if (messageType === MessageType.SERVER_ERROR_RESPONSE) {
    response.code = payload.readInt32BE(0);
    response.payloadSize = payload.readUInt32BE(4);
    payload = payload.slice(8);
  }

  if (payload.length === 0) {
    return response;
  }

  // 解压缩
  if (messageCompression === CompressionType.GZIP) {
    try {
      payload = gunzipSync(payload);
    } catch {
      return response;
    }
  }

  // 解析 payload
  try {
    if (serializationMethod === SerializationType.JSON) {
      const payloadStr = payload.toString('utf-8');
      response.payloadMsg = JSON.parse(payloadStr);
    }
  } catch {
    // 忽略解析错误
  }

  return response;
}

/**
 * 错误码定义
 */
export enum SAUCErrCode {
  SUCCESS = 20000000,
  INVALID_REQUEST = 45000001,
  EMPTY_AUDIO = 45000002,
  TIMEOUT = 45000081,
  INVALID_AUDIO_FORMAT = 45000151,
  SERVER_BUSY = 55000031,
}

/**
 * 获取错误码描述
 */
export function getErrorMessage(code: number): string {
  switch (code) {
    case SAUCErrCode.SUCCESS:
      return '成功';
    case SAUCErrCode.INVALID_REQUEST:
      return '请求参数无效';
    case SAUCErrCode.EMPTY_AUDIO:
      return '空音频';
    case SAUCErrCode.TIMEOUT:
      return '等包超时';
    case SAUCErrCode.INVALID_AUDIO_FORMAT:
      return '音频格式不正确';
    case SAUCErrCode.SERVER_BUSY:
      return '服务器繁忙';
    default:
      if (code >= 55000000 && code < 56000000) {
        return '服务内部处理错误';
      }
      return `未知错误: ${code}`;
  }
}
