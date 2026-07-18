//! Qwen Realtime TTS Provider
//!
//! 基于阿里云 DashScope Realtime WebSocket API 实现语音合成。
//!
//! 与 QwenTTS (CosyVoice) 的区别:
//! - 端点: `wss://dashscope.aliyuncs.com/api-ws/v1/realtime?model=xxx`
//! - 消息格式: 事件类型 + JSON 结构
//! - 音频数据通过 Base64 编码在 JSON 事件中传输
//! - 支持 instructions 指令控制功能
//!
//! 支持的模型:
//! - `qwen3-tts-instruct-flash-realtime` (支持 instructions 情感控制)
//! - `qwen3-tts-flash-realtime`
//!
//! 交互流程:
//! 1. 连接 WebSocket (URL 带 model 参数)
//! 2. 等待 session.created
//! 3. 发送 session.update 配置会话
//! 4. 等待 session.updated
//! 5. 发送 input_text_buffer.append (流式可多次)
//! 6. 发送 session.finish
//! 7. 收集 response.audio.delta (base64) 直到 session.finished

use async_trait::async_trait;
use futures_util::{SinkExt, StreamExt};
use tokio::net::TcpStream;
use tokio_tungstenite::tungstenite::Message;
use tokio_tungstenite::{MaybeTlsStream, WebSocketStream};

use base64::Engine;

use crate::asr::traits::ConnectionState;
use crate::tts::error::TtsError;
use crate::tts::protocol::dashscope_realtime::{
    self, RealtimeMode, ServerEvent, SessionUpdateParams, connect_ws,
    create_input_text_buffer_append, create_session_finish, initialize_session, receive_event,
};
use crate::tts::traits::{TtsConnection, TtsProvider};
use crate::tts::types::{
    BaseTtsOption, TextStream, TtsAudioStream, TtsConnectOption, TtsRequest, TtsResponse,
    TtsStreamChunk, TtsVoice,
};
use crate::tts::voice_id::VoiceId;
use crate::tts::voices;

// ============================== 常量 ==============================

/// Qwen Realtime TTS 默认 WebSocket 地址
pub const QWEN_REALTIME_DEFAULT_BASE_URL: &str = "wss://dashscope.aliyuncs.com/api-ws/v1/realtime";

/// Qwen Realtime TTS 默认模型
pub const QWEN_REALTIME_DEFAULT_MODEL: &str = "qwen3-tts-instruct-flash-realtime";

/// Qwen Realtime TTS 默认音色
pub const QWEN_REALTIME_DEFAULT_VOICE: &str = "Cherry";

/// Qwen Realtime TTS 默认音频格式
pub const QWEN_REALTIME_DEFAULT_FORMAT: &str = "pcm";

/// Qwen Realtime TTS 默认采样率
pub const QWEN_REALTIME_DEFAULT_SAMPLE_RATE: u32 = 24000;

// ============================== QwenRealtimeTtsOption ==============================

/// Qwen Realtime TTS 专属配置
#[derive(Debug, Clone, Default)]
pub struct QwenRealtimeTtsOption {
    pub base: BaseTtsOption,
    /// 采样率
    pub sample_rate: Option<u32>,
    /// 情感控制指令（仅 instruct 模型支持）
    pub instruction: Option<String>,
    /// 是否启用指令优化
    pub optimize_instructions: Option<bool>,
    /// 语速倍率 (0.5~2.0)
    pub speech_rate: Option<f32>,
    /// 音调倍率 (0.5~2.0)
    pub pitch_rate: Option<f32>,
    /// 交互模式
    pub mode: Option<RealtimeMode>,
    /// 语言类型
    pub language_type: Option<String>,
}

// ============================== 内部辅助结构 ==============================

