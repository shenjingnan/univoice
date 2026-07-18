use std::pin::Pin;
use std::time::Duration;

use async_trait::async_trait;
use futures_util::{SinkExt, StreamExt};
use tokio::net::TcpStream;
use tokio_tungstenite::tungstenite::{self, Message, http};
use tokio_tungstenite::{MaybeTlsStream, WebSocketStream, connect_async};

/// 将 URL 转换为带自定义头的 http::Request
fn url_to_ws_request(
    url: &str,
    auth_headers: &[(String, String)],
) -> Result<http::Request<()>, AsrError> {
    use http::HeaderName;
    use http::header::HeaderValue;

    let parsed_url: http::Uri = url.parse().map_err(|e: http::uri::InvalidUri| {
        AsrError::Other(format!("Invalid WebSocket URL: {}", e))
    })?;

    let host = parsed_url.host().unwrap_or("").to_string();

    let mut req_builder = http::Request::builder()
        .uri(&parsed_url)
        .method("GET")
        .header("Host", &host)
        .header("Upgrade", "websocket")
        .header("Connection", "Upgrade")
        .header(
            "Sec-WebSocket-Key",
            &tungstenite::handshake::client::generate_key(),
        )
        .header("Sec-WebSocket-Version", "13");

    for (name, value) in auth_headers {
        let header_name = HeaderName::from_bytes(name.as_bytes()).map_err(header_err_to_asr)?;
        let header_value = HeaderValue::from_str(value).map_err(header_err_to_asr)?;
        req_builder = req_builder.header(header_name, header_value);
    }

    req_builder
        .body(())
        .map_err(|e| AsrError::Other(format!("HTTP request build error: {}", e)))
}

use crate::asr::error::AsrError;
use crate::asr::protocol::sauc::{
    SaucAudioConfig, SaucFullClientRequest, SaucRequestConfig, SaucUser, build_auth_headers,
    encode_audio_request, encode_full_client_request, get_error_message, parse_response,
};

/// 将 HeaderName/HeaderValue 错误转为 AsrError
fn header_err_to_asr<E: std::fmt::Display>(e: E) -> AsrError {
    AsrError::Other(format!("HTTP header error: {}", e))
}
use crate::asr::traits::{AsrConnectOption, AsrConnection, AsrProvider, ConnectionState};
use crate::asr::types::{
    AsrResponse, AsrSegment, AsrStreamChunk, AudioCodecFormat, AudioContainerFormat, AudioStream,
    BaseProviderOption, DEFAULT_BASE_URL, DEFAULT_RESOURCE_ID, DEFAULT_SAMPLE_RATE,
};

// ============================== DoubaoAsrMode ==============================

/// Doubao ASR 工作模式
#[derive(Debug, Default, Clone, Copy, PartialEq, Eq)]
pub enum DoubaoAsrMode {
    #[default]
    Streaming,
    NoStream,
    Async,
}

// ============================== DoubaoAsrOption ==============================

/// Doubao ASR 专属配置
#[derive(Debug, Clone)]
pub struct DoubaoAsrOption {
    pub base: BaseProviderOption,
    pub app_key: Option<String>,
    pub access_key: Option<String>,
    pub resource_id: Option<String>,
    pub mode: DoubaoAsrMode,
    pub sample_rate: u32,
    pub bits: u8,
    pub channel: u8,
    pub segment_duration: u32,
    pub enable_itn: bool,
    pub enable_punc: bool,
    pub enable_ddc: bool,
    pub show_utterances: bool,
    pub end_window_size: Option<u32>,
    pub enable_nonstream: Option<bool>,
    pub vad_segment_duration: Option<u32>,
    pub force_to_speech_time: Option<u32>,
}

#[allow(clippy::derivable_impls)]
impl Default for DoubaoAsrOption {
    fn default() -> Self {
        Self {
            base: BaseProviderOption::default(),
            app_key: None,
            access_key: None,
            resource_id: None,
            mode: DoubaoAsrMode::default(),
            sample_rate: DEFAULT_SAMPLE_RATE,
            bits: 16,
            channel: 1,
            segment_duration: 200,
            enable_itn: true,
            enable_punc: true,
            enable_ddc: false,
            show_utterances: true,
            end_window_size: None,
            enable_nonstream: None,
            vad_segment_duration: None,
            force_to_speech_time: None,
        }
    }
}

// ============================== 队列消息类型 ==============================

enum QueueItem {
    Chunk(AsrStreamChunk),
    Complete,
}

