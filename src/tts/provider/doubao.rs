//! Doubao (火山引擎) TTS Provider
//!
//! 基于火山引擎双向 WebSocket 二进制协议实现语音合成。
//! 对应 TypeScript 端的 `src/tts/providers/doubao.ts`。

use async_trait::async_trait;
use futures_util::{SinkExt, StreamExt};
use std::time::Duration;
use tokio::net::TcpStream;
use tokio_tungstenite::tungstenite::{self, Message};
use tokio_tungstenite::{MaybeTlsStream, WebSocketStream, connect_async};

use crate::asr::traits::ConnectionState;
use crate::tts::error::TtsError;
use crate::tts::protocol::volcengine::{self, EventType, MsgType, VolcMessage};
use crate::tts::traits::{TtsConnection, TtsProvider};
use crate::tts::types::{
    BaseTtsOption, TextStream, TtsAudioStream, TtsConnectOption, TtsRequest, TtsResponse,
    TtsStreamChunk, TtsVoice,
};
use crate::tts::voice_id::VoiceId;
use crate::tts::voices;

// ============================================================================
// 常量
// ============================================================================

/// 火山引擎 TTS 默认 WebSocket 地址
const DOUBAO_DEFAULT_BASE_URL: &str = "wss://openspeech.bytedance.com/api/v3/tts/bidirection";
/// 默认 Resource ID
const DOUBAO_DEFAULT_RESOURCE_ID: &str = "seed-tts-2.0";
/// 默认音色
const DOUBAO_DEFAULT_VOICE: &str = "zh_female_tianmeixiaoyuan_moon_bigtts";
/// 默认音频格式
const DOUBAO_DEFAULT_FORMAT: &str = "mp3";
/// 默认采样率
const DOUBAO_DEFAULT_SAMPLE_RATE: u32 = 24000;

/// 连接超时
#[cfg(not(test))]
const CONNECT_TIMEOUT: Duration = Duration::from_secs(10);
#[cfg(test)]
const CONNECT_TIMEOUT: Duration = Duration::from_secs(1);

// ============================================================================
// 类型别名
// ============================================================================

type WsStream = WebSocketStream<MaybeTlsStream<TcpStream>>;

// ============================================================================
// DoubaoTtsConfig (内部)
// ============================================================================

/// DoubaoTTS 运行时配置快照 (用于连接复用)
#[derive(Debug, Clone)]
struct DoubaoTtsConfig {
    voice: VoiceId,
    format: String,
    sample_rate: u32,
    enable_timestamp: bool,
}

// ============================================================================
// DoubaoTtsOption
// ============================================================================

/// DoubaoTTS 专属配置
#[derive(Debug, Clone, Default)]
pub struct DoubaoTtsOption {
    pub base: BaseTtsOption,
    pub app_id: Option<String>,
    pub access_token: Option<String>,
    pub resource_id: Option<String>,
    pub sample_rate: Option<u32>,
    pub enable_timestamp: Option<bool>,
}

// ============================================================================
// DoubaoTts
// ============================================================================

/// 豆包 TTS Provider
pub struct DoubaoTts {
    app_id: String,
    access_token: String,
    resource_id: String,
    base_url: String,
    voice: VoiceId,
    format: String,
    sample_rate: u32,
    enable_timestamp: bool,
}

impl DoubaoTts {
    pub fn new(options: DoubaoTtsOption) -> Self {
        let base = &options.base;
        Self {
            app_id: options.app_id.unwrap_or_default(),
            access_token: options.access_token.unwrap_or_default(),
            resource_id: options
                .resource_id
                .clone()
                .unwrap_or_else(|| DOUBAO_DEFAULT_RESOURCE_ID.into()),
            base_url: base
                .base_url
                .clone()
                .unwrap_or_else(|| DOUBAO_DEFAULT_BASE_URL.into()),
            voice: base
                .voice
                .clone()
                .unwrap_or_else(|| VoiceId::from(DOUBAO_DEFAULT_VOICE)),
            format: base
                .format
                .clone()
                .unwrap_or_else(|| DOUBAO_DEFAULT_FORMAT.into()),
            sample_rate: options.sample_rate.unwrap_or(DOUBAO_DEFAULT_SAMPLE_RATE),
            enable_timestamp: options.enable_timestamp.unwrap_or(false),
        }
    }

    fn config(&self) -> DoubaoTtsConfig {
        DoubaoTtsConfig {
            voice: self.voice.clone(),
            format: self.format.clone(),
            sample_rate: self.sample_rate,
            enable_timestamp: self.enable_timestamp,
        }
    }