/// Qwen Realtime TTS 运行时配置
#[derive(Debug, Clone)]
struct QwenRealtimeConfig {
    #[allow(dead_code)]
    model: String,
    voice: VoiceId,
    format: String,
    sample_rate: u32,
    instruction: Option<String>,
    optimize_instructions: bool,
    speech_rate: Option<f32>,
    pitch_rate: Option<f32>,
    mode: RealtimeMode,
    language_type: Option<String>,
}

// ============================== QwenRealtimeTts ==============================

/// Qwen Realtime TTS Provider
pub struct QwenRealtimeTts {
    api_key: String,
    base_url: String,
    model: String,
    voice: VoiceId,
    format: String,
    sample_rate: u32,
    instruction: Option<String>,
    optimize_instructions: bool,
    speech_rate: Option<f32>,
    pitch_rate: Option<f32>,
    mode: RealtimeMode,
    language_type: Option<String>,
}

impl QwenRealtimeTts {
    pub fn new(options: QwenRealtimeTtsOption) -> Self {
        let base = &options.base;
        Self {
            api_key: base.api_key.clone().unwrap_or_default(),
            base_url: base
                .base_url
                .clone()
                .unwrap_or_else(|| QWEN_REALTIME_DEFAULT_BASE_URL.into()),
            model: base
                .model
                .clone()
                .unwrap_or_else(|| QWEN_REALTIME_DEFAULT_MODEL.into()),
            voice: base
                .voice
                .clone()
                .unwrap_or_else(|| VoiceId::from(QWEN_REALTIME_DEFAULT_VOICE)),
            format: base
                .format
                .clone()
                .unwrap_or_else(|| QWEN_REALTIME_DEFAULT_FORMAT.into()),
            sample_rate: options
                .sample_rate
                .unwrap_or(QWEN_REALTIME_DEFAULT_SAMPLE_RATE),
            instruction: options.instruction,
            optimize_instructions: options.optimize_instructions.unwrap_or(false),
            speech_rate: options.speech_rate,
            pitch_rate: options.pitch_rate,
            mode: options.mode.unwrap_or_default(),
            language_type: options.language_type,
        }
    }

    fn config(&self) -> QwenRealtimeConfig {
        QwenRealtimeConfig {
            model: self.model.clone(),
            voice: self.voice.clone(),
            format: self.format.clone(),
            sample_rate: self.sample_rate,
            instruction: self.instruction.clone(),
            optimize_instructions: self.optimize_instructions,
            speech_rate: self.speech_rate,
            pitch_rate: self.pitch_rate,
            mode: self.mode,
            language_type: self.language_type.clone(),
        }
    }

    fn build_session_params(&self) -> SessionUpdateParams {
        SessionUpdateParams {
            voice: self.voice.as_str().to_string(),
            mode: self.mode,
            language_type: self.language_type.clone(),
            format: self.format.clone(),
            sample_rate: self.sample_rate,
            bitrate: None,
            instructions: self.instruction.clone(),
            optimize_instructions: self.optimize_instructions,
            speech_rate: self.speech_rate,
            pitch_rate: self.pitch_rate,
        }
    }

    /// 验证必要参数
    fn ensure_valid(&self) -> Result<(), TtsError> {
        if self.api_key.is_empty() {
            return Err(TtsError::InvalidParameter(
                "apiKey is required for Qwen Realtime TTS".into(),
            ));
        }
        Ok(())
    }

    /// 建立 WebSocket 连接（带认证和模型参数）
    async fn connect_ws(&self) -> Result<WebSocketStream<MaybeTlsStream<TcpStream>>, TtsError> {
        let ws = connect_ws(&self.base_url, &self.model, &self.api_key).await?;
        Ok(ws)
    }
}

// ============================== TtsProvider 实现 ==============================