// ============================== DoubaoAsr ==============================

/// Doubao ASR Provider
pub struct DoubaoAsr {
    app_key: String,
    access_key: String,
    resource_id: String,
    mode: DoubaoAsrMode,
    base_url: String,
    sample_rate: u32,
    bits: u8,
    channel: u8,
    language: String,
    format: AudioContainerFormat,
    codec: AudioCodecFormat,
    enable_itn: bool,
    enable_punc: bool,
    enable_ddc: bool,
    show_utterances: bool,
    end_window_size: Option<u32>,
    enable_nonstream: Option<bool>,
    vad_segment_duration: Option<u32>,
    force_to_speech_time: Option<u32>,
}

impl DoubaoAsr {
    pub fn new(options: DoubaoAsrOption) -> Self {
        let base = &options.base;
        Self {
            app_key: options.app_key.unwrap_or_default(),
            access_key: options
                .access_key
                .or_else(|| base.api_key.clone())
                .unwrap_or_default(),
            resource_id: options
                .resource_id
                .unwrap_or_else(|| DEFAULT_RESOURCE_ID.into()),
            mode: options.mode,
            base_url: base
                .base_url
                .clone()
                .unwrap_or_else(|| DEFAULT_BASE_URL.into()),
            sample_rate: options.sample_rate,
            bits: options.bits,
            channel: options.channel,
            language: base.language.clone().unwrap_or_else(|| "zh-CN".into()),
            format: base.format.unwrap_or(AudioContainerFormat::Pcm),
            codec: base.codec.unwrap_or(AudioCodecFormat::Raw),
            enable_itn: options.enable_itn,
            enable_punc: options.enable_punc,
            enable_ddc: options.enable_ddc,
            show_utterances: options.show_utterances,
            end_window_size: options.end_window_size,
            enable_nonstream: options.enable_nonstream,
            vad_segment_duration: options.vad_segment_duration,
            force_to_speech_time: options.force_to_speech_time,
        }
    }

    fn get_websocket_url(&self) -> String {
        match self.mode {
            DoubaoAsrMode::Streaming => format!("{}/bigmodel", self.base_url),
            DoubaoAsrMode::Async => format!("{}/bigmodel_async", self.base_url),
            DoubaoAsrMode::NoStream => format!("{}/bigmodel_nostream", self.base_url),
        }
    }

    fn build_full_client_request_params(&self) -> SaucFullClientRequest {
        SaucFullClientRequest {
            user: Some(SaucUser {
                uid: Some("univoice-sdk".into()),
            }),
            audio: SaucAudioConfig {
                format: self.format.as_str().to_string(),
                codec: Some(self.codec.as_str().to_string()),
                rate: Some(self.sample_rate),
                bits: Some(self.bits),
                channel: Some(self.channel),
                language: Some(self.language.clone()),
            },
            request: SaucRequestConfig {
                model_name: "bigmodel".into(),
                enable_itn: Some(self.enable_itn),
                enable_punc: Some(self.enable_punc),
                enable_ddc: Some(self.enable_ddc),
                show_utterances: Some(self.show_utterances),
                end_window_size: self.end_window_size,
                enable_nonstream: self.enable_nonstream,
                vad_segment_duration: self.vad_segment_duration,
                force_to_speech_time: self.force_to_speech_time,
            },
        }
    }

    /// 内部：发送音频流
    async fn send_audio_stream_internal<S>(
        write: &mut S,
        audio: AudioStream,
        mut sequence: i32,
    ) -> Result<i32, AsrError>
    where
        S: futures_util::Sink<Message> + Unpin,
        S::Error: Into<AsrError>,
    {
        tokio::pin!(audio);

        while let Some(chunk) = audio.next().await {
            let frame = encode_audio_request(sequence, &chunk, false)?;
            write
                .send(Message::Binary(frame))
                .await
                .map_err(|_| AsrError::Other("send failed".into()))?;
            sequence += 1;
        }

        // 发送末帧
        let last_frame = encode_audio_request(sequence, &[], true)?;
        write
            .send(Message::Binary(last_frame))
            .await
            .map_err(|_| AsrError::Other("send last frame failed".into()))?;

        Ok(sequence)
    }

