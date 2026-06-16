use std::pin::Pin;

use async_stream::stream;
use async_trait::async_trait;
use base64::Engine;
use futures_util::{Stream, StreamExt};
use http::StatusCode;
use reqwest::Response;
use serde::{Deserialize, Serialize};

use crate::asr::error::AsrError;
use crate::asr::traits::AsrProvider;
use crate::asr::types::{AsrStreamChunk, AudioContainerFormat, AudioStream, BaseProviderOption};

// ============================== 常量 ==============================

/// MIMO ASR 默认 REST API 端点
const MIMO_DEFAULT_BASE_URL: &str = "https://api.xiaomimimo.com/v1/chat/completions";

/// MIMO ASR 默认模型
const MIMO_DEFAULT_MODEL: &str = "mimo-v2.5-asr";

/// 默认语言
const MIMO_DEFAULT_LANGUAGE: &str = "zh";

/// 最大音频数据大小（25 MB）
const MIMO_MAX_AUDIO_SIZE: usize = 25 * 1024 * 1024;

// ============================== 内部请求/响应数据结构 ==============================

/// Chat Completions 请求体（OpenAI 兼容格式）
#[derive(Debug, Serialize)]
struct ChatCompletionsRequest {
    model: String,
    messages: Vec<Message>,
    #[serde(rename = "asr_options")]
    asr_options: AsrOptions,
    stream: bool,
}

#[derive(Debug, Serialize)]
struct Message {
    role: String,
    content: Vec<ContentPart>,
}

#[derive(Debug, Serialize)]
struct ContentPart {
    #[serde(rename = "type")]
    type_: String,
    #[serde(rename = "input_audio")]
    input_audio: InputAudio,
}

#[derive(Debug, Serialize)]
struct InputAudio {
    data: String,
}

#[derive(Debug, Serialize)]
struct AsrOptions {
    language: String,
}

/// SSE 流式响应的 data 行（OpenAI Chat Completions chunk 格式）
#[derive(Debug, Deserialize)]
struct ChatCompletionChunk {
    choices: Vec<ChunkChoice>,
}

#[derive(Debug, Deserialize)]
struct ChunkChoice {
    delta: Delta,
    #[serde(default)]
    finish_reason: Option<String>,
}

#[derive(Debug, Deserialize)]
struct Delta {
    #[serde(default)]
    content: Option<String>,
}

/// 非流式错误响应（OpenAI 兼容格式）
/// 支持两种格式：
/// - 标准：`{"error": {"message": "..."}}`
/// - 扁平：`{"message": "..."}`
#[derive(Debug, Deserialize)]
struct MimoErrorBody {
    error: Option<MimoErrorDetail>,
    message: Option<String>,
}

#[derive(Debug, Deserialize)]
struct MimoErrorDetail {
    message: Option<String>,
}

// ============================== 配置选项 ==============================

/// MIMO ASR 专属配置
#[derive(Debug, Clone)]
pub struct MimoAsrOption {
    pub base: BaseProviderOption,
    pub language: Option<String>,
}

// ============================== Provider 结构体 ==============================

/// MIMO ASR Provider
///
/// 基于小米 MiMo OpenAI 兼容 API 实现语音识别。
/// 使用 Chat Completions 端点 + `input_audio` 消息类型，
/// 音频通过 Base64 编码嵌入请求体。
///
/// 与 Qwen/Doubao 不同，MIMO 使用 HTTP REST 而非 WebSocket，
/// 且不支持预建立连接（connect 返回 Unsupported）。
pub struct MimoAsr {
    api_key: String,
    /// 完整端点 URL 路径 — 默认: https://api.xiaomimimo.com/v1/chat/completions
    base_url: String,
    /// ASR 模型名 — 默认: mimo-v2.5-asr
    model: String,
    /// 识别语言 — 默认: "zh"
    language: String,
    /// 音频容器格式，用于决定 Data URL 中的 MIME 类型
    format: AudioContainerFormat,
}

impl MimoAsr {
    pub fn new(options: MimoAsrOption) -> Self {
        let base = &options.base;
        let format = base.format.unwrap_or(AudioContainerFormat::Wav);
        Self {
            api_key: base.api_key.clone().unwrap_or_default(),
            base_url: base
                .base_url
                .clone()
                .unwrap_or_else(|| MIMO_DEFAULT_BASE_URL.into()),
            model: base
                .model
                .clone()
                .unwrap_or_else(|| MIMO_DEFAULT_MODEL.into()),
            language: options
                .language
                .clone()
                .unwrap_or_else(|| MIMO_DEFAULT_LANGUAGE.into()),
            format,
        }
    }

    /// 验证必要参数
    fn ensure_valid(&self) -> Result<(), AsrError> {
        if self.api_key.is_empty() {
            return Err(AsrError::InvalidParameter(
                "apiKey is required for MIMO ASR".into(),
            ));
        }
        Ok(())
    }

    /// 收集音频流，每块到达时做大小检查
    async fn collect_audio_stream(
        mut audio: AudioStream,
        max_size: usize,
    ) -> Result<Vec<u8>, AsrError> {
        let mut audio_data = Vec::new();
        while let Some(chunk) = audio.next().await {
            if audio_data.len() + chunk.len() > max_size {
                return Err(AsrError::InvalidParameter(
                    "audio data exceeds max size".into(),
                ));
            }
            audio_data.extend_from_slice(&chunk);
        }
        Ok(audio_data)
    }

    /// 构造 Data URL: data:{mime};base64,{encoded_audio}
    fn build_data_url(audio_data: &[u8], format: AudioContainerFormat) -> String {
        let mime = determine_mime_type(format);
        let encoded = base64::engine::general_purpose::STANDARD.encode(audio_data);
        format!("data:{};base64,{}", mime, encoded)
    }

    /// 构造请求体
    fn build_request(&self, audio_data: Vec<u8>) -> Result<ChatCompletionsRequest, AsrError> {
        let data_url = Self::build_data_url(&audio_data, self.format);

        let request = ChatCompletionsRequest {
            model: self.model.clone(),
            messages: vec![Message {
                role: "user".into(),
                content: vec![ContentPart {
                    type_: "input_audio".into(),
                    input_audio: InputAudio { data: data_url },
                }],
            }],
            asr_options: AsrOptions {
                language: self.language.clone(),
            },
            stream: true,
        };

        Ok(request)
    }
}

