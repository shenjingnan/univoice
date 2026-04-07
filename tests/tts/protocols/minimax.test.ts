import { describe, expect, it } from 'vitest';
import {
  concatArrays,
  createTaskContinueMessage,
  createTaskFinishMessage,
  createTaskStartMessage,
  decodeAudioData,
  isAudioDataEvent,
  isConnectedSuccessEvent,
  isFailedEvent,
  isTaskFinishedEvent,
  isTaskStartedEvent,
} from '@/tts/protocols/minimax.js';

describe('Minimax TTS 协议', () => {
  describe('createTaskStartMessage', () => {
    it('应该创建 task_start 消息', () => {
      const msg = createTaskStartMessage({
        model: 't2v2',
        voiceId: 'voice-1',
        format: 'mp3',
      });
      expect(msg.event).toBe('task_start');
      expect(msg.model).toBe('t2v2');
      expect(msg.voice_setting.voice_id).toBe('voice-1');
      expect(msg.voice_setting.speed).toBe(1);
      expect(msg.voice_setting.vol).toBe(1);
      expect(msg.voice_setting.pitch).toBe(0);
      expect(msg.audio_setting.format).toBe('mp3');
      expect(msg.audio_setting.sample_rate).toBe(32000);
      expect(msg.audio_setting.bitrate).toBe(128000);
      expect(msg.audio_setting.channel).toBe(1);
    });

    it('应该使用自定义参数', () => {
      const msg = createTaskStartMessage({
        model: 'model',
        voiceId: 'v',
        format: 'wav',
        sampleRate: 16000,
        bitrate: 64000,
        speed: 1.5,
        volume: 0.8,
        pitch: 2,
      });
      expect(msg.voice_setting.speed).toBe(1.5);
      expect(msg.voice_setting.vol).toBe(0.8);
      expect(msg.voice_setting.pitch).toBe(2);
      expect(msg.audio_setting.sample_rate).toBe(16000);
      expect(msg.audio_setting.bitrate).toBe(64000);
    });
  });

  describe('createTaskContinueMessage', () => {
    it('应该创建 task_continue 消息', () => {
      const msg = createTaskContinueMessage('Hello');
      expect(msg.event).toBe('task_continue');
      expect(msg.text).toBe('Hello');
    });
  });

  describe('createTaskFinishMessage', () => {
    it('应该创建 task_finish 消息', () => {
      const msg = createTaskFinishMessage();
      expect(msg.event).toBe('task_finish');
    });
  });

  describe('事件判断函数', () => {
    it('isConnectedSuccessEvent', () => {
      expect(isConnectedSuccessEvent({ event: 'connected_success' })).toBe(true);
      expect(isConnectedSuccessEvent({ event: 'task_started' })).toBe(false);
    });

    it('isTaskStartedEvent', () => {
      expect(isTaskStartedEvent({ event: 'task_started' })).toBe(true);
    });

    it('isAudioDataEvent', () => {
      expect(isAudioDataEvent({ data: { audio: 'hex' }, is_final: false })).toBe(true);
      expect(isAudioDataEvent({ event: 'task_started' })).toBe(false);
    });

    it('isFailedEvent', () => {
      expect(isFailedEvent({ event: 'task_failed', code: 1, message: 'err' })).toBe(true);
    });

    it('isTaskFinishedEvent', () => {
      expect(isTaskFinishedEvent({ event: 'task_finished' })).toBe(true);
    });
  });

  describe('decodeAudioData', () => {
    it('应该从 hex 解码音频', () => {
      const result = decodeAudioData('0102ff00');
      expect(Array.from(result)).toEqual([1, 2, 255, 0]);
    });

    it('空字符串应返回空', () => {
      const result = decodeAudioData('');
      expect(result.length).toBe(0);
    });
  });

  describe('concatArrays', () => {
    it('应该合并数组', () => {
      const result = concatArrays([new Uint8Array([1, 2]), new Uint8Array([3])]);
      expect(Array.from(result)).toEqual([1, 2, 3]);
    });
  });
});