    /// 内部：接收 WebSocket 消息并分发给 channel
    async fn receive_messages_internal(
        read: &mut (
                 impl futures_util::Stream<Item = Result<Message, tokio_tungstenite::tungstenite::Error>>
                 + Unpin
             ),
        tx: tokio::sync::mpsc::Sender<QueueItem>,
    ) -> Result<(), AsrError> {
        while let Some(msg) = read.next().await {
            let msg = msg?;
            match msg {
                Message::Binary(data) => {
                    let response = parse_response(&data)?;

                    if response.code != 0 {
                        let err_msg = get_error_message(response.code);
                        return Err(AsrError::AsrServiceError {
                            code: response.code,
                            message: err_msg,
                        });
                    }

                    if let Some(ref payload) = response.payload_msg {
                        if let Some(ref result) = payload.result {
                            let chunk = AsrStreamChunk {
                                text: result.text.clone(),
                                is_final: response.is_last_package,
                                confidence: None,
                                segment: result.utterances.as_ref().and_then(|u| {
                                    u.first().map(|utt| AsrSegment {
                                        id: 0,
                                        start: utt.start_time,
                                        end: utt.end_time,
                                        text: utt.text.clone(),
                                        speaker: None,
                                        confidence: Some(if utt.definite { 1.0 } else { 0.8 }),
                                    })
                                }),
                            };
                            let _ = tx.send(QueueItem::Chunk(chunk)).await;
                        }
                    }

                    if response.is_last_package {
                        let _ = tx.send(QueueItem::Complete).await;
                        return Ok(());
                    }
                }
                Message::Close(_) => {
                    let _ = tx.send(QueueItem::Complete).await;
                    return Ok(());
                }
                _ => {}
            }
        }

        Ok(())
    }
}

use futures_util::Stream;

#[async_trait]
#[allow(clippy::result_large_err)]
impl AsrProvider for DoubaoAsr {
    fn name(&self) -> &'static str {
        "doubao"
    }

    async fn listen_stream(
        &self,
        audio: AudioStream,
    ) -> Result<Pin<Box<dyn Stream<Item = Result<AsrStreamChunk, AsrError>> + Send>>, AsrError>
    {
        if self.app_key.is_empty() {
            return Err(AsrError::InvalidParameter(
                "appKey is required for Doubao ASR".into(),
            ));
        }
        if self.access_key.is_empty() {
            return Err(AsrError::InvalidParameter(
                "accessKey is required for Doubao ASR".into(),
            ));
        }

        let url = self.get_websocket_url();
        let headers = build_auth_headers(&self.app_key, &self.access_key, &self.resource_id);
        let request = url_to_ws_request(&url, &headers)?;

        // 带超时的 WebSocket 连接
        let (ws_stream, _) = tokio::time::timeout(Duration::from_secs(10), connect_async(request))
            .await
            .map_err(|_| AsrError::Timeout(10_000))??;

        let (mut write, mut read) = ws_stream.split();

        // 发送 FullClientRequest
        let params = self.build_full_client_request_params();
        let full_request = encode_full_client_request(&params, 1, true)?;
        write.send(Message::Binary(full_request)).await?;

        // 等待初始化确认
        match read.next().await {
            Some(Ok(msg)) => {
                if let Message::Binary(data) = msg {
                    let response = parse_response(&data)?;
                    if response.code != 0 {
                        // 无法在不重组的情况下关闭，直接丢弃
                        return Err(AsrError::InitFailed(get_error_message(response.code)));
                    }
                }
            }
            Some(Err(e)) => return Err(AsrError::Websocket(e)),
            None => return Err(AsrError::Other("Connection closed during init".into())),
        }

        // 创建 channel
        let (tx, mut rx) = tokio::sync::mpsc::channel::<QueueItem>(32);

        // Spawn 发送任务
        let send_handle: tokio::task::JoinHandle<Result<i32, AsrError>> =
            tokio::spawn(async move {
                let final_seq = Self::send_audio_stream_internal(&mut write, audio, 2).await?;
                Ok(final_seq)
            });

        // Spawn 接收任务
        let recv_handle: tokio::task::JoinHandle<Result<(), AsrError>> =
            tokio::spawn(async move { Self::receive_messages_internal(&mut read, tx).await });

        // 构造流
        let stream = async_stream::stream! {
            loop {
                tokio::select! {
                    item = rx.recv() => {
                        match item {
                            Some(QueueItem::Chunk(chunk)) => yield Ok(chunk),
                            Some(QueueItem::Complete) | None => break,
                        }
                    }
                }
            }

            // 检查发送和接收任务的错误
            if let Ok(Err(e)) = send_handle.await {
                yield Err(e);
            }
            if let Ok(Err(e)) = recv_handle.await {
                yield Err(e);
            }
        };

        Ok(Box::pin(stream))
    }

    async fn connect(&self, options: AsrConnectOption) -> Result<Box<dyn AsrConnection>, AsrError> {
        if self.app_key.is_empty() {
            return Err(AsrError::InvalidParameter("appKey is required".into()));
        }
        if self.access_key.is_empty() {
            return Err(AsrError::InvalidParameter("accessKey is required".into()));
        }

        let url = self.get_websocket_url();
        let headers = build_auth_headers(&self.app_key, &self.access_key, &self.resource_id);
        let request = url_to_ws_request(&url, &headers)?;

        let (ws_stream, _) = tokio::time::timeout(options.timeout, connect_async(request))
            .await
            .map_err(|_| AsrError::Timeout(options.timeout.as_millis() as u64))??;

        let (mut write, mut read) = ws_stream.split();

        // 发送 FullClientRequest（连接级别初始化）
        let params = self.build_full_client_request_params();
        let full_request = encode_full_client_request(&params, 1, true)?;
        write.send(Message::Binary(full_request)).await?;

        // 等待初始化确认
        match read.next().await {
            Some(Ok(Message::Binary(data))) => {
                let response = parse_response(&data)?;
                if response.code != 0 {
                    return Err(AsrError::InitFailed(get_error_message(response.code)));
                }
            }
            Some(Ok(_)) => {} // 非 Binary 消息跳过
            Some(Err(e)) => return Err(AsrError::Websocket(e)),
            None => return Err(AsrError::Other("Connection closed during init".into())),
        }

        // 重组 WebSocket 存入 Connection
        let ws_stream = write
            .reunite(read)
            .map_err(|_| AsrError::Other("Failed to reunite WebSocket".into()))?;

        Ok(Box::new(DoubaoAsrConnection {
            ws: Some(ws_stream),
            seq: 2,
            state: ConnectionState::Connected,
        }))
    }
}

