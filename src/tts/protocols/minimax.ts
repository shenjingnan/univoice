import { Buffer } from 'node:buffer';
import WebSocket from 'ws';

/**
 * Minimax TTS WebSocket API 协议实现
 * 参考文档: https://platform.minimaxi.com/docs/api-reference/speech-t2a-websocket
 */

/**
 * WebSocket 消息类型
 */
export type MinimaxMessage = TaskStartMessage | TaskContinueMessage | TaskFinishMessage;

/**
 * task_start 消息 - 启动任务
 */
export interface TaskStartMessage {
  event: 'task_start';
  model: string;
  voice_setting: VoiceSetting;
  audio_setting: AudioSetting;
}

/**
 * 语音设置
 */
export interface VoiceSetting {
  voice_id: string;
  speed: number;
  vol: number;
  pitch: number;
  english_normalization: boolean;
}

/**
 * 音频设置
 */
export interface AudioSetting {
  sample_rate: number;
  bitrate: number;
  format: string;
  channel: number;
}

/**
 * task_continue 消息 - 发送文本
 */
export interface TaskContinueMessage {
  event: 'task_continue';
  text: string;
}

/**
 * task_finish 消息 - 结束任务
 */
export interface TaskFinishMessage {
  event: 'task_finish';
}

/**
 * 服务端响应事件类型
 */
export type MinimaxEvent =
  | ConnectedSuccessEvent
  | TaskStartedEvent
  | AudioDataEvent
  | TaskFailedEvent;

/**
 * connected_success 事件 - 连接成功
 */
export interface ConnectedSuccessEvent {
  event: 'connected_success';
}

/**
 * task_started 事件 - 任务启动成功
 */
export interface TaskStartedEvent {
  event: 'task_started';
}

/**
 * 音频数据响应
 */
export interface AudioDataEvent {
  data: {
    audio: string; // hex 编码的音频数据
  };
  is_final: boolean;
}

/**
 * task_failed 事件
 */
export interface TaskFailedEvent {
  event: 'task_failed';
  code?: number;
  message?: string;
}

/**
 * 服务端响应
 */
export type ServerResponse = MinimaxEvent;

/**
 * 创建 task_start 消息
 */
export function createTaskStartMessage(options: {
  model: string;
  voiceId: string;
  format: string;
  sampleRate?: number;
  bitrate?: number;
  speed?: number;
  volume?: number;
  pitch?: number;
}): TaskStartMessage {
  return {
    event: 'task_start',
    model: options.model,
    voice_setting: {
      voice_id: options.voiceId,
      speed: options.speed ?? 1,
      vol: options.volume ?? 1,
      pitch: options.pitch ?? 0,
      english_normalization: false,
    },
    audio_setting: {
      sample_rate: options.sampleRate ?? 32000,
      bitrate: options.bitrate ?? 128000,
      format: options.format,
      channel: 1,
    },
  };
}

/**
 * 创建 task_continue 消息
 */
export function createTaskContinueMessage(text: string): TaskContinueMessage {
  return {
    event: 'task_continue',
    text,
  };
}

/**
 * 创建 task_finish 消息
 */
export function createTaskFinishMessage(): TaskFinishMessage {
  return {
    event: 'task_finish',
  };
}

/**
 * 解析服务端响应
 */
export function parseServerResponse(data: WebSocket.Data): ServerResponse {
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
  return JSON.parse(text) as ServerResponse;
}

/**
 * 检查是否是连接成功事件
 */
export function isConnectedSuccessEvent(event: ServerResponse): event is ConnectedSuccessEvent {
  return event.event === 'connected_success';
}

/**
 * 检查是否是任务启动成功事件
 */
export function isTaskStartedEvent(event: ServerResponse): event is TaskStartedEvent {
  return event.event === 'task_started';
}

/**
 * 检查是否是音频数据事件
 */
export function isAudioDataEvent(event: ServerResponse): event is AudioDataEvent {
  return 'data' in event && 'audio' in (event as AudioDataEvent).data;
}

/**
 * 检查是否是失败事件
 */
export function isFailedEvent(event: ServerResponse): event is TaskFailedEvent {
  return event.event === 'task_failed';
}

/**
 * 从 hex 解码音频数据
 */
export function decodeAudioData(hex: string): Uint8Array {
  return Buffer.from(hex, 'hex');
}

/**
 * WebSocket 状态管理
 */
interface WebSocketState {
  queue: ServerResponse[];
  callbacks: ((msg: ServerResponse) => void)[];
}

const wsStates = new Map<WebSocket, WebSocketState>();

function getOrCreateState(ws: WebSocket): WebSocketState {
  let state = wsStates.get(ws);
  if (!state) {
    state = { queue: [], callbacks: [] };
    wsStates.set(ws, state);
  }
  return state;
}

function setupMessageHandler(ws: WebSocket) {
  if (!wsStates.has(ws)) {
    const state = getOrCreateState(ws);

    ws.on('message', (data: WebSocket.Data) => {
      try {
        const msg = parseServerResponse(data);

        if (state.callbacks.length > 0) {
          const callback = state.callbacks.shift();
          if (callback) callback(msg);
        } else {
          state.queue.push(msg);
        }
      } catch (error) {
        console.error('[Minimax] Error parsing message:', error);
      }
    });

    ws.on('close', () => {
      wsStates.delete(ws);
    });
  }
}

