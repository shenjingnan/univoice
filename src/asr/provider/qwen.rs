use std::collections::HashMap;
use std::pin::Pin;
use std::time::Duration;

use async_trait::async_trait;
use futures_util::{Sink, SinkExt, Stream, StreamExt};
use tokio::net::TcpStream;
use tokio_tungstenite::tungstenite::{self, Message, http};
use tokio_tungstenite::{MaybeTlsStream, WebSocketStream, connect_async};

use crate::asr::error::AsrError;
use crate::asr::protocol::dashscope::{
    self, RunTaskHeader, RunTaskMessage, RunTaskParameters, RunTaskPayload, ServerEvent,
};
use crate::asr::traits::{AsrConnectOption, AsrConnection, AsrProvider, ConnectionState};
use crate::asr::types::{
    AsrResponse, AsrSegment, AsrStreamChunk, AudioContainerFormat, AudioStream, BaseProviderOption,
};

// ============================== 常量 ==============================

/// Qwen（DashScope）默认 WebSocket 地址
pub const QWEN_DEFAULT_BASE_URL: &str = "wss://dashscope.aliyuncs.com/api-ws/v1/inference/";
/// Qwen（DashScope）默认模型
pub const QWEN_DEFAULT_MODEL: &str = "paraformer-realtime-v2";
/// Qwen 音频分块大小（4KB，对齐 TS 实现）
pub const QWEN_CHUNK_SIZE: usize = 4096;

/// 连接超时（测试环境下用 1s 避免 CI 等待过久）
#[cfg(not(test))]
const CONNECT_TIMEOUT: Duration = Duration::from_secs(10);
#[cfg(test)]
const CONNECT_TIMEOUT: Duration = Duration::from_secs(1);

// ============================== 内部类型 ==============================

/// 内部 channel 消息类型
enum QueueItem {
    Chunk(AsrStreamChunk),
    Complete,
}

// ============================== QwenAsrOption ==============================

/// Qwen ASR 专属配置
#[derive(Debug, Clone, Default)]
pub struct QwenAsrOption {
    pub base: BaseProviderOption,
    pub sample_rate: Option<u32>,
    pub enable_words: Option<bool>,
    pub enable_punctuation_prediction: Option<bool>,
    pub enable_inverse_text_normalization: Option<bool>,
}

// ============================== QwenAsr ==============================

/// Qwen ASR Provider
pub struct QwenAsr {
    api_key: String,
    base_url: String,
    model: String,
    format: AudioContainerFormat,
    sample_rate: Option<u32>,
    language: Option<String>,
    enable_words: Option<bool>,
    enable_punctuation_prediction: Option<bool>,
    enable_inverse_text_normalization: Option<bool>,
}

