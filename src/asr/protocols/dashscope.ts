import { Buffer } from 'node:buffer';
import WebSocket from 'ws';

/**
 * DashScope Paraformer ASR WebSocket API 协议实现
 * 参考文档: https://help.aliyun.com/zh/model-studio/websocket-for-paraformer-real-time-service
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
export type ASRMessage = RunTaskMessage | FinishTaskMessage;

/**
 * run-task 消息 - 启动 ASR 任务
 */
export interface RunTaskMessage {
  header: {
    task_id: string;
    action: 'run-task';
    streaming: 'duplex';
  };
  payload: {
    task_group: 'audio';
    task: 'asr';
    function: 'recognition';
    model: string;
    parameters: {
      format: string;
      sample_rate?: number;
      language_hints?: string[];
      enable_words?: boolean;
      enable_punctuation_prediction?: boolean;
      enable_inverse_text_normalization?: boolean;
      punctuation_map?: Record<string, string>;
    };
    input: Record<string, never>;
  };
}

/**
 * finish-task 消息 - 结束任务
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
export type ASREvent =
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
 * result-generated 事件 - 包含识别结果
 */
export interface ResultGeneratedEvent {
  header: {
    task_id: string;
    event: 'result-generated';
    task_status: TaskStatus;
  };
  payload: {
    output: {
      sentence: {
        text: string;
        start_time?: number;
        end_time?: number;
        confidence?: number;
        /** 句子是否结束 */
        sentence_end?: boolean;
        words?: Array<{
          text: string;
          start_time: number;
          end_time: number;
          confidence?: number;
        }>;
      };
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
    output: {
      sentence?: {
        text: string;
        start_time?: number;
        end_time?: number;
        confidence?: number;
      };
    };
    usage?: {
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
export type ServerResponse = ASREvent;

/**
 * 创建 run-task 消息
 */
export function createRunTaskMessage(
  taskId: string,
  options: {
    model: string;
    format: string;
    sampleRate?: number;
    languageHints?: string[];
    enableWords?: boolean;
    enablePunctuationPrediction?: boolean;
    enableInverseTextNormalization?: boolean;
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
      task: 'asr',
      function: 'recognition',
      model: options.model,
      parameters: {
        format: options.format,
        ...(options.sampleRate ? { sample_rate: options.sampleRate } : {}),
        ...(options.languageHints ? { language_hints: options.languageHints } : {}),
        ...(options.enableWords !== undefined ? { enable_words: options.enableWords } : {}),
        ...(options.enablePunctuationPrediction !== undefined
          ? { enable_punctuation_prediction: options.enablePunctuationPrediction }
          : {}),
        ...(options.enableInverseTextNormalization !== undefined
          ? { enable_inverse_text_normalization: options.enableInverseTextNormalization }
          : {}),
      },
      input: {},
    },
  };
}

/**
 * 创建 finish-task 消息
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
 * 检查是否是结果生成事件
 */
export function isResultGeneratedEvent(event: ServerResponse): event is ResultGeneratedEvent {
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
      throw new Error(`ASR task failed: ${msg.header.error_code} - ${msg.header.error_message}`);
    }
    throw new Error(`Unexpected event: ${msg.header.event}, expected task-started`);
  }
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
        console.error('Error parsing ASR message:', error);
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
export async function sendMessage(ws: WebSocket, message: ASRMessage): Promise<void> {
  const data = JSON.stringify(message);
  return new Promise((resolve, reject) => {
    ws.send(data, (error?: Error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

/**
 * 发送二进制音频数据
 */
export async function sendBinaryData(ws: WebSocket, data: Buffer | Uint8Array): Promise<void> {
  return new Promise((resolve, reject) => {
    ws.send(data, (error?: Error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}
