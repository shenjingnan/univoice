import { Buffer } from 'node:buffer';
import WebSocket from 'ws';

/**
 * DashScope CosyVoice WebSocket API 协议实现
 * 参考文档: https://help.aliyun.com/zh/model-studio/developer-reference/cosyvoice-api
 */

/**
 * 任务状态
 */
export enum TaskStatus {
  Pending = 'Pending',
  Running = 'Running',
  Completed = 'Completed',
  Failed = 'Failed',
}

/**
 * WebSocket 消息类型
 */
export type DashScopeMessage = RunTaskMessage | ContinueTaskMessage | FinishTaskMessage;

/**
 * run-task 消息 - 启动任务
 * 注意：根据 DashScope CosyVoice 协议，run-task 的 input 必须是空对象
 * 文本需要通过 continue-task 指令发送
 */
export interface RunTaskMessage {
  header: {
    task_id: string;
    action: 'run-task';
    streaming: 'duplex';
  };
  payload: {
    task_group: 'audio';
    task: 'tts';
    function: 'SpeechSynthesizer';
    model: string;
    parameters: {
      text_type: 'PlainText';
      voice: string;
      format: string;
      sample_rate?: number;
      volume?: number;
      rate?: number;
      pitch?: number;
    };
    input: Record<string, never>;
  };
}

/**
 * continue-task 消息 - 继续发送文本
 */
export interface ContinueTaskMessage {
  header: {
    task_id: string;
    action: 'continue-task';
    streaming: 'duplex';
  };
  payload: {
    input: {
      text: string;
    };
  };
}

/**
 * finish-task 消息 - 结束任务
 * 注意：payload 必须包含 input 字段（空对象）
 */
export interface FinishTaskMessage {
  header: {
    task_id: string;
    action: 'finish-task';
    streaming: 'duplex';
  };
  payload: {
    input: Record<string, never>;
  };
}

/**
 * 服务端响应事件类型
 */
export type DashScopeEvent =
  | TaskStartedEvent
  | ResultGeneratedEvent
  | TaskFinishedEvent
  | TaskFailedEvent;

/**
 * task-started 事件
 */
export interface TaskStartedEvent {
  header: {
    task_id: string;
    event: 'task-started';
  };
  payload: Record<string, never>;
}

/**
 * result-generated 事件 - 句子级别的状态通知
 * 注意：音频数据通过独立的二进制 WebSocket 帧传输，不在此事件中
 */
export interface ResultGeneratedEvent {
  header: {
    task_id: string;
    event: 'result-generated';
    task_status: TaskStatus;
  };
  payload: {
    output: {
      type: 'sentence-begin' | 'sentence-synthesis' | 'sentence-end';
      sentence: {
        index: number;
        begin_time?: number;
        end_time?: number;
        text?: string;
      };
    };
    usage?: {
      characters: number;
      duration: number;
    };
  };
}

/**
 * task-finished 事件
 */
export interface TaskFinishedEvent {
  header: {
    task_id: string;
    event: 'task-finished';
    task_status: TaskStatus;
  };
  payload: {
    usage: {
      characters: number;
      duration: number;
    };
  };
}

/**
 * task-failed 事件
 */
export interface TaskFailedEvent {
  header: {
    task_id: string;
    event: 'task-failed';
    task_status: TaskStatus;
    error_code: string;
    error_message: string;
  };
  payload: Record<string, never>;
}

/**
 * 服务端响应
 */
export type ServerResponse = DashScopeEvent;

/**
 * 创建 run-task 消息
 * 注意：run-task 的 input 必须是空对象，文本需要通过 continue-task 发送
 */
export function createRunTaskMessage(
  taskId: string,
  options: {
    model: string;
    voice: string;
    format: string;
    sampleRate?: number;
    volume?: number;
    rate?: number;
    pitch?: number;
  }
): RunTaskMessage {
  return {
    header: {
      task_id: taskId,
      action: 'run-task',
      streaming: 'duplex',
    },
    payload: {
      task_group: 'audio',
      task: 'tts',
      function: 'SpeechSynthesizer',
      model: options.model,
      parameters: {
        text_type: 'PlainText',
        voice: options.voice,
        format: options.format,
        sample_rate: options.sampleRate,
        volume: options.volume,
        rate: options.rate,
        pitch: options.pitch,
      },
      input: {},
    },
  };
}

/**
 * 创建 continue-task 消息
 */
export function createContinueTaskMessage(taskId: string, text: string): ContinueTaskMessage {
  return {
    header: {
      task_id: taskId,
      action: 'continue-task',
      streaming: 'duplex',
    },
    payload: {
      input: {
        text,
      },
    },
  };
}

/**
 * 创建 finish-task 消息
 * 注意：payload 必须包含 input 字段（空对象）
 */