#[async_trait]
#[allow(clippy::result_large_err)]
impl TtsProvider for QwenRealtimeTts {
    fn name(&self) -> &'static str {
        "qwen-realtime"
    }

    async fn synthesize(&self, request: TtsRequest) -> Result<TtsResponse, TtsError> {
        self.ensure_valid()?;
        let mut ws = self.connect_ws().await?;
        let text = request.text;
        let config = self.config();
        let params = self.build_session_params();

        let result = run_realtime_synthesize(&mut ws, &text, &params, &config).await?;
        // ws 在 session.finished 后自动关闭或由服务端关闭
        let _ = ws.close(None).await;
        Ok(result)
    }

    async fn speak_stream(&self, input: TextStream) -> Result<TtsAudioStream, TtsError> {
        self.ensure_valid()?;
        let ws = self.connect_ws().await?;
        let config = self.config();
        let params = self.build_session_params();

        let stream = run_realtime_stream(ws, input, &params, &config).await?;
        Ok(stream)
    }

    async fn connect(
        &self,
        _options: TtsConnectOption,
    ) -> Result<Box<dyn TtsConnection>, TtsError> {
        self.ensure_valid()?;

        let mut ws = self.connect_ws().await?;
        let config = self.config();
        let params = self.build_session_params();

        // connect() 自动完成 session 初始化
        initialize_session(&mut ws, &params).await?;

        Ok(Box::new(QwenRealtimeTtsConnection {
            ws: Some(ws),
            state: ConnectionState::Connected,
            config,
        }))
    }

    async fn list_voices(&self) -> Result<Vec<TtsVoice>, TtsError> {
        Ok(voices::qwen_realtime::list_voices())
    }
}

// ============================== 非流式合成 ==============================

/// 在 WebSocket 上执行非流式 Realtime 合成
///
/// 流程:
/// 1. session 初始化 (session.created → session.update → session.updated)
/// 2. 发送 append (含完整文本)
/// 3. 发送 session.finish
/// 4. 收集所有 audio delta 直到 session.finished
async fn run_realtime_synthesize(
    ws: &mut WebSocketStream<MaybeTlsStream<TcpStream>>,
    text: &str,
    params: &SessionUpdateParams,
    _config: &QwenRealtimeConfig,
) -> Result<TtsResponse, TtsError> {
    // 1. session 初始化
    initialize_session(ws, params).await?;

    // 2. 发送 append
    let append_msg = create_input_text_buffer_append(text);
    ws.send(Message::Text(append_msg)).await?;

    // 3. 发送 session.finish
    let finish_msg = create_session_finish();
    ws.send(Message::Text(finish_msg)).await?;

    // 4. 收集音频
    let audio_chunks = collect_audio_deltas(ws).await?;

    if audio_chunks.is_empty() {
        return Err(TtsError::NoAudio);
    }

    let total_len: usize = audio_chunks.iter().map(|c| c.len()).sum();
    let mut audio = Vec::with_capacity(total_len);
    for chunk in audio_chunks {
        audio.extend_from_slice(&chunk);
    }

    Ok(TtsResponse {
        audio,
        format: _config.format.clone(),
        duration: None,
    })
}

// ============================== 流式合成 ==============================

