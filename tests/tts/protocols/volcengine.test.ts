import { describe, expect, it } from 'vitest';
import {
  CompressionBits,
  createMessage,
  EventType,
  MsgType,
  MsgTypeFlagBits,
  marshalMessage,
  SerializationBits,
  unmarshalMessage,
  VersionBits,
} from '@/tts/protocols/volcengine.js';

describe('volcengine 协议', () => {
  describe('createMessage', () => {
    it('应该创建默认消息', () => {
      const msg = createMessage(MsgType.FullClientRequest, MsgTypeFlagBits.NoSeq);
      expect(msg.type).toBe(MsgType.FullClientRequest);
      expect(msg.flag).toBe(MsgTypeFlagBits.NoSeq);
      expect(msg.version).toBe(VersionBits.Version1);
      expect(msg.serialization).toBe(SerializationBits.JSON);
      expect(msg.compression).toBe(CompressionBits.None);
      expect(msg.payload).toBeInstanceOf(Uint8Array);
      expect(msg.payload.length).toBe(0);
    });
  });

  describe('marshalMessage / unmarshalMessage', () => {
    it('应该正确序列化和反序列化基本消息', () => {
      const msg = createMessage(MsgType.FullClientRequest, MsgTypeFlagBits.NoSeq);
      msg.payload = new TextEncoder().encode('{"test": true}');
      const data = marshalMessage(msg);
      expect(data).toBeInstanceOf(Uint8Array);
      expect(data.length).toBeGreaterThan(3);

      const restored = unmarshalMessage(data);
      expect(restored.type).toBe(MsgType.FullClientRequest);
      expect(restored.flag).toBe(MsgTypeFlagBits.NoSeq);
      expect(restored.version).toBe(VersionBits.Version1);
    });

    it('应该正确处理带 event 的消息', () => {
      const msg = createMessage(MsgType.FullClientRequest, MsgTypeFlagBits.WithEvent);
      msg.event = EventType.StartConnection;
      msg.payload = new TextEncoder().encode('{}');
      const data = marshalMessage(msg);
      const restored = unmarshalMessage(data);
      expect(restored.event).toBe(EventType.StartConnection);
    });

    it('应该正确处理带 sequence 的消息', () => {
      const msg = createMessage(MsgType.FullClientRequest, MsgTypeFlagBits.PositiveSeq);
      msg.sequence = 42;
      msg.payload = new TextEncoder().encode('test');
      const data = marshalMessage(msg);
      const restored = unmarshalMessage(data);
      expect(restored.sequence).toBe(42);
    });

    it('应该正确处理 payload 数据', () => {
      const msg = createMessage(MsgType.FullClientRequest, MsgTypeFlagBits.NoSeq);
      const payload = new TextEncoder().encode('hello world');
      msg.payload = payload;
      const data = marshalMessage(msg);
      const restored = unmarshalMessage(data);
      expect(new TextDecoder().decode(restored.payload)).toBe('hello world');
    });

    it('数据太短应该抛错', () => {
      expect(() => unmarshalMessage(new Uint8Array(2))).toThrow('data too short');
    });

    it('应该正确处理带 sessionId 的消息', () => {
      const msg = createMessage(MsgType.FullClientRequest, MsgTypeFlagBits.WithEvent);
      msg.event = EventType.StartSession;
      msg.sessionId = 'test-session-123';
      msg.payload = new TextEncoder().encode('{}');
      const data = marshalMessage(msg);
      const restored = unmarshalMessage(data);
      expect(restored.sessionId).toBe('test-session-123');
    });

    it('应该正确处理 Error 类型消息', () => {
      const msg = createMessage(MsgType.Error, MsgTypeFlagBits.NoSeq);
      msg.errorCode = 12345;
      msg.payload = new TextEncoder().encode('error message');
      const data = marshalMessage(msg);
      const restored = unmarshalMessage(data);
      expect(restored.errorCode).toBe(12345);
    });

    it('应该往返保持数据一致性', () => {
      const msg = createMessage(MsgType.FullClientRequest, MsgTypeFlagBits.WithEvent);
      msg.event = EventType.TaskRequest;
      msg.sessionId = 'session-abc';
      msg.payload = new TextEncoder().encode('{"speaker":"test","text":"hello"}');
      const data = marshalMessage(msg);
      const restored = unmarshalMessage(data);
      expect(restored.type).toBe(msg.type);
      expect(restored.flag).toBe(msg.flag);
      expect(restored.event).toBe(msg.event);
      expect(restored.sessionId).toBe(msg.sessionId);
      expect(new TextDecoder().decode(restored.payload)).toBe('{"speaker":"test","text":"hello"}');
    });
  });

  describe('枚举值', () => {
    it('EventType 应该包含预期的事件类型', () => {
      expect(EventType.StartConnection).toBe(1);
      expect(EventType.FinishConnection).toBe(2);
      expect(EventType.StartSession).toBe(100);
      expect(EventType.FinishSession).toBe(102);
      expect(EventType.TaskRequest).toBe(200);
      expect(EventType.TTSResponse).toBe(352);
    });

    it('MsgType 应该包含预期的消息类型', () => {
      expect(MsgType.FullClientRequest).toBe(0b1);
      expect(MsgType.AudioOnlyClient).toBe(0b10);
      expect(MsgType.FullServerResponse).toBe(0b1001);
      expect(MsgType.Error).toBe(0b1111);
    });
  });
});
