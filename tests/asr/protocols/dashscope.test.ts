import { describe, expect, it } from 'vitest';
import {
  createFinishTaskMessage,
  createRunTaskMessage,
  isFailedEvent,
  isFinishedEvent,
  isResultGeneratedEvent,
  TaskStatus,
} from '@/asr/protocols/dashscope.js';

describe('DashScope ASR 协议', () => {
  describe('createRunTaskMessage', () => {
    it('应该创建 run-task 消息', () => {
      const msg = createRunTaskMessage('task-1', {
        model: 'paraformer-realtime-v2',
        format: 'pcm',
      });
      expect(msg.header.task_id).toBe('task-1');
      expect(msg.header.action).toBe('run-task');
      expect(msg.header.streaming).toBe('duplex');
      expect(msg.payload.task_group).toBe('audio');
      expect(msg.payload.task).toBe('asr');
      expect(msg.payload.function).toBe('recognition');
      expect(msg.payload.model).toBe('paraformer-realtime-v2');
      expect(msg.payload.parameters.format).toBe('pcm');
      expect(msg.payload.input).toEqual({});
    });

    it('应该包含可选参数', () => {
      const msg = createRunTaskMessage('task-2', {
        model: 'model',
        format: 'wav',
        sampleRate: 16000,
        languageHints: ['zh', 'en'],
        enableWords: true,
        enablePunctuationPrediction: true,
        enableInverseTextNormalization: true,
      });
      expect(msg.payload.parameters.sample_rate).toBe(16000);
      expect(msg.payload.parameters.language_hints).toEqual(['zh', 'en']);
      expect(msg.payload.parameters.enable_words).toBe(true);
      expect(msg.payload.parameters.enable_punctuation_prediction).toBe(true);
      expect(msg.payload.parameters.enable_inverse_text_normalization).toBe(true);
    });

    it('不应包含未定义的可选参数', () => {
      const msg = createRunTaskMessage('task-3', {
        model: 'model',
        format: 'pcm',
      });
      expect(msg.payload.parameters.sample_rate).toBeUndefined();
      expect(msg.payload.parameters.language_hints).toBeUndefined();
    });
  });

  describe('createFinishTaskMessage', () => {
    it('应该创建 finish-task 消息', () => {
      const msg = createFinishTaskMessage('task-1');
      expect(msg.header.task_id).toBe('task-1');
      expect(msg.header.action).toBe('finish-task');
      expect(msg.payload.input).toEqual({});
    });
  });

  describe('事件判断函数', () => {
    it('isResultGeneratedEvent 应该正确判断', () => {
      expect(
        isResultGeneratedEvent({
          header: { event: 'result-generated', task_id: 't', task_status: TaskStatus.Running },
          // biome-ignore lint/suspicious/noExplicitAny: test mock
          payload: {} as any,
        })
      ).toBe(true);
      expect(
        isResultGeneratedEvent({
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
    });

    it('isFailedEvent 应该正确判断', () => {
      expect(
        isFailedEvent({
          header: {
            event: 'task-failed',
            task_id: 't',
            task_status: TaskStatus.Failed,
            error_code: 'E',
            error_message: 'err',
          },
          // biome-ignore lint/suspicious/noExplicitAny: test mock
          payload: {} as any,
        })
      ).toBe(true);
    });
  });
});