/// 在 WebSocket 上执行流式 Realtime 合成
///
/// 使用 ws.split() 实现双向并发:
/// - send 任务: TextStream → append → session.finish
/// - recv 任务: audio delta (base64 decode) → tx channel
async fn run_realtime_stream(
    ws: WebSocketStream<MaybeTlsStream<TcpStream>>,
    mut input: TextStream,
    params: &SessionUpdateParams,
    _config: &QwenRealtimeConfig,
) -> Result<TtsAudioStream, TtsError> {
    let (mut write, mut read) = ws.split();
    let (tx, mut rx) = tokio::sync::mpsc::channel::<Vec<u8>>(64);

    // session 初始化：发送 session.update，等待 session.updated
    let update_msg = dashscope_realtime::create_session_update(params);
    write.send(Message::Text(update_msg)).await?;

    // 3. 等待 session.updated（通过 read half）
    let session_ok = loop {
        match read.next().await {
            Some(Ok(Message::Text(data))) => {
                let event = dashscope_realtime::parse_server_event(&data)?;
                match event {
                    ServerEvent::SessionUpdated { .. } => break true,
                    ServerEvent::Error { code, message } => {
                        return Err(TtsError::ServiceError { code, message });
                    }
                    _ => {} // 忽略中间事件
                }
            }
            Some(Ok(Message::Close(_))) | None => {
                return Err(TtsError::Other(
                    "Connection closed during session init".into(),
                ));
            }
            Some(Err(e)) => return Err(TtsError::Websocket(e)),
            _ => {}
        }
    };

    if !session_ok {
        return Err(TtsError::Other("Session initialization failed".into()));
    }

    let recv_tx = tx.clone();

    // 发送任务: TextStream → append → session.finish
    let send_handle: tokio::task::JoinHandle<Result<(), TtsError>> = tokio::spawn(async move {
        let mut text_sent = false;
        while let Some(chunk) = input.next().await {
            if !chunk.is_empty() {
                let msg = create_input_text_buffer_append(&chunk);
                write.send(Message::Text(msg)).await?;
                text_sent = true;
            }
        }
        if !text_sent {
            let msg = create_input_text_buffer_append("");
            write.send(Message::Text(msg)).await?;
        }
        let finish_msg = create_session_finish();
        write.send(Message::Text(finish_msg)).await?;
        Ok(())
    });

    // 5. 接收任务: audio delta → tx channel
    let recv_handle: tokio::task::JoinHandle<Result<(), TtsError>> = tokio::spawn(async move {
        while let Some(msg) = read.next().await {
            match msg? {
                Message::Text(data) => {
                    let event = dashscope_realtime::parse_server_event(&data)?;
                    match event {
                        ServerEvent::AudioDelta { delta } => {
                            let audio = base64::engine::general_purpose::STANDARD
                                .decode(&delta)
                                .map_err(|e| {
                                    TtsError::Other(format!("Base64 decode error: {}", e))
                                })?;
                            if recv_tx.send(audio).await.is_err() {
                                return Ok(());
                            }
                        }
                        ServerEvent::SessionFinished { .. } => return Ok(()),
                        ServerEvent::Error { code, message } => {
                            return Err(TtsError::ServiceError { code, message });
                        }
                        _ => {} // 忽略其他事件
                    }
                }
                Message::Close(_) => return Ok(()),
                Message::Ping(_) | Message::Pong(_) | Message::Frame(_) | Message::Binary(_) => {} // Binary 不用于 Realtime 协议
            }
        }
        Ok(())
    });

    // 构造输出流
    let stream = async_stream::stream! {
        while let Some(audio) = rx.recv().await {
            yield Ok(TtsStreamChunk { audio_chunk: audio });
        }

        if let Ok(Err(e)) = send_handle.await {
            yield Err(e);
        }
        if let Ok(Err(e)) = recv_handle.await {
            yield Err(e);
        }
    };

    Ok(Box::pin(stream))
}

// ============================== 辅助函数 ==============================

/// 收集音频数据（非 split 模式）
///
/// 从事件循环中提取所有 response.audio.delta 的 base64 数据，
/// 解码后返回，直到遇到 session.finished 或 error。
async fn collect_audio_deltas(
    ws: &mut WebSocketStream<MaybeTlsStream<TcpStream>>,
) -> Result<Vec<Vec<u8>>, TtsError> {
    let mut audio_chunks: Vec<Vec<u8>> = Vec::new();

    loop {
        let event = receive_event(ws).await?;
        match event {
            ServerEvent::AudioDelta { delta } => {
                let audio = base64::engine::general_purpose::STANDARD
                    .decode(&delta)
                    .map_err(|e| TtsError::Other(format!("Base64 decode error: {}", e)))?;
                if !audio.is_empty() {
                    audio_chunks.push(audio);
                }
            }
            ServerEvent::SessionFinished { .. } => break,
            ServerEvent::Error { code, message } => {
                return Err(TtsError::ServiceError { code, message });
            }
            _ => {} // 忽略其他中间事件
        }
    }

    Ok(audio_chunks)
}