    /// 构建带认证头的 WS 请求 (对应 TS buildAuthHeaders)
    fn build_ws_request(&self) -> Result<http::Request<()>, TtsError> {
        use tokio_tungstenite::tungstenite::client::IntoClientRequest;
        let mut req: http::Request<()> = self
            .base_url
            .as_str()
            .into_client_request()
            .map_err(|e| TtsError::Other(format!("Invalid WebSocket URL: {}", e)))?;

        // 火山引擎 TTS 要求 permessage-deflate 扩展
        req.headers_mut().insert(
            "Sec-WebSocket-Extensions",
            "permessage-deflate; client_max_window_bits"
                .parse()
                .unwrap(),
        );
        // 认证头
        req.headers_mut()
            .insert("X-Api-App-Key", self.app_id.parse().unwrap());
        req.headers_mut()
            .insert("X-Api-Access-Key", self.access_token.parse().unwrap());
        req.headers_mut()
            .insert("X-Api-Resource-Id", self.resource_id.parse().unwrap());
        req.headers_mut().insert(
            "X-Api-Connect-Id",
            uuid::Uuid::new_v4().to_string().parse().unwrap(),
        );

        Ok(req)
    }

    /// 验证必要参数
    fn ensure_valid(&self) -> Result<(), TtsError> {
        if self.app_id.is_empty() {
            return Err(TtsError::InvalidParameter(
                "appId is required for Doubao TTS".into(),
            ));
        }
        if self.access_token.is_empty() {
            return Err(TtsError::InvalidParameter(
                "accessToken is required for Doubao TTS".into(),
            ));
        }
        Ok(())
    }

    /// 构建 StartSession JSON payload (对应 TS buildSessionPayload)
    fn build_session_payload(&self) -> Vec<u8> {
        let payload = serde_json::json!({
            "user": {
                "uid": uuid::Uuid::new_v4().to_string()
            },
            "req_params": {
                "speaker": self.voice.as_str(),
                "audio_params": {
                    "format": self.format,
                    "sample_rate": self.sample_rate,
                    "enable_timestamp": self.enable_timestamp,
                },
                "additions": "{\"disable_markdown_filter\":true}"
            },
            "event": EventType::StartSession as u32,
        });
        payload.to_string().into_bytes()
    }

    /// 构建 TaskRequest JSON payload (对应 TS buildTaskPayload)
    fn build_task_payload(&self, text: &str) -> Vec<u8> {
        let payload = serde_json::json!({
            "user": {
                "uid": uuid::Uuid::new_v4().to_string()
            },
            "req_params": {
                "speaker": self.voice.as_str(),
                "audio_params": {
                    "format": self.format,
                    "sample_rate": self.sample_rate,
                    "enable_timestamp": self.enable_timestamp,
                },
                "additions": "{\"disable_markdown_filter\":true}",
                "text": text,
            },
            "event": EventType::TaskRequest as u32,
        });
        payload.to_string().into_bytes()
    }

    /// 建立 WebSocket 连接 (带默认超时)
    async fn connect_ws(&self) -> Result<WsStream, TtsError> {
        let request = self.build_ws_request()?;
        let (ws, _) = tokio::time::timeout(CONNECT_TIMEOUT, connect_async(request))
            .await
            .map_err(|_| TtsError::Timeout(CONNECT_TIMEOUT.as_millis() as u64))??;
        Ok(ws)
    }

    /// Send a VolcMessage via WebSocket sink.
    async fn ws_send<S>(sink: &mut S, msg: &VolcMessage) -> Result<(), TtsError>
    where
        S: futures_util::Sink<Message, Error = tungstenite::Error> + Unpin,
    {
        let bytes = volcengine::marshal_message(msg)?;
        sink.send(Message::Binary(bytes)).await?;
        Ok(())
    }
}

// ============================================================================
// TtsProvider 实现
// ============================================================================

