use std::pin::Pin;

use async_stream::stream;
use async_trait::async_trait;
use futures_util::{Stream, StreamExt};
use http::StatusCode;
use reqwest::Response;
use reqwest::multipart::{Form, Part};
use serde::Deserialize;

use crate::asr::error::AsrError;
use crate::asr::traits::AsrProvider;
use crate::asr::types::{AsrSegment, AsrStreamChunk, AudioStream, BaseProviderOption};

// ============================== 常量 ==============================

/// GLM ASR 默认 REST API 地址
const GLM_DEFAULT_BASE_URL: &str = "https://open.bigmodel.cn/api/paas/v4/audio/transcriptions";
/// GLM ASR 默认模型
const GLM_DEFAULT_MODEL: &str = "glm-asr-2512";
/// 最大文件大小（25 MB）
const GLM_MAX_FILE_SIZE: usize = 25 * 1024 * 1024;

// ============================== 内部数据结构 ==============================

/// SSE 事件的数据结构（兼容新格式和旧格式）
#[derive(Debug, Deserialize)]
struct GlmSseData {
    text: Option<String>,
    delta: Option<String>,
    #[serde(rename = "type")]
    type_: Option<String>,
    is_final: Option<bool>,
    #[serde(alias = "isFinal")]
    is_final_alt: Option<bool>,
    start_time: Option<u32>,
    end_time: Option<u32>,
}

/// API 错误响应的数据结构
#[derive(Debug, Deserialize)]
struct GlmErrorBody {
    error: Option<GlmErrorDetail>,
    message: Option<String>,
}

#[derive(Debug, Deserialize)]
struct GlmErrorDetail {
    message: Option<String>,
}

// ============================== 配置选项 ==============================

/// GLM ASR 专属配置
#[derive(Debug, Clone, Default)]
pub struct GlmAsrOption {
    pub base: BaseProviderOption,
    pub hotwords: Option<Vec<String>>,
    pub context: Option<String>,
}

// ============================== Provider 结构体 ==============================

/// GLM ASR Provider
///
/// 基于智谱 AI GLM ASR HTTP REST API 实现语音识别。
/// 与 Qwen/Doubao 不同，GLM 使用 HTTP REST 而非 WebSocket，
/// 且不支持预建立连接（connect 返回 Unsupported）。
pub struct GlmAsr {
    api_key: String,
    base_url: String,
    model: String,
    hotwords: Option<String>,
    context: Option<String>,
}

impl GlmAsr {
    pub fn new(options: GlmAsrOption) -> Self {
        let base = &options.base;
        Self {
            api_key: base.api_key.clone().unwrap_or_default(),
            base_url: base
                .base_url
                .clone()
                .unwrap_or_else(|| GLM_DEFAULT_BASE_URL.into()),
            model: base
                .model
                .clone()
                .unwrap_or_else(|| GLM_DEFAULT_MODEL.into()),
            hotwords: options
                .hotwords
                .filter(|hw| !hw.is_empty()) // Some([]) → None
                .map(|hw| hw.join(",")), // ["a","b"] → "a,b"
            context: options.context,
        }
    }