// ============================== DoubaoAsrConnection ==============================

pub struct DoubaoAsrConnection {
    ws: Option<WebSocketStream<MaybeTlsStream<TcpStream>>>,
    #[allow(dead_code)]
    seq: i32,
    state: ConnectionState,
}

#[cfg(test)]
impl DoubaoAsrConnection {
    pub(crate) fn new_for_test(state: ConnectionState) -> Self {
        Self {
            ws: None,
            seq: 0,
            state,
        }
    }
}

#[async_trait]
#[allow(clippy::result_large_err)]
impl AsrConnection for DoubaoAsrConnection {
    fn state(&self) -> ConnectionState {
        self.state
    }

    async fn listen_stream(
        &mut self,
        audio: AudioStream,
    ) -> Result<Pin<Box<dyn Stream<Item = Result<AsrStreamChunk, AsrError>> + Send>>, AsrError>
    {
        if self.state != ConnectionState::Connected {
            return Err(AsrError::ConnectionClosed);
        }

        // 取出 WS 的所有权（一期简化：每次 listen 消耗 WS）
        let ws = self.ws.take().ok_or(AsrError::ConnectionClosed)?;
        let (mut write, mut read) = ws.split();
        let start_seq = self.seq;

        // 创建 channel
        let (tx, mut rx) = tokio::sync::mpsc::channel::<QueueItem>(32);

        // Spawn 发送任务
        let send_handle: tokio::task::JoinHandle<Result<i32, AsrError>> =
            tokio::spawn(async move {
                let final_seq =
                    DoubaoAsr::send_audio_stream_internal(&mut write, audio, start_seq).await?;
                Ok(final_seq)
            });

        // Spawn 接收任务
        let recv_handle: tokio::task::JoinHandle<Result<(), AsrError>> =
            tokio::spawn(async move { DoubaoAsr::receive_messages_internal(&mut read, tx).await });

        // 构造流
        let stream = async_stream::stream! {
            loop {
                tokio::select! {
                    item = rx.recv() => {
                        match item {
                            Some(QueueItem::Chunk(chunk)) => yield Ok(chunk),
                            Some(QueueItem::Complete) | None => break,
                        }
                    }
                }
            }

            if let Ok(Err(e)) = send_handle.await {
                yield Err(e);
            }
            if let Ok(Err(e)) = recv_handle.await {
                yield Err(e);
            }
        };

        self.state = ConnectionState::Closed;

        Ok(Box::pin(stream))
    }