// ============================== QwenRealtimeTtsConnection ==============================

/// Qwen Realtime TTS 连接实例
///
/// 通过 QwenRealtimeTts::connect() 获取，已完成 session 初始化，
/// 可直接发送文本进行合成。
pub struct QwenRealtimeTtsConnection {
    ws: Option<WebSocketStream<MaybeTlsStream<TcpStream>>>,
    state: ConnectionState,
    config: QwenRealtimeConfig,
}

impl QwenRealtimeTtsConnection {
    fn build_session_params(&self) -> SessionUpdateParams {
        SessionUpdateParams {
            voice: self.config.voice.as_str().to_string(),
            mode: self.config.mode,
            language_type: self.config.language_type.clone(),
            format: self.config.format.clone(),
            sample_rate: self.config.sample_rate,
            bitrate: None,
            instructions: self.config.instruction.clone(),
            optimize_instructions: self.config.optimize_instructions,
            speech_rate: self.config.speech_rate,
            pitch_rate: self.config.pitch_rate,
        }
    }
}

#[cfg(test)]
impl QwenRealtimeTtsConnection {
    pub(crate) fn new_for_test(state: ConnectionState) -> Self {
        Self {
            ws: None,
            state,
            config: QwenRealtimeConfig {
                model: String::new(),
                voice: VoiceId::new(""),
                format: String::new(),
                sample_rate: 24000,
                instruction: None,
                optimize_instructions: false,
                speech_rate: None,
                pitch_rate: None,
                mode: RealtimeMode::ServerCommit,
                language_type: None,
            },
        }
    }
}

#[async_trait]
#[allow(clippy::result_large_err)]
impl TtsConnection for QwenRealtimeTtsConnection {
    fn state(&self) -> ConnectionState {
        self.state
    }

    /// 在已初始化的 session 上执行非流式合成
    ///
    /// 发送 append + session.finish，收集音频，不关闭连接。
    async fn synthesize(&mut self, text: String) -> Result<TtsResponse, TtsError> {
        if self.state != ConnectionState::Connected {
            return Err(TtsError::ConnectionClosed);
        }

        let ws = self.ws.as_mut().ok_or(TtsError::ConnectionClosed)?;

        // 发送 append
        let append_msg = create_input_text_buffer_append(&text);
        ws.send(Message::Text(append_msg)).await?;

        // 发送 session.finish
        let finish_msg = create_session_finish();
        ws.send(Message::Text(finish_msg)).await?;

        // 收集音频
        let audio_chunks = collect_audio_deltas(ws).await?;

        if audio_chunks.is_empty() {
            return Err(TtsError::NoAudio);
        }

        let total_len: usize = audio_chunks.iter().map(|c| c.len()).sum();
        let mut audio = Vec::with_capacity(total_len);
        for chunk in audio_chunks {
            audio.extend_from_slice(&chunk);
        }

        Ok(TtsResponse {
            audio,
            format: self.config.format.clone(),
            duration: None,
        })
    }

    /// 在已初始化的 session 上执行流式合成
    ///
    /// 消耗 WebSocket（需要 split），调用后连接状态变为 Closed。
    async fn speak_stream(&mut self, input: TextStream) -> Result<TtsAudioStream, TtsError> {
        if self.state != ConnectionState::Connected {
            return Err(TtsError::ConnectionClosed);
        }

        let ws = self.ws.take().ok_or(TtsError::ConnectionClosed)?;
        self.state = ConnectionState::Closed;

        let params = self.build_session_params();
        let stream = run_realtime_stream(ws, input, &params, &self.config).await?;
        Ok(stream)
    }

