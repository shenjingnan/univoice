import { Buffer } from 'node:buffer';
import { randomUUID } from 'node:crypto';
import WebSocket from 'ws';

/**
 * DashScope Realtime TTS WebSocket API 协议实现
 * 参考: https://help.aliyun.com/zh/model-studio/developer-reference/tts-realtime-api
 *
 * 与 CosyVoice API 的区别:
 * - 端点: wss://dashscope.aliyuncs.com/api-ws/v1/realtime
 * - 消息格式: 事件类型 + JSON 结构（而非 header/payload）
 * - 支持指令控制（instructions）功能
 */

// ========== 客户端事件类型 ==========

/**
 * session.update 事件 - 更新会话配置
 * 参考: https://help.aliyun.com/zh/model-studio/qwen-tts-realtime
 */
export interface SessionUpdateEvent {
  /** 客户端生成的唯一事件ID */
  event_id: string;
  type: 'session.update';
  session: {
    /** 音色（必填） */
    voice: string;
    /** 交互模式: server_commit (服务端自动判断) | commit (客户端手动触发) */
    mode?: 'server_commit' | 'commit';
    /** 语言类型 */
    language_type?: string;
    /** 音频格式 */
    response_format?: string;
    /** 采样率 */
    sample_rate?: number;
    /** 比特率 (仅 opus 格式可用) */
    bitrate?: number;
    /** 指令文本（用于情感控制，仅部分模型支持） */
    instructions?: string;
    /** 是否启用指令优化 */
    optimize_instructions?: boolean;
    /** 语速倍率 (0.5~2.0) */
    speech_rate?: number;
    /** 音调倍率 (0.5~2.0) */
    pitch_rate?: number;
  };
}

/**
 * input_text_buffer.append 事件 - 追加文本到缓冲区
 */
export interface InputTextBufferAppendEvent {
  /** 客户端生成的唯一事件ID */
  event_id: string;
  type: 'input_text_buffer.append';
  /** 文本内容 */
  text: string;
}

/**
 * input_text_buffer.commit 事件 - 提交文本缓冲区（commit 模式下使用）
 */
export interface InputTextBufferCommitEvent {
  /** 客户端生成的唯一事件ID */
  event_id: string;
  type: 'input_text_buffer.commit';
}

/**
 * input_text_buffer.clear 事件 - 清空文本缓冲区
 */
export interface InputTextBufferClearEvent {
  /** 客户端生成的唯一事件ID */
  event_id: string;
  type: 'input_text_buffer.clear';
}

/**
 * session.finish 事件 - 结束会话
 */
export interface SessionFinishEvent {
  /** 客户端生成的唯一事件ID */
  event_id: string;
  type: 'session.finish';
}

/**
 * 客户端发送的所有事件类型
 */
export type ClientEvent =
  | SessionUpdateEvent
  | InputTextBufferAppendEvent
  | InputTextBufferCommitEvent
  | InputTextBufferClearEvent
  | SessionFinishEvent;

// ========== 服务端事件类型 ==========

/**
 * session.created 事件 - 会话创建成功
 */
export interface SessionCreatedEvent {
  type: 'session.created';
  session: {
    id: string;
    model: string;
  };
}

/**
 * session.updated 事件 - 会话配置更新成功
 */
export interface SessionUpdatedEvent {
  type: 'session.updated';
  session: {
    id: string;
    model: string;
  };
}

/**
 * response.audio.delta 事件 - 音频数据块
 */
export interface ResponseAudioDeltaEvent {
  type: 'response.audio.delta';
  /** 事件 ID */
  event_id: string;
  /** Base64 编码的音频数据 */
  delta: string;
}

/**
 * response.done 事件 - 响应完成
 */
export interface ResponseDoneEvent {
  type: 'response.done';
  event_id: string;
}

/**
 * session.finished 事件 - 会话结束
 */
export interface SessionFinishedEvent {
  type: 'session.finished';
  session: {
    id: string;
  };
  usage?: {
    characters: number;
    duration: number;
  };
}

/**
 * error 事件 - 错误
 */
export interface ErrorEvent {
  type: 'error';
  error: {
    code: string;
    message: string;
  };
}

/**
 * 服务端返回的所有事件类型
 */
export type ServerEvent =
  | SessionCreatedEvent
  | SessionUpdatedEvent
  | ResponseAudioDeltaEvent
  | ResponseDoneEvent
  | SessionFinishedEvent
  | ErrorEvent;

// ========== 事件创建函数 ==========

/**
 * 创建 session.update 事件
 */
export function createSessionUpdateEvent(options: {
  /** 音色（必填） */
  voice: string;
  mode?: 'server_commit' | 'commit';
  languageType?: string;
  format?: string;
  sampleRate?: number;
  bitrate?: number;
  instructions?: string;
  optimizeInstructions?: boolean;
  speechRate?: number;
  pitchRate?: number;
}): SessionUpdateEvent {
  return {
    event_id: `event_${randomUUID()}`,
    type: 'session.update',
    session: {
      voice: options.voice,
      mode: options.mode || 'server_commit',
      language_type: options.languageType || 'Auto',
      response_format: options.format || 'pcm',
      sample_rate: options.sampleRate || 24000,
      bitrate: options.bitrate,
      instructions: options.instructions,
      optimize_instructions: options.optimizeInstructions,
      speech_rate: options.speechRate,
      pitch_rate: options.pitchRate,
    },
  };
}