    async fn listen(&mut self, audio: AudioStream) -> Result<AsrResponse, AsrError> {
        let mut stream = self.listen_stream(audio).await?;
        let mut text_parts: Vec<String> = Vec::new();
        let mut segments: Vec<AsrSegment> = Vec::new();

        use futures_util::StreamExt;
        while let Some(result) = stream.next().await {
            match result {
                Ok(chunk) => {
                    if chunk.is_final && !chunk.text.is_empty() {
                        text_parts.push(chunk.text);
                    }
                    if let Some(seg) = chunk.segment {
                        segments.push(seg);
                    }
                }
                Err(e) => return Err(e),
            }
        }

        Ok(AsrResponse {
            text: text_parts.join(""),
            segments: if segments.is_empty() {
                None
            } else {
                Some(segments)
            },
            language: None,
            duration: None,
        })
    }

    async fn close(&mut self) -> Result<(), AsrError> {
        if let Some(ws) = self.ws.as_mut() {
            ws.close(None).await?;
        }
        self.state = ConnectionState::Closed;
        Ok(())
    }
}

// ============================== 测试 ==============================

#[cfg(test)]
mod tests {
    use super::*;
    use crate::asr::types::DEFAULT_BASE_URL;

    #[test]
    fn test_c1_constructor_defaults() {
        let provider = DoubaoAsr::new(DoubaoAsrOption {
            app_key: Some("app-key".into()),
            access_key: Some("access-key".into()),
            ..Default::default()
        });
        assert_eq!(provider.name(), "doubao");
        assert_eq!(provider.sample_rate, DEFAULT_SAMPLE_RATE);
        assert_eq!(provider.language, "zh-CN");
        assert_eq!(provider.resource_id, DEFAULT_RESOURCE_ID);
        assert_eq!(provider.bits, 16);
        assert_eq!(provider.channel, 1);
    }

    #[test]
    fn test_c2_constructor_access_key_fallback() {
        let provider = DoubaoAsr::new(DoubaoAsrOption {
            base: BaseProviderOption {
                api_key: Some("api-key-fallback".into()),
                ..Default::default()
            },
            app_key: Some("app-key".into()),
            access_key: None,
            ..Default::default()
        });
        assert_eq!(provider.access_key, "api-key-fallback");
    }

    #[test]
    fn test_c3_constructor_mode_default() {
        let provider = DoubaoAsr::new(DoubaoAsrOption {
            app_key: Some("k".into()),
            access_key: Some("k".into()),
            ..Default::default()
        });
        // 默认 mode 应为 Streaming
        assert_eq!(provider.mode as i32, DoubaoAsrMode::Streaming as i32);
    }

    #[test]
    fn test_u1_url_streaming() {
        let provider = DoubaoAsr::new(DoubaoAsrOption {
            app_key: Some("k".into()),
            access_key: Some("k".into()),
            mode: DoubaoAsrMode::Streaming,
            ..Default::default()
        });
        assert_eq!(
            provider.get_websocket_url(),
            format!("{}/bigmodel", DEFAULT_BASE_URL)
        );
    }

    #[test]
    fn test_u2_url_async() {
        let provider = DoubaoAsr::new(DoubaoAsrOption {
            app_key: Some("k".into()),
            access_key: Some("k".into()),
            mode: DoubaoAsrMode::Async,
            ..Default::default()
        });
        assert_eq!(
            provider.get_websocket_url(),
            format!("{}/bigmodel_async", DEFAULT_BASE_URL)
        );
    }

    #[test]
    fn test_u3_url_nostream() {
        let provider = DoubaoAsr::new(DoubaoAsrOption {
            app_key: Some("k".into()),
            access_key: Some("k".into()),
            mode: DoubaoAsrMode::NoStream,
            ..Default::default()
        });
        assert_eq!(
            provider.get_websocket_url(),
            format!("{}/bigmodel_nostream", DEFAULT_BASE_URL)
        );
    }

    #[test]
    fn test_u4_url_custom_base() {
        let provider = DoubaoAsr::new(DoubaoAsrOption {
            base: BaseProviderOption {
                base_url: Some("ws://localhost:8080".into()),
                ..Default::default()
            },
            app_key: Some("k".into()),
            access_key: Some("k".into()),
            mode: DoubaoAsrMode::Streaming,
            ..Default::default()
        });
        assert_eq!(provider.get_websocket_url(), "ws://localhost:8080/bigmodel");
    }