// ============================== MIME 类型决定 ==============================

/// 根据音频容器格式决定 Data URL 中的 MIME 类型
fn determine_mime_type(format: AudioContainerFormat) -> &'static str {
    match format {
        AudioContainerFormat::Wav => "audio/wav",
        AudioContainerFormat::Mp3 => "audio/mpeg",
        AudioContainerFormat::Ogg => "audio/ogg",
        AudioContainerFormat::Pcm => "audio/wav",
    }
}

// ============================== SSE 解析（纯函数层） ==============================

/// 从字节缓冲中提取完整的 SSE 事件行
///
/// 返回（提取到的 data: 内容列表, 是否遇到 [DONE]）。
/// 未完成的行保留在 buffer 中供下次调用。
/// 支持三种行结束符：\n（Unix）、\r\n（Windows）、\r（旧 Mac）。
fn process_sse_buffer(buffer: &mut Vec<u8>) -> (Vec<String>, bool) {
    let mut lines = Vec::new();
    loop {
        let end_pos = buffer.iter().position(|&b| b == b'\n' || b == b'\r');
        match end_pos {
            Some(pos) => {
                // 确定行结束序列长度：\n=1, \r=1, \r\n=2
                let consume =
                    if buffer[pos] == b'\r' && pos + 1 < buffer.len() && buffer[pos + 1] == b'\n' {
                        pos + 2
                    } else {
                        pos + 1
                    };
                let tail = buffer.split_off(consume);
                let line_bytes = std::mem::replace(buffer, tail);
                let line = String::from_utf8_lossy(&line_bytes);
                let trimmed = line.trim();
                if trimmed.is_empty() {
                    continue;
                }
                if let Some(data) = trimmed.strip_prefix("data:") {
                    let data = data.trim();
                    if data == "[DONE]" {
                        return (lines, true);
                    }
                    lines.push(data.to_string());
                }
            }
            None => break,
        }
    }
    (lines, false)
}

/// 解析单行 SSE data JSON 为 AsrStreamChunk
///
/// 支持 OpenAI Chat Completions chunk 格式：
/// - delta 模式：`{"choices":[{"delta":{"content":"text"},"finish_reason":null}]}`
/// - stop 模式：`{"choices":[{"delta":{},"finish_reason":"stop"}]}`
///
/// 注意：MIMO 的 OpenAI 格式不含 confidence 和 segment 信息，
/// 返回的 chunk 中这两个字段始终为 None。
fn parse_sse_chunk(data: &str) -> Option<AsrStreamChunk> {
    let chunk: ChatCompletionChunk = serde_json::from_str(data).ok()?;
    let choice = chunk.choices.into_iter().next()?;

    let is_final = choice.finish_reason.as_deref() == Some("stop");
    let text = choice.delta.content.filter(|s| !s.is_empty())?;

    Some(AsrStreamChunk {
        text,
        is_final,
        confidence: None,
        segment: None,
    })
}

// ============================== SSE 流处理（HTTP 适配层） ==============================

/// 将 HTTP 响应体转换为 SSE 解析流
fn sse_stream(response: Response) -> impl Stream<Item = Result<AsrStreamChunk, AsrError>> + Send {
    stream! {
        let mut buffer: Vec<u8> = Vec::new();
        let mut byte_stream = response.bytes_stream();

        while let Some(chunk) = byte_stream.next().await {
            let chunk = match chunk {
                Ok(c) => c,
                Err(e) => {
                    yield Err(AsrError::HttpRequest(e.to_string()));
                    return;
                }
            };
            buffer.extend_from_slice(&chunk);

            let (lines, done) = process_sse_buffer(&mut buffer);
            for line in lines {
                if let Some(chunk) = parse_sse_chunk(&line) {
                    yield Ok(chunk);
                }
            }
            if done {
                return;
            }
        }
    }
}

// ============================== 错误解析 ==============================

/// 根据 HTTP 状态码生成默认错误消息
fn status_default_message(status: u16) -> String {
    StatusCode::from_u16(status)
        .ok()
        .and_then(|s| s.canonical_reason())
        .map(|reason| format!("HTTP {}: {}", status, reason))
        .unwrap_or_else(|| format!("HTTP {}", status))
}

/// 解析 API 错误响应体为 HttpStatus 错误
///
/// 优先使用 `error.message`（OpenAI 标准格式），
/// 回退到顶级 `message`（扁平格式），
/// 最终回退到 HTTP status 默认消息。
fn parse_error_response(status: u16, body: &str) -> AsrError {
    let message = serde_json::from_str::<MimoErrorBody>(body)
        .ok()
        .and_then(|err| err.error.and_then(|e| e.message).or(err.message))
        .unwrap_or_else(|| status_default_message(status));
    AsrError::HttpStatus { status, message }
}

// ============================== AsrProvider 实现 ==============================

#[async_trait]
#[allow(clippy::result_large_err)]
impl AsrProvider for MimoAsr {
    fn name(&self) -> &'static str {
        "mimo"
    }

    async fn listen_stream(
        &self,
        audio: AudioStream,
    ) -> Result<Pin<Box<dyn Stream<Item = Result<AsrStreamChunk, AsrError>> + Send>>, AsrError>
    {
        self.ensure_valid()?;

        // 收集整个音频流，同时检查大小限制
        let audio_data = Self::collect_audio_stream(audio, MIMO_MAX_AUDIO_SIZE).await?;

        // 构造请求体
        let request = self.build_request(audio_data)?;

        // 序列化请求体为 JSON
        let body = serde_json::to_string(&request)?;

        // 发送 HTTP POST 请求
        let client = reqwest::Client::new();
        let response = client
            .post(&self.base_url)
            .header("api-key", &self.api_key)
            .header("Content-Type", "application/json")
            .body(body)
            .send()
            .await
            .map_err(|e| AsrError::HttpRequest(e.to_string()))?;

        // 检查响应状态
        if !response.status().is_success() {
            let status = response.status().as_u16();
            let body_text = response.text().await.unwrap_or_default();
            return Err(parse_error_response(status, &body_text));
        }

        // 将响应体流转换为 SSE 解析流
        let stream = sse_stream(response);
        Ok(Box::pin(stream))
    }
}