#[async_trait]
#[allow(clippy::result_large_err)]
impl TtsProvider for DoubaoTts {
    fn name(&self) -> &'static str {
        "doubao"
    }

    async fn synthesize(&self, request: TtsRequest) -> Result<TtsResponse, TtsError> {
        self.ensure_valid()?;
        let mut ws = self.connect_ws().await?;

        // -- 1. StartConnection handshake --
        Self::ws_send(&mut ws, &VolcMessage::build_start_connection()).await?;
        volcengine::wait_for_event(
            &mut ws,
            MsgType::FullServerResponse,
            EventType::ConnectionStarted,
        )
        .await?;

        // -- 2. StartSession --
        let session_id = uuid::Uuid::new_v4().to_string();
        let session_payload = self.build_session_payload();
        Self::ws_send(
            &mut ws,
            &VolcMessage::build_start_session(session_payload, &session_id),
        )
        .await?;
        volcengine::wait_for_event(
            &mut ws,
            MsgType::FullServerResponse,
            EventType::SessionStarted,
        )
        .await?;

        // -- 3. TaskRequest + FinishSession (TS: send immediately without wait) --
        let task_payload = self.build_task_payload(&request.text);
        Self::ws_send(
            &mut ws,
            &VolcMessage::build_task_request(task_payload, &session_id),
        )
        .await?;
        Self::ws_send(&mut ws, &VolcMessage::build_finish_session(&session_id)).await?;

        // -- 4. Collect audio until SessionFinished --
        let mut audio_chunks: Vec<Vec<u8>> = Vec::new();
        loop {
            let msg = volcengine::recv_message(&mut ws).await?;
            match msg.msg_type {
                MsgType::AudioOnlyServer => {
                    if !msg.payload.is_empty() {
                        audio_chunks.push(msg.payload);
                    }
                }
                MsgType::FullServerResponse if msg.event == Some(EventType::SessionFinished) => {
                    break;
                }
                MsgType::FullServerResponse => continue,
                MsgType::Error => {
                    let error_msg = String::from_utf8_lossy(&msg.payload).to_string();
                    return Err(TtsError::ServiceError {
                        code: msg.error_code.unwrap_or(0).to_string(),
                        message: error_msg,
                    });
                }
                _ => continue,
            }
        }

        // -- 5. FinishConnection handshake --
        Self::ws_send(&mut ws, &VolcMessage::build_finish_connection()).await?;
        volcengine::wait_for_event(
            &mut ws,
            MsgType::FullServerResponse,
            EventType::ConnectionFinished,
        )
        .await?;

        // -- 6. Build response --
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
            format: self.format.clone(),
            duration: None,
        })
    }

    #[allow(clippy::result_large_err)]
    async fn speak_stream(&self, input: TextStream) -> Result<TtsAudioStream, TtsError> {
        self.ensure_valid()?;
        let ws = self.connect_ws().await?;

        // -- 1. StartConnection handshake --
        let (mut write, mut read) = ws.split();
        Self::ws_send(&mut write, &VolcMessage::build_start_connection()).await?;

        // Verify ConnectionStarted — need to reunite temporarily or use the read half
        // We already split above, so use the read half directly
        let _conn_started = volcengine::wait_for_event(
            &mut read,
            MsgType::FullServerResponse,
            EventType::ConnectionStarted,
        )
        .await?;

        // -- 2. StartSession --
        let session_id = uuid::Uuid::new_v4().to_string();
        let session_payload = self.build_session_payload();
        Self::ws_send(
            &mut write,
            &VolcMessage::build_start_session(session_payload, &session_id),
        )
        .await?;

        let _session_started = volcengine::wait_for_event(
            &mut read,
            MsgType::FullServerResponse,
            EventType::SessionStarted,
        )
        .await?;

        // -- 3. Concurrent send / receive --
        let (tx, mut rx) = tokio::sync::mpsc::channel::<Vec<u8>>(64);
        // 用于同步: 接收任务收到 SessionFinished 后通知发送任务可以发 finish_connection
        let (session_done_tx, session_done_rx) = tokio::sync::oneshot::channel::<()>();
        let mut session_done_tx = Some(session_done_tx);

        let send_config = self.config();
        let send_handle: tokio::task::JoinHandle<Result<(), TtsError>> = tokio::spawn(async move {
            let mut text_stream = input;
            while let Some(chunk) = text_stream.next().await {
                let payload = Self::build_task_payload_cfg(&send_config, &chunk);
                Self::ws_send_cfg(
                    &mut write,
                    &VolcMessage::build_task_request(payload, &session_id),
                )
                .await?;
            }
            // 结束会话 (服务端收到后开始发送 SessionFinished)
            Self::ws_send_cfg(&mut write, &VolcMessage::build_finish_session(&session_id)).await?;
            // 等待接收任务确认服务端已完成所有音频发送 (SessionFinished 已收到)
            let _ = session_done_rx.await;
            // 结束连接 (此时服务端已发送完所有音频)
            Self::ws_send_cfg(&mut write, &VolcMessage::build_finish_connection()).await?;
            Ok(())
        });

        let recv_handle: tokio::task::JoinHandle<Result<(), TtsError>> = tokio::spawn(async move {
            loop {
                let msg = volcengine::recv_message(&mut read).await?;
                match msg.msg_type {
                    MsgType::AudioOnlyServer if !msg.payload.is_empty() => {
                        if tx.send(msg.payload).await.is_err() {
                            return Ok(());
                        }
                    }
                    // SessionFinished → 通知发送任务可以发 finish_connection
                    MsgType::FullServerResponse
                        if msg.event == Some(EventType::SessionFinished) =>
                    {
                        if let Some(tx) = session_done_tx.take() {
                            let _ = tx.send(());
                        }
                    }
                    MsgType::FullServerResponse
                        if msg.event == Some(EventType::ConnectionFinished) =>
                    {
                        return Ok(());
                    }
                    MsgType::FullServerResponse => continue,
                    MsgType::Error => {
                        let error_msg = String::from_utf8_lossy(&msg.payload).to_string();
                        return Err(TtsError::ServiceError {
                            code: msg.error_code.unwrap_or(0).to_string(),
                            message: error_msg,
                        });
                    }
                    _ => continue,
                }
            }
        });

        // -- 4. Build output stream --
        let stream = async_stream::stream! {
            while let Some(audio) = rx.recv().await {
                yield Ok(TtsStreamChunk { audio_chunk: audio });
            }

            // Propagate errors from spawned tasks
            match send_handle.await {
                Ok(Err(e)) => yield Err(e),
                Err(_) => yield Err(TtsError::Other("Send task panicked".into())),
                _ => {}
            }
            match recv_handle.await {
                Ok(Err(e)) => yield Err(e),
                Err(_) => yield Err(TtsError::Other("Recv task panicked".into())),
                _ => {}
            }
        };

        Ok(Box::pin(stream))
    }

    async fn connect(&self, options: TtsConnectOption) -> Result<Box<dyn TtsConnection>, TtsError> {
        self.ensure_valid()?;

        let request = self.build_ws_request()?;
        let (mut ws, _) = tokio::time::timeout(options.timeout, connect_async(request))
            .await
            .map_err(|_| TtsError::Timeout(options.timeout.as_millis() as u64))??;

        // Complete StartConnection handshake (using unsplit WS)
        Self::ws_send(&mut ws, &VolcMessage::build_start_connection()).await?;
        let (write, mut read) = ws.split();
        volcengine::wait_for_event(
            &mut read,
            MsgType::FullServerResponse,
            EventType::ConnectionStarted,
        )
        .await?;

        // Reunite WS halves for reuse in connection
        let ws = write
            .reunite(read)
            .map_err(|_| TtsError::Other("Failed to reunite WebSocket".into()))?;

        Ok(Box::new(DoubaoTtsConnection {
            ws: Some(ws),
            state: ConnectionState::Connected,
            config: self.config(),
        }))
    }

    async fn list_voices(&self) -> Result<Vec<TtsVoice>, TtsError> {
        Ok(voices::doubao::list_voices())
    }
}