impl QwenAsr {
    pub fn new(options: QwenAsrOption) -> Self {
        let base = &options.base;
        let format = base.format.unwrap_or(AudioContainerFormat::Mp3);
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
            format,
            sample_rate: options.sample_rate,
            language: base.language.clone(),
            enable_words: options.enable_words,
            enable_punctuation_prediction: options.enable_punctuation_prediction,
            enable_inverse_text_normalization: options.enable_inverse_text_normalization,
        }
    }

    /// 构建 WebSocket 认证头
    #[allow(dead_code)]
    fn build_auth_headers(&self) -> Vec<(String, String)> {
        vec![("Authorization".into(), format!("Bearer {}", self.api_key))]
    }

    /// 生成 language_hints（zh-CN → ["zh"], en-US → ["en"]）
    #[allow(dead_code)]
    fn get_language_hints(&self) -> Option<Vec<String>> {
        Self::get_language_hints_static(&self.language)
    }

    /// 验证必要参数
    fn ensure_valid(&self) -> Result<(), AsrError> {
        if self.api_key.is_empty() {
            return Err(AsrError::InvalidParameter(
                "apiKey is required for Qwen ASR".into(),
            ));
        }
        Ok(())
    }

    /// 构建带认证头的 WS 请求
    fn build_ws_request(&self) -> Result<http::Request<()>, AsrError> {
        let parsed_url: http::Uri = self.base_url.parse().map_err(|e: http::uri::InvalidUri| {
            AsrError::Other(format!("Invalid WebSocket URL: {}", e))
        })?;

        let host = parsed_url.host().unwrap_or("").to_string();

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
            .map_err(|e| AsrError::Other(format!("HTTP request build error: {}", e)))
    }

    /// 语言映射工具（关联函数版本，供 run_recognition_on_ws 使用）
    fn get_language_hints_static(language: &Option<String>) -> Option<Vec<String>> {
        let lang = language.as_ref()?;
        let hint = match lang.as_str() {
            "zh-CN" | "zh-TW" | "zh-HK" => "zh",
            "en-US" | "en-GB" => "en",
            "ja-JP" => "ja",
            "ko-KR" => "ko",
            "de-DE" => "de",
            "fr-FR" => "fr",
            "es-ES" => "es",
            "ru-RU" => "ru",
            "pt-BR" => "pt",
            "it-IT" => "it",
            "nl-NL" => "nl",
            "pl-PL" => "pl",
            "tr-TR" => "tr",
            "vi-VN" => "vi",
            "th-TH" => "th",
            "ar-SA" => "ar",
            _ => lang.split('-').next()?,
        };
        Some(vec![hint.to_string()])
    }

    /// 在已连接的 WebSocket 上执行完整 run-task → finish-task 周期
    #[allow(clippy::too_many_arguments)]
    pub(crate) async fn run_recognition_on_ws(
        ws_stream: WebSocketStream<MaybeTlsStream<TcpStream>>,
        audio: AudioStream,
        model: String,
        format: AudioContainerFormat,
        sample_rate: Option<u32>,
        language: Option<String>,
        enable_words: Option<bool>,
        enable_punctuation_prediction: Option<bool>,
        enable_inverse_text_normalization: Option<bool>,
    ) -> Result<Pin<Box<dyn Stream<Item = Result<AsrStreamChunk, AsrError>> + Send>>, AsrError>
    {
        let (mut write, mut read) = ws_stream.split();

        // 1. 构建并发送 run-task
        let task_id = uuid::Uuid::new_v4().to_string();
        let run_task_msg = RunTaskMessage {
            header: RunTaskHeader {
                task_id: task_id.clone(),
                action: "run-task",
                streaming: "duplex",
            },
            payload: RunTaskPayload {
                task_group: "audio",
                task: "asr",
                function: "recognition",
                model: model.clone(),
                parameters: RunTaskParameters {
                    format: format.as_str().to_string(),
                    sample_rate,
                    language_hints: Self::get_language_hints_static(&language),
                    enable_words,
                    enable_punctuation_prediction,
                    enable_inverse_text_normalization,
                },
                input: HashMap::new(),
            },
        };
        let json = serde_json::to_string(&run_task_msg)?;
        write.send(Message::Text(json)).await?;

        // 2. 手动读取第一个消息，验证 task-started
        match read.next().await {
            Some(Ok(Message::Text(data))) => {
                let event = dashscope::parse_server_response(&data)?;
                match event {
                    ServerEvent::TaskStarted => { /* 继续 */ }
                    ServerEvent::TaskFailed { code, message } => {
                        return Err(AsrError::AsrServiceError {
                            code: code.parse().unwrap_or(-1),
                            message,
                        });
                    }
                    _ => {
                        return Err(AsrError::Other(format!(
                            "Unexpected event after run-task: expected task-started, got {:?}",
                            event
                        )));
                    }
                }
            }
            Some(Ok(other)) => {
                return Err(AsrError::Other(format!(
                    "Unexpected message type after run-task: {:?}",
                    other
                )));
            }
            Some(Err(e)) => return Err(AsrError::Websocket(e)),
            None => {
                return Err(AsrError::Other(
                    "Connection closed before task-started".into(),
                ));
            }
        }

        // 3. 创建 channel
        let (tx, mut rx) = tokio::sync::mpsc::channel::<QueueItem>(32);

        // 4. spawn 接收任务
        let recv_handle: tokio::task::JoinHandle<Result<(), AsrError>> =
            tokio::spawn(async move { receive_results(read, tx).await });

        // 5. spawn 发送任务（task_id move 进闭包）
        let send_handle: tokio::task::JoinHandle<Result<(), AsrError>> =
            tokio::spawn(async move { send_audio_task(write, audio, task_id).await });

        // 6. 构造输出流
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

        Ok(Box::pin(stream))
    }
}

