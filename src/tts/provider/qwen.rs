use async_trait::async_trait;
use futures_util::{SinkExt, StreamExt};
use std::time::Duration;
use tokio::net::TcpStream;
use tokio_tungstenite::tungstenite::{self, Message, http};
use tokio_tungstenite::{MaybeTlsStream, WebSocketStream, connect_async};

use crate::asr::traits::ConnectionState;
use crate::tts::error::TtsError;
use crate::tts::protocol::dashscope::{self, TtsRunTaskParams, TtsServerEvent};
use crate::tts::traits::{TtsConnection, TtsProvider};
use crate::tts::types::{
    BaseTtsOption, TextStream, TtsAudioStream, TtsConnectOption, TtsRequest, TtsResponse,
    TtsStreamChunk, TtsVoice,
};
use crate::tts::voice_id::VoiceId;
use crate::tts::voices;

// ============================== 常量 ==============================

/// Qwen（DashScope）默认 WebSocket 地址
pub const QWEN_DEFAULT_BASE_URL: &str = "wss://dashscope.aliyuncs.com/api-ws/v1/inference/";
/// Qwen TTS 默认模型
pub const QWEN_DEFAULT_MODEL: &str = "cosyvoice-v3-flash";
/// Qwen TTS 默认音色
pub const QWEN_DEFAULT_VOICE: &str = "longxiaochun_v3";

/// 连接超时
#[cfg(not(test))]
const CONNECT_TIMEOUT: Duration = Duration::from_secs(10);
#[cfg(test)]
const CONNECT_TIMEOUT: Duration = Duration::from_secs(1);

// ============================== 内部辅助结构 ==============================

/// Qwen TTS 运行时配置（从 QwenTts 提取，用于在连接上执行合成）
#[derive(Debug, Clone)]
struct QwenTtsConfig {
    model: String,
    voice: VoiceId,
    format: String,
    sample_rate: Option<u32>,
    speed: f32,
    volume: f32,
    pitch: f32,
}

// ============================== QwenTtsOption ==============================

/// Qwen TTS 专属配置
#[derive(Debug, Clone, Default)]
pub struct QwenTtsOption {
    pub base: BaseTtsOption,
    pub sample_rate: Option<u32>,
    /// 情感控制指令，仅 qwen3-tts 新模型支持（TS 占位字段，当前协议未发送）
    pub instruction: Option<String>,
}

// ============================== QwenTts ==============================

/// Qwen TTS Provider
pub struct QwenTts {
    api_key: String,
    base_url: String,
    model: String,
    voice: VoiceId,
    format: String,
    sample_rate: Option<u32>,
    speed: f32,
    volume: f32,
    pitch: f32,
    _instruction: Option<String>,
}

impl QwenTts {
    pub fn new(options: QwenTtsOption) -> Self {
        let base = &options.base;
        Self {
            api_key: base.api_key.clone().unwrap_or_default(),
            base_url: base
                .base_url
                .clone()
                .unwrap_or_else(|| QWEN_DEFAULT_BASE_URL.into()),
            model: base
                .model
                .clone()
                .unwrap_or_else(|| QWEN_DEFAULT_MODEL.into()),
            voice: base
                .voice
                .clone()
                .unwrap_or_else(|| VoiceId::from(QWEN_DEFAULT_VOICE)),
            format: base.format.clone().unwrap_or_else(|| "mp3".into()),
            sample_rate: options.sample_rate,
            speed: base.speed.unwrap_or(1.0),
            volume: base.volume.unwrap_or(1.0),
            pitch: base.pitch.unwrap_or(1.0),
            _instruction: options.instruction,
        }
    }

    fn config(&self) -> QwenTtsConfig {
        QwenTtsConfig {
            model: self.model.clone(),
            voice: self.voice.clone(),
            format: self.format.clone(),
            sample_rate: self.sample_rate,
            speed: self.speed,
            volume: self.volume,
            pitch: self.pitch,
        }
    }