// ============================================================================
// 内部辅助 (用于 speak_stream 中从 DoubaoTtsConfig 构建 payload)
// ============================================================================

impl DoubaoTts {
    fn build_task_payload_cfg(config: &DoubaoTtsConfig, text: &str) -> Vec<u8> {
        let payload = serde_json::json!({
            "user": {
                "uid": uuid::Uuid::new_v4().to_string()
            },
            "req_params": {
                "speaker": config.voice.as_str(),
                "audio_params": {
                    "format": config.format,
                    "sample_rate": config.sample_rate,
                    "enable_timestamp": config.enable_timestamp,
                },
                "additions": "{\"disable_markdown_filter\":true}",
                "text": text,
            },
            "event": EventType::TaskRequest as u32,
        });
        payload.to_string().into_bytes()
    }

    async fn ws_send_cfg<S>(sink: &mut S, msg: &VolcMessage) -> Result<(), TtsError>
    where
        S: futures_util::Sink<Message, Error = tungstenite::Error> + Unpin,
    {
        let bytes = volcengine::marshal_message(msg)?;
        sink.send(Message::Binary(bytes)).await?;
        Ok(())
    }
}

// ============================================================================
// DoubaoTtsConnection
// ============================================================================

/// 豆包 TTS 连接实例 (通过 DoubaoTts::connect() 获取)
pub struct DoubaoTtsConnection {
    ws: Option<WsStream>,
    state: ConnectionState,
    config: DoubaoTtsConfig,
}