// ============================== 发送任务 ==============================

/// 遍历音频流发送 Binary 帧，完成后发送 finish-task
async fn send_audio_task(
    mut write: impl Sink<Message, Error = tungstenite::Error> + Unpin,
    audio: AudioStream,
    task_id: String,
) -> Result<(), AsrError> {
    tokio::pin!(audio);

    while let Some(chunk) = audio.next().await {
        write.send(Message::Binary(chunk)).await?;
    }

    let finish_msg = dashscope::create_finish_task_message(&task_id);
    write.send(Message::Text(finish_msg)).await?;

    Ok(())
}

// ============================== 接收任务 ==============================

/// 接收 WebSocket Text 消息，解析为 ServerEvent，通过 channel 发送 chunk
async fn receive_results(
    mut read: impl Stream<Item = Result<Message, tungstenite::Error>> + Unpin,
    tx: tokio::sync::mpsc::Sender<QueueItem>,
) -> Result<(), AsrError> {
    while let Some(msg) = read.next().await {
        match msg? {
            Message::Text(data) => {
                let event = dashscope::parse_server_response(&data)?;
                match event {
                    ServerEvent::ResultGenerated(sentence) => {
                        let is_final = sentence.sentence_end.unwrap_or(false);
                        let segment =
                            sentence
                                .start_time
                                .zip(sentence.end_time)
                                .map(|(start, end)| AsrSegment {
                                    id: 0,
                                    start,
                                    end,
                                    text: sentence.text.clone(),
                                    speaker: None,
                                    confidence: sentence.confidence,
                                });
                        let chunk = AsrStreamChunk {
                            text: sentence.text,
                            is_final,
                            confidence: sentence.confidence,
                            segment,
                        };
                        if tx.send(QueueItem::Chunk(chunk)).await.is_err() {
                            return Ok(()); // channel closed
                        }
                    }
                    ServerEvent::TaskFinished(sentence) => {
                        if let Some(s) = sentence {
                            let segment =
                                s.start_time.zip(s.end_time).map(|(start, end)| AsrSegment {
                                    id: 0,
                                    start,
                                    end,
                                    text: s.text.clone(),
                                    speaker: None,
                                    confidence: s.confidence,
                                });
                            let chunk = AsrStreamChunk {
                                text: s.text,
                                is_final: true,
                                confidence: s.confidence,
                                segment,
                            };
                            let _ = tx.send(QueueItem::Chunk(chunk)).await;
                        }
                        let _ = tx.send(QueueItem::Complete).await;
                        return Ok(());
                    }
                    ServerEvent::TaskFailed { code, message } => {
                        return Err(AsrError::AsrServiceError {
                            code: code.parse().unwrap_or(-1),
                            message,
                        });
                    }
                    _ => { /* ignore TaskStarted, Unexpected */ }
                }
            }
            Message::Close(_) => {
                let _ = tx.send(QueueItem::Complete).await;
                return Ok(());
            }
            // tungstenite 自动回复 Ping; Pong/Frame 安全忽略
            Message::Ping(_) | Message::Pong(_) | Message::Frame(_) => {}
            // 服务器不应发送 Binary 帧
            Message::Binary(_) => {}
        }
    }
    // WebSocket 流结束（服务端已关闭连接）
    let _ = tx.send(QueueItem::Complete).await;
    Ok(())
}

// ============================== AsrProvider 实现 ==============================