// ============================== 测试 ==============================

#[cfg(test)]
mod tests {
    use super::*;
    use futures_util::stream;

    // ==================== 辅助函数 ====================

    fn make_provider(api_key: &str) -> MimoAsr {
        MimoAsr::new(MimoAsrOption {
            base: BaseProviderOption {
                api_key: Some(api_key.into()),
                ..Default::default()
            },
            language: None,
        })
    }

    fn make_custom_provider(
        api_key: &str,
        base_url: Option<&str>,
        model: Option<&str>,
        language: Option<&str>,
        format: Option<AudioContainerFormat>,
    ) -> MimoAsr {
        MimoAsr::new(MimoAsrOption {
            base: BaseProviderOption {
                api_key: Some(api_key.into()),
                base_url: base_url.map(|s| s.into()),
                model: model.map(|s| s.into()),
                format,
                ..Default::default()
            },
            language: language.map(|s| s.into()),
        })
    }

    // ==================== C 系列: 构造/配置 ====================

    #[test]
    fn test_c01_defaults() {
        let provider = make_provider("test-key");
        assert_eq!(provider.name(), "mimo");
        assert_eq!(provider.base_url, MIMO_DEFAULT_BASE_URL);
        assert_eq!(provider.model, MIMO_DEFAULT_MODEL);
        assert_eq!(provider.language, "zh");
        assert_eq!(provider.format, AudioContainerFormat::Wav);
    }

    #[test]
    fn test_c02_custom_options() {
        let provider = make_custom_provider(
            "custom-key",
            Some("https://custom.url/v1/chat/completions"),
            Some("custom-model"),
            Some("en"),
            Some(AudioContainerFormat::Mp3),
        );
        assert_eq!(provider.api_key, "custom-key");
        assert_eq!(provider.base_url, "https://custom.url/v1/chat/completions");
        assert_eq!(provider.model, "custom-model");
        assert_eq!(provider.language, "en");
        assert_eq!(provider.format, AudioContainerFormat::Mp3);
    }

    #[test]
    fn test_c03_api_key_from_base() {
        let provider = make_custom_provider("the-key", None, None, None, None);
        assert_eq!(provider.api_key, "the-key");
    }

    #[test]
    fn test_c04_api_key_none() {
        let provider = MimoAsr::new(MimoAsrOption {
            base: BaseProviderOption {
                api_key: None,
                ..Default::default()
            },
            language: None,
        });
        assert_eq!(provider.api_key, "");
    }

    #[test]
    fn test_c05_model_from_base() {
        let provider = make_custom_provider("k", None, Some("custom-model"), None, None);
        assert_eq!(provider.model, "custom-model");
    }

    #[test]
    fn test_c06_model_default() {
        let provider = make_provider("k");
        assert_eq!(provider.model, MIMO_DEFAULT_MODEL);
    }

    #[test]
    fn test_c07_base_url_default() {
        let provider = make_provider("k");
        assert_eq!(provider.base_url, MIMO_DEFAULT_BASE_URL);
    }

    #[test]
    fn test_c08_base_url_custom() {
        let provider =
            make_custom_provider("k", Some("https://custom.url/endpoint"), None, None, None);
        assert_eq!(provider.base_url, "https://custom.url/endpoint");
    }

    #[test]
    fn test_c09_language_from_option() {
        let provider = make_custom_provider("k", None, None, Some("auto"), None);
        assert_eq!(provider.language, "auto");
    }

    #[test]
    fn test_c10_language_default() {
        let provider = make_provider("k");
        assert_eq!(provider.language, "zh");
    }

    #[test]
    fn test_c11_language_custom() {
        let provider = make_custom_provider("k", None, None, Some("en"), None);
        assert_eq!(provider.language, "en");

        let provider = make_custom_provider("k", None, None, Some("auto"), None);
        assert_eq!(provider.language, "auto");
    }

    #[test]
    fn test_c12_format_from_base() {
        let provider = make_custom_provider("k", None, None, None, Some(AudioContainerFormat::Mp3));
        assert_eq!(provider.format, AudioContainerFormat::Mp3);

        let provider = make_custom_provider("k", None, None, None, Some(AudioContainerFormat::Ogg));
        assert_eq!(provider.format, AudioContainerFormat::Ogg);
    }

    #[test]
    fn test_c13_format_default() {
        let provider = make_provider("k");
        assert_eq!(provider.format, AudioContainerFormat::Wav);
    }

    // ==================== V 系列: 参数验证 ====================

    #[test]
    fn test_v01_ensure_valid_passes() {
        let provider = make_provider("valid-key");
        assert!(provider.ensure_valid().is_ok());
    }

    #[test]
    fn test_v02_ensure_valid_rejects_empty() {
        let provider = make_provider("");
        assert!(matches!(
            provider.ensure_valid(),
            Err(AsrError::InvalidParameter(_))
        ));
    }

    #[test]
    fn test_v03_ensure_valid_rejects_none() {
        let provider = MimoAsr::new(MimoAsrOption {
            base: BaseProviderOption {
                api_key: None,
                ..Default::default()
            },
            language: None,
        });
        assert!(matches!(
            provider.ensure_valid(),
            Err(AsrError::InvalidParameter(_))
        ));
    }

    // ==================== P 系列: SSE 行解析 ====================

    // --- 跨平台行结尾 ---