impl DoubaoTtsConnection {
    fn build_session_payload(&self) -> Vec<u8> {
        let payload = serde_json::json!({
            "user": {
                "uid": uuid::Uuid::new_v4().to_string()
            },
            "req_params": {
                "speaker": self.config.voice,
                "audio_params": {
                    "format": self.config.format,
                    "sample_rate": self.config.sample_rate,
                    "enable_timestamp": self.config.enable_timestamp,
                },
                "additions": "{\"disable_markdown_filter\":true}"
            },
            "event": EventType::StartSession as u32,
        });
        payload.to_string().into_bytes()
    }

    fn build_task_payload(&self, text: &str) -> Vec<u8> {
        let payload = serde_json::json!({
            "user": {
                "uid": uuid::Uuid::new_v4().to_string()
            },
            "req_params": {
                "speaker": self.config.voice,
                "audio_params": {
                    "format": self.config.format,
                    "sample_rate": self.config.sample_rate,
                    "enable_timestamp": self.config.enable_timestamp,
                },
                "additions": "{\"disable_markdown_filter\":true}",
                "text": text,
            },
            "event": EventType::TaskRequest as u32,
        });
        payload.to_string().into_bytes()
    }

    async fn ws_send_inner<S>(sink: &mut S, msg: &VolcMessage) -> Result<(), TtsError>
    where
        S: futures_util::Sink<Message, Error = tungstenite::Error> + Unpin,
    {
        let bytes = volcengine::marshal_message(msg)?;
        sink.send(Message::Binary(bytes)).await?;
        Ok(())
    }
}

#[cfg(test)]
impl DoubaoTtsConnection {
    pub(crate) fn new_for_test(state: ConnectionState) -> Self {
        Self {
            ws: None,
            state,
            config: DoubaoTtsConfig {
                voice: VoiceId::new(""),
                format: String::new(),
                sample_rate: 24000,
                enable_timestamp: false,
            },
        }
    }
}

#[async_trait]
#[allow(clippy::result_large_err)]
impl TtsConnection for DoubaoTtsConnection {
    fn state(&self) -> ConnectionState {
        self.state
    }