#[async_trait]
#[allow(clippy::result_large_err)]
impl AsrProvider for QwenAsr {
    fn name(&self) -> &'static str {
        "qwen"
    }

    async fn listen_stream(
        &self,
        audio: AudioStream,
    ) -> Result<Pin<Box<dyn Stream<Item = Result<AsrStreamChunk, AsrError>> + Send>>, AsrError>
    {
        self.ensure_valid()?;

        let request = self.build_ws_request()?;

        let (ws_stream, _) = tokio::time::timeout(CONNECT_TIMEOUT, connect_async(request))
            .await
            .map_err(|_| AsrError::Timeout(CONNECT_TIMEOUT.as_millis() as u64))??;

        let stream = Self::run_recognition_on_ws(
            ws_stream,
            audio,
            self.model.clone(),
            self.format,
            self.sample_rate,
            self.language.clone(),
            self.enable_words,
            self.enable_punctuation_prediction,
            self.enable_inverse_text_normalization,
        )
        .await?;

        Ok(stream)
    }

    async fn connect(&self, options: AsrConnectOption) -> Result<Box<dyn AsrConnection>, AsrError> {
        self.ensure_valid()?;

        let request = self.build_ws_request()?;

        let (ws_stream, _) = tokio::time::timeout(options.timeout, connect_async(request))
            .await
            .map_err(|_| AsrError::Timeout(options.timeout.as_millis() as u64))??;

        Ok(Box::new(QwenAsrConnection {
            ws: Some(ws_stream),
            state: ConnectionState::Connected,
            model: self.model.clone(),
            format: self.format,
            sample_rate: self.sample_rate,
            language: self.language.clone(),
            enable_words: self.enable_words,
            enable_punctuation_prediction: self.enable_punctuation_prediction,
            enable_inverse_text_normalization: self.enable_inverse_text_normalization,
        }))
    }
}

// ============================== QwenAsrConnection ==============================

pub struct QwenAsrConnection {
    ws: Option<WebSocketStream<MaybeTlsStream<TcpStream>>>,
    state: ConnectionState,
    model: String,
    format: AudioContainerFormat,
    sample_rate: Option<u32>,
    language: Option<String>,
    enable_words: Option<bool>,
    enable_punctuation_prediction: Option<bool>,
    enable_inverse_text_normalization: Option<bool>,
}

#[cfg(test)]
impl QwenAsrConnection {
    pub(crate) fn new_for_test(state: ConnectionState) -> Self {
        Self {
            ws: None,
            state,
            model: String::new(),
            format: AudioContainerFormat::Mp3,
            sample_rate: None,
            language: None,
            enable_words: None,
            enable_punctuation_prediction: None,
            enable_inverse_text_normalization: None,
        }
    }
}

#[async_trait]
#[allow(clippy::result_large_err)]
impl AsrConnection for QwenAsrConnection {
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

        let ws = self.ws.take().ok_or(AsrError::ConnectionClosed)?;
        self.state = ConnectionState::Closed;

        let stream = QwenAsr::run_recognition_on_ws(
            ws,
            audio,
            self.model.clone(),
            self.format,
            self.sample_rate,
            self.language.clone(),
            self.enable_words,
            self.enable_punctuation_prediction,
            self.enable_inverse_text_normalization,
        )
        .await?;