    async fn close(&mut self) -> Result<(), TtsError> {
        if let Some(ws) = self.ws.as_mut() {
            ws.close(None).await?;
        }
        self.ws = None;
        self.state = ConnectionState::Closed;
        Ok(())
    }
}

// ============================== 测试 ==============================

#[cfg(test)]
mod tests {
    use super::*;

    // -------- 2.1 构造/配置 --------

    #[test]
    fn test_c1_defaults() {
        let provider = QwenRealtimeTts::new(QwenRealtimeTtsOption {
            base: BaseTtsOption {
                api_key: Some("test-key".into()),
                ..Default::default()
            },
            ..Default::default()
        });
        assert_eq!(provider.name(), "qwen-realtime");
        assert_eq!(provider.base_url, QWEN_REALTIME_DEFAULT_BASE_URL);
        assert_eq!(provider.model, QWEN_REALTIME_DEFAULT_MODEL);
        assert_eq!(provider.voice, QWEN_REALTIME_DEFAULT_VOICE);
        assert_eq!(provider.format, QWEN_REALTIME_DEFAULT_FORMAT);
        assert_eq!(provider.sample_rate, QWEN_REALTIME_DEFAULT_SAMPLE_RATE);
        assert_eq!(provider.mode, RealtimeMode::ServerCommit);
    }

    #[test]
    fn test_c2_custom_options() {
        let provider = QwenRealtimeTts::new(QwenRealtimeTtsOption {
            base: BaseTtsOption {
                api_key: Some("custom-key".into()),
                base_url: Some("wss://custom-host/".into()),
                model: Some("qwen3-tts-flash-realtime".into()),
                voice: Some("Ethan".into()),
                format: Some("mp3".into()),
                language: Some("en-US".into()),
                ..Default::default()
            },
            sample_rate: Some(48000),
            instruction: Some("speak softly".into()),
            optimize_instructions: Some(true),
            speech_rate: Some(1.5),
            pitch_rate: Some(1.2),
            mode: Some(RealtimeMode::Commit),
            language_type: Some("English".into()),
        });
        assert_eq!(provider.api_key, "custom-key");
        assert_eq!(provider.base_url, "wss://custom-host/");
        assert_eq!(provider.model, "qwen3-tts-flash-realtime");
        assert_eq!(provider.voice, "Ethan");
        assert_eq!(provider.format, "mp3");
        assert_eq!(provider.sample_rate, 48000);
        assert_eq!(provider.instruction, Some("speak softly".into()));
        assert_eq!(provider.optimize_instructions, true);
        assert_eq!(provider.speech_rate, Some(1.5));
        assert_eq!(provider.pitch_rate, Some(1.2));
        assert_eq!(provider.mode, RealtimeMode::Commit);
        assert_eq!(provider.language_type, Some("English".into()));
    }

    #[test]
    fn test_c3_api_key_from_base() {
        let provider = QwenRealtimeTts::new(QwenRealtimeTtsOption {
            base: BaseTtsOption {
                api_key: Some("the-key".into()),
                ..Default::default()
            },
            ..Default::default()
        });
        assert_eq!(provider.api_key, "the-key");

        let provider = QwenRealtimeTts::new(QwenRealtimeTtsOption {
            base: BaseTtsOption {
                api_key: None,
                ..Default::default()
            },
            ..Default::default()
        });
        assert_eq!(provider.api_key, "");
    }

    #[test]
    fn test_c4_model_from_base() {
        let provider = QwenRealtimeTts::new(QwenRealtimeTtsOption {
            base: BaseTtsOption {
                api_key: Some("k".into()),
                model: Some("custom-model".into()),
                ..Default::default()
            },
            ..Default::default()
        });
        assert_eq!(provider.model, "custom-model");

        let provider = QwenRealtimeTts::new(QwenRealtimeTtsOption {
            base: BaseTtsOption {
                api_key: Some("k".into()),
                model: None,
                ..Default::default()
            },
            ..Default::default()
        });
        assert_eq!(provider.model, QWEN_REALTIME_DEFAULT_MODEL);
    }