    async fn synthesize(&mut self, text: String) -> Result<TtsResponse, TtsError> {
        if self.state != ConnectionState::Connected {
            return Err(TtsError::ConnectionClosed);
        }

        let session_id = uuid::Uuid::new_v4().to_string();

        // Build payloads before borrowing self.ws (avoids borrow conflict)
        let session_payload = self.build_session_payload();
        let task_payload = self.build_task_payload(&text);

        let ws = self.ws.as_mut().ok_or(TtsError::ConnectionClosed)?;

        // -- StartSession (no StartConnection — connection is reused) --

        Self::ws_send_inner(
            ws,
            &VolcMessage::build_start_session(session_payload, &session_id),
        )
        .await?;
        volcengine::wait_for_event(ws, MsgType::FullServerResponse, EventType::SessionStarted)
            .await?;

        // -- TaskRequest + FinishSession --
        Self::ws_send_inner(
            ws,
            &VolcMessage::build_task_request(task_payload, &session_id),
        )
        .await?;
        Self::ws_send_inner(ws, &VolcMessage::build_finish_session(&session_id)).await?;

        // -- Collect audio until SessionFinished --
        let mut audio_chunks: Vec<Vec<u8>> = Vec::new();
        loop {
            let msg = volcengine::recv_message(ws).await?;
            match msg.msg_type {
                MsgType::AudioOnlyServer => {
                    if !msg.payload.is_empty() {
                        audio_chunks.push(msg.payload);
                    }
                }
                MsgType::FullServerResponse if msg.event == Some(EventType::SessionFinished) => {
                    break;
                }
                MsgType::FullServerResponse => continue,
                MsgType::Error => {
                    let error_msg = String::from_utf8_lossy(&msg.payload).to_string();
                    return Err(TtsError::ServiceError {
                        code: msg.error_code.unwrap_or(0).to_string(),
                        message: error_msg,
                    });
                }
                _ => continue,
            }
        }

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

    async fn speak_stream(&mut self, input: TextStream) -> Result<TtsAudioStream, TtsError> {
        if self.state != ConnectionState::Connected {
            return Err(TtsError::ConnectionClosed);
        }
        let ws = self.ws.take().ok_or(TtsError::ConnectionClosed)?;
        self.state = ConnectionState::Closed;

        let (mut write, mut read) = ws.split();
        let session_id = uuid::Uuid::new_v4().to_string();

        // -- StartSession (no StartConnection — connection ready) --
        let session_payload = self.build_session_payload();
        Self::ws_send_inner(
            &mut write,
            &VolcMessage::build_start_session(session_payload, &session_id),
        )
        .await?;
        volcengine::wait_for_event(
            &mut read,
            MsgType::FullServerResponse,
            EventType::SessionStarted,
        )
        .await?;

        // -- Concurrent send / receive --
        let (tx, mut rx) = tokio::sync::mpsc::channel::<Vec<u8>>(64);
        let (session_done_tx, session_done_rx) = tokio::sync::oneshot::channel::<()>();
        let mut session_done_tx = Some(session_done_tx);
        let cfg = self.config.clone();

        let send_handle: tokio::task::JoinHandle<Result<(), TtsError>> = tokio::spawn(async move {
            let mut text_stream = input;
            while let Some(chunk) = text_stream.next().await {
                let payload = Self::build_task_payload_cfg(&cfg, &chunk);
                Self::ws_send_inner(
                    &mut write,
                    &VolcMessage::build_task_request(payload, &session_id),
                )
                .await?;
            }
            Self::ws_send_inner(&mut write, &VolcMessage::build_finish_session(&session_id))
                .await?;
            // 等待 SessionFinished 确认服务端已处理完所有音频
            let _ = session_done_rx.await;
            Self::ws_send_inner(&mut write, &VolcMessage::build_finish_connection()).await?;
            Ok(())
        });

        let recv_handle: tokio::task::JoinHandle<Result<(), TtsError>> = tokio::spawn(async move {
            loop {
                let msg = volcengine::recv_message(&mut read).await?;
                match msg.msg_type {
                    MsgType::AudioOnlyServer if !msg.payload.is_empty() => {
                        if tx.send(msg.payload).await.is_err() {
                            return Ok(());
                        }
                    }
                    MsgType::FullServerResponse
                        if msg.event == Some(EventType::SessionFinished) =>
                    {
                        if let Some(tx) = session_done_tx.take() {
                            let _ = tx.send(());
                        }
                    }
                    MsgType::FullServerResponse
                        if msg.event == Some(EventType::ConnectionFinished) =>
                    {
                        return Ok(());
                    }
                    MsgType::FullServerResponse => continue,
                    MsgType::Error => {
                        let error_msg = String::from_utf8_lossy(&msg.payload).to_string();
                        return Err(TtsError::ServiceError {
                            code: msg.error_code.unwrap_or(0).to_string(),
                            message: error_msg,
                        });
                    }
                    _ => continue,
                }
            }
        });

        let stream = async_stream::stream! {
            while let Some(audio) = rx.recv().await {
                yield Ok(TtsStreamChunk { audio_chunk: audio });
            }
            match send_handle.await {
                Ok(Err(e)) => yield Err(e),
                Err(_) => yield Err(TtsError::Other("Send task panicked".into())),
                _ => {}
            }
            match recv_handle.await {
                Ok(Err(e)) => yield Err(e),
                Err(_) => yield Err(TtsError::Other("Recv task panicked".into())),
                _ => {}
            }
        };

        Ok(Box::pin(stream))
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

/// Internal helpers with config reference for spawned tasks
impl DoubaoTtsConnection {
    fn build_task_payload_cfg(config: &DoubaoTtsConfig, text: &str) -> Vec<u8> {
        let payload = serde_json::json!({
            "user": {
                "uid": uuid::Uuid::new_v4().to_string()
            },
            "req_params": {
                "speaker": config.voice.as_str(),
                "audio_params": {
                    "format": config.format,
                    "sample_rate": config.sample_rate,
                    "enable_timestamp": config.enable_timestamp,
                },
                "additions": "{\"disable_markdown_filter\":true}",
                "text": text,
            },
            "event": EventType::TaskRequest as u32,
        });
        payload.to_string().into_bytes()
    }
}

// ============================================================================
// 测试
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    // ---- C1-C9: 配置 ----

    #[test]
    fn test_c1_defaults() {
        let provider = DoubaoTts::new(DoubaoTtsOption {
            app_id: Some("test-app".into()),
            access_token: Some("test-token".into()),
            ..Default::default()
        });
        assert_eq!(provider.name(), "doubao");
        assert_eq!(provider.app_id, "test-app");
        assert_eq!(provider.access_token, "test-token");
        assert_eq!(provider.resource_id, DOUBAO_DEFAULT_RESOURCE_ID);
        assert_eq!(provider.base_url, DOUBAO_DEFAULT_BASE_URL);
        assert_eq!(provider.voice, DOUBAO_DEFAULT_VOICE);
        assert_eq!(provider.format, DOUBAO_DEFAULT_FORMAT);
        assert_eq!(provider.sample_rate, DOUBAO_DEFAULT_SAMPLE_RATE);
        assert!(!provider.enable_timestamp);
    }

    #[test]
    fn test_c2_custom_options() {
        let provider = DoubaoTts::new(DoubaoTtsOption {
            base: BaseTtsOption {
                base_url: Some("wss://custom-host/".into()),
                voice: Some("custom_voice".into()),
                format: Some("wav".into()),
                ..Default::default()
            },
            app_id: Some("custom-app".into()),
            access_token: Some("custom-token".into()),
            resource_id: Some("custom-resource".into()),
            sample_rate: Some(16000),
            enable_timestamp: Some(true),
        });
        assert_eq!(provider.app_id, "custom-app");
        assert_eq!(provider.access_token, "custom-token");
        assert_eq!(provider.resource_id, "custom-resource");
        assert_eq!(provider.base_url, "wss://custom-host/");
        assert_eq!(provider.voice, "custom_voice");
        assert_eq!(provider.format, "wav");
        assert_eq!(provider.sample_rate, 16000);
        assert!(provider.enable_timestamp);
    }

    #[test]
    fn test_c3_app_id_empty_default() {
        let provider = DoubaoTts::new(DoubaoTtsOption {
            app_id: Some("".into()),
            access_token: Some("token".into()),
            ..Default::default()
        });
        assert_eq!(provider.app_id, "");
    }

    #[test]
    fn test_c4_access_token_empty_default() {
        let provider = DoubaoTts::new(DoubaoTtsOption {
            app_id: Some("app".into()),
            access_token: Some("".into()),
            ..Default::default()
        });
        assert_eq!(provider.access_token, "");
    }

    #[test]
    fn test_c5_base_url_custom() {
        let provider = DoubaoTts::new(DoubaoTtsOption {
            base: BaseTtsOption {
                base_url: Some("wss://custom/".into()),
                ..Default::default()
            },
            app_id: Some("a".into()),
            access_token: Some("t".into()),
            ..Default::default()
        });
        assert_eq!(provider.base_url, "wss://custom/");
    }

    #[test]
    fn test_c6_voice_from_base() {
        let provider = DoubaoTts::new(DoubaoTtsOption {
            base: BaseTtsOption {
                voice: Some("base_voice".into()),
                ..Default::default()
            },
            app_id: Some("a".into()),
            access_token: Some("t".into()),
            ..Default::default()
        });
        assert_eq!(provider.voice, "base_voice");
    }

    #[test]
    fn test_c7_format_from_base() {
        let provider = DoubaoTts::new(DoubaoTtsOption {
            base: BaseTtsOption {
                format: Some("ogg".into()),
                ..Default::default()
            },
            app_id: Some("a".into()),
            access_token: Some("t".into()),
            ..Default::default()
        });
        assert_eq!(provider.format, "ogg");
    }

    #[test]
    fn test_c8_sample_rate_custom() {
        let provider = DoubaoTts::new(DoubaoTtsOption {
            app_id: Some("a".into()),
            access_token: Some("t".into()),
            sample_rate: Some(44100),
            ..Default::default()
        });
        assert_eq!(provider.sample_rate, 44100);
    }

    #[test]
    fn test_c9_enable_timestamp_true() {
        let provider = DoubaoTts::new(DoubaoTtsOption {
            app_id: Some("a".into()),
            access_token: Some("t".into()),
            enable_timestamp: Some(true),
            ..Default::default()
        });
        assert!(provider.enable_timestamp);
    }

    // ---- H1-H2: WS 请求头 ----

    #[test]
    fn test_h1_ws_request_headers() {
        let provider = DoubaoTts::new(DoubaoTtsOption {
            app_id: Some("test-app".into()),
            access_token: Some("test-token".into()),
            resource_id: Some("test-resource".into()),
            ..Default::default()
        });
        let request = provider.build_ws_request().unwrap();
        assert_eq!(request.method(), "GET");
        assert_eq!(
            request
                .headers()
                .get("X-Api-App-Key")
                .unwrap()
                .to_str()
                .unwrap(),
            "test-app"
        );
        assert_eq!(
            request
                .headers()
                .get("X-Api-Access-Key")
                .unwrap()
                .to_str()
                .unwrap(),
            "test-token"
        );
        assert_eq!(
            request
                .headers()
                .get("X-Api-Resource-Id")
                .unwrap()
                .to_str()
                .unwrap(),
            "test-resource"
        );
        assert!(request.headers().get("X-Api-Connect-Id").is_some());
        assert_eq!(
            request.headers().get("Upgrade").unwrap().to_str().unwrap(),
            "websocket"
        );
        assert_eq!(
            request
                .headers()
                .get("Connection")
                .unwrap()
                .to_str()
                .unwrap(),
            "Upgrade"
        );
        assert_eq!(
            request
                .headers()
                .get("Sec-WebSocket-Version")
                .unwrap()
                .to_str()
                .unwrap(),
            "13"
        );
        assert!(request.headers().get("Host").is_some());
        assert!(request.headers().get("Sec-WebSocket-Key").is_some());
    }

    #[test]
    fn test_h2_ws_request_invalid_url() {
        let provider = DoubaoTts {
            app_id: "app".into(),
            access_token: "token".into(),
            resource_id: "res".into(),
            base_url: "not a valid url".into(),
            voice: VoiceId::new(""),
            format: String::new(),
            sample_rate: 24000,
            enable_timestamp: false,
        };
        let result = provider.build_ws_request();
        assert!(result.is_err());
    }

    // ---- V1-V3: 参数验证 ----

    #[test]
    fn test_v1_empty_app_id() {
        let provider = DoubaoTts::new(DoubaoTtsOption {
            app_id: Some("".into()),
            access_token: Some("token".into()),
            ..Default::default()
        });
        assert!(matches!(
            provider.ensure_valid(),
            Err(TtsError::InvalidParameter(_))
        ));
    }

    #[test]
    fn test_v2_empty_access_token() {
        let provider = DoubaoTts::new(DoubaoTtsOption {
            app_id: Some("app".into()),
            access_token: Some("".into()),
            ..Default::default()
        });
        assert!(matches!(
            provider.ensure_valid(),
            Err(TtsError::InvalidParameter(_))
        ));
    }

    #[test]
    fn test_v3_synthesize_empty_key() {
        let provider = DoubaoTts::new(DoubaoTtsOption {
            app_id: Some("".into()),
            access_token: Some("".into()),
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

    // ---- S1-S5: Connection 状态机 ----

    #[test]
    fn test_s1_connection_state_initial() {
        let conn = DoubaoTtsConnection::new_for_test(ConnectionState::Connected);
        assert_eq!(conn.state(), ConnectionState::Connected);
    }

    #[tokio::test]
    async fn test_s2_close_transition() {
        let mut conn = DoubaoTtsConnection::new_for_test(ConnectionState::Connected);
        conn.close().await.unwrap();
        assert_eq!(conn.state(), ConnectionState::Closed);
    }

    #[tokio::test]
    async fn test_s3_close_idempotent() {
        let mut conn = DoubaoTtsConnection::new_for_test(ConnectionState::Connected);
        conn.close().await.unwrap();
        conn.close().await.unwrap();
        assert_eq!(conn.state(), ConnectionState::Closed);
    }

    #[tokio::test]
    async fn test_s4_synthesize_after_close() {
        let mut conn = DoubaoTtsConnection::new_for_test(ConnectionState::Connected);
        conn.close().await.unwrap();
        let result = conn.synthesize("text".into()).await;
        assert!(matches!(result, Err(TtsError::ConnectionClosed)));
    }

    #[tokio::test]
    async fn test_s5_speak_stream_after_close() {
        let mut conn = DoubaoTtsConnection::new_for_test(ConnectionState::Connected);
        conn.close().await.unwrap();
        let input: TextStream = Box::pin(futures_util::stream::empty());
        let result = conn.speak_stream(input).await;
        assert!(matches!(result, Err(TtsError::ConnectionClosed)));
    }

    // ---- L1: list_voices ----

    #[test]
    fn test_l1_list_voices_all_have_id() {
        let provider = DoubaoTts::new(DoubaoTtsOption {
            app_id: Some("a".into()),
            access_token: Some("t".into()),
            ..Default::default()
        });
        let rt = tokio::runtime::Runtime::new().unwrap();
        let voices = rt.block_on(provider.list_voices()).unwrap();
        assert!(!voices.is_empty(), "Doubao list_voices should not be empty");
        for v in &voices {
            assert!(!v.id.is_empty(), "Each voice must have a non-empty id");
        }
    }
}