        Ok(stream)
    }

    async fn listen(&mut self, audio: AudioStream) -> Result<AsrResponse, AsrError> {
        let mut stream = self.listen_stream(audio).await?;
        let mut text_parts: Vec<String> = Vec::new();
        let mut segments: Vec<AsrSegment> = Vec::new();

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
    use crate::asr::types::AudioStream;

    // -------- 2.1 构造/配置 --------

    #[test]
    fn test_c1_defaults() {
        let provider = QwenAsr::new(QwenAsrOption {
            base: BaseProviderOption {
                api_key: Some("test-key".into()),
                ..Default::default()
            },
            ..Default::default()
        });
        assert_eq!(provider.name(), "qwen");
        assert_eq!(provider.base_url, QWEN_DEFAULT_BASE_URL);
        assert_eq!(provider.model, QWEN_DEFAULT_MODEL);
        assert_eq!(provider.format, AudioContainerFormat::Mp3);
    }

    #[test]
    fn test_c2_custom_options() {
        let provider = QwenAsr::new(QwenAsrOption {
            base: BaseProviderOption {
                api_key: Some("custom-key".into()),
                base_url: Some("ws://localhost:8080/".into()),
                model: Some("paraformer-realtime-8k-v1".into()),
                language: Some("en-US".into()),
                format: Some(AudioContainerFormat::Wav),
                ..Default::default()
            },
            sample_rate: Some(8000),
            enable_words: Some(true),
            enable_punctuation_prediction: Some(false),
            enable_inverse_text_normalization: Some(true),
        });
        assert_eq!(provider.api_key, "custom-key");
        assert_eq!(provider.base_url, "ws://localhost:8080/");
        assert_eq!(provider.model, "paraformer-realtime-8k-v1");
        assert_eq!(provider.format, AudioContainerFormat::Wav);
        assert_eq!(provider.sample_rate, Some(8000));
        assert_eq!(provider.language, Some("en-US".into()));
        assert_eq!(provider.enable_words, Some(true));
        assert_eq!(provider.enable_punctuation_prediction, Some(false));
        assert_eq!(provider.enable_inverse_text_normalization, Some(true));
    }

    #[test]
    fn test_c3_format_default_mp3() {
        let provider = QwenAsr::new(QwenAsrOption {
            base: BaseProviderOption {
                api_key: Some("k".into()),
                format: None,
                ..Default::default()
            },
            ..Default::default()
        });
        assert_eq!(provider.format, AudioContainerFormat::Mp3);
    }

    #[test]
    fn test_c4_format_from_base() {
        let provider = QwenAsr::new(QwenAsrOption {
            base: BaseProviderOption {
                api_key: Some("k".into()),
                format: Some(AudioContainerFormat::Wav),
                ..Default::default()
            },
            ..Default::default()
        });
        assert_eq!(provider.format, AudioContainerFormat::Wav);
    }

    #[test]
    fn test_c5_api_key_from_base() {
        let provider = QwenAsr::new(QwenAsrOption {
            base: BaseProviderOption {
                api_key: Some("the-key".into()),
                ..Default::default()
            },
            ..Default::default()
        });
        assert_eq!(provider.api_key, "the-key");

        let provider = QwenAsr::new(QwenAsrOption {
            base: BaseProviderOption {
                api_key: None,
                ..Default::default()
            },
            ..Default::default()
        });
        assert_eq!(provider.api_key, "");
    }

    #[test]
    fn test_c6_model_from_base() {
        let provider = QwenAsr::new(QwenAsrOption {
            base: BaseProviderOption {
                api_key: Some("k".into()),
                model: Some("custom-model".into()),
                ..Default::default()
            },
            ..Default::default()
        });
        assert_eq!(provider.model, "custom-model");

        let provider = QwenAsr::new(QwenAsrOption {
            base: BaseProviderOption {
                api_key: Some("k".into()),
                model: None,
                ..Default::default()
            },
            ..Default::default()
        });
        assert_eq!(provider.model, QWEN_DEFAULT_MODEL);
    }

    // -------- 2.2 WebSocket 请求头构造 --------

    #[test]
    fn test_h1_ws_request_headers() {
        let provider = QwenAsr::new(QwenAsrOption {
            base: BaseProviderOption {
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
        let provider = QwenAsr {
            api_key: "k".into(),
            base_url: "not a valid url".into(),
            model: String::new(),
            format: AudioContainerFormat::Mp3,
            sample_rate: None,
            language: None,
            enable_words: None,
            enable_punctuation_prediction: None,
            enable_inverse_text_normalization: None,
        };
        let result = provider.build_ws_request();
        assert!(result.is_err());
    }

    #[test]
    fn test_h3_ws_request_uri_trailing_slash() {
        let provider = QwenAsr {
            api_key: "k".into(),
            base_url: "wss://dashscope.aliyuncs.com/api-ws/v1/inference/".into(),
            model: String::new(),
            format: AudioContainerFormat::Mp3,
            sample_rate: None,
            language: None,
            enable_words: None,
            enable_punctuation_prediction: None,
            enable_inverse_text_normalization: None,
        };
        let request = provider.build_ws_request().unwrap();
        assert_eq!(request.uri().path(), "/api-ws/v1/inference/");
    }

    // -------- 2.3 语言映射 --------

    #[test]
    fn test_l1_hints_zh_cn() {
        let hints = QwenAsr::get_language_hints_static(&Some("zh-CN".into()));
        assert_eq!(hints, Some(vec!["zh".into()]));
    }

    #[test]
    fn test_l2_hints_zh_tw() {
        let hints = QwenAsr::get_language_hints_static(&Some("zh-TW".into()));
        assert_eq!(hints, Some(vec!["zh".into()]));
    }

    #[test]
    fn test_l3_hints_zh_hk() {
        let hints = QwenAsr::get_language_hints_static(&Some("zh-HK".into()));
        assert_eq!(hints, Some(vec!["zh".into()]));
    }

    #[test]
    fn test_l4_hints_en_us() {
        let hints = QwenAsr::get_language_hints_static(&Some("en-US".into()));
        assert_eq!(hints, Some(vec!["en".into()]));
    }

    #[test]
    fn test_l5_hints_en_gb() {
        let hints = QwenAsr::get_language_hints_static(&Some("en-GB".into()));
        assert_eq!(hints, Some(vec!["en".into()]));
    }

    #[test]
    fn test_l6_hints_ja_jp() {
        let hints = QwenAsr::get_language_hints_static(&Some("ja-JP".into()));
        assert_eq!(hints, Some(vec!["ja".into()]));
    }

    #[test]
    fn test_l7_hints_ko_kr() {
        let hints = QwenAsr::get_language_hints_static(&Some("ko-KR".into()));
        assert_eq!(hints, Some(vec!["ko".into()]));
    }

    #[test]
    fn test_l8_hints_de_de() {
        let hints = QwenAsr::get_language_hints_static(&Some("de-DE".into()));
        assert_eq!(hints, Some(vec!["de".into()]));
    }

    #[test]
    fn test_l9_hints_fr_fr() {
        let hints = QwenAsr::get_language_hints_static(&Some("fr-FR".into()));
        assert_eq!(hints, Some(vec!["fr".into()]));
    }

    #[test]
    fn test_l10_hints_es_es() {
        let hints = QwenAsr::get_language_hints_static(&Some("es-ES".into()));
        assert_eq!(hints, Some(vec!["es".into()]));
    }

    #[test]
    fn test_l11_hints_ru_ru() {
        let hints = QwenAsr::get_language_hints_static(&Some("ru-RU".into()));
        assert_eq!(hints, Some(vec!["ru".into()]));
    }

    #[test]
    fn test_l12_hints_pt_br() {
        let hints = QwenAsr::get_language_hints_static(&Some("pt-BR".into()));
        assert_eq!(hints, Some(vec!["pt".into()]));
    }

    #[test]
    fn test_l13_hints_it_it() {
        let hints = QwenAsr::get_language_hints_static(&Some("it-IT".into()));
        assert_eq!(hints, Some(vec!["it".into()]));
    }

    #[test]
    fn test_l14_hints_nl_nl() {
        let hints = QwenAsr::get_language_hints_static(&Some("nl-NL".into()));
        assert_eq!(hints, Some(vec!["nl".into()]));
    }

    #[test]
    fn test_l15_hints_pl_pl() {
        let hints = QwenAsr::get_language_hints_static(&Some("pl-PL".into()));
        assert_eq!(hints, Some(vec!["pl".into()]));
    }

    #[test]
    fn test_l16_hints_tr_tr() {
        let hints = QwenAsr::get_language_hints_static(&Some("tr-TR".into()));
        assert_eq!(hints, Some(vec!["tr".into()]));
    }

    #[test]
    fn test_l17_hints_vi_vn() {
        let hints = QwenAsr::get_language_hints_static(&Some("vi-VN".into()));
        assert_eq!(hints, Some(vec!["vi".into()]));
    }

    #[test]
    fn test_l18_hints_th_th() {
        let hints = QwenAsr::get_language_hints_static(&Some("th-TH".into()));
        assert_eq!(hints, Some(vec!["th".into()]));
    }

    #[test]
    fn test_l19_hints_ar_sa() {
        let hints = QwenAsr::get_language_hints_static(&Some("ar-SA".into()));
        assert_eq!(hints, Some(vec!["ar".into()]));
    }

    #[test]
    fn test_l20_hints_unknown() {
        let hints = QwenAsr::get_language_hints_static(&Some("id-ID".into()));
        assert_eq!(hints, Some(vec!["id".into()]));
    }

    #[test]
    fn test_l21_hints_none() {
        let hints: Option<Vec<String>> = QwenAsr::get_language_hints_static(&None);
        assert_eq!(hints, None);
    }

    #[test]
    fn test_l22_hints_static() {
        // 验证实例方法与静态方法结果一致
        let provider = QwenAsr::new(QwenAsrOption {
            base: BaseProviderOption {
                api_key: Some("k".into()),
                language: Some("zh-CN".into()),
                ..Default::default()
            },
            ..Default::default()
        });
        let instance = provider.get_language_hints();
        let static_result = QwenAsr::get_language_hints_static(&Some("zh-CN".into()));
        assert_eq!(instance, static_result);
    }

    // -------- 2.4 参数验证 --------

    #[test]
    fn test_v1_empty_api_key() {
        let provider = QwenAsr::new(QwenAsrOption {
            base: BaseProviderOption {
                api_key: Some("".into()),
                ..Default::default()
            },
            ..Default::default()
        });
        let audio: AudioStream = Box::pin(futures_util::stream::empty());
        let rt = tokio::runtime::Runtime::new().unwrap();
        let result = rt.block_on(provider.listen_stream(audio));
        assert!(matches!(result, Err(AsrError::InvalidParameter(_))));
    }

    #[test]
    fn test_v2_ensure_valid_passes() {
        let provider = QwenAsr::new(QwenAsrOption {
            base: BaseProviderOption {
                api_key: Some("valid-key".into()),
                ..Default::default()
            },
            ..Default::default()
        });
        assert!(provider.ensure_valid().is_ok());
    }

    #[test]
    fn test_v3_ensure_valid_rejects() {
        let provider = QwenAsr::new(QwenAsrOption {
            base: BaseProviderOption {
                api_key: Some("".into()),
                ..Default::default()
            },
            ..Default::default()
        });
        assert!(matches!(
            provider.ensure_valid(),
            Err(AsrError::InvalidParameter(_))
        ));
    }

    // -------- 2.5 Connection 状态机 --------

    #[test]
    fn test_s1_connection_state_initial() {
        let conn = QwenAsrConnection::new_for_test(ConnectionState::Connected);
        assert_eq!(conn.state(), ConnectionState::Connected);
    }

    #[tokio::test]
    async fn test_s2_close_transition() {
        let mut conn = QwenAsrConnection::new_for_test(ConnectionState::Connected);
        conn.close().await.unwrap();
        assert_eq!(conn.state(), ConnectionState::Closed);
    }

    #[tokio::test]
    async fn test_s3_close_idempotent() {
        let mut conn = QwenAsrConnection::new_for_test(ConnectionState::Connected);
        conn.close().await.unwrap();
        conn.close().await.unwrap();
        assert_eq!(conn.state(), ConnectionState::Closed);
    }

    #[tokio::test]
    async fn test_s4_listen_after_close() {
        let mut conn = QwenAsrConnection::new_for_test(ConnectionState::Connected);
        conn.close().await.unwrap();
        let audio: AudioStream = Box::pin(futures_util::stream::empty());
        let result = conn.listen_stream(audio).await;
        assert!(matches!(result, Err(AsrError::ConnectionClosed)));
    }

    #[tokio::test]
    async fn test_s5_listen_with_ws_none() {
        let mut conn = QwenAsrConnection::new_for_test(ConnectionState::Connected);
        let audio: AudioStream = Box::pin(futures_util::stream::empty());
        let result = conn.listen_stream(audio).await;
        assert!(matches!(result, Err(AsrError::ConnectionClosed)));
    }
}