    #[test]
    fn test_c5_voice_default() {
        let provider = QwenRealtimeTts::new(QwenRealtimeTtsOption {
            base: BaseTtsOption {
                api_key: Some("k".into()),
                voice: None,
                ..Default::default()
            },
            ..Default::default()
        });
        assert_eq!(provider.voice, QWEN_REALTIME_DEFAULT_VOICE);
    }

    #[test]
    fn test_c6_format_default() {
        let provider = QwenRealtimeTts::new(QwenRealtimeTtsOption {
            base: BaseTtsOption {
                api_key: Some("k".into()),
                format: None,
                ..Default::default()
            },
            ..Default::default()
        });
        assert_eq!(provider.format, QWEN_REALTIME_DEFAULT_FORMAT);
    }

    #[test]
    fn test_c7_sample_rate_default() {
        let provider = QwenRealtimeTts::new(QwenRealtimeTtsOption {
            base: BaseTtsOption {
                api_key: Some("k".into()),
                ..Default::default()
            },
            sample_rate: None,
            ..Default::default()
        });
        assert_eq!(provider.sample_rate, QWEN_REALTIME_DEFAULT_SAMPLE_RATE);
    }

    #[test]
    fn test_c8_sample_rate_custom() {
        let provider = QwenRealtimeTts::new(QwenRealtimeTtsOption {
            base: BaseTtsOption {
                api_key: Some("k".into()),
                ..Default::default()
            },
            sample_rate: Some(16000),
            ..Default::default()
        });
        assert_eq!(provider.sample_rate, 16000);
    }

    // -------- 2.2 参数验证 --------

    #[test]
    fn test_v1_empty_api_key() {
        let provider = QwenRealtimeTts::new(QwenRealtimeTtsOption {
            base: BaseTtsOption {
                api_key: Some("".into()),
                ..Default::default()
            },
            ..Default::default()
        });
        assert!(matches!(
            provider.ensure_valid(),
            Err(TtsError::InvalidParameter(_))
        ));
    }

    #[test]
    fn test_v2_valid_api_key() {
        let provider = QwenRealtimeTts::new(QwenRealtimeTtsOption {
            base: BaseTtsOption {
                api_key: Some("valid-key".into()),
                ..Default::default()
            },
            ..Default::default()
        });
        assert!(provider.ensure_valid().is_ok());
    }

    #[test]
    fn test_v3_synthesize_empty_key() {
        let provider = QwenRealtimeTts::new(QwenRealtimeTtsOption {
            base: BaseTtsOption {
                api_key: Some("".into()),
                ..Default::default()
            },
            ..Default::default()
        });
        let request = TtsRequest {
            text: "hello".into(),
            options: None,
        };
        let rt = tokio::runtime::Runtime::new().unwrap();
        let result = rt.block_on(provider.synthesize(request));
        assert!(matches!(result, Err(TtsError::InvalidParameter(_))));
    }

    // -------- 2.3 Build Session Params --------

    #[test]
    fn test_p1_build_session_params_default() {
        let provider = QwenRealtimeTts::new(QwenRealtimeTtsOption {
            base: BaseTtsOption {
                api_key: Some("k".into()),
                ..Default::default()
            },
            ..Default::default()
        });
        let params = provider.build_session_params();
        assert_eq!(params.voice, QWEN_REALTIME_DEFAULT_VOICE);
        assert_eq!(params.mode, RealtimeMode::ServerCommit);
        assert_eq!(params.format, QWEN_REALTIME_DEFAULT_FORMAT);
        assert_eq!(params.sample_rate, QWEN_REALTIME_DEFAULT_SAMPLE_RATE);
    }

