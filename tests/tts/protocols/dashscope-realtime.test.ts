import { Buffer } from 'node:buffer';
import { describe, expect, it } from 'vitest';
import {
  createInputTextBufferAppendEvent,
  createInputTextBufferClearEvent,
  createInputTextBufferCommitEvent,
  createSessionFinishEvent,
  createSessionUpdateEvent,
  decodeAudioData,
  isAudioEvent,
  isErrorEvent,
  isSessionCreatedEvent,
  isSessionFinishedEvent,
  isSessionUpdatedEvent,
} from '@/tts/protocols/dashscope-realtime.js';

describe('DashScope Realtime TTS 协议', () => {
  describe('createSessionUpdateEvent', () => {
    it('应该创建带必填字段的 session.update 事件', () => {
      const event = createSessionUpdateEvent({ voice: 'Cherry' });
      expect(event.type).toBe('session.update');
      expect(event.session.voice).toBe('Cherry');
      expect(event.event_id).toMatch(/^event_/);
    });

    it('应该使用默认值', () => {
      const event = createSessionUpdateEvent({ voice: 'Cherry' });
      expect(event.session.mode).toBe('server_commit');
      expect(event.session.language_type).toBe('Auto');
      expect(event.session.response_format).toBe('pcm');
      expect(event.session.sample_rate).toBe(24000);
    });

    it('应该支持自定义选项', () => {
      const event = createSessionUpdateEvent({
        voice: 'Cherry',
        mode: 'commit',
        languageType: 'Chinese',
        format: 'opus',
        sampleRate: 48000,
        bitrate: 64000,
        instructions: '温柔的语调',
        optimizeInstructions: true,
        speechRate: 1.5,
        pitchRate: 0.8,
      });
      expect(event.session.mode).toBe('commit');
      expect(event.session.language_type).toBe('Chinese');
      expect(event.session.response_format).toBe('opus');
      expect(event.session.sample_rate).toBe(48000);
      expect(event.session.bitrate).toBe(64000);
      expect(event.session.instructions).toBe('温柔的语调');
      expect(event.session.optimize_instructions).toBe(true);
      expect(event.session.speech_rate).toBe(1.5);
      expect(event.session.pitch_rate).toBe(0.8);
    });
  });

  describe('createInputTextBufferAppendEvent', () => {
    it('应该创建文本追加事件', () => {
      const event = createInputTextBufferAppendEvent('Hello');
      expect(event.type).toBe('input_text_buffer.append');
      expect(event.text).toBe('Hello');
      expect(event.event_id).toMatch(/^event_/);
    });
  });

  describe('createInputTextBufferCommitEvent', () => {
    it('应该创建文本提交事件', () => {
      const event = createInputTextBufferCommitEvent();
      expect(event.type).toBe('input_text_buffer.commit');
      expect(event.event_id).toMatch(/^event_/);
    });
  });

  describe('createInputTextBufferClearEvent', () => {
    it('应该创建文本清空事件', () => {
      const event = createInputTextBufferClearEvent();
      expect(event.type).toBe('input_text_buffer.clear');
      expect(event.event_id).toMatch(/^event_/);
    });
  });

  describe('createSessionFinishEvent', () => {
    it('应该创建会话结束事件', () => {
      const event = createSessionFinishEvent();
      expect(event.type).toBe('session.finish');
      expect(event.event_id).toMatch(/^event_/);
    });
  });

  describe('事件判断函数', () => {
    it('isAudioEvent 应该识别 response.audio.delta', () => {
      expect(isAudioEvent({ type: 'response.audio.delta', event_id: 'e1', delta: 'abc' })).toBe(
        true
      );
      expect(isAudioEvent({ type: 'session.created', session: { id: '1', model: 'm' } })).toBe(
        false
      );
    });

    it('isSessionFinishedEvent 应该识别 session.finished', () => {
      expect(isSessionFinishedEvent({ type: 'session.finished', session: { id: '1' } })).toBe(true);
      expect(
        isSessionFinishedEvent({ type: 'session.created', session: { id: '1', model: 'm' } })
      ).toBe(false);
    });

    it('isErrorEvent 应该识别 error', () => {
      expect(isErrorEvent({ type: 'error', error: { code: 'E001', message: 'err' } })).toBe(true);
      expect(isErrorEvent({ type: 'session.created', session: { id: '1', model: 'm' } })).toBe(
        false
      );
    });

    it('isSessionCreatedEvent 应该识别 session.created', () => {
      expect(
        isSessionCreatedEvent({ type: 'session.created', session: { id: '1', model: 'm' } })
      ).toBe(true);
    });

    it('isSessionUpdatedEvent 应该识别 session.updated', () => {
      expect(
        isSessionUpdatedEvent({ type: 'session.updated', session: { id: '1', model: 'm' } })
      ).toBe(true);
    });
  });

  describe('decodeAudioData', () => {
    it('应该从 base64 解码音频', () => {
      const base64 = Buffer.from([1, 2, 3]).toString('base64');
      const result = decodeAudioData(base64);
      expect(Array.from(result)).toEqual([1, 2, 3]);
    });
  });
});