/**
 * 接收服务端消息
 */
export async function receiveResponse(ws: WebSocket): Promise<ServerResponse> {
  setupMessageHandler(ws);

  return new Promise((resolve, reject) => {
    const state = wsStates.get(ws);
    if (!state) {
      reject(new Error('WebSocket state not found'));
      return;
    }

    if (state.queue.length > 0) {
      const msg = state.queue.shift();
      if (msg) {
        resolve(msg);
        return;
      }
    }

    const errorHandler = (error: WebSocket.ErrorEvent) => {
      const index = state.callbacks.indexOf(resolver);
      if (index !== -1) {
        state.callbacks.splice(index, 1);
      }
      reject(error);
    };

    const resolver = (msg: ServerResponse) => {
      ws.removeListener('error', errorHandler);
      resolve(msg);
    };

    state.callbacks.push(resolver);
    ws.once('error', errorHandler);
  });
}

/**
 * 发送消息
 */
export async function sendMessage(ws: WebSocket, message: MinimaxMessage): Promise<void> {
  const data = JSON.stringify(message);
  return new Promise((resolve, reject) => {
    ws.send(data, (error?: Error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

/**
 * 等待 connected_success 事件
 */
export async function waitForConnected(ws: WebSocket): Promise<void> {
  const msg = await receiveResponse(ws);
  if (!isConnectedSuccessEvent(msg)) {
    if (isFailedEvent(msg)) {
      throw new Error(`Minimax connection failed: ${msg.code} - ${msg.message}`);
    }
    throw new Error(
      `Unexpected event: ${(msg as { event: string }).event}, expected connected_success`
    );
  }
}

/**
 * 等待 task_started 事件
 */
export async function waitForTaskStarted(ws: WebSocket): Promise<void> {
  const msg = await receiveResponse(ws);
  if (!isTaskStartedEvent(msg)) {
    if (isFailedEvent(msg)) {
      throw new Error(`Minimax task failed: ${msg.code} - ${msg.message}`);
    }
    throw new Error(`Unexpected event: ${(msg as { event: string }).event}, expected task_started`);
  }
}

/**
 * 收集音频数据直到任务完成
 */
export async function collectAudioData(ws: WebSocket): Promise<Uint8Array[]> {
  const audioChunks: Uint8Array[] = [];

  while (true) {
    const msg = await receiveResponse(ws);

    if (isFailedEvent(msg)) {
      throw new Error(`Minimax task failed: ${msg.code} - ${msg.message}`);
    }

    if (isAudioDataEvent(msg)) {
      if (msg.data.audio) {
        const audioData = decodeAudioData(msg.data.audio);
        audioChunks.push(audioData);
      }

      if (msg.is_final) {
        break;
      }
    }
  }

  return audioChunks;
}

/**
 * 合并多个 Uint8Array
 */
export function concatArrays(arrays: Uint8Array[]): Uint8Array {
  const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

/**
 * 接收音频数据或事件
 * 用于流式场景
 *
 * @returns 返回音频数据或事件，如果收到结束标志则返回 null
 */
export async function receiveAudioOrEvent(
  ws: WebSocket
): Promise<{ type: 'audio'; data: Uint8Array } | { type: 'event'; event: ServerResponse } | null> {
  setupMessageHandler(ws);

  return new Promise((resolve, reject) => {
    const state = wsStates.get(ws);
    if (!state) {
      reject(new Error('WebSocket state not found'));
      return;
    }

    // 检查是否有缓存的消息
    if (state.queue.length > 0) {
      const msg = state.queue.shift();
      if (msg) {
        if (isFailedEvent(msg)) {
          resolve(null);
          return;
        }
        if (isAudioDataEvent(msg)) {
          if (msg.is_final) {
            resolve(null);
            return;
          }
          const audioData = decodeAudioData(msg.data.audio);
          resolve({ type: 'audio', data: audioData });
          return;
        }
        resolve({ type: 'event', event: msg });
        return;
      }
    }

    // 如果没有缓存消息，等待新消息
    let resolved = false;
    const cleanup = () => {
      resolved = true;
      ws.removeListener('error', errorHandler);
    };

    const errorHandler = (error: WebSocket.ErrorEvent) => {
      if (resolved) return;
      cleanup();
      reject(error);
    };

    const messageResolver = (msg: ServerResponse) => {
      if (resolved) return;
      cleanup();

      if (isFailedEvent(msg)) {
        resolve(null);
        return;
      }

      if (isAudioDataEvent(msg)) {
        if (msg.is_final) {
          resolve(null);
          return;
        }
        const audioData = decodeAudioData(msg.data.audio);
        resolve({ type: 'audio', data: audioData });
        return;
      }

      resolve({ type: 'event', event: msg });
    };

    state.callbacks.push(messageResolver);
    ws.once('error', errorHandler);
  });
}