    /// 验证必要参数
    fn ensure_valid(&self) -> Result<(), AsrError> {
        if self.api_key.is_empty() {
            return Err(AsrError::InvalidParameter(
                "apiKey is required for GLM ASR".into(),
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

    /// 构造 multipart/form-data 请求体
    fn build_form_data(
        audio_data: Vec<u8>,
        model: &str,
        hotwords: &Option<String>,
        context: &Option<String>,
    ) -> Result<Form, AsrError> {
        let file_part = Part::bytes(audio_data).file_name("audio.mp3");

        let mut form = Form::new()
            .part("file", file_part)
            .text("model", model.to_string())
            .text("stream", "true");

        if let Some(hw) = hotwords {
            if !hw.is_empty() {
                form = form.text("hotwords", hw.clone());
            }
        }
        if let Some(ctx) = context {
            form = form.text("context", ctx.clone());
        }

        Ok(form)
    }

    /// 解析 API 错误响应体为 HttpStatus 错误
    fn parse_error_response(status: u16, body: &str) -> AsrError {
        let message = serde_json::from_str::<GlmErrorBody>(body)
            .ok()
            .and_then(|err| err.error.and_then(|e| e.message).or(err.message))
            .unwrap_or_else(|| status_default_message(status));
        AsrError::HttpStatus { status, message }
    }
}

// ============================== 错误辅助函数 ==============================

/// 根据 HTTP 状态码生成默认错误消息
fn status_default_message(status: u16) -> String {
    StatusCode::from_u16(status)
        .ok()
        .and_then(|s| s.canonical_reason())
        .map(|reason| format!("HTTP {}: {}", status, reason))
        .unwrap_or_else(|| format!("HTTP {}", status))
}

// ============================== SSE 解析（纯函数层） ==============================

/// 解析单行 SSE JSON 数据
///
/// 支持三种格式：
/// - 新格式 delta: `{"type":"transcript.text.delta","delta":"..."}`
/// - 新格式 done: `{"type":"transcript.text.done","text":"..."}`
/// - 旧格式: `{"text":"...","is_final":true,"start_time":0,"end_time":1000}`
///
/// 解析失败返回 None（静默跳过，对齐 TS catch {}）。
fn parse_sse_data(data: &str) -> Option<AsrStreamChunk> {
    let parsed: GlmSseData = serde_json::from_str(data).ok()?;
    match parsed.type_.as_deref() {
        Some("transcript.text.delta") => parsed.delta.map(|d| AsrStreamChunk {
            text: d,
            is_final: false,
            confidence: None,
            segment: None,
        }),
        Some("transcript.text.done") => parsed.text.map(|t| AsrStreamChunk {
            text: t,
            is_final: true,
            confidence: None,
            segment: None,
        }),
        _ => {
            // 未知 type 或旧格式：只要 text 存在且非空就产出
            // filter(|t| !t.is_empty()) 对齐 TS `if (parsed.text)` 的 falsy 判断
            let text = parsed.text.filter(|t| !t.is_empty())?;
            let is_final = parsed.is_final.unwrap_or(false) || parsed.is_final_alt.unwrap_or(false);
            let segment = parsed
                .start_time
                .zip(parsed.end_time)
                .map(|(start, end)| AsrSegment {
                    id: 0,
                    start,
                    end,
                    text: text.clone(),
                    speaker: None,
                    confidence: None,
                });
            Some(AsrStreamChunk {
                text,
                is_final,
                confidence: None,
                segment,
            })
        }
    }
}

/// 处理字节缓冲区，提取完整的 SSE 事件行。
///
/// 返回（已解析的 chunks, 是否遇到 [DONE]）。
/// 未完成的行保留在 buffer 中供下次调用。
/// 支持三种行结束符：\n（Unix）、\r\n（Windows）、\r（旧 Mac）。
fn process_sse_buffer(buffer: &mut Vec<u8>) -> (Vec<AsrStreamChunk>, bool) {
    let mut chunks = Vec::new();
    loop {
        // 找首次出现的 \n 或 \r（兼容 SSE \r-only 行结束符）
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
                // trim() 去除行结束符（\r 和 \n 都是 whitespace）
                let line = String::from_utf8_lossy(&line_bytes);
                let trimmed = line.trim();
                if trimmed.is_empty() {
                    continue;
                }
                if let Some(data) = trimmed.strip_prefix("data:") {
                    let data = data.trim();
                    if data == "[DONE]" {
                        return (chunks, true);
                    }
                    if let Some(chunk) = parse_sse_data(data) {
                        chunks.push(chunk);
                    }
                }
            }
            None => break,
        }
    }
    (chunks, false)
}

// ============================== SSE 解析（HTTP 适配层） ==============================

/// 将 HTTP 响应体转换为 SSE 解析流。
/// 核心解析委托给 process_sse_buffer（可测试的纯函数）。
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

            let (chunks, _done) = process_sse_buffer(&mut buffer);
            for chunk in chunks {
                yield Ok(chunk);
            }
            if _done {
                return;
            }
        }
    }
}

