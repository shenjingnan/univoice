import { Buffer } from 'node:buffer';
import { describe, expect, it } from 'vitest';
import {
  ASRRequestHeader,
  buildAudioOnlyRequest,
  buildAuthHeaders,
  buildFullClientRequest,
  CompressionType,
  getErrorMessage,
  MessageType,
  MessageTypeSpecificFlags,
  ProtocolVersion,
  parseResponse,
  SAUCErrCode,
  SerializationType,
} from '@/asr/protocols/sauc.js';

describe('SAUC 协议', () => {
  describe('buildAuthHeaders', () => {
    it('应该构建正确的认证头', () => {
      const headers = buildAuthHeaders({
        appKey: 'test-app',
        accessKey: 'test-access',
        resourceId: 'test-resource',
        connectId: 'test-connect',
      });
      expect(headers['X-Api-App-Key']).toBe('test-app');
      expect(headers['X-Api-Access-Key']).toBe('test-access');
      expect(headers['X-Api-Resource-Id']).toBe('test-resource');
      expect(headers['X-Api-Connect-Id']).toBe('test-connect');
    });

    it('应该使用默认值', () => {
      const headers = buildAuthHeaders({
        appKey: 'app',
        accessKey: 'access',
      });
      expect(headers['X-Api-Resource-Id']).toBe('volc.bigasr.sauc.duration');
      expect(headers['X-Api-Connect-Id']).toBeDefined();
    });
  });

  describe('ASRRequestHeader', () => {
    it('应该创建默认请求头', () => {
      const header = ASRRequestHeader.default();
      const bytes = header.toBytes();
      expect(bytes).toBeInstanceOf(Buffer);
      expect(bytes.length).toBe(4);
      // 检查版本号
      expect((bytes[0] >> 4) & 0x0f).toBe(ProtocolVersion.V1);
      // 检查消息类型
      expect((bytes[1] >> 4) & 0x0f).toBe(MessageType.CLIENT_FULL_REQUEST);
    });

    it('应该支持链式调用', () => {
      const header = ASRRequestHeader.default()
        .withMessageType(MessageType.CLIENT_AUDIO_ONLY_REQUEST)
        .withSerializationType(SerializationType.NO_SERIALIZATION);
      const bytes = header.toBytes();
      expect((bytes[1] >> 4) & 0x0f).toBe(MessageType.CLIENT_AUDIO_ONLY_REQUEST);
      expect((bytes[2] >> 4) & 0x0f).toBe(SerializationType.NO_SERIALIZATION);
    });
  });

  describe('buildFullClientRequest', () => {
    it('应该构建正确的请求消息', () => {
      const params = {
        audio: { format: 'pcm' as const },
        request: { model_name: 'test' },
      };
      const result = buildFullClientRequest(params, 1, false);
      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBeGreaterThan(8);
      // header(4) + sequence(4) + payloadSize(4) + payload
    });

    it('应该支持 gzip 压缩', () => {
      const params = {
        audio: { format: 'pcm' as const },
        request: { model_name: 'test' },
      };
      const compressed = buildFullClientRequest(params, 1, true);
      // 压缩后可能更小或更大（取决于数据大小），但头部结构不同
      expect(compressed).toBeInstanceOf(Buffer);
    });
  });

  describe('buildAudioOnlyRequest', () => {
    it('应该构建音频数据请求', () => {
      const segment = Buffer.from([1, 2, 3, 4]);
      const result = buildAudioOnlyRequest(1, segment, false, false);
      expect(result).toBeInstanceOf(Buffer);
      // header(4) + sequence(4) + payloadSize(4) + data
      expect(result.length).toBeGreaterThan(12);
    });

    it('最后一包应该使用负序列号', () => {
      const segment = Buffer.from([1, 2, 3, 4]);
      const result = buildAudioOnlyRequest(5, segment, true, false);
      const sequence = result.readInt32BE(4);
      expect(sequence).toBe(-5); // 负序列号
    });
  });

  describe('parseResponse', () => {
    it('应该解析服务端响应', () => {
      // 构建一个简单的服务端响应
      const header = Buffer.alloc(4);
      header[0] = 0x11; // version=1, header_size=4
      header[1] = (MessageType.SERVER_FULL_RESPONSE << 4) | MessageTypeSpecificFlags.NEG_SEQUENCE;
      header[2] = (SerializationType.JSON << 4) | CompressionType.NONE;
      header[3] = 0x00;

      const payloadJson = JSON.stringify({ result: { text: 'hello' } });
      const payloadBytes = Buffer.from(payloadJson, 'utf-8');
      const payloadSize = Buffer.alloc(4);
      payloadSize.writeUInt32BE(payloadBytes.length, 0);

      const data = Buffer.concat([header, payloadSize, payloadBytes]);
      const response = parseResponse(data);

      expect(response.isLastPackage).toBe(true);
      expect(response.payloadSize).toBe(payloadBytes.length);
      expect(response.payloadMsg?.result?.text).toBe('hello');
    });

    it('数据太短应该抛错', () => {
      expect(() => parseResponse(Buffer.alloc(2))).toThrow('too short');
    });

    it('应该解析错误响应', () => {
      const header = Buffer.alloc(4);
      header[0] = 0x11;
      header[1] = MessageType.SERVER_ERROR_RESPONSE << 4;
      header[2] = (SerializationType.JSON << 4) | CompressionType.NONE;
      header[3] = 0x00;

      const errorCode = Buffer.alloc(4);
      errorCode.writeInt32BE(45000001, 0);
      const payloadJson = JSON.stringify({ message: 'error' });
      const payloadBytes = Buffer.from(payloadJson, 'utf-8');
      const payloadSize = Buffer.alloc(4);
      payloadSize.writeUInt32BE(payloadBytes.length, 0);

      const data = Buffer.concat([header, errorCode, payloadSize, payloadBytes]);
      const response = parseResponse(data);
      expect(response.code).toBe(45000001);
    });
  });

  describe('getErrorMessage', () => {
    it('应该返回正确的错误消息', () => {
      expect(getErrorMessage(SAUCErrCode.SUCCESS)).toBe('成功');
      expect(getErrorMessage(SAUCErrCode.INVALID_REQUEST)).toBe('请求参数无效');
      expect(getErrorMessage(SAUCErrCode.EMPTY_AUDIO)).toBe('空音频');
      expect(getErrorMessage(SAUCErrCode.TIMEOUT)).toBe('等包超时');
      expect(getErrorMessage(SAUCErrCode.INVALID_AUDIO_FORMAT)).toBe('音频格式不正确');
      expect(getErrorMessage(SAUCErrCode.SERVER_BUSY)).toBe('服务器繁忙');
    });

    it('未知服务端错误码应该返回通用消息', () => {
      expect(getErrorMessage(55000001)).toBe('服务内部处理错误');
    });

    it('未知错误码应该返回未知错误', () => {
      expect(getErrorMessage(99999999)).toContain('未知错误');
    });
  });
});