/**
 * 创建 input_text_buffer.append 事件
 */
export function createInputTextBufferAppendEvent(text: string): InputTextBufferAppendEvent {
  return {
    event_id: `event_${randomUUID()}`,
    type: 'input_text_buffer.append',
    text,
  };
}

/**
 * 创建 input_text_buffer.commit 事件
 */
export function createInputTextBufferCommitEvent(): InputTextBufferCommitEvent {
  return {
    event_id: `event_${randomUUID()}`,
    type: 'input_text_buffer.commit',
  };
}

/**
 * 创建 input_text_buffer.clear 事件
 */
export function createInputTextBufferClearEvent(): InputTextBufferClearEvent {
  return {
    event_id: `event_${randomUUID()}`,
    type: 'input_text_buffer.clear',
  };
}

/**
 * 创建 session.finish 事件
 */
export function createSessionFinishEvent(): SessionFinishEvent {
  return {
    event_id: `event_${randomUUID()}`,
    type: 'session.finish',
  };
}

// ========== WebSocket 辅助函数 ==========

/**
 * 发送事件
 */
export async function sendEvent(ws: WebSocket, event: ClientEvent): Promise<void> {
  const data = JSON.stringify(event);
  return new Promise((resolve, reject) => {
    ws.send(data, (error?: Error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

/**
 * 解析服务端事件
 */
export function parseServerEvent(data: WebSocket.Data): ServerEvent {
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
  return JSON.parse(text) as ServerEvent;
}

/**
 * 从 Base64 解码音频数据
 */
export function decodeAudioData(base64: string): Uint8Array {
  return Buffer.from(base64, 'base64');
}

/**
 * 检查是否是音频事件
 */
export function isAudioEvent(event: ServerEvent): event is ResponseAudioDeltaEvent {
  return event.type === 'response.audio.delta';
}

/**
 * 检查是否是会话结束事件
 */
export function isSessionFinishedEvent(event: ServerEvent): event is SessionFinishedEvent {
  return event.type === 'session.finished';
}

/**
 * 检查是否是错误事件
 */
export function isErrorEvent(event: ServerEvent): event is ErrorEvent {
  return event.type === 'error';
}

/**
 * 检查是否是会话创建事件
 */
export function isSessionCreatedEvent(event: ServerEvent): event is SessionCreatedEvent {
  return event.type === 'session.created';
}

/**
 * 检查是否是会话更新成功事件
 */
export function isSessionUpdatedEvent(event: ServerEvent): event is SessionUpdatedEvent {
  return event.type === 'session.updated';
}

// ========== WebSocket 状态管理 ==========

interface WebSocketState {
  queue: ServerEvent[];
  callbacks: ((event: ServerEvent) => void)[];
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
        const event = parseServerEvent(data);
        if (state.callbacks.length > 0) {
          const callback = state.callbacks.shift();
          if (callback) callback(event);
        } else {
          state.queue.push(event);
        }
      } catch (error) {
        console.error('[DashScope Realtime] 解析消息失败:', error);
      }
    });

    ws.on('close', () => {
      wsStates.delete(ws);
    });
  }
}

/**
 * 接收服务端事件
 */
export async function receiveEvent(ws: WebSocket): Promise<ServerEvent> {
  setupMessageHandler(ws);

  return new Promise((resolve, reject) => {
    const state = wsStates.get(ws);
    if (!state) {
      reject(new Error('WebSocket state not found'));
      return;
    }

    if (state.queue.length > 0) {
      const event = state.queue.shift();
      if (event) {
        resolve(event);
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

    const closeHandler = () => {
      const index = state.callbacks.indexOf(resolver);
      if (index !== -1) {
        state.callbacks.splice(index, 1);
      }
      reject(new Error('WebSocket connection closed'));
    };

    const resolver = (event: ServerEvent) => {
      ws.removeListener('error', errorHandler);
      ws.removeListener('close', closeHandler);
      resolve(event);
    };

    state.callbacks.push(resolver);
    ws.once('error', errorHandler);
    ws.once('close', closeHandler);
  });
}

/**
 * 等待特定类型的事件
 */
export async function waitForEvent(
  ws: WebSocket,
  eventType: ServerEvent['type']
): Promise<ServerEvent> {
  while (true) {
    const event = await receiveEvent(ws);
    if (event.type === eventType) {
      return event;
    }
    if (isErrorEvent(event)) {
      throw new Error(`TTS error: ${event.error.code} - ${event.error.message}`);
    }
    // 其他事件继续等待
  }
}

/**
 * 接收音频数据或结束事件
 * 用于流式场景
 *
 * @returns 返回音频数据，如果收到结束事件则返回 null
 */
export async function receiveAudioOrEnd(
  ws: WebSocket
): Promise<{ type: 'audio'; data: Uint8Array } | null> {
  const event = await receiveEvent(ws);

  if (isAudioEvent(event)) {
    return {
      type: 'audio',
      data: decodeAudioData(event.delta),
    };
  }

  if (isSessionFinishedEvent(event) || isErrorEvent(event)) {
    return null;
  }

  // 其他事件类型，继续等待
  return receiveAudioOrEnd(ws);
}