// ============================== AsrProvider 实现 ==============================

#[async_trait]
#[allow(clippy::result_large_err)]
impl AsrProvider for GlmAsr {
    fn name(&self) -> &'static str {
        "glm"
    }

    async fn listen_stream(
        &self,
        audio: AudioStream,
    ) -> Result<Pin<Box<dyn Stream<Item = Result<AsrStreamChunk, AsrError>> + Send>>, AsrError>
    {
        self.ensure_valid()?;

        // 收集整个音频流，同时检查大小限制（每块到达时立即检查）
        let audio_data = Self::collect_audio_stream(audio, GLM_MAX_FILE_SIZE).await?;

        // 构造 multipart/form-data
        let form = Self::build_form_data(audio_data, &self.model, &self.hotwords, &self.context)?;

        // 发送 HTTP POST 请求
        let client = reqwest::Client::new();
        let response = client
            .post(&self.base_url)
            .header("Authorization", &format!("Bearer {}", self.api_key))
            .header("Accept", "text/event-stream")
            .multipart(form)
            .send()
            .await
            .map_err(|e| AsrError::HttpRequest(e.to_string()))?;

        // 检查响应状态
        if !response.status().is_success() {
            let status = response.status().as_u16();
            let body = response.text().await.unwrap_or_default();
            return Err(Self::parse_error_response(status, &body));
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

    fn make_provider(api_key: &str) -> GlmAsr {
        GlmAsr::new(GlmAsrOption {
            base: BaseProviderOption {
                api_key: Some(api_key.into()),
                ..Default::default()
            },
            ..Default::default()
        })
    }

    // ==================== 2.1 构造/配置 ====================

    #[test]
    fn test_defaults() {
        let provider = make_provider("test-key");
        assert_eq!(provider.name(), "glm");
        assert_eq!(provider.base_url, GLM_DEFAULT_BASE_URL);
        assert_eq!(provider.model, GLM_DEFAULT_MODEL);
        assert_eq!(provider.hotwords, None);
        assert_eq!(provider.context, None);
    }

    #[test]
    fn test_custom_options() {
        let provider = GlmAsr::new(GlmAsrOption {
            base: BaseProviderOption {
                api_key: Some("custom-key".into()),
                base_url: Some("https://custom.url/api".into()),
                model: Some("custom-model".into()),
                ..Default::default()
            },
            hotwords: Some(vec!["hello".into(), "world".into()]),
            context: Some("test context".into()),
        });
        assert_eq!(provider.api_key, "custom-key");
        assert_eq!(provider.base_url, "https://custom.url/api");
        assert_eq!(provider.model, "custom-model");
        assert_eq!(provider.hotwords, Some("hello,world".into()));
        assert_eq!(provider.context, Some("test context".into()));
    }

    #[test]
    fn test_api_key_inheritance() {
        let provider = GlmAsr::new(GlmAsrOption {
            base: BaseProviderOption {
                api_key: None,
                ..Default::default()
            },
            ..Default::default()
        });
        assert_eq!(provider.api_key, "");
    }

    #[test]
    fn test_api_key_custom() {
        let provider = GlmAsr::new(GlmAsrOption {
            base: BaseProviderOption {
                api_key: Some("custom".into()),
                ..Default::default()
            },
            ..Default::default()
        });
        assert_eq!(provider.api_key, "custom");
    }

    #[test]
    fn test_model_custom() {
        let provider = GlmAsr::new(GlmAsrOption {
            base: BaseProviderOption {
                api_key: Some("k".into()),
                model: Some("custom-model".into()),
                ..Default::default()
            },
            ..Default::default()
        });
        assert_eq!(provider.model, "custom-model");
    }

    #[test]
    fn test_hotwords_none() {
        let provider = GlmAsr::new(GlmAsrOption {
            base: BaseProviderOption {
                api_key: Some("k".into()),
                ..Default::default()
            },
            hotwords: None,
            ..Default::default()
        });
        assert_eq!(provider.hotwords, None);
    }

    #[test]
    fn test_hotwords_empty_vec() {
        let provider = GlmAsr::new(GlmAsrOption {
            base: BaseProviderOption {
                api_key: Some("k".into()),
                ..Default::default()
            },
            hotwords: Some(vec![]),
            ..Default::default()
        });
        assert_eq!(provider.hotwords, None);
    }

    #[test]
    fn test_hotwords_multiple() {
        let provider = GlmAsr::new(GlmAsrOption {
            base: BaseProviderOption {
                api_key: Some("k".into()),
                ..Default::default()
            },
            hotwords: Some(vec!["a".into(), "b".into(), "c".into()]),
            ..Default::default()
        });
        assert_eq!(provider.hotwords, Some("a,b,c".into()));
    }

    #[test]
    fn test_context_some() {
        let provider = GlmAsr::new(GlmAsrOption {
            base: BaseProviderOption {
                api_key: Some("k".into()),
                ..Default::default()
            },
            context: Some("test".into()),
            ..Default::default()
        });
        assert_eq!(provider.context, Some("test".into()));
    }

    // ==================== 2.2 参数验证 ====================

    #[test]
    fn test_ensure_valid_passes() {
        let provider = make_provider("valid-key");
        assert!(provider.ensure_valid().is_ok());
    }

    #[test]
    fn test_ensure_valid_rejects_empty() {
        let provider = make_provider("");
        assert!(matches!(
            provider.ensure_valid(),
            Err(AsrError::InvalidParameter(_))
        ));
    }

    #[test]
    fn test_ensure_valid_rejects_default() {
        let provider = GlmAsr::new(GlmAsrOption {
            base: BaseProviderOption {
                api_key: None,
                ..Default::default()
            },
            ..Default::default()
        });
        assert!(matches!(
            provider.ensure_valid(),
            Err(AsrError::InvalidParameter(_))
        ));
    }

    // ==================== 2.3 SSE 解析 ====================

    #[test]
    fn test_sse_delta() {
        let json = r#"{"type":"transcript.text.delta","delta":"hello "}"#;
        let chunk = parse_sse_data(json).unwrap();
        assert_eq!(chunk.text, "hello ");
        assert!(!chunk.is_final);
        assert!(chunk.segment.is_none());
    }

    #[test]
    fn test_sse_delta_with_timestamps() {
        // delta 格式应忽略 timestamps
        let json =
            r#"{"type":"transcript.text.delta","delta":"hello","start_time":0,"end_time":1000}"#;
        let chunk = parse_sse_data(json).unwrap();
        assert_eq!(chunk.text, "hello");
        assert!(!chunk.is_final);
        assert!(chunk.segment.is_none()); // delta 格式不产生 segment
    }

    #[test]
    fn test_sse_done() {
        let json = r#"{"type":"transcript.text.done","text":"hello world"}"#;
        let chunk = parse_sse_data(json).unwrap();
        assert_eq!(chunk.text, "hello world");
        assert!(chunk.is_final);
    }

    #[test]
    fn test_sse_old_format_snake() {
        let json = r#"{"text":"hello","is_final":true}"#;
        let chunk = parse_sse_data(json).unwrap();
        assert_eq!(chunk.text, "hello");
        assert!(chunk.is_final);
    }

    #[test]
    fn test_sse_old_format_camel() {
        let json = r#"{"text":"hello","isFinal":true}"#;
        let chunk = parse_sse_data(json).unwrap();
        assert_eq!(chunk.text, "hello");
        assert!(chunk.is_final);
    }

    #[test]
    fn test_sse_old_format_not_final() {
        let json = r#"{"text":"partial","is_final":false}"#;
        let chunk = parse_sse_data(json).unwrap();
        assert_eq!(chunk.text, "partial");
        assert!(!chunk.is_final);
    }

    #[test]
    fn test_sse_old_format_with_segment() {
        let json = r#"{"text":"hello","is_final":true,"start_time":0,"end_time":1500}"#;
        let chunk = parse_sse_data(json).unwrap();
        assert!(chunk.is_final);
        let seg = chunk.segment.unwrap();
        assert_eq!(seg.start, 0);
        assert_eq!(seg.end, 1500);
        assert_eq!(seg.text, "hello");
    }

    #[test]
    fn test_sse_old_format_partial_segment() {
        // end_time 缺失时不应产生 segment
        let json = r#"{"text":"hello","is_final":true,"start_time":0}"#;
        let chunk = parse_sse_data(json).unwrap();
        assert!(chunk.is_final);
        assert!(chunk.segment.is_none());
    }

    #[test]
    fn test_sse_invalid_json() {
        assert!(parse_sse_data("not valid json").is_none());
    }

    #[test]
    fn test_sse_partial_json() {
        assert!(parse_sse_data(r#"{"type":"transcript.text.delta","delta":"par"#).is_none());
    }

    #[test]
    fn test_sse_empty_text() {
        // 对齐 TS `if (parsed.text)` falsy 行为
        assert!(parse_sse_data(r#"{"text":""}"#).is_none());
    }

    #[test]
    fn test_sse_unknown_type() {
        // 未知 type 但 text 存在 → fallthrough 到旧格式
        let json = r#"{"type":"unknown.event","text":"hello"}"#;
        let chunk = parse_sse_data(json).unwrap();
        assert_eq!(chunk.text, "hello");
        assert!(!chunk.is_final);
    }

    #[test]
    fn test_sse_empty_object() {
        assert!(parse_sse_data("{}").is_none());
    }

    // ==================== 2.4 错误解析 ====================

    #[test]
    fn test_error_standard() {
        let err = GlmAsr::parse_error_response(401, r#"{"error":{"message":"auth failed"}}"#);
        assert!(matches!(
            err,
            AsrError::HttpStatus {
                status: 401,
                message: _
            }
        ));
        if let AsrError::HttpStatus { ref message, .. } = err {
            assert_eq!(message, "auth failed");
        }
    }

    #[test]
    fn test_error_flat() {
        let err = GlmAsr::parse_error_response(400, r#"{"message":"bad request"}"#);
        if let AsrError::HttpStatus { ref message, .. } = err {
            assert_eq!(message, "bad request");
        }
    }

    #[test]
    fn test_error_both_levels() {
        // 应优先使用 error.message
        let err =
            GlmAsr::parse_error_response(403, r#"{"error":{"message":"inner"},"message":"outer"}"#);
        if let AsrError::HttpStatus { ref message, .. } = err {
            assert_eq!(message, "inner");
        }
    }

    #[test]
    fn test_error_no_json() {
        let err = GlmAsr::parse_error_response(500, "not json");
        if let AsrError::HttpStatus { ref message, .. } = err {
            assert_eq!(message, "HTTP 500: Internal Server Error");
        }
    }

    #[test]
    fn test_error_empty_body() {
        let err = GlmAsr::parse_error_response(502, "");
        if let AsrError::HttpStatus { ref message, .. } = err {
            assert_eq!(message, "HTTP 502: Bad Gateway");
        }
    }

    #[test]
    fn test_error_unknown_status() {
        let err = GlmAsr::parse_error_response(499, "");
        if let AsrError::HttpStatus { ref message, .. } = err {
            assert_eq!(message, "HTTP 499");
        }
    }

    // ==================== 2.5 SSE 字节流解析 ====================

    #[test]
    fn test_single_delta() {
        let mut buffer = b"data: {\"type\":\"transcript.text.delta\",\"delta\":\"hi \"}\n".to_vec();
        let (chunks, _done) = process_sse_buffer(&mut buffer);
        assert!(!_done);
        assert_eq!(chunks.len(), 1);
        assert_eq!(chunks[0].text, "hi ");
    }

    #[test]
    fn test_single_done() {
        let mut buffer = b"data: {\"type\":\"transcript.text.done\",\"text\":\"hi\"}\n".to_vec();
        let (chunks, _done) = process_sse_buffer(&mut buffer);
        assert!(!_done);
        assert_eq!(chunks.len(), 1);
        assert!(chunks[0].is_final);
    }

    #[test]
    fn test_multiple_events() {
        let input = concat!(
            "data: {\"type\":\"transcript.text.delta\",\"delta\":\"hello \"}\n",
            "data: {\"type\":\"transcript.text.delta\",\"delta\":\"world\"}\n",
            "data: {\"type\":\"transcript.text.done\",\"text\":\"hello world\"}\n",
        );
        let mut buffer = input.as_bytes().to_vec();
        let (chunks, _done) = process_sse_buffer(&mut buffer);
        // 注意：transcript.text.done 不是 [DONE] 信号，所以 _done = false
        assert!(!_done);
        assert_eq!(chunks.len(), 3);
        assert_eq!(chunks[0].text, "hello ");
        assert!(!chunks[0].is_final);
        assert_eq!(chunks[2].text, "hello world");
        assert!(chunks[2].is_final);
    }

    #[test]
    fn test_done_signal() {
        let mut buffer = b"data: [DONE]\n".to_vec();
        let (chunks, _done) = process_sse_buffer(&mut buffer);
        assert!(_done);
        assert_eq!(chunks.len(), 0);
    }

    #[test]
    fn test_empty_lines() {
        let mut buffer =
            b"\n\ndata: {\"type\":\"transcript.text.delta\",\"delta\":\"hi\"}\n\n".to_vec();
        let (chunks, _done) = process_sse_buffer(&mut buffer);
        assert!(!_done);
        assert_eq!(chunks.len(), 1);
    }

    #[test]
    fn test_crlf_endings() {
        let mut buffer =
            b"data: {\"type\":\"transcript.text.delta\",\"delta\":\"hi \"}\r\n".to_vec();
        let (chunks, _done) = process_sse_buffer(&mut buffer);
        assert_eq!(chunks.len(), 1);
        assert_eq!(chunks[0].text, "hi ");
    }

    #[test]
    fn test_trailing_spaces() {
        let mut buffer = b" data: {\"type\":\"transcript.text.delta\",\"delta\":\"hi\"}\n".to_vec();
        let (chunks, _done) = process_sse_buffer(&mut buffer);
        assert_eq!(chunks.len(), 1);
    }

    #[test]
    fn test_no_newline_trailing() {
        let mut buffer = b"data: {\"type\":\"transcript.text.delta\",\"delta\":\"hi\"}".to_vec();
        let (chunks, _done) = process_sse_buffer(&mut buffer);
        assert!(!_done);
        assert_eq!(chunks.len(), 0);
        assert!(!buffer.is_empty());
    }

    #[test]
    fn test_partial_line_accumulation() {
        let mut buffer = b"data: {\"type\":\"transcript.text.delta\",\"delta\":\"par".to_vec();
        let (chunks, _done) = process_sse_buffer(&mut buffer);
        assert_eq!(chunks.len(), 0);
        assert!(!buffer.is_empty());

        buffer.extend_from_slice(b"tial\"}\n");
        let (chunks, _done) = process_sse_buffer(&mut buffer);
        assert_eq!(chunks.len(), 1);
        assert_eq!(chunks[0].text, "partial");
    }

    #[test]
    fn test_non_data_line() {
        let mut buffer =
            b":comment\ndata: {\"type\":\"transcript.text.delta\",\"delta\":\"hi\"}\n".to_vec();
        let (chunks, _done) = process_sse_buffer(&mut buffer);
        assert_eq!(chunks.len(), 1);
    }

    // ==================== 2.6 音频流收集 ====================

    #[tokio::test]
    async fn test_collect_single_chunk() {
        let audio: AudioStream = Box::pin(stream::iter([vec![0u8; 100]]));
        let result = GlmAsr::collect_audio_stream(audio, GLM_MAX_FILE_SIZE)
            .await
            .unwrap();
        assert_eq!(result.len(), 100);
    }

    #[tokio::test]
    async fn test_collect_multiple_chunks() {
        let audio: AudioStream = Box::pin(stream::iter([vec![0u8; 50], vec![1u8; 50]]));
        let result = GlmAsr::collect_audio_stream(audio, GLM_MAX_FILE_SIZE)
            .await
            .unwrap();
        assert_eq!(result.len(), 100);
        assert_eq!(result[0], 0u8);
        assert_eq!(result[99], 1u8);
    }

    #[tokio::test]
    async fn test_collect_empty() {
        let audio: AudioStream = Box::pin(stream::empty());
        let result = GlmAsr::collect_audio_stream(audio, GLM_MAX_FILE_SIZE)
            .await
            .unwrap();
        assert_eq!(result.len(), 0);
    }

    #[tokio::test]
    async fn test_collect_exceeds_limit() {
        let chunks = vec![vec![0u8; 50], vec![0u8; 60]];
        let audio: AudioStream = Box::pin(stream::iter(chunks));
        let result = GlmAsr::collect_audio_stream(audio, 100).await;
        assert!(matches!(result, Err(AsrError::InvalidParameter(_))));
    }

    // ==================== 2.7 边界场景 ====================

    #[test]
    fn test_consecutive_done_signals() {
        let mut buffer = b"data: [DONE]\ndata: [DONE]\n".to_vec();
        let (chunks, _done) = process_sse_buffer(&mut buffer);
        assert!(_done);
        // 第一个 [DONE] 触发终止，第二个不会到达
        assert_eq!(chunks.len(), 0);
    }

    #[test]
    fn test_mixed_format_stream() {
        let input = concat!(
            "data: {\"type\":\"transcript.text.delta\",\"delta\":\"hello \"}\n",
            "data: {\"type\":\"transcript.text.done\",\"text\":\"hello world\"}\n",
            "data: {\"text\":\"legacy\",\"is_final\":true}\n",
            "data: [DONE]\n",
        );
        let mut buffer = input.as_bytes().to_vec();
        let (chunks, _done) = process_sse_buffer(&mut buffer);
        assert!(_done);
        assert_eq!(chunks.len(), 3);
        assert_eq!(chunks[0].text, "hello ");
        assert!(!chunks[0].is_final);
        assert_eq!(chunks[1].text, "hello world");
        assert!(chunks[1].is_final);
        assert_eq!(chunks[2].text, "legacy");
        assert!(chunks[2].is_final);
    }

    #[test]
    fn test_buffer_reuse_after_partial() {
        let mut buffer = b"data: {\"type\":\"transcript.text.delta\",\"delta\":\"par".to_vec();
        let (_, _) = process_sse_buffer(&mut buffer);
        assert!(!buffer.is_empty());

        buffer.extend_from_slice(b"tial\"}\n");
        let (chunks, _done) = process_sse_buffer(&mut buffer);
        assert!(!_done);
        assert_eq!(chunks.len(), 1);
        assert_eq!(chunks[0].text, "partial");
    }

    #[test]
    fn test_unicode_chinese() {
        let json = r#"{"text":"你好世界","is_final":true}"#;
        let chunk = parse_sse_data(json).unwrap();
        assert_eq!(chunk.text, "你好世界");
        assert!(chunk.is_final);
    }

    #[test]
    fn test_unicode_emoji() {
        let json = r#"{"text":"🎉🎊","is_final":true}"#;
        let chunk = parse_sse_data(json).unwrap();
        assert_eq!(chunk.text, "🎉🎊");
        assert!(chunk.is_final);
    }

    #[test]
    fn test_utf8_across_3byte_chunk_boundary() {
        // "测" = [230, 181, 139]
        let mut buffer = b"data: {\"type\":\"transcript.text.delta\",\"delta\":\"\xe6\xb5".to_vec();
        let (chunks, _) = process_sse_buffer(&mut buffer);
        assert_eq!(chunks.len(), 0);

        buffer.extend_from_slice(b"\x8b\"}\n");
        let (chunks, _) = process_sse_buffer(&mut buffer);
        assert_eq!(chunks.len(), 1);
        assert_eq!(chunks[0].text, "测");
    }

    #[test]
    fn test_utf8_across_4byte_chunk_boundary() {
        // 🎉 = [240, 159, 142, 137]
        let mut buffer =
            b"data: {\"type\":\"transcript.text.delta\",\"delta\":\"\xf0\x9f\x8e".to_vec();
        let (chunks, _) = process_sse_buffer(&mut buffer);
        assert_eq!(chunks.len(), 0);

        buffer.extend_from_slice(b"\x89\"}\n");
        let (chunks, _) = process_sse_buffer(&mut buffer);
        assert_eq!(chunks.len(), 1);
        assert_eq!(chunks[0].text, "🎉");
    }

    #[test]
    fn test_cr_only_line_endings() {
        let mut buffer = b"data: {\"type\":\"transcript.text.delta\",\"delta\":\"hi \"}\rdata: {\"type\":\"transcript.text.done\",\"text\":\"hi\"}\r".to_vec();
        let (chunks, _done) = process_sse_buffer(&mut buffer);
        assert!(!_done);
        assert_eq!(chunks.len(), 2);
        assert_eq!(chunks[0].text, "hi ");
        assert_eq!(chunks[1].text, "hi");
        assert!(chunks[1].is_final);
    }

    #[test]
    fn test_unknown_type_error_event() {
        // 未知 type 且无 text → 静默丢弃
        let json = r#"{"type":"transcript.text.error","message":"error"}"#;
        assert!(parse_sse_data(json).is_none());
    }

    #[test]
    fn test_newline_in_json_value() {
        // JSON 值内含 \n 导致截断 → 解析失败 → 静默跳过
        let data = "{\"delta\":\"a\nb\"}";
        assert!(parse_sse_data(data).is_none());
    }

    #[test]
    fn test_very_long_line() {
        // 构造一个超过 64KB 的 data 行
        let long_delta = "A".repeat(65536);
        let json = serde_json::json!({"type":"transcript.text.delta","delta":long_delta});
        let line = format!("data: {}\n", json);
        let mut buffer = line.as_bytes().to_vec();
        let (chunks, _done) = process_sse_buffer(&mut buffer);
        assert!(!_done);
        assert_eq!(chunks.len(), 1);
        assert_eq!(chunks[0].text.len(), 65536);
    }

    #[test]
    fn test_response_with_only_comments() {
        let mut buffer = b":comment1\n:comment2\n:comment3\n".to_vec();
        let (chunks, _done) = process_sse_buffer(&mut buffer);
        assert!(!_done);
        assert_eq!(chunks.len(), 0);
    }

    #[tokio::test]
    async fn test_zero_length_chunk() {
        // TC49: 空 Vec<u8> chunk → extend_from_slice 安全处理
        let audio: AudioStream = Box::pin(stream::iter([vec![0u8; 10], vec![], vec![0u8; 10]]));
        let result = GlmAsr::collect_audio_stream(audio, GLM_MAX_FILE_SIZE)
            .await
            .unwrap();
        assert_eq!(result.len(), 20);
    }
}
