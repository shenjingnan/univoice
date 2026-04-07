import { describe, expect, it } from 'vitest';
import {
  concatArrays,
  createContinueTaskMessage,
  createFinishTaskMessage,
  createRunTaskMessage,
  decodeAudioData,
  isAudioEvent,
  isFailedEvent,
  isFinishedEvent,
  TaskStatus,
} from '@/tts/protocols/dashscope.js';

describe('DashScope TTS 协议', () => {
  describe('createRunTaskMessage', () => {
    it('应该创建正确的 run-task 消息', () => {
      const msg = createRunTaskMessage('task-123', {
        model: 'cosyvoice-v3-flash',
        voice: 'longxiaochun',
        format: 'mp3',
      });
      expect(msg.header.task_id).toBe('task-123');
      expect(msg.header.action).toBe('run-task');
      expect(msg.header.streaming).toBe('duplex');
      expect(msg.payload.task_group).toBe('audio');
      expect(msg.payload.task).toBe('tts');
      expect(msg.payload.function).toBe('SpeechSynthesizer');
      expect(msg.payload.model).toBe('cosyvoice-v3-flash');
      expect(msg.payload.parameters.voice).toBe('longxiaochun');
      expect(msg.payload.parameters.format).toBe('mp3');
      expect(msg.payload.parameters.text_type).toBe('PlainText');
      expect(msg.payload.input).toEqual({});
    });

    it('应该支持可选参数', () => {
      const msg = createRunTaskMessage('task-456', {
        model: 'model',
        voice: 'voice',
        format: 'wav',
        sampleRate: 16000,
        volume: 80,
        rate: 1.5,
        pitch: 2,
      });
      expect(msg.payload.parameters.sample_rate).toBe(16000);
      expect(msg.payload.parameters.volume).toBe(80);
      expect(msg.payload.parameters.rate).toBe(1.5);
      expect(msg.payload.parameters.pitch).toBe(2);
    });
  });

  describe('createContinueTaskMessage', () => {
    it('应该创建正确的 continue-task 消息', () => {
      const msg = createContinueTaskMessage('task-123', 'Hello World');
      expect(msg.header.task_id).toBe('task-123');
      expect(msg.header.action).toBe('continue-task');
      expect(msg.payload.input.text).toBe('Hello World');
    });
  });

  describe('createFinishTaskMessage', () => {
    it('应该创建正确的 finish-task 消息', () => {
      const msg = createFinishTaskMessage('task-123');
      expect(msg.header.task_id).toBe('task-123');
      expect(msg.header.action).toBe('finish-task');
      expect(msg.payload.input).toEqual({});
    });
  });

  describe('事件判断函数', () => {
    it('isAudioEvent 应该正确判断', () => {
      expect(
        isAudioEvent({
          header: { event: 'result-generated', task_id: 't', task_status: TaskStatus.Running },
          // biome-ignore lint/suspicious/noExplicitAny: test mock
          payload: {} as any,
        })
      ).toBe(true);
      expect(
        isAudioEvent({
          header: { event: 'task-finished', task_id: 't', task_status: TaskStatus.Completed },
          // biome-ignore lint/suspicious/noExplicitAny: test mock
          payload: {} as any,
        })
      ).toBe(false);
    });

    it('isFinishedEvent 应该正确判断', () => {
      expect(
        isFinishedEvent({
          header: { event: 'task-finished', task_id: 't', task_status: TaskStatus.Completed },
          // biome-ignore lint/suspicious/noExplicitAny: test mock
          payload: {} as any,
        })
      ).toBe(true);
      expect(
        // biome-ignore lint/suspicious/noExplicitAny: test mock
        isFinishedEvent({ header: { event: 'task-started', task_id: 't' }, payload: {} as any })
      ).toBe(false);
    });

    it('isFailedEvent 应该正确判断', () => {
      expect(
        isFailedEvent({
          header: {
            event: 'task-failed',
            task_id: 't',
            task_status: TaskStatus.Failed,
            error_code: 'E001',
            error_message: 'err',
          },
          // biome-ignore lint/suspicious/noExplicitAny: test mock
          payload: {} as any,
        })
      ).toBe(true);
      expect(
        // biome-ignore lint/suspicious/noExplicitAny: test mock
        isFailedEvent({ header: { event: 'task-started', task_id: 't' }, payload: {} as any })
      ).toBe(false);
    });
  });

  describe('concatArrays', () => {
    it('应该合并多个 Uint8Array', () => {
      const a = new Uint8Array([1, 2]);
      const b = new Uint8Array([3, 4]);
      const result = concatArrays([a, b]);
      expect(Array.from(result)).toEqual([1, 2, 3, 4]);
    });

    it('空数组应该返回空 Uint8Array', () => {
      const result = concatArrays([]);
      expect(result.length).toBe(0);
    });

    it('单个数组应该返回副本', () => {
      const a = new Uint8Array([1, 2, 3]);
      const result = concatArrays([a]);
      expect(Array.from(result)).toEqual([1, 2, 3]);
    });
  });

  describe('decodeAudioData', () => {
    it('应该从 base64 解码', () => {
      const base64 = Buffer.from([1, 2, 3, 4]).toString('base64');
      const result = decodeAudioData(base64);
      expect(Array.from(result)).toEqual([1, 2, 3, 4]);
    });
  });
});