    /// 构建带认证头的 WS 请求
    fn build_ws_request(&self) -> Result<http::Request<()>, TtsError> {
        let parsed_url: http::Uri = self.base_url.parse().map_err(|e: http::uri::InvalidUri| {
            TtsError::Other(format!("Invalid WebSocket URL: {}", e))
        })?;

        let host = match parsed_url.port() {
            Some(port) => format!("{}:{}", parsed_url.host().unwrap_or(""), port),
            None => parsed_url.host().unwrap_or("").to_string(),
        };

        let req_builder = http::Request::builder()
            .uri(&parsed_url)
            .method("GET")
            .header("Host", &host)
            .header("Upgrade", "websocket")
            .header("Connection", "Upgrade")
            .header(
                "Sec-WebSocket-Key",
                &tungstenite::handshake::client::generate_key(),
            )
            .header("Sec-WebSocket-Version", "13")
            .header("Authorization", &format!("Bearer {}", self.api_key));

        req_builder
            .body(())
            .map_err(|e| TtsError::Other(format!("HTTP request build error: {}", e)))
    }

    /// 验证必要参数
    fn ensure_valid(&self) -> Result<(), TtsError> {
        if self.api_key.is_empty() {
            return Err(TtsError::InvalidParameter(
                "apiKey is required for Qwen TTS".into(),
            ));
        }
        Ok(())
    }

    /// 构建 run-task 参数
    fn build_run_params(&self) -> TtsRunTaskParams {
        let vol = (self.volume * 100.0) as u32;
        TtsRunTaskParams {
            model: self.model.clone(),
            voice: self.voice.as_str().to_string(),
            format: self.format.clone(),
            sample_rate: self.sample_rate,
            volume: Some(vol),
            rate: Some(self.speed),
            pitch: Some(self.pitch),
        }
    }

    /// 建立 WebSocket 连接（带默认超时）
    async fn connect_ws(&self) -> Result<WebSocketStream<MaybeTlsStream<TcpStream>>, TtsError> {
        let request = self.build_ws_request()?;
        let (ws, _) = tokio::time::timeout(CONNECT_TIMEOUT, connect_async(request))
            .await
            .map_err(|_| TtsError::Timeout(CONNECT_TIMEOUT.as_millis() as u64))??;
        Ok(ws)
    }
}

// ============================== TtsProvider 实现 ==============================

#[async_trait]
#[allow(clippy::result_large_err)]
impl TtsProvider for QwenTts {
    fn name(&self) -> &'static str {
        "qwen"
    }

    async fn synthesize(&self, request: TtsRequest) -> Result<TtsResponse, TtsError> {
        self.ensure_valid()?;
        let ws = self.connect_ws().await?;
        let text = request.text;
        let config = self.config();
        let params = self.build_run_params();
        let task_id = uuid::Uuid::new_v4().to_string();

        let result = run_tts_synthesize(ws, &text, &task_id, &params, &config).await?;
        Ok(result)
    }

    async fn speak_stream(&self, input: TextStream) -> Result<TtsAudioStream, TtsError> {
        self.ensure_valid()?;
        let ws = self.connect_ws().await?;
        let config = self.config();
        let params = self.build_run_params();

        let stream = run_tts_stream(ws, input, &params, &config).await?;
        Ok(stream)
    }

    async fn connect(&self, options: TtsConnectOption) -> Result<Box<dyn TtsConnection>, TtsError> {
        self.ensure_valid()?;

        let request = self.build_ws_request()?;

        let (ws_stream, _) = tokio::time::timeout(options.timeout, connect_async(request))
            .await
            .map_err(|_| TtsError::Timeout(options.timeout.as_millis() as u64))??;

        Ok(Box::new(QwenTtsConnection {
            ws: Some(ws_stream),
            state: ConnectionState::Connected,
            config: self.config(),
        }))
    }

    async fn list_voices(&self) -> Result<Vec<TtsVoice>, TtsError> {
        Ok(voices::qwen::list_voices_for_model(Some(&self.model)))
    }
}