    #[test]
    fn test_p2_build_session_params_custom() {
        let provider = QwenRealtimeTts::new(QwenRealtimeTtsOption {
            base: BaseTtsOption {
                api_key: Some("k".into()),
                voice: Some("Ethan".into()),
                ..Default::default()
            },
            mode: Some(RealtimeMode::Commit),
            language_type: Some("English".into()),
            instruction: Some("speak slowly".into()),
            ..Default::default()
        });
        let params = provider.build_session_params();
        assert_eq!(params.voice, "Ethan");
        assert_eq!(params.mode, RealtimeMode::Commit);
        assert_eq!(params.language_type, Some("English".into()));
        assert_eq!(params.instructions, Some("speak slowly".into()));
    }

    // -------- 2.4 Connection 状态机 --------

    #[test]
    fn test_s1_connection_state_initial() {
        let conn = QwenRealtimeTtsConnection::new_for_test(ConnectionState::Connected);
        assert_eq!(conn.state(), ConnectionState::Connected);
    }

    #[tokio::test]
    async fn test_s2_close_transition() {
        let mut conn = QwenRealtimeTtsConnection::new_for_test(ConnectionState::Connected);
        conn.close().await.unwrap();
        assert_eq!(conn.state(), ConnectionState::Closed);
    }

    #[tokio::test]
    async fn test_s3_close_idempotent() {
        let mut conn = QwenRealtimeTtsConnection::new_for_test(ConnectionState::Connected);
        conn.close().await.unwrap();
        conn.close().await.unwrap();
        assert_eq!(conn.state(), ConnectionState::Closed);
    }

    #[tokio::test]
    async fn test_s4_synthesize_after_close() {
        let mut conn = QwenRealtimeTtsConnection::new_for_test(ConnectionState::Connected);
        conn.close().await.unwrap();
        let result = conn.synthesize("text".into()).await;
        assert!(matches!(result, Err(TtsError::ConnectionClosed)));
    }

    #[tokio::test]
    async fn test_s5_speak_stream_after_close() {
        let mut conn = QwenRealtimeTtsConnection::new_for_test(ConnectionState::Connected);
        conn.close().await.unwrap();
        let input: TextStream = Box::pin(futures_util::stream::empty());
        let result = conn.speak_stream(input).await;
        assert!(matches!(result, Err(TtsError::ConnectionClosed)));
    }

    #[tokio::test]
    async fn test_s6_synthesize_with_ws_none() {
        let mut conn = QwenRealtimeTtsConnection::new_for_test(ConnectionState::Connected);
        let result = conn.synthesize("text".into()).await;
        assert!(matches!(result, Err(TtsError::ConnectionClosed)));
    }

    // -------- 2.5 Config 构造 --------

    #[test]
    fn test_m1_config_default() {
        let provider = QwenRealtimeTts::new(QwenRealtimeTtsOption {
            base: BaseTtsOption {
                api_key: Some("k".into()),
                ..Default::default()
            },
            ..Default::default()
        });
        let config = provider.config();
        assert_eq!(config.model, QWEN_REALTIME_DEFAULT_MODEL);
        assert_eq!(config.voice, QWEN_REALTIME_DEFAULT_VOICE);
        assert_eq!(config.sample_rate, QWEN_REALTIME_DEFAULT_SAMPLE_RATE);
        assert!(config.instruction.is_none());
        assert!(!config.optimize_instructions);
    }

    #[test]
    fn test_m2_config_custom() {
        let provider = QwenRealtimeTts::new(QwenRealtimeTtsOption {
            base: BaseTtsOption {
                api_key: Some("k".into()),
                model: Some("custom-m".into()),
                ..Default::default()
            },
            instruction: Some("custom instruction".into()),
            optimize_instructions: Some(true),
            ..Default::default()
        });
        let config = provider.config();
        assert_eq!(config.model, "custom-m");
        assert_eq!(config.instruction, Some("custom instruction".into()));
        assert!(config.optimize_instructions);
    }
}