    #[test]
    fn test_r1_build_params_default() {
        let provider = DoubaoAsr::new(DoubaoAsrOption {
            app_key: Some("k".into()),
            access_key: Some("k".into()),
            ..Default::default()
        });
        let params = provider.build_full_client_request_params();
        assert_eq!(params.audio.format, "pcm");
        assert_eq!(params.audio.codec, Some("raw".into()));
        assert_eq!(params.audio.rate, Some(16000));
        assert_eq!(params.request.model_name, "bigmodel");
    }

    #[test]
    fn test_r2_build_params_ogg_opus() {
        let provider = DoubaoAsr::new(DoubaoAsrOption {
            base: BaseProviderOption {
                format: Some(AudioContainerFormat::Ogg),
                codec: Some(AudioCodecFormat::Opus),
                ..Default::default()
            },
            app_key: Some("k".into()),
            access_key: Some("k".into()),
            ..Default::default()
        });
        let params = provider.build_full_client_request_params();
        assert_eq!(params.audio.format, "ogg");
        assert_eq!(params.audio.codec, Some("opus".into()));
    }

    #[test]
    fn test_r3_build_params_with_vad() {
        let provider = DoubaoAsr::new(DoubaoAsrOption {
            base: BaseProviderOption {
                ..Default::default()
            },
            app_key: Some("k".into()),
            access_key: Some("k".into()),
            end_window_size: Some(500),
            vad_segment_duration: Some(3000),
            ..Default::default()
        });
        let params = provider.build_full_client_request_params();
        assert_eq!(params.request.end_window_size, Some(500));
        assert_eq!(params.request.vad_segment_duration, Some(3000));
    }

    #[test]
    fn test_r4_build_params_without_vad() {
        let provider = DoubaoAsr::new(DoubaoAsrOption {
            app_key: Some("k".into()),
            access_key: Some("k".into()),
            ..Default::default()
        });
        let params = provider.build_full_client_request_params();
        assert!(params.request.end_window_size.is_none());
        assert!(params.request.vad_segment_duration.is_none());
    }

    #[test]
    fn test_v1_validate_empty_app_key() {
        let provider = DoubaoAsr::new(DoubaoAsrOption {
            app_key: Some("".into()),
            access_key: Some("key".into()),
            ..Default::default()
        });
        let audio: AudioStream = Box::pin(futures_util::stream::empty());
        let rt = tokio::runtime::Runtime::new().unwrap();
        let result = rt.block_on(provider.listen_stream(audio));
        match result {
            Err(AsrError::InvalidParameter(_)) => {} // expected
            _ => panic!("Expected InvalidParameter error"),
        }
    }

    #[test]
    fn test_v2_validate_empty_access_key() {
        let provider = DoubaoAsr::new(DoubaoAsrOption {
            app_key: Some("key".into()),
            access_key: Some("".into()),
            ..Default::default()
        });
        let audio: AudioStream = Box::pin(futures_util::stream::empty());
        let rt = tokio::runtime::Runtime::new().unwrap();
        let result = rt.block_on(provider.listen_stream(audio));
        match result {
            Err(AsrError::InvalidParameter(_)) => {} // expected
            _ => panic!("Expected InvalidParameter error"),
        }
    }

    // ===== S: Connection 状态测试 =====

    #[test]
    fn test_s1_connection_state_new() {
        let conn = DoubaoAsrConnection::new_for_test(ConnectionState::Connected);
        assert_eq!(conn.state(), ConnectionState::Connected);
    }

    #[tokio::test]
    async fn test_s2_connection_close_idempotent() {
        let mut conn = DoubaoAsrConnection::new_for_test(ConnectionState::Connected);
        conn.close().await.unwrap();
        assert_eq!(conn.state(), ConnectionState::Closed);
        // 第二次 close 不 panic
        conn.close().await.unwrap();
        assert_eq!(conn.state(), ConnectionState::Closed);
    }

    #[tokio::test]
    async fn test_s3_connection_listen_after_close() {
        let mut conn = DoubaoAsrConnection::new_for_test(ConnectionState::Connected);
        conn.close().await.unwrap();
        let audio: AudioStream = Box::pin(futures_util::stream::empty());
        let result = conn.listen_stream(audio).await;
        assert!(matches!(result, Err(AsrError::ConnectionClosed)));
    }

    #[tokio::test]
    async fn test_s4_connection_close_no_ws() {
        let mut conn = DoubaoAsrConnection::new_for_test(ConnectionState::Closed);
        // ws=None 时 close 不 panic
        conn.close().await.unwrap();
        assert_eq!(conn.state(), ConnectionState::Closed);
    }
}