// ============================== 内部工具函数 ==============================

/// 在 WebSocket 上执行非流式合成周期（消耗 WS）
async fn run_tts_synthesize(
    mut ws: WebSocketStream<MaybeTlsStream<TcpStream>>,
    text: &str,
    task_id: &str,
    params: &TtsRunTaskParams,
    config: &QwenTtsConfig,
) -> Result<TtsResponse, TtsError> {
    // 1. 发送 run-task
    let run_msg = dashscope::create_run_task_message(task_id, params);
    ws.send(Message::Text(run_msg)).await?;

    // 2. 等待 task-started
    wait_for_task_started(&mut ws).await?;

    // 3. 发送 continue-task
    let continue_msg = dashscope::create_continue_task_message(task_id, text);
    ws.send(Message::Text(continue_msg)).await?;

    // 4. 发送 finish-task
    let finish_msg = dashscope::create_finish_task_message(task_id);
    ws.send(Message::Text(finish_msg)).await?;

    // 5. 收集音频数据
    let audio_chunks = collect_audio_data(&mut ws).await?;

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
        format: config.format.clone(),
        duration: None,
    })
}

/// 在 WebSocket 上执行流式合成（消耗 WS，需要 split）
#[allow(clippy::result_large_err)]
async fn run_tts_stream(
    ws: WebSocketStream<MaybeTlsStream<TcpStream>>,
    mut input: TextStream,
    params: &TtsRunTaskParams,
    _config: &QwenTtsConfig,
) -> Result<TtsAudioStream, TtsError> {
    let (mut write, mut read) = ws.split();
    let task_id = uuid::Uuid::new_v4().to_string();
    let (tx, mut rx) = tokio::sync::mpsc::channel::<Vec<u8>>(64);

    // 1. 发送 run-task
    let run_msg = dashscope::create_run_task_message(&task_id, params);
    write.send(Message::Text(run_msg)).await?;

    // 2. 等待 task-started
    loop {
        match read.next().await {
            Some(Ok(Message::Text(data))) => {
                let event = dashscope::parse_server_response(&data)?;
                match event {
                    TtsServerEvent::TaskStarted => break,
                    TtsServerEvent::TaskFailed { code, message } => {
                        return Err(TtsError::ServiceError { code, message });
                    }
                    _ => {}
                }
            }
            Some(Ok(Message::Close(_))) | None => {
                return Err(TtsError::Other(
                    "Connection closed before task-started".into(),
                ));
            }
            Some(Err(e)) => return Err(TtsError::Websocket(e)),
            _ => {} // ping/pong
        }
    }

    // 3. 并发执行发送和接收
    let send_handle: tokio::task::JoinHandle<Result<(), TtsError>> = tokio::spawn(async move {
        let mut text_sent = false;
        while let Some(chunk) = input.next().await {
            if !chunk.is_empty() {
                let msg = dashscope::create_continue_task_message(&task_id, &chunk);
                write.send(Message::Text(msg)).await?;
                text_sent = true;
            }
        }
        if !text_sent {
            let msg = dashscope::create_continue_task_message(&task_id, "");
            write.send(Message::Text(msg)).await?;
        }
        let finish_msg = dashscope::create_finish_task_message(&task_id);
        write.send(Message::Text(finish_msg)).await?;
        Ok(())
    });

    let recv_handle: tokio::task::JoinHandle<Result<(), TtsError>> = tokio::spawn(async move {
        while let Some(msg) = read.next().await {
            match msg? {
                Message::Binary(data) => {
                    if tx.send(data).await.is_err() {
                        return Ok(());
                    }
                }
                Message::Text(data) => {
                    let event = dashscope::parse_server_response(&data)?;
                    match event {
                        TtsServerEvent::TaskFinished { .. } => return Ok(()),
                        TtsServerEvent::TaskFailed { code, message } => {
                            return Err(TtsError::ServiceError { code, message });
                        }
                        _ => {} // ignore result-generated etc.
                    }
                }
                Message::Close(_) => return Ok(()),
                Message::Ping(_) | Message::Pong(_) | Message::Frame(_) => {}
            }
        }
        Ok(())
    });

    // 4. 构造输出流
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

/// 等待 task-started 事件（非 split 模式）
async fn wait_for_task_started(
    ws: &mut WebSocketStream<MaybeTlsStream<TcpStream>>,
) -> Result<(), TtsError> {
    loop {
        match ws.next().await {
            Some(Ok(Message::Text(data))) => {
                let event = dashscope::parse_server_response(&data)?;
                match event {
                    TtsServerEvent::TaskStarted => return Ok(()),
                    TtsServerEvent::TaskFailed { code, message } => {
                        return Err(TtsError::ServiceError { code, message });
                    }
                    _ => {}
                }
            }
            Some(Ok(Message::Close(_))) | None => {
                return Err(TtsError::Other(
                    "Connection closed before task-started".into(),
                ));
            }
            Some(Err(e)) => return Err(TtsError::Websocket(e)),
            _ => {} // ping/pong
        }
    }
}

/// 收集音频数据（非 split 模式）
async fn collect_audio_data(
    ws: &mut WebSocketStream<MaybeTlsStream<TcpStream>>,
) -> Result<Vec<Vec<u8>>, TtsError> {
    let mut audio_chunks: Vec<Vec<u8>> = Vec::new();
    loop {
        match ws.next().await {
            Some(Ok(Message::Binary(data))) if !data.is_empty() => {
                audio_chunks.push(data);
            }
            Some(Ok(Message::Text(data))) => {
                let event = dashscope::parse_server_response(&data)?;
                match event {
                    TtsServerEvent::TaskFinished { .. } => break,
                    TtsServerEvent::TaskFailed { code, message } => {
                        return Err(TtsError::ServiceError { code, message });
                    }
                    _ => {} // ignore result-generated etc.
                }
            }
            Some(Ok(Message::Close(_))) | None => break,
            Some(Err(e)) => return Err(TtsError::Websocket(e)),
            _ => {} // ping/pong
        }
    }
    Ok(audio_chunks)
}

// ============================== QwenTtsConnection ==============================

/// Qwen TTS 连接实例
pub struct QwenTtsConnection {
    ws: Option<WebSocketStream<MaybeTlsStream<TcpStream>>>,
    state: ConnectionState,
    config: QwenTtsConfig,
}

impl QwenTtsConnection {
    fn build_params(&self) -> TtsRunTaskParams {
        let vol = (self.config.volume * 100.0) as u32;
        TtsRunTaskParams {
            model: self.config.model.clone(),
            voice: self.config.voice.as_str().to_string(),
            format: self.config.format.clone(),
            sample_rate: self.config.sample_rate,
            volume: Some(vol),
            rate: Some(self.config.speed),
            pitch: Some(self.config.pitch),
        }
    }
}

#[cfg(test)]
impl QwenTtsConnection {
    pub(crate) fn new_for_test(state: ConnectionState) -> Self {
        Self {
            ws: None,
            state,
            config: QwenTtsConfig {
                model: String::new(),
                voice: VoiceId::new(""),
                format: String::new(),
                sample_rate: None,
                speed: 1.0,
                volume: 1.0,
                pitch: 1.0,
            },
        }
    }
}

#[async_trait]
#[allow(clippy::result_large_err)]
impl TtsConnection for QwenTtsConnection {
    fn state(&self) -> ConnectionState {
        self.state
    }

    async fn synthesize(&mut self, text: String) -> Result<TtsResponse, TtsError> {
        if self.state != ConnectionState::Connected {
            return Err(TtsError::ConnectionClosed);
        }

        let task_id = uuid::Uuid::new_v4().to_string();
        let params = self.build_params();
        let conn_config = self.config.clone();

        let ws = self.ws.as_mut().ok_or(TtsError::ConnectionClosed)?;

        // 1. run-task
        let run_msg = dashscope::create_run_task_message(&task_id, &params);
        ws.send(Message::Text(run_msg)).await?;

        // 2. wait task-started
        wait_for_task_started(ws).await?;

        // 3. continue-task
        let continue_msg = dashscope::create_continue_task_message(&task_id, &text);
        ws.send(Message::Text(continue_msg)).await?;

        // 4. finish-task
        let finish_msg = dashscope::create_finish_task_message(&task_id);
        ws.send(Message::Text(finish_msg)).await?;

        // 5. collect audio
        let audio_chunks = collect_audio_data(ws).await?;

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
            format: conn_config.format,
            duration: None,
        })
    }

    async fn speak_stream(&mut self, input: TextStream) -> Result<TtsAudioStream, TtsError> {
        if self.state != ConnectionState::Connected {
            return Err(TtsError::ConnectionClosed);
        }
        let ws = self.ws.take().ok_or(TtsError::ConnectionClosed)?;
        self.state = ConnectionState::Closed;

        let params = self.build_params();
        let stream = run_tts_stream(ws, input, &params, &self.config).await?;
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
        let provider = QwenTts::new(QwenTtsOption {
            base: BaseTtsOption {
                api_key: Some("test-key".into()),
                ..Default::default()
            },
            ..Default::default()
        });
        assert_eq!(provider.name(), "qwen");
        assert_eq!(provider.base_url, QWEN_DEFAULT_BASE_URL);
        assert_eq!(provider.model, QWEN_DEFAULT_MODEL);
        assert_eq!(provider.voice, QWEN_DEFAULT_VOICE);
        assert_eq!(provider.format, "mp3");
        assert_eq!(provider.speed, 1.0);
        assert_eq!(provider.volume, 1.0);
        assert_eq!(provider.pitch, 1.0);
    }

    #[test]
    fn test_c2_custom_options() {
        let provider = QwenTts::new(QwenTtsOption {
            base: BaseTtsOption {
                api_key: Some("custom-key".into()),
                base_url: Some("wss://custom-host/".into()),
                model: Some("cosyvoice-v2".into()),
                voice: Some("custom_voice".into()),
                speed: Some(1.5),
                volume: Some(0.8),
                pitch: Some(1.2),
                format: Some("wav".into()),
                language: Some("en-US".into()),
            },
            sample_rate: Some(24000),
            instruction: Some("speak softly".into()),
        });
        assert_eq!(provider.api_key, "custom-key");
        assert_eq!(provider.base_url, "wss://custom-host/");
        assert_eq!(provider.model, "cosyvoice-v2");
        assert_eq!(provider.voice, "custom_voice");
        assert_eq!(provider.format, "wav");
        assert_eq!(provider.sample_rate, Some(24000));
        assert_eq!(provider.speed, 1.5);
        assert_eq!(provider.volume, 0.8);
        assert_eq!(provider.pitch, 1.2);
        assert_eq!(provider._instruction, Some("speak softly".into()));
    }

    #[test]
    fn test_c3_api_key_from_base() {
        let provider = QwenTts::new(QwenTtsOption {
            base: BaseTtsOption {
                api_key: Some("the-key".into()),
                ..Default::default()
            },
            ..Default::default()
        });
        assert_eq!(provider.api_key, "the-key");

        let provider = QwenTts::new(QwenTtsOption {
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
        let provider = QwenTts::new(QwenTtsOption {
            base: BaseTtsOption {
                api_key: Some("k".into()),
                model: Some("custom-model".into()),
                ..Default::default()
            },
            ..Default::default()
        });
        assert_eq!(provider.model, "custom-model");

        let provider = QwenTts::new(QwenTtsOption {
            base: BaseTtsOption {
                api_key: Some("k".into()),
                model: None,
                ..Default::default()
            },
            ..Default::default()
        });
        assert_eq!(provider.model, QWEN_DEFAULT_MODEL);
    }

    #[test]
    fn test_c5_voice_default() {
        let provider = QwenTts::new(QwenTtsOption {
            base: BaseTtsOption {
                api_key: Some("k".into()),
                voice: None,
                ..Default::default()
            },
            ..Default::default()
        });
        assert_eq!(provider.voice, QWEN_DEFAULT_VOICE);
    }

    #[test]
    fn test_c6_format_default() {
        let provider = QwenTts::new(QwenTtsOption {
            base: BaseTtsOption {
                api_key: Some("k".into()),
                format: None,
                ..Default::default()
            },
            ..Default::default()
        });
        assert_eq!(provider.format, "mp3");
    }

    #[test]
    fn test_c7_sample_rate_custom() {
        let provider = QwenTts::new(QwenTtsOption {
            base: BaseTtsOption {
                api_key: Some("k".into()),
                ..Default::default()
            },
            sample_rate: Some(24000),
            instruction: None,
        });
        assert_eq!(provider.sample_rate, Some(24000));
    }

    // -------- 2.2 WebSocket 请求头 --------

    #[test]
    fn test_h1_ws_request_headers() {
        let provider = QwenTts::new(QwenTtsOption {
            base: BaseTtsOption {
                api_key: Some("test-key".into()),
                ..Default::default()
            },
            ..Default::default()
        });
        let request = provider.build_ws_request().unwrap();
        assert_eq!(request.method(), "GET");
        assert_eq!(
            request
                .headers()
                .get("Authorization")
                .unwrap()
                .to_str()
                .unwrap(),
            "Bearer test-key"
        );
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
        let provider = QwenTts {
            api_key: "k".into(),
            base_url: "not a valid url".into(),
            model: String::new(),
            voice: VoiceId::new(""),
            format: String::new(),
            sample_rate: None,
            speed: 1.0,
            volume: 1.0,
            pitch: 1.0,
            _instruction: None,
        };
        let result = provider.build_ws_request();
        assert!(result.is_err());
    }

    #[test]
    fn test_h3_ws_request_uri_trailing_slash() {
        let provider = QwenTts {
            api_key: "k".into(),
            base_url: "wss://dashscope.aliyuncs.com/api-ws/v1/inference/".into(),
            model: String::new(),
            voice: VoiceId::new(""),
            format: String::new(),
            sample_rate: None,
            speed: 1.0,
            volume: 1.0,
            pitch: 1.0,
            _instruction: None,
        };
        let request = provider.build_ws_request().unwrap();
        assert_eq!(request.uri().path(), "/api-ws/v1/inference/");
    }

    #[test]
    fn test_h4_ws_request_with_port() {
        let provider = QwenTts {
            api_key: "k".into(),
            base_url: "wss://host:8443/path".into(),
            model: String::new(),
            voice: VoiceId::new(""),
            format: String::new(),
            sample_rate: None,
            speed: 1.0,
            volume: 1.0,
            pitch: 1.0,
            _instruction: None,
        };
        let request = provider.build_ws_request().unwrap();
        assert_eq!(
            request.headers().get("Host").unwrap().to_str().unwrap(),
            "host:8443"
        );
        assert_eq!(request.uri().path(), "/path");
    }

    #[test]
    fn test_h5_ws_request_with_query() {
        let provider = QwenTts {
            api_key: "k".into(),
            base_url: "wss://host/path?version=2".into(),
            model: String::new(),
            voice: VoiceId::new(""),
            format: String::new(),
            sample_rate: None,
            speed: 1.0,
            volume: 1.0,
            pitch: 1.0,
            _instruction: None,
        };
        let request = provider.build_ws_request().unwrap();
        assert_eq!(
            request.uri().path_and_query().unwrap().as_str(),
            "/path?version=2"
        );
    }

    // -------- 2.3 参数验证 --------

    #[test]
    fn test_v1_empty_api_key() {
        let provider = QwenTts::new(QwenTtsOption {
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
        let provider = QwenTts::new(QwenTtsOption {
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
        let provider = QwenTts::new(QwenTtsOption {
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

    // -------- 2.4 Connection 状态机 --------

    #[test]
    fn test_s1_connection_state_initial() {
        let conn = QwenTtsConnection::new_for_test(ConnectionState::Connected);
        assert_eq!(conn.state(), ConnectionState::Connected);
    }

    #[tokio::test]
    async fn test_s2_close_transition() {
        let mut conn = QwenTtsConnection::new_for_test(ConnectionState::Connected);
        conn.close().await.unwrap();
        assert_eq!(conn.state(), ConnectionState::Closed);
    }

    #[tokio::test]
    async fn test_s3_close_idempotent() {
        let mut conn = QwenTtsConnection::new_for_test(ConnectionState::Connected);
        conn.close().await.unwrap();
        conn.close().await.unwrap();
        assert_eq!(conn.state(), ConnectionState::Closed);
    }

    #[tokio::test]
    async fn test_s4_synthesize_after_close() {
        let mut conn = QwenTtsConnection::new_for_test(ConnectionState::Connected);
        conn.close().await.unwrap();
        let result = conn.synthesize("text".into()).await;
        assert!(matches!(result, Err(TtsError::ConnectionClosed)));
    }

    #[tokio::test]
    async fn test_s5_speak_stream_after_close() {
        let mut conn = QwenTtsConnection::new_for_test(ConnectionState::Connected);
        conn.close().await.unwrap();
        let input: TextStream = Box::pin(futures_util::stream::empty());
        let result = conn.speak_stream(input).await;
        assert!(matches!(result, Err(TtsError::ConnectionClosed)));
    }

    #[tokio::test]
    async fn test_s6_synthesize_with_ws_none() {
        let mut conn = QwenTtsConnection::new_for_test(ConnectionState::Connected);
        let result = conn.synthesize("text".into()).await;
        assert!(matches!(result, Err(TtsError::ConnectionClosed)));
    }

    // -------- 2.5 volume 值域映射 --------

    #[test]
    fn test_m1_volume_default() {
        let provider = QwenTts::new(QwenTtsOption {
            base: BaseTtsOption {
                api_key: Some("k".into()),
                volume: None,
                ..Default::default()
            },
            ..Default::default()
        });
        assert_eq!(provider.volume, 1.0);
        let params = provider.build_run_params();
        assert_eq!(params.volume, Some(100));
    }

    #[test]
    fn test_m2_volume_zero() {
        let provider = QwenTts::new(QwenTtsOption {
            base: BaseTtsOption {
                api_key: Some("k".into()),
                volume: Some(0.0),
                ..Default::default()
            },
            ..Default::default()
        });
        assert_eq!(provider.volume, 0.0);
        let params = provider.build_run_params();
        assert_eq!(params.volume, Some(0));
    }

    #[test]
    fn test_m3_volume_max() {
        let provider = QwenTts::new(QwenTtsOption {
            base: BaseTtsOption {
                api_key: Some("k".into()),
                volume: Some(1.0),
                ..Default::default()
            },
            ..Default::default()
        });
        assert_eq!(provider.volume, 1.0);
        let params = provider.build_run_params();
        assert_eq!(params.volume, Some(100));
    }

    #[test]
    fn test_m4_volume_mid() {
        let provider = QwenTts::new(QwenTtsOption {
            base: BaseTtsOption {
                api_key: Some("k".into()),
                volume: Some(0.5),
                ..Default::default()
            },
            ..Default::default()
        });
        let params = provider.build_run_params();
        assert_eq!(params.volume, Some(50));
    }

    // -------- 2.6 list_voices --------

    #[test]
    fn test_l1_list_voices_not_empty() {
        let provider = QwenTts::new(QwenTtsOption {
            base: BaseTtsOption {
                api_key: Some("k".into()),
                ..Default::default()
            },
            ..Default::default()
        });
        let rt = tokio::runtime::Runtime::new().unwrap();
        let voices = rt.block_on(provider.list_voices()).unwrap();
        assert!(!voices.is_empty(), "Qwen list_voices should not be empty");
    }
}