export function createFinishTaskMessage(taskId: string): FinishTaskMessage {
  return {
    header: {
      task_id: taskId,
      action: 'finish-task',
      streaming: 'duplex',
    },
    payload: {
      input: {},
    },
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
 * 检查是否是音频事件
 */
export function isAudioEvent(event: ServerResponse): event is ResultGeneratedEvent {
  return event.header.event === 'result-generated';
}

/**
 * 检查是否是完成事件
 */
export function isFinishedEvent(event: ServerResponse): event is TaskFinishedEvent {
  return event.header.event === 'task-finished';
}

/**
 * 检查是否是失败事件
 */
export function isFailedEvent(event: ServerResponse): event is TaskFailedEvent {
  return event.header.event === 'task-failed';
}

/**
 * 等待 task-started 事件
 */
export async function waitForTaskStarted(ws: WebSocket): Promise<void> {
  const msg = await receiveResponse(ws);
  if (msg.header.event !== 'task-started') {
    if (isFailedEvent(msg)) {
      throw new Error(`TTS task failed: ${msg.header.error_code} - ${msg.header.error_message}`);
    }
    throw new Error(`Unexpected event: ${msg.header.event}, expected task-started`);
  }
}

/**
 * 从 base64 解码音频数据
 */
export function decodeAudioData(base64: string): Uint8Array {
  return Buffer.from(base64, 'base64');
}

/**
 * WebSocket 状态管理
 */
interface WebSocketState {
  queue: ServerResponse[];
  callbacks: ((msg: ServerResponse) => void)[];
  audioQueue: Uint8Array[];
}

const wsStates = new Map<WebSocket, WebSocketState>();

function getOrCreateState(ws: WebSocket): WebSocketState {
  let state = wsStates.get(ws);
  if (!state) {
    state = { queue: [], callbacks: [], audioQueue: [] };
    wsStates.set(ws, state);
  }
  return state;
}

/**
 * 检查数据是否是二进制（音频数据）
 */
function isBinaryData(data: WebSocket.Data): boolean {
  if (Buffer.isBuffer(data)) return true;
  if (data instanceof ArrayBuffer) return true;
  if (Array.isArray(data)) return true;
  // 尝试解析为 JSON，如果失败则是二进制数据
  return false;
}

function setupMessageHandler(ws: WebSocket) {
  if (!wsStates.has(ws)) {
    const state = getOrCreateState(ws);

    ws.on('message', (data: WebSocket.Data) => {
      // 检查是否是二进制数据（音频）
      if (isBinaryData(data)) {
        try {
          // 尝试解析为 JSON，如果失败则是二进制音频数据
          const text = Buffer.isBuffer(data)
            ? data.toString('utf8')
            : data instanceof ArrayBuffer
              ? new TextDecoder().decode(data)
              : Array.isArray(data)
                ? Buffer.concat(data).toString('utf8')
                : String(data);

          // 尝试解析 JSON
          try {
            const msg = JSON.parse(text) as ServerResponse;

            if (state.callbacks.length > 0) {
              const callback = state.callbacks.shift();
              if (callback) callback(msg);
            } else {
              state.queue.push(msg);
            }
          } catch {
            // JSON 解析失败，说明是二进制音频数据
            const audioData = Buffer.isBuffer(data)
              ? new Uint8Array(data)
              : data instanceof ArrayBuffer
                ? new Uint8Array(data)
                : Array.isArray(data)
                  ? new Uint8Array(Buffer.concat(data))
                  : new Uint8Array(Buffer.from(String(data)));

            state.audioQueue.push(audioData);
          }
        } catch (error) {
          console.error('Error processing DashScope message:', error);
        }
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
export async function sendMessage(ws: WebSocket, message: DashScopeMessage): Promise<void> {
  const data = JSON.stringify(message);
  return new Promise((resolve, reject) => {
    ws.send(data, (error?: Error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

/**
 * 等待指定事件
 */
export async function waitForEvent(ws: WebSocket, eventType: string): Promise<ServerResponse> {
  while (true) {
    const msg = await receiveResponse(ws);
    if (msg.header.event === eventType) {
      return msg;
    }
    // 如果收到失败事件，抛出错误
    if (isFailedEvent(msg)) {
      throw new Error(`TTS task failed: ${msg.header.error_code} - ${msg.header.error_message}`);
    }
  }
}

/**
 * 接收音频数据
 */
export async function receiveAudioData(ws: WebSocket): Promise<Uint8Array | null> {
  setupMessageHandler(ws);

  return new Promise((resolve, reject) => {
    const state = wsStates.get(ws);
    if (!state) {
      reject(new Error('WebSocket state not found'));
      return;
    }

    // 检查是否有缓存的音频数据
    if (state.audioQueue.length > 0) {
      const audio = state.audioQueue.shift();
      resolve(audio || null);
      return;
    }

    const errorHandler = (error: WebSocket.ErrorEvent) => {
      const index = state.callbacks.indexOf(textResolver);
      if (index !== -1) {
        state.callbacks.splice(index, 1);
      }
      reject(error);
    };

    const textResolver = (msg: ServerResponse) => {
      // 收到文本消息，检查是否是结束事件
      if (isFinishedEvent(msg) || isFailedEvent(msg)) {
        ws.removeListener('error', errorHandler);
        // 将消息放回队列，让 collectAudioData 处理
        state.queue.unshift(msg);
        resolve(null); // 表示没有更多音频数据
      } else {
        // 其他文本消息，继续等待音频
        state.queue.push(msg);
        // 重新注册回调
        state.callbacks.push(textResolver);
      }
    };

    const audioCheckCallback = () => {
      if (state.audioQueue.length > 0) {
        const audio = state.audioQueue.shift();
        ws.removeListener('error', errorHandler);
        resolve(audio || null);
      } else {
        // 继续等待
        setTimeout(audioCheckCallback, 10);
      }
    };

    // 同时监听文本消息和音频数据
    state.callbacks.push(textResolver);
    ws.once('error', errorHandler);
    audioCheckCallback();
  });
}

/**
 * 收集音频数据直到任务完成
 * 音频数据通过二进制消息发送，JSON 消息用于事件通知
 */
export async function collectAudioData(ws: WebSocket): Promise<Uint8Array[]> {
  const audioChunks: Uint8Array[] = [];

  while (true) {
    // 先检查是否有待处理的 JSON 消息
    const state = wsStates.get(ws);
    if (state && state.queue.length > 0) {
      const msg = state.queue.shift();
      if (msg) {
        if (isFinishedEvent(msg)) {
          break;
        } else if (isFailedEvent(msg)) {
          throw new Error(
            `TTS task failed: ${msg.header.error_code} - ${msg.header.error_message}`
          );
        }
        // 其他消息（如 result-generated），继续处理
        continue;
      }
    }

    // 尝试接收音频数据
    const audio = await receiveAudioData(ws);
    if (audio) {
      console.log(`[${Date.now()}] 收到音频块: ${audio.length} bytes`);
      audioChunks.push(audio);
    } else {
      // receiveAudioData 返回 null，表示收到结束事件
      // 再次检查队列中的消息
      const currentState = wsStates.get(ws);
      if (currentState && currentState.queue.length > 0) {
        const msg = currentState.queue.shift();
        if (msg) {
          if (isFinishedEvent(msg)) {
            break;
          } else if (isFailedEvent(msg)) {
            throw new Error(
              `TTS task failed: ${msg.header.error_code} - ${msg.header.error_message}`
            );
          }
        }
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
 * 接收音频数据或事件的返回类型
 * - audio: 收到二进制音频数据
 * - event: 收到服务端事件（result-generated 等）
 * - failed: 收到 task-failed 事件，携带错误详情
 * - null: 收到 task-finished 事件，表示正常结束
 */
export type ReceiveResult =
  | { type: 'audio'; data: Uint8Array }
  | { type: 'event'; event: ServerResponse }
  | { type: 'failed'; event: TaskFailedEvent }
  | null;

/**
 * 接收音频数据或事件
 * 用于流式场景，可以同时处理二进制音频数据和 JSON 事件
 *
 * @returns 返回音频数据或事件，task-finished 返回 null，task-failed 返回错误详情
 */
export async function receiveAudioOrEvent(ws: WebSocket): Promise<ReceiveResult> {
  setupMessageHandler(ws);

  return new Promise((resolve, reject) => {
    const state = wsStates.get(ws);
    if (!state) {
      reject(new Error('WebSocket state not found'));
      return;
    }

    // 先检查是否有缓存的音频数据
    if (state.audioQueue.length > 0) {
      const audio = state.audioQueue.shift();
      resolve({ type: 'audio', data: audio || new Uint8Array() });
      return;
    }

    // 再检查是否有缓存的消息
    if (state.queue.length > 0) {
      const msg = state.queue.shift();
      if (msg) {
        if (isFinishedEvent(msg)) {
          resolve(null);
        } else if (isFailedEvent(msg)) {
          resolve({ type: 'failed', event: msg });
        } else {
          resolve({ type: 'event', event: msg });
        }
        return;
      }
    }

    // 如果都没有，同时等待音频和消息
    let resolved = false;
    let audioTimer: ReturnType<typeof setTimeout> | null = null;

    const cleanup = () => {
      resolved = true;
      if (audioTimer !== null) {
        clearTimeout(audioTimer);
        audioTimer = null;
      }
      ws.removeListener('error', errorHandler);
      // 从 callbacks 中移除 messageResolver，避免泄漏
      const idx = state.callbacks.indexOf(messageResolver);
      if (idx !== -1) {
        state.callbacks.splice(idx, 1);
      }
    };

    const errorHandler = (error: WebSocket.ErrorEvent) => {
      if (resolved) return;
      cleanup();
      reject(error);
    };

    const audioCheckCallback = () => {
      if (resolved) return;
      if (state.audioQueue.length > 0) {
        cleanup();
        const audio = state.audioQueue.shift();
        resolve({ type: 'audio', data: audio || new Uint8Array() });
        return;
      }
      // 继续检查
      audioTimer = setTimeout(audioCheckCallback, 10);
    };

    const messageResolver = (msg: ServerResponse) => {
      if (resolved) return;
      cleanup();
      if (isFinishedEvent(msg)) {
        resolve(null);
      } else if (isFailedEvent(msg)) {
        resolve({ type: 'failed', event: msg });
      } else {
        resolve({ type: 'event', event: msg });
      }
    };

    state.callbacks.push(messageResolver);
    ws.once('error', errorHandler);
    audioCheckCallback();
  });
}