    #[test]
    fn test_p01_unix_line_ending() {
        let mut buffer = b"data: {\"test\":1}\n".to_vec();
        let (lines, done) = process_sse_buffer(&mut buffer);
        assert!(!done);
        assert_eq!(lines.len(), 1);
        assert_eq!(lines[0], r#"{"test":1}"#);
    }

    #[test]
    fn test_p02_windows_line_ending() {
        let mut buffer = b"data: {\"test\":1}\r\n".to_vec();
        let (lines, done) = process_sse_buffer(&mut buffer);
        assert!(!done);
        assert_eq!(lines.len(), 1);
    }

    #[test]
    fn test_p03_old_mac_line_ending() {
        let mut buffer = b"data: {\"test\":1}\r".to_vec();
        let (lines, done) = process_sse_buffer(&mut buffer);
        assert!(!done);
        assert_eq!(lines.len(), 1);
    }

    #[test]
    fn test_p04_mixed_line_endings() {
        let mut buffer = b"data: first\n".to_vec();
        let (lines1, _) = process_sse_buffer(&mut buffer);
        assert_eq!(lines1.len(), 1);
        assert_eq!(lines1[0], "first");

        buffer.extend_from_slice(b"data: second\r\n");
        buffer.extend_from_slice(b"data: third\r");
        let (lines2, done) = process_sse_buffer(&mut buffer);
        assert!(!done);
        assert_eq!(lines2.len(), 2);
        assert_eq!(lines2[0], "second");
        assert_eq!(lines2[1], "third");
    }

    // --- 基本功能 ---

    #[test]
    fn test_p05_single_data_line() {
        let mut buffer = b"data: hello\n".to_vec();
        let (lines, done) = process_sse_buffer(&mut buffer);
        assert!(!done);
        assert_eq!(lines, vec!["hello"]);
    }

    #[test]
    fn test_p06_multiple_data_lines() {
        let mut buffer = b"data: one\ndata: two\ndata: three\n".to_vec();
        let (lines, done) = process_sse_buffer(&mut buffer);
        assert!(!done);
        assert_eq!(lines, vec!["one", "two", "three"]);
    }

    #[test]
    fn test_p07_empty_lines_skipped() {
        let mut buffer = b"\n\ndata: hi\n\n".to_vec();
        let (lines, done) = process_sse_buffer(&mut buffer);
        assert!(!done);
        assert_eq!(lines, vec!["hi"]);
    }

    #[test]
    fn test_p08_comment_lines_skipped() {
        let mut buffer = b":comment\ndata: hi\n:another\n".to_vec();
        let (lines, done) = process_sse_buffer(&mut buffer);
        assert!(!done);
        assert_eq!(lines, vec!["hi"]);
    }

    #[test]
    fn test_p09_trailing_spaces() {
        // SSE 行前的空格在 trim() 后被去除，因此 data: 仍然可识别
        let mut buffer = b" data: hi\n".to_vec();
        let (lines, done) = process_sse_buffer(&mut buffer);
        assert!(!done);
        assert_eq!(lines, vec!["hi"]);
    }

    // --- [DONE] 信号 ---

    #[test]
    fn test_p10_done_signal() {
        let mut buffer = b"data: [DONE]\n".to_vec();
        let (lines, done) = process_sse_buffer(&mut buffer);
        assert!(done);
        assert!(lines.is_empty());
    }

    #[test]
    fn test_p11_consecutive_done() {
        let mut buffer = b"data: [DONE]\ndata: [DONE]\n".to_vec();
        let (lines, done) = process_sse_buffer(&mut buffer);
        assert!(done);
        assert!(lines.is_empty());
    }

    #[test]
    fn test_p12_data_after_done() {
        let mut buffer = b"data: [DONE]\ndata: should_not_appear\n".to_vec();
        let (lines, done) = process_sse_buffer(&mut buffer);
        assert!(done);
        assert!(lines.is_empty());
    }

    #[test]
    fn test_p13_done_with_crlf() {
        let mut buffer = b"data: [DONE]\r\n".to_vec();
        let (lines, done) = process_sse_buffer(&mut buffer);
        assert!(done);
        assert!(lines.is_empty());
    }

    #[test]
    fn test_p14_done_with_cr() {
        let mut buffer = b"data: [DONE]\r".to_vec();
        let (lines, done) = process_sse_buffer(&mut buffer);
        assert!(done);
        assert!(lines.is_empty());
    }

    // --- Buffer 边界 ---

    #[test]
    fn test_p15_no_newline_trailing() {
        let mut buffer = b"data: hello".to_vec();
        let (lines, done) = process_sse_buffer(&mut buffer);
        assert!(!done);
        assert!(lines.is_empty());
        assert!(!buffer.is_empty()); // 数据保留在 buffer 中
    }

    #[test]
    fn test_p16_partial_line_accumulation() {
        let mut buffer = b"data: par".to_vec();
        let (lines, _) = process_sse_buffer(&mut buffer);
        assert!(lines.is_empty());
        assert!(!buffer.is_empty());

        buffer.extend_from_slice(b"tial\n");
        let (lines, done) = process_sse_buffer(&mut buffer);
        assert!(!done);
        assert_eq!(lines, vec!["partial"]);
    }

    #[test]
    fn test_p17_buffer_reuse() {
        let mut buffer = b"data: par".to_vec();
        let (_, _) = process_sse_buffer(&mut buffer);
        assert!(!buffer.is_empty());

        buffer.extend_from_slice(b"tial\n");
        let (lines, done) = process_sse_buffer(&mut buffer);
        assert!(!done);
        assert_eq!(lines, vec!["partial"]);
    }

    #[test]
    fn test_p18_empty_buffer() {
        let mut buffer = Vec::new();
        let (lines, done) = process_sse_buffer(&mut buffer);
        assert!(!done);
        assert!(lines.is_empty());
    }

    #[test]
    fn test_p19_very_long_line() {
        let long = "A".repeat(65536);
        let line = format!("data: {}\n", long);
        let mut buffer = line.as_bytes().to_vec();
        let (lines, done) = process_sse_buffer(&mut buffer);
        assert!(!done);
        assert_eq!(lines.len(), 1);
        assert_eq!(lines[0].len(), 65536);
    }

    // ==================== S 系列: SSE JSON 解析 ====================

    // --- OpenAI Chunk 格式 ---

    #[test]
    fn test_s01_delta_non_empty() {
        let data = r#"{"choices":[{"index":0,"delta":{"content":"hello"},"finish_reason":null}]}"#;
        let chunk = parse_sse_chunk(data).unwrap();
        assert_eq!(chunk.text, "hello");
        assert!(!chunk.is_final);
        assert!(chunk.confidence.is_none());
        assert!(chunk.segment.is_none());
    }

    #[test]
    fn test_s02_delta_empty_string() {
        let data = r#"{"choices":[{"index":0,"delta":{"content":""},"finish_reason":null}]}"#;
        assert!(parse_sse_chunk(data).is_none());
    }

    #[test]
    fn test_s03_delta_null() {
        let data = r#"{"choices":[{"index":0,"delta":{"content":null},"finish_reason":null}]}"#;
        assert!(parse_sse_chunk(data).is_none());
    }

    #[test]
    fn test_s04_delta_content_with_stop() {
        let data =
            r#"{"choices":[{"index":0,"delta":{"content":"hello"},"finish_reason":"stop"}]}"#;
        let chunk = parse_sse_chunk(data).unwrap();
        assert_eq!(chunk.text, "hello");
        assert!(chunk.is_final);
    }

    #[test]
    fn test_s05_stop_without_content() {
        let data = r#"{"choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}"#;
        assert!(parse_sse_chunk(data).is_none());
    }

    #[test]
    fn test_s06_empty_choices() {
        let data = r#"{"choices":[]}"#;
        assert!(parse_sse_chunk(data).is_none());
    }

    #[test]
    fn test_s07_multiple_choices() {
        let data = r#"{"choices":[{"index":0,"delta":{"content":"first"},"finish_reason":null},{"index":1,"delta":{"content":"second"},"finish_reason":null}]}"#;
        let chunk = parse_sse_chunk(data).unwrap();
        assert_eq!(chunk.text, "first"); // 取第一个
    }

    #[test]
    fn test_s08_delta_with_role() {
        // 首个 chunk 含 role 但不含有效 content
        let data = r#"{"choices":[{"index":0,"delta":{"role":"assistant","content":""},"finish_reason":null}]}"#;
        assert!(parse_sse_chunk(data).is_none());
    }

    #[test]
    fn test_s09_missing_choices() {
        let data = r#"{"id":"123","object":"chat.completion.chunk"}"#;
        assert!(parse_sse_chunk(data).is_none());
    }

    // --- Content 值语义 ---

    #[test]
    fn test_s10_content_whitespace_preserved() {
        let data =
            r#"{"choices":[{"index":0,"delta":{"content":"  hello  "},"finish_reason":null}]}"#;
        let chunk = parse_sse_chunk(data).unwrap();
        assert_eq!(chunk.text, "  hello  "); // 空格保留不 trim
    }

    #[test]
    fn test_s11_content_single_space() {
        let data = r#"{"choices":[{"index":0,"delta":{"content":" "},"finish_reason":null}]}"#;
        let chunk = parse_sse_chunk(data).unwrap();
        assert_eq!(chunk.text, " ");
    }

    #[test]
    fn test_s12_content_only_whitespace() {
        let data = r#"{"choices":[{"index":0,"delta":{"content":"   "},"finish_reason":null}]}"#;
        let chunk = parse_sse_chunk(data).unwrap();
        assert_eq!(chunk.text, "   ");
    }

    // --- Unicode 覆盖 ---

    #[test]
    fn test_s13_chinese_text() {
        let data =
            r#"{"choices":[{"index":0,"delta":{"content":"你好世界"},"finish_reason":null}]}"#;
        let chunk = parse_sse_chunk(data).unwrap();
        assert_eq!(chunk.text, "你好世界");
    }

    #[test]
    fn test_s14_emoji_text() {
        let data = r#"{"choices":[{"index":0,"delta":{"content":"🎉🎊"},"finish_reason":null}]}"#;
        let chunk = parse_sse_chunk(data).unwrap();
        assert_eq!(chunk.text, "🎉🎊");
    }

    #[test]
    fn test_s15_mixed_language() {
        let data =
            r#"{"choices":[{"index":0,"delta":{"content":"Hello 你好"},"finish_reason":null}]}"#;
        let chunk = parse_sse_chunk(data).unwrap();
        assert_eq!(chunk.text, "Hello 你好");
    }

    #[test]
    fn test_s16_special_chars() {
        let data =
            r#"{"choices":[{"index":0,"delta":{"content":".?!,，。！？"},"finish_reason":null}]}"#;
        let chunk = parse_sse_chunk(data).unwrap();
        assert_eq!(chunk.text, ".?!,，。！？");
    }

    // --- MIMO SSE 特有约束 ---

    #[test]
    fn test_s17_confidence_always_none() {
        let data = r#"{"choices":[{"index":0,"delta":{"content":"hello"},"finish_reason":null}]}"#;
        let chunk = parse_sse_chunk(data).unwrap();
        assert!(chunk.confidence.is_none());
    }

    #[test]
    fn test_s18_segment_always_none() {
        let data = r#"{"choices":[{"index":0,"delta":{"content":"hello"},"finish_reason":null}]}"#;
        let chunk = parse_sse_chunk(data).unwrap();
        assert!(chunk.segment.is_none());
    }

    // --- Malformed 数据容错 ---

    #[test]
    fn test_s19_invalid_json() {
        assert!(parse_sse_chunk("not valid json").is_none());
    }

    #[test]
    fn test_s20_partial_json() {
        assert!(parse_sse_chunk(r#"{"choices":[{"delta":{"content":"par"#).is_none());
    }

    #[test]
    fn test_s21_unexpected_field_types() {
        // choices 是对象而非数组
        let data = r#"{"choices":{"delta":{"content":"hello"}}}"#;
        assert!(parse_sse_chunk(data).is_none());
    }

    #[test]
    fn test_s22_null_choices() {
        let data = r#"{"choices":null}"#;
        assert!(parse_sse_chunk(data).is_none());
    }

    // ==================== B 系列: Base64 编码 ====================

    #[test]
    fn test_b01_base64_known_input() {
        let encoded = base64::engine::general_purpose::STANDARD.encode(b"hello");
        assert_eq!(encoded, "aGVsbG8=");
    }

    #[test]
    fn test_b02_base64_empty() {
        let encoded = base64::engine::general_purpose::STANDARD.encode(b"");
        assert_eq!(encoded, "");
    }

    #[test]
    fn test_b03_base64_binary_data() {
        let data = vec![0u8, 1, 2, 255, 254, 128];
        let encoded = base64::engine::general_purpose::STANDARD.encode(&data);
        let decoded = base64::engine::general_purpose::STANDARD
            .decode(&encoded)
            .unwrap();
        assert_eq!(decoded, data);
    }

    #[test]
    fn test_b04_data_url_format() {
        let audio = b"test audio data";
        let url = MimoAsr::build_data_url(audio, AudioContainerFormat::Wav);
        assert!(url.starts_with("data:audio/wav;base64,"));
        let encoded = base64::engine::general_purpose::STANDARD.encode(audio);
        assert_eq!(url, format!("data:audio/wav;base64,{}", encoded));
    }

    // ==================== SP 系列: SSE 完整管道 ====================

    #[test]
    fn test_sp01_single_delta_chunk() {
        let input = b"data: {\"choices\":[{\"index\":0,\"delta\":{\"content\":\"hello\"},\"finish_reason\":null}]}\n";
        let mut buffer = input.to_vec();
        let (lines, done) = process_sse_buffer(&mut buffer);
        assert!(!done);
        assert_eq!(lines.len(), 1);

        let chunk = parse_sse_chunk(&lines[0]).unwrap();
        assert_eq!(chunk.text, "hello");
        assert!(!chunk.is_final);
    }

    #[test]
    fn test_sp02_multiple_delta_stream() {
        let input = concat!(
            "data: {\"choices\":[{\"index\":0,\"delta\":{\"content\":\"hello \"},\"finish_reason\":null}]}\n",
            "data: {\"choices\":[{\"index\":0,\"delta\":{\"content\":\"world\"},\"finish_reason\":null}]}\n",
            "data: {\"choices\":[{\"index\":0,\"delta\":{},\"finish_reason\":\"stop\"}]}\n",
            "data: [DONE]\n",
        );
        let mut buffer = input.as_bytes().to_vec();
        let (lines, done) = process_sse_buffer(&mut buffer);
        assert!(done);
        assert_eq!(lines.len(), 3); // 2 deltas + 1 stop (不含 [DONE], 停在了 [DONE])
        // 实际上 [DONE] 触发 done=true，3个 data: 行在 [DONE] 前被提取

        let chunks: Vec<_> = lines.iter().filter_map(|l| parse_sse_chunk(l)).collect();
        assert_eq!(chunks.len(), 2);
        assert_eq!(chunks[0].text, "hello ");
        assert!(!chunks[0].is_final);
        assert_eq!(chunks[1].text, "world");
        assert!(!chunks[1].is_final);
    }

    #[test]
    fn test_sp03_delta_then_stop() {
        let input = concat!(
            "data: {\"choices\":[{\"index\":0,\"delta\":{\"content\":\"hello\"},\"finish_reason\":null}]}\n",
            "data: {\"choices\":[{\"index\":0,\"delta\":{},\"finish_reason\":\"stop\"}]}\n",
            "data: [DONE]\n",
        );
        let mut buffer = input.as_bytes().to_vec();
        let (lines, done) = process_sse_buffer(&mut buffer);
        assert!(done);

        let chunks: Vec<_> = lines.iter().filter_map(|l| parse_sse_chunk(l)).collect();
        assert_eq!(chunks.len(), 1);
        assert_eq!(chunks[0].text, "hello");
    }

    #[test]
    fn test_sp04_only_stop_chunk() {
        let input = concat!(
            "data: {\"choices\":[{\"index\":0,\"delta\":{},\"finish_reason\":\"stop\"}]}\n",
            "data: [DONE]\n",
        );
        let mut buffer = input.as_bytes().to_vec();
        let (lines, done) = process_sse_buffer(&mut buffer);
        assert!(done);

        let chunks: Vec<_> = lines.iter().filter_map(|l| parse_sse_chunk(l)).collect();
        assert!(chunks.is_empty());
    }

    #[test]
    fn test_sp05_long_text_multiple_chunks() {
        let parts = ["今天", "天气", "真", "不错"];
        let mut input = String::new();
        for part in &parts {
            input.push_str(&format!(
                "data: {{\"choices\":[{{\"index\":0,\"delta\":{{\"content\":\"{}\"}},\"finish_reason\":null}}]}}\n",
                part
            ));
        }
        input.push_str("data: [DONE]\n");

        let mut buffer = input.as_bytes().to_vec();
        let (lines, done) = process_sse_buffer(&mut buffer);
        assert!(done);

        let chunks: Vec<_> = lines.iter().filter_map(|l| parse_sse_chunk(l)).collect();
        assert_eq!(chunks.len(), 4);
        let combined: String = chunks.iter().map(|c| c.text.as_str()).collect();
        assert_eq!(combined, "今天天气真不错");
    }

    #[test]
    fn test_sp06_unicode_stream() {
        let input = concat!(
            "data: {\"choices\":[{\"index\":0,\"delta\":{\"content\":\"你好\"},\"finish_reason\":null}]}\n",
            "data: {\"choices\":[{\"index\":0,\"delta\":{\"content\":\"世界\"},\"finish_reason\":null}]}\n",
            "data: [DONE]\n",
        );
        let mut buffer = input.as_bytes().to_vec();
        let (lines, done) = process_sse_buffer(&mut buffer);
        assert!(done);

        let chunks: Vec<_> = lines.iter().filter_map(|l| parse_sse_chunk(l)).collect();
        assert_eq!(chunks.len(), 2);
        assert_eq!(chunks[0].text, "你好");
        assert_eq!(chunks[1].text, "世界");
    }

    #[test]
    fn test_sp07_stream_without_done() {
        // 流没有 [DONE]，直接结束
        let input = b"data: {\"choices\":[{\"index\":0,\"delta\":{\"content\":\"hi\"},\"finish_reason\":null}]}\n";
        let mut buffer = input.to_vec();
        let (lines, done) = process_sse_buffer(&mut buffer);
        assert!(!done); // 没有 [DONE]
        assert_eq!(lines.len(), 1);

        let chunk = parse_sse_chunk(&lines[0]).unwrap();
        assert_eq!(chunk.text, "hi");
    }

    #[test]
    fn test_sp08_non_sse_response() {
        // 纯 JSON 响应，没有 data: 前缀
        let mut buffer =
            b"{\"id\":\"123\",\"choices\":[{\"index\":0,\"message\":{\"content\":\"hello\"}}]}\n"
                .to_vec();
        let (lines, done) = process_sse_buffer(&mut buffer);
        assert!(!done);
        assert!(lines.is_empty()); // 没有 data: 前缀行被忽略
    }

    #[test]
    fn test_sp09_real_world_stream() {
        let input = concat!(
            "data: {\"id\":\"chatcmpl-abc\",\"object\":\"chat.completion.chunk\",\"choices\":[{\"index\":0,\"delta\":{\"role\":\"assistant\",\"content\":\"\"},\"finish_reason\":null}]}\n",
            "data: {\"id\":\"chatcmpl-abc\",\"object\":\"chat.completion.chunk\",\"choices\":[{\"index\":0,\"delta\":{\"content\":\"今天\"},\"finish_reason\":null}]}\n",
            "data: {\"id\":\"chatcmpl-abc\",\"object\":\"chat.completion.chunk\",\"choices\":[{\"index\":0,\"delta\":{\"content\":\"天气\"},\"finish_reason\":null}]}\n",
            "data: {\"id\":\"chatcmpl-abc\",\"object\":\"chat.completion.chunk\",\"choices\":[{\"index\":0,\"delta\":{\"content\":\"很好\"},\"finish_reason\":null}]}\n",
            "data: {\"id\":\"chatcmpl-abc\",\"object\":\"chat.completion.chunk\",\"choices\":[{\"index\":0,\"delta\":{},\"finish_reason\":\"stop\"}]}\n",
            "data: [DONE]\n",
        );
        let mut buffer = input.as_bytes().to_vec();
        let (lines, done) = process_sse_buffer(&mut buffer);
        assert!(done);

        let chunks: Vec<_> = lines.iter().filter_map(|l| parse_sse_chunk(l)).collect();
        assert_eq!(chunks.len(), 3);
        assert_eq!(chunks[0].text, "今天");
        assert_eq!(chunks[1].text, "天气");
        assert_eq!(chunks[2].text, "很好");
        for chunk in &chunks {
            assert!(!chunk.is_final);
            assert!(chunk.confidence.is_none());
            assert!(chunk.segment.is_none());
        }
    }

    // --- 跨平台 ---

    #[test]
    fn test_sp10_lf_stream() {
        let input = format!(
            "data: {}\ndata: {}\ndata: [DONE]\n",
            r#"{"choices":[{"delta":{"content":"hi"}}]}"#,
            r#"{"choices":[{"delta":{},"finish_reason":"stop"}]}"#,
        );
        let mut buffer = input.as_bytes().to_vec();
        let (lines, done) = process_sse_buffer(&mut buffer);
        assert!(done);
        let chunks: Vec<_> = lines.iter().filter_map(|l| parse_sse_chunk(l)).collect();
        assert_eq!(chunks.len(), 1);
        assert_eq!(chunks[0].text, "hi");
    }

    #[test]
    fn test_sp11_crlf_stream() {
        let input = format!(
            "data: {}\r\ndata: {}\r\ndata: [DONE]\r\n",
            r#"{"choices":[{"delta":{"content":"hi"}}]}"#,
            r#"{"choices":[{"delta":{},"finish_reason":"stop"}]}"#,
        );
        let mut buffer = input.as_bytes().to_vec();
        let (lines, done) = process_sse_buffer(&mut buffer);
        assert!(done);
        let chunks: Vec<_> = lines.iter().filter_map(|l| parse_sse_chunk(l)).collect();
        assert_eq!(chunks.len(), 1);
    }

    #[test]
    fn test_sp12_cr_stream() {
        let input = format!(
            "data: {}\rdata: {}\rdata: [DONE]\r",
            r#"{"choices":[{"delta":{"content":"hi"}}]}"#,
            r#"{"choices":[{"delta":{},"finish_reason":"stop"}]}"#,
        );
        let mut buffer = input.as_bytes().to_vec();
        let (lines, done) = process_sse_buffer(&mut buffer);
        assert!(done);
        let chunks: Vec<_> = lines.iter().filter_map(|l| parse_sse_chunk(l)).collect();
        assert_eq!(chunks.len(), 1);
    }

    // ==================== R 系列: 请求体序列化 ====================

    #[test]
    fn test_r01_request_json_structure() {
        let provider = make_provider("test-key");
        let audio = b"test audio";
        let request = provider.build_request(audio.to_vec()).unwrap();
        let json = serde_json::to_string(&request).unwrap();

        // 验证所有必需字段存在
        assert!(json.contains(r#""model":"#));
        assert!(json.contains(r#""messages":"#));
        assert!(json.contains(r#""asr_options":"#));
        assert!(json.contains(r#""stream":true"#));
    }

    #[test]
    fn test_r02_request_audio_data_uri() {
        let provider = make_provider("test-key");
        let audio = b"test audio";
        let request = provider.build_request(audio.to_vec()).unwrap();
        let json = serde_json::to_string(&request).unwrap();

        assert!(json.contains(r#""data":"#));
        assert!(json.contains("data:audio/wav;base64,"));
    }

    #[test]
    fn test_r03_request_audio_data_uri_format() {
        let provider = make_custom_provider("k", None, None, None, Some(AudioContainerFormat::Mp3));
        let audio = b"test";
        let request = provider.build_request(audio.to_vec()).unwrap();
        let json = serde_json::to_string(&request).unwrap();

        let expected_url = format!(
            "data:audio/mpeg;base64,{}",
            base64::engine::general_purpose::STANDARD.encode(b"test")
        );
        assert!(json.contains(&expected_url));
    }

    #[test]
    fn test_r04_request_asr_options() {
        let provider = make_custom_provider("k", None, None, Some("en"), None);
        let request = provider.build_request(b"test".to_vec()).unwrap();
        let json = serde_json::to_string(&request).unwrap();

        assert!(json.contains(r#""language":"en""#));
    }

    #[test]
    fn test_r05_request_stream_true() {
        let provider = make_provider("k");
        let request = provider.build_request(b"test".to_vec()).unwrap();
        let json = serde_json::to_string(&request).unwrap();

        assert!(json.contains(r#""stream":true"#));
    }

    #[test]
    fn test_r06_request_messages_structure() {
        let provider = make_provider("k");
        let request = provider.build_request(b"test".to_vec()).unwrap();
        let json = serde_json::to_string(&request).unwrap();

        // content 必须是数组，不是字符串
        assert!(json.contains(r#""type":"input_audio""#));
        assert!(json.contains(r#""role":"user""#));
        // 验证 content 是数组：content 后跟 [
        assert!(json.contains(r#""content":["#));
    }

    #[test]
    fn test_r07_request_model_field() {
        let provider = make_custom_provider("k", None, Some("custom-asr-model"), None, None);
        let request = provider.build_request(b"test".to_vec()).unwrap();
        let json = serde_json::to_string(&request).unwrap();

        assert!(json.contains(r#""model":"custom-asr-model""#));
    }

    #[test]
    fn test_r08_request_empty_audio() {
        let provider = make_provider("k");
        let request = provider.build_request(vec![]).unwrap();
        let json = serde_json::to_string(&request).unwrap();

        assert!(json.contains("data:audio/wav;base64,"));
    }

    // ==================== M 系列: MIME 类型 ====================

    #[test]
    fn test_m01_mime_wav() {
        assert_eq!(determine_mime_type(AudioContainerFormat::Wav), "audio/wav");
    }

    #[test]
    fn test_m02_mime_mp3() {
        assert_eq!(determine_mime_type(AudioContainerFormat::Mp3), "audio/mpeg");
    }

    #[test]
    fn test_m03_mime_ogg() {
        assert_eq!(determine_mime_type(AudioContainerFormat::Ogg), "audio/ogg");
    }

    #[test]
    fn test_m04_mime_pcm() {
        assert_eq!(determine_mime_type(AudioContainerFormat::Pcm), "audio/wav");
    }

    // ==================== A 系列: 音频收集 ====================

    #[tokio::test]
    async fn test_a01_collect_single_chunk() {
        let audio: AudioStream = Box::pin(stream::iter([vec![0u8; 100]]));
        let result = MimoAsr::collect_audio_stream(audio, MIMO_MAX_AUDIO_SIZE)
            .await
            .unwrap();
        assert_eq!(result.len(), 100);
    }

    #[tokio::test]
    async fn test_a02_collect_multiple_chunks() {
        let audio: AudioStream = Box::pin(stream::iter([vec![0u8; 50], vec![1u8; 50]]));
        let result = MimoAsr::collect_audio_stream(audio, MIMO_MAX_AUDIO_SIZE)
            .await
            .unwrap();
        assert_eq!(result.len(), 100);
        assert_eq!(result[0], 0u8);
        assert_eq!(result[99], 1u8);
    }

    #[tokio::test]
    async fn test_a03_collect_empty() {
        let audio: AudioStream = Box::pin(stream::empty());
        let result = MimoAsr::collect_audio_stream(audio, MIMO_MAX_AUDIO_SIZE)
            .await
            .unwrap();
        assert_eq!(result.len(), 0);
    }

    #[tokio::test]
    async fn test_a04_collect_exceeds_limit() {
        let chunks = vec![vec![0u8; 60], vec![0u8; 60]];
        let audio: AudioStream = Box::pin(stream::iter(chunks));
        let result = MimoAsr::collect_audio_stream(audio, 100).await;
        assert!(matches!(result, Err(AsrError::InvalidParameter(_))));
    }

    #[tokio::test]
    async fn test_a05_collect_boundary_at_limit() {
        let audio: AudioStream = Box::pin(stream::iter([vec![0u8; 100]]));
        let result = MimoAsr::collect_audio_stream(audio, 100).await;
        assert!(result.is_ok());
        assert_eq!(result.unwrap().len(), 100);
    }

    #[tokio::test]
    async fn test_a06_collect_zero_length_chunks() {
        let audio: AudioStream = Box::pin(stream::iter([vec![0u8; 10], vec![], vec![0u8; 10]]));
        let result = MimoAsr::collect_audio_stream(audio, MIMO_MAX_AUDIO_SIZE)
            .await
            .unwrap();
        assert_eq!(result.len(), 20);
    }

    // ==================== X 系列: 并发安全与连接 ====================

    #[test]
    fn test_x01_provider_send_sync() {
        fn assert_send<T: Send>(_: &T) {}
        fn assert_sync<T: Sync>(_: &T) {}

        let provider = make_provider("test-key");
        assert_send(&provider);
        assert_sync(&provider);
    }

    #[test]
    fn test_x02_multiple_providers_independent() {
        let p1 = make_custom_provider("key1", None, None, Some("zh"), None);
        let p2 = make_custom_provider("key2", None, None, Some("en"), None);

        assert_eq!(p1.api_key, "key1");
        assert_eq!(p1.language, "zh");
        assert_eq!(p2.api_key, "key2");
        assert_eq!(p2.language, "en");
    }

    #[test]
    fn test_x03_connect_unsupported() {
        let provider = make_provider("test-key");
        let rt = tokio::runtime::Runtime::new().unwrap();
        let result = rt.block_on(provider.connect(crate::asr::traits::AsrConnectOption::default()));
        assert!(matches!(result, Err(AsrError::Unsupported("connect"))));
    }

    // ==================== E 系列: 错误解析 ====================

    #[test]
    fn test_e01_error_standard() {
        let err = parse_error_response(401, r#"{"error":{"message":"Invalid API key"}}"#);
        assert!(matches!(
            err,
            AsrError::HttpStatus {
                status: 401,
                message: _
            }
        ));
        if let AsrError::HttpStatus { ref message, .. } = err {
            assert_eq!(message, "Invalid API key");
        }
    }

    #[test]
    fn test_e02_error_no_error_object() {
        let err = parse_error_response(400, r#"{"message":"bad request"}"#);
        if let AsrError::HttpStatus { ref message, .. } = err {
            assert_eq!(message, "bad request");
        }
    }

    #[test]
    fn test_e03_error_empty_body() {
        let err = parse_error_response(502, "");
        if let AsrError::HttpStatus { ref message, .. } = err {
            assert_eq!(message, "HTTP 502: Bad Gateway");
        }
    }

    #[test]
    fn test_e04_error_invalid_json() {
        let err = parse_error_response(500, "not json");
        if let AsrError::HttpStatus { ref message, .. } = err {
            assert_eq!(message, "HTTP 500: Internal Server Error");
        }
    }

    #[test]
    fn test_e05_error_unknown_status() {
        let err = parse_error_response(499, "");
        if let AsrError::HttpStatus { ref message, .. } = err {
            assert_eq!(message, "HTTP 499");
        }
    }

    #[test]
    fn test_e06_error_no_message() {
        let err = parse_error_response(403, r#"{"error":{}}"#);
        if let AsrError::HttpStatus { ref message, .. } = err {
            assert_eq!(message, "HTTP 403: Forbidden");
        }
    }
}
