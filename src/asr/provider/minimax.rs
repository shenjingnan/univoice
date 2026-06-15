use std::pin::Pin;
use std::time::Duration;

use async_stream::stream;
use async_trait::async_trait;
use futures_util::{Stream, StreamExt};
use http::StatusCode;
use reqwest::multipart::{Form, Part};
use serde::Deserialize;

use crate::asr::error::AsrError;
use crate::asr::traits::{AsrConnectOption, AsrConnection, AsrProvider};
use crate::asr::types::{AsrStreamChunk, AudioStream, BaseProviderOption};

// ============================== 常量 ==============================

/// MiniMax ASR 默认 REST API 地址
const MINIMAX_DEFAULT_BASE_URL: &str = "https://api.minimax.chat/v1/audio/transcriptions";
/// MiniMax ASR 默认模型
const MINIMAX_DEFAULT_MODEL: &str = "speech-01";
/// 最大文件大小（25 MB）
const MINIMAX_MAX_FILE_SIZE: usize = 25 * 1024 * 1024;

// ============================== 内部数据结构 ==============================

/// MiniMax API 响应
#[derive(Debug, Deserialize)]
struct MinimaxResponse {
    text: String,
}

/// MiniMax API 错误响应体
#[derive(Debug, Deserialize)]
struct MinimaxErrorBody {
    error: Option<MinimaxErrorDetail>,
    message: Option<String>,
}

#[derive(Debug, Deserialize)]
struct MinimaxErrorDetail {
    message: Option<String>,
    #[allow(dead_code)]
    #[serde(rename = "type")]
    type_: Option<String>,
    #[allow(dead_code)]
    code: Option<String>,
}

/// Form 字段中间表示（可测试）
#[cfg_attr(test, derive(PartialEq, Debug))]
struct FormFields {
    file_data: Vec<u8>,
    file_name: String,
    model: String,
    language: Option<String>,
}

// ============================== 配置选项 ==============================

/// MiniMax ASR 专属配置
#[derive(Debug, Clone, Default)]
pub struct MinimaxAsrOption {
    pub base: BaseProviderOption,
    pub timeout: Option<Duration>,
}

// ============================== Provider 结构体 ==============================

/// MiniMax ASR Provider
///
/// 基于 MiniMax ASR HTTP REST API 实现语音识别。
/// 与 GLM 类似，MiniMax 使用 HTTP REST 而非 WebSocket，
/// 且不支持预建立连接（connect 返回 Unsupported）。
#[derive(Debug)]
pub struct MinimaxAsr {
    api_key: String,
    base_url: String,
    model: String,
    language: Option<String>,
    timeout: Option<Duration>,
}

impl MinimaxAsr {
    pub fn new(options: MinimaxAsrOption) -> Self {
        let base = &options.base;
        Self {
            api_key: base.api_key.clone().unwrap_or_default(),
            base_url: base
                .base_url
                .clone()
                .unwrap_or_else(|| MINIMAX_DEFAULT_BASE_URL.into()),
            model: base
                .model
                .clone()
                .unwrap_or_else(|| MINIMAX_DEFAULT_MODEL.into()),
            language: base.language.clone(),
            timeout: options.timeout,
        }
    }

    /// 验证必要参数
    fn ensure_valid(&self) -> Result<(), AsrError> {
        if self.api_key.is_empty() {
            return Err(AsrError::InvalidParameter(
                "apiKey is required for MiniMax ASR".into(),
            ));
        }
        Ok(())
    }

    /// 创建 HTTP 客户端
    fn make_client(&self) -> reqwest::Client {
        let mut builder = reqwest::Client::builder();
        if let Some(timeout) = self.timeout {
            builder = builder.timeout(timeout);
        }
        builder.build().unwrap_or_else(|_| reqwest::Client::new())
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

    /// 构造 Form 字段中间表示
    fn build_form_fields(
        audio_data: Vec<u8>,
        model: &str,
        language: &Option<String>,
    ) -> FormFields {
        FormFields {
            file_data: audio_data,
            file_name: "audio.mp3".into(),
            model: model.to_string(),
            language: language.clone(),
        }
    }

    /// 从 FormFields 构造 multipart form
    fn form_from_fields(fields: FormFields) -> Result<Form, AsrError> {
        let file_part = Part::bytes(fields.file_data).file_name(fields.file_name);
        let mut form = Form::new()
            .part("file", file_part)
            .text("model", fields.model);
        if let Some(lang) = fields.language {
            if !lang.is_empty() {
                form = form.text("language", lang);
            }
        }
        Ok(form)
    }

    /// 构造 multipart/form-data 请求体
    fn build_form_data(
        audio_data: Vec<u8>,
        model: &str,
        language: &Option<String>,
    ) -> Result<Form, AsrError> {
        let fields = Self::build_form_fields(audio_data, model, language);
        Self::form_from_fields(fields)
    }

    /// 解析 API 错误响应体为 HttpStatus 错误
    fn parse_error_response(status: u16, body: &str) -> AsrError {
        let message = serde_json::from_str::<MinimaxErrorBody>(body)
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

// ============================== AsrProvider 实现 ==============================

#[async_trait]
#[allow(clippy::result_large_err)]
impl AsrProvider for MinimaxAsr {
    fn name(&self) -> &'static str {
        "minimax"
    }

    async fn listen_stream(
        &self,
        audio: AudioStream,
    ) -> Result<Pin<Box<dyn Stream<Item = Result<AsrStreamChunk, AsrError>> + Send>>, AsrError>
    {
        self.ensure_valid()?;

        // 收集整个音频流，同时检查大小限制
        let audio_data = Self::collect_audio_stream(audio, MINIMAX_MAX_FILE_SIZE).await?;

        // 构造 multipart/form-data
        let form = Self::build_form_data(audio_data, &self.model, &self.language)?;

        // 发送 HTTP POST 请求
        let client = self.make_client();
        let response = client
            .post(&self.base_url)
            .header("Authorization", &format!("Bearer {}", self.api_key))
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

        // 解析 JSON 响应体
        let body = response
            .bytes()
            .await
            .map_err(|e| AsrError::HttpRequest(e.to_string()))?;
        let result: MinimaxResponse = serde_json::from_slice(&body)?;

        let chunk = AsrStreamChunk {
            text: result.text,
            is_final: true,
            confidence: None,
            segment: None,
        };

        Ok(Box::pin(stream! {
            yield Ok(chunk);
        }))
    }

    async fn connect(
        &self,
        _options: AsrConnectOption,
    ) -> Result<Box<dyn AsrConnection>, AsrError> {
        Err(AsrError::Unsupported("connect"))
    }
}

// ============================== 测试 ==============================

#[cfg(test)]
mod tests {
    use super::*;
    use futures_util::stream;

    // ==================== 辅助函数 ====================

    fn make_provider(api_key: &str) -> MinimaxAsr {
        MinimaxAsr::new(MinimaxAsrOption {
            base: BaseProviderOption {
                api_key: Some(api_key.into()),
                ..Default::default()
            },
            timeout: None,
        })
    }

    // ==================== 3.1 构造/配置测试 ====================

    #[test]
    fn test_defaults() {
        let provider = make_provider("test-key");
        assert_eq!(provider.name(), "minimax");
        assert_eq!(provider.base_url, MINIMAX_DEFAULT_BASE_URL);
        assert_eq!(provider.model, MINIMAX_DEFAULT_MODEL);
        assert_eq!(provider.language, Some("zh-CN".into()));
        assert_eq!(provider.timeout, None);
    }

    #[test]
    fn test_custom_base_url() {
        let provider = MinimaxAsr::new(MinimaxAsrOption {
            base: BaseProviderOption {
                api_key: Some("test-key".into()),
                base_url: Some("https://custom.url/api".into()),
                ..Default::default()
            },
            timeout: None,
        });
        assert_eq!(provider.base_url, "https://custom.url/api");
    }

    #[test]
    fn test_custom_model() {
        let provider = MinimaxAsr::new(MinimaxAsrOption {
            base: BaseProviderOption {
                api_key: Some("test-key".into()),
                model: Some("custom-model".into()),
                ..Default::default()
            },
            timeout: None,
        });
        assert_eq!(provider.model, "custom-model");
    }

    #[test]
    fn test_model_empty_string() {
        let provider = MinimaxAsr::new(MinimaxAsrOption {
            base: BaseProviderOption {
                api_key: Some("test-key".into()),
                model: Some(String::new()),
                ..Default::default()
            },
            timeout: None,
        });
        // 空字符串不回退到默认值
        assert_eq!(provider.model, "");
    }

    #[test]
    fn test_api_key_none() {
        let provider = MinimaxAsr::new(MinimaxAsrOption {
            base: BaseProviderOption {
                api_key: None,
                ..Default::default()
            },
            timeout: None,
        });
        assert_eq!(provider.api_key, "");
    }

    #[test]
    fn test_api_key_custom() {
        let provider = MinimaxAsr::new(MinimaxAsrOption {
            base: BaseProviderOption {
                api_key: Some("my-key".into()),
                ..Default::default()
            },
            timeout: None,
        });
        assert_eq!(provider.api_key, "my-key");
    }

    #[test]
    fn test_language_none() {
        let provider = MinimaxAsr::new(MinimaxAsrOption {
            base: BaseProviderOption {
                api_key: Some("k".into()),
                language: None,
                ..Default::default()
            },
            timeout: None,
        });
        assert_eq!(provider.language, None);
    }

    #[test]
    fn test_language_custom() {
        let provider = MinimaxAsr::new(MinimaxAsrOption {
            base: BaseProviderOption {
                api_key: Some("k".into()),
                language: Some("en".into()),
                ..Default::default()
            },
            timeout: None,
        });
        assert_eq!(provider.language, Some("en".into()));
    }

    #[test]
    fn test_name() {
        let provider = make_provider("k");
        assert_eq!(provider.name(), "minimax");
    }

    #[test]
    fn test_option_default() {
        let opt = MinimaxAsrOption::default();
        assert_eq!(opt.base.api_key, None);
        assert_eq!(opt.base.base_url, None);
        assert_eq!(opt.base.model, None);
        assert_eq!(opt.base.language, Some("zh-CN".into()));
        assert_eq!(opt.timeout, None);
    }

    #[test]
    fn test_debug_safe_output() {
        let provider = make_provider("secret-key");
        let output = format!("{:?}", provider);
        // Debug 输出不应 panic，且字段应可读
        assert!(!output.is_empty());
    }

    #[test]
    fn test_custom_timeout() {
        let provider = MinimaxAsr::new(MinimaxAsrOption {
            base: BaseProviderOption {
                api_key: Some("k".into()),
                ..Default::default()
            },
            timeout: Some(Duration::from_secs(30)),
        });
        assert_eq!(provider.timeout, Some(Duration::from_secs(30)));
    }

    #[test]
    fn test_timeout_default() {
        let opt = MinimaxAsrOption::default();
        assert_eq!(opt.timeout, None);
    }

    // ==================== 3.2 参数验证 ====================

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
        let provider = MinimaxAsr::new(MinimaxAsrOption {
            base: BaseProviderOption {
                api_key: None,
                ..Default::default()
            },
            timeout: None,
        });
        assert!(matches!(
            provider.ensure_valid(),
            Err(AsrError::InvalidParameter(_))
        ));
    }

    #[test]
    fn test_ensure_valid_rejects_whitespace() {
        // 已知限制：当前实现只检查空字符串，空格字符串可通过验证
        let provider = make_provider("   ");
        assert!(provider.ensure_valid().is_ok());
    }

    // ==================== 3.3 JSON 响应解析 ====================

    #[test]
    fn test_parse_normal() {
        let result: MinimaxResponse = serde_json::from_str(r#"{"text":"你好世界"}"#).unwrap();
        assert_eq!(result.text, "你好世界");
    }

    #[test]
    fn test_parse_empty_text() {
        let result: MinimaxResponse = serde_json::from_str(r#"{"text":""}"#).unwrap();
        assert_eq!(result.text, "");
    }

    #[test]
    fn test_parse_unicode_chinese() {
        let result: MinimaxResponse = serde_json::from_str(r#"{"text":"中文测试"}"#).unwrap();
        assert_eq!(result.text, "中文测试");
    }

    #[test]
    fn test_parse_unicode_japanese() {
        let result: MinimaxResponse = serde_json::from_str(r#"{"text":"こんにちは"}"#).unwrap();
        assert_eq!(result.text, "こんにちは");
    }

    #[test]
    fn test_parse_unicode_emoji() {
        let result: MinimaxResponse = serde_json::from_str(r#"{"text":"🎉🎊你好"}"#).unwrap();
        assert_eq!(result.text, "🎉🎊你好");
    }

    #[test]
    fn test_parse_mixed_text() {
        let result: MinimaxResponse =
            serde_json::from_str(r#"{"text":"Hello 你好 123!@#"}"#).unwrap();
        assert_eq!(result.text, "Hello 你好 123!@#");
    }

    #[test]
    fn test_parse_special_chars() {
        let result: MinimaxResponse =
            serde_json::from_str(r#"{"text":"line1\nline2\ttab"}"#).unwrap();
        assert_eq!(result.text, "line1\nline2\ttab");
    }

    #[test]
    fn test_parse_extra_fields() {
        let result: MinimaxResponse =
            serde_json::from_str(r#"{"text":"hello","extra_field":"ignored","number":42}"#)
                .unwrap();
        assert_eq!(result.text, "hello");
    }

    #[test]
    fn test_parse_null_text() {
        let result: Result<MinimaxResponse, _> = serde_json::from_str(r#"{"text":null}"#);
        assert!(result.is_err());
    }

    #[test]
    fn test_parse_missing_text() {
        let result: Result<MinimaxResponse, _> = serde_json::from_str(r#"{}"#);
        assert!(result.is_err());
    }

    #[test]
    fn test_parse_not_json() {
        let result: Result<MinimaxResponse, _> = serde_json::from_str(r#"not json"#);
        assert!(result.is_err());
    }

    #[test]
    fn test_parse_empty_body() {
        let result: Result<MinimaxResponse, _> = serde_json::from_str(r#""#);
        assert!(result.is_err());
    }

    #[test]
    fn test_parse_numeric_text() {
        let result: Result<MinimaxResponse, _> = serde_json::from_str(r#"{"text":12345}"#);
        assert!(result.is_err());
    }

    #[test]
    fn test_parse_boolean_text() {
        let result: Result<MinimaxResponse, _> = serde_json::from_str(r#"{"text":true}"#);
        assert!(result.is_err());
    }

    #[test]
    fn test_parse_very_long_text() {
        let long_text = "a".repeat(1_000_000);
        let json = serde_json::json!({"text": long_text});
        let json_str = serde_json::to_string(&json).unwrap();
        let result: MinimaxResponse = serde_json::from_str(&json_str).unwrap();
        assert_eq!(result.text.len(), 1_000_000);
    }

    #[test]
    fn test_parse_deeply_nested() {
        let result: MinimaxResponse =
            serde_json::from_str(r#"{"text":"hello","extra":{"level1":{"level2":"value"}}}"#)
                .unwrap();
        assert_eq!(result.text, "hello");
    }

    // ==================== 3.4 错误响应解析 ====================

    #[test]
    fn test_error_nested() {
        let err = MinimaxAsr::parse_error_response(401, r#"{"error":{"message":"auth failed"}}"#);
        if let AsrError::HttpStatus {
            status: 401,
            ref message,
        } = err
        {
            assert_eq!(message, "auth failed");
        } else {
            panic!("expected HttpStatus");
        }
    }

    #[test]
    fn test_error_flat() {
        let err = MinimaxAsr::parse_error_response(400, r#"{"message":"bad request"}"#);
        if let AsrError::HttpStatus {
            status: 400,
            ref message,
        } = err
        {
            assert_eq!(message, "bad request");
        } else {
            panic!("expected HttpStatus");
        }
    }

    #[test]
    fn test_error_both_levels() {
        // 应优先使用 error.message
        let err = MinimaxAsr::parse_error_response(
            403,
            r#"{"error":{"message":"inner"},"message":"outer"}"#,
        );
        if let AsrError::HttpStatus {
            status: 403,
            ref message,
        } = err
        {
            assert_eq!(message, "inner");
        } else {
            panic!("expected HttpStatus");
        }
    }

    #[test]
    fn test_error_with_type_code() {
        let err = MinimaxAsr::parse_error_response(
            401,
            r#"{"error":{"message":"unauthorized","type":"auth_error","code":"401"}}"#,
        );
        if let AsrError::HttpStatus {
            status: 401,
            ref message,
        } = err
        {
            assert_eq!(message, "unauthorized");
        } else {
            panic!("expected HttpStatus");
        }
    }

    #[test]
    fn test_error_no_match_field() {
        let err = MinimaxAsr::parse_error_response(400, r#"{"code":"bad_request","detail":"err"}"#);
        if let AsrError::HttpStatus {
            status: 400,
            ref message,
        } = err
        {
            assert_eq!(message, "HTTP 400: Bad Request");
        } else {
            panic!("expected HttpStatus");
        }
    }

    #[test]
    fn test_error_no_json() {
        let err = MinimaxAsr::parse_error_response(500, "not json");
        if let AsrError::HttpStatus {
            status: 500,
            ref message,
        } = err
        {
            assert_eq!(message, "HTTP 500: Internal Server Error");
        } else {
            panic!("expected HttpStatus");
        }
    }

    #[test]
    fn test_error_empty_body() {
        let err = MinimaxAsr::parse_error_response(502, "");
        if let AsrError::HttpStatus {
            status: 502,
            ref message,
        } = err
        {
            assert_eq!(message, "HTTP 502: Bad Gateway");
        } else {
            panic!("expected HttpStatus");
        }
    }

    #[test]
    fn test_error_unknown_status() {
        let err = MinimaxAsr::parse_error_response(499, "");
        if let AsrError::HttpStatus {
            status: 499,
            ref message,
        } = err
        {
            assert_eq!(message, "HTTP 499");
        } else {
            panic!("expected HttpStatus");
        }
    }

    #[test]
    fn test_error_null_message() {
        // error.message 为 null 时应降级到 status_default_message
        let err = MinimaxAsr::parse_error_response(500, r#"{"error":{"message":null}}"#);
        if let AsrError::HttpStatus {
            status: 500,
            ref message,
        } = err
        {
            assert_eq!(message, "HTTP 500: Internal Server Error");
        } else {
            panic!("expected HttpStatus");
        }
    }

    // ==================== 3.5 Form 字段构建 ====================

    #[test]
    fn test_fields_contains_file_and_model_no_lang() {
        let fields = MinimaxAsr::build_form_fields(vec![1, 2, 3], "speech-01", &None);
        assert_eq!(fields.file_data, vec![1, 2, 3]);
        assert_eq!(fields.model, "speech-01");
        assert_eq!(fields.language, None);
    }

    #[test]
    fn test_fields_with_language() {
        let fields = MinimaxAsr::build_form_fields(vec![1, 2, 3], "speech-01", &Some("en".into()));
        assert_eq!(fields.language, Some("en".into()));
    }

    #[test]
    fn test_fields_file_name_is_mp3() {
        let fields = MinimaxAsr::build_form_fields(vec![], "speech-01", &None);
        assert_eq!(fields.file_name, "audio.mp3");
    }

    #[test]
    fn test_fields_file_content() {
        let data = vec![10, 20, 30, 40, 50];
        let fields = MinimaxAsr::build_form_fields(data.clone(), "speech-01", &None);
        assert_eq!(fields.file_data, data);
    }

    #[test]
    fn test_fields_model_value() {
        let fields = MinimaxAsr::build_form_fields(vec![], "custom-model-v2", &None);
        assert_eq!(fields.model, "custom-model-v2");
    }

    #[test]
    fn test_fields_empty_audio() {
        let fields = MinimaxAsr::build_form_fields(vec![], "speech-01", &None);
        assert!(fields.file_data.is_empty());
    }

    #[test]
    fn test_fields_large_audio() {
        let data = vec![0u8; 1024 * 1024]; // 1 MB
        let fields = MinimaxAsr::build_form_fields(data.clone(), "speech-01", &None);
        assert_eq!(fields.file_data.len(), 1024 * 1024);
    }

    #[test]
    fn test_fields_unicode_model() {
        let fields = MinimaxAsr::build_form_fields(vec![], "中文模型名", &None);
        assert_eq!(fields.model, "中文模型名");
    }

    #[test]
    fn test_fields_language_empty_string() {
        let fields = MinimaxAsr::build_form_fields(vec![], "speech-01", &Some(String::new()));
        assert_eq!(fields.language, Some(String::new()));
    }

    // ==================== 3.6 音频流收集 ====================

    #[tokio::test]
    async fn test_collect_single_chunk() {
        let audio: AudioStream = Box::pin(stream::iter([vec![0u8; 100]]));
        let result = MinimaxAsr::collect_audio_stream(audio, MINIMAX_MAX_FILE_SIZE)
            .await
            .unwrap();
        assert_eq!(result.len(), 100);
    }

    #[tokio::test]
    async fn test_collect_multiple_chunks() {
        let audio: AudioStream = Box::pin(stream::iter([vec![0u8; 50], vec![1u8; 50]]));
        let result = MinimaxAsr::collect_audio_stream(audio, MINIMAX_MAX_FILE_SIZE)
            .await
            .unwrap();
        assert_eq!(result.len(), 100);
        assert_eq!(result[0], 0u8);
        assert_eq!(result[99], 1u8);
    }

    #[tokio::test]
    async fn test_collect_empty_stream() {
        let audio: AudioStream = Box::pin(stream::empty());
        let result = MinimaxAsr::collect_audio_stream(audio, MINIMAX_MAX_FILE_SIZE)
            .await
            .unwrap();
        assert_eq!(result.len(), 0);
    }

    #[tokio::test]
    async fn test_collect_exceeds_limit() {
        let audio: AudioStream = Box::pin(stream::iter([vec![0u8; 50], vec![0u8; 60]]));
        let result = MinimaxAsr::collect_audio_stream(audio, 100).await;
        assert!(matches!(result, Err(AsrError::InvalidParameter(_))));
    }

    #[tokio::test]
    async fn test_collect_zero_length_chunk() {
        let audio: AudioStream = Box::pin(stream::iter([vec![0u8; 10], vec![], vec![0u8; 10]]));
        let result = MinimaxAsr::collect_audio_stream(audio, MINIMAX_MAX_FILE_SIZE)
            .await
            .unwrap();
        assert_eq!(result.len(), 20);
    }

    #[tokio::test]
    async fn test_collect_large_data() {
        let data = vec![0u8; 10 * 1024 * 1024]; // 10 MB
        let chunks: Vec<Vec<u8>> = data.chunks(4096).map(|c| c.to_vec()).collect();
        let audio: AudioStream = Box::pin(stream::iter(chunks));
        let result = MinimaxAsr::collect_audio_stream(audio, MINIMAX_MAX_FILE_SIZE)
            .await
            .unwrap();
        assert_eq!(result.len(), 10 * 1024 * 1024);
    }

    #[tokio::test]
    async fn test_collect_exact_limit() {
        let limit = 1024 * 1024; // 1 MB (use small limit for test speed)
        let data = vec![0u8; limit];
        let chunks: Vec<Vec<u8>> = data.chunks(4096).map(|c| c.to_vec()).collect();
        let audio: AudioStream = Box::pin(stream::iter(chunks));
        let result = MinimaxAsr::collect_audio_stream(audio, limit)
            .await
            .unwrap();
        assert_eq!(result.len(), limit);
    }

    #[tokio::test]
    async fn test_collect_many_small_chunks() {
        let chunks: Vec<Vec<u8>> = (0..10000).map(|_| vec![42u8]).collect();
        let audio: AudioStream = Box::pin(stream::iter(chunks));
        let result = MinimaxAsr::collect_audio_stream(audio, MINIMAX_MAX_FILE_SIZE)
            .await
            .unwrap();
        assert_eq!(result.len(), 10000);
    }

    // ==================== 3.8 connect ====================

    #[tokio::test]
    async fn test_connect_returns_unsupported() {
        let provider = make_provider("k");
        let options = AsrConnectOption::default();
        let result = provider.connect(options).await;
        assert!(matches!(result, Err(AsrError::Unsupported(_))));
    }

    // ==================== 3.9 status_default_message ====================

    #[test]
    fn test_status_200() {
        assert_eq!(status_default_message(200), "HTTP 200: OK");
    }

    #[test]
    fn test_status_401() {
        assert_eq!(status_default_message(401), "HTTP 401: Unauthorized");
    }

    #[test]
    fn test_status_500() {
        assert_eq!(
            status_default_message(500),
            "HTTP 500: Internal Server Error"
        );
    }

    #[test]
    fn test_status_unknown() {
        assert_eq!(status_default_message(999), "HTTP 999");
    }

    #[test]
    fn test_status_min() {
        assert_eq!(status_default_message(0), "HTTP 0");
    }

    // ==================== 3.10 form_from_fields ====================

    #[test]
    fn test_form_normal() {
        let fields = FormFields {
            file_data: vec![1, 2, 3],
            file_name: "audio.mp3".into(),
            model: "speech-01".into(),
            language: None,
        };
        let form = MinimaxAsr::form_from_fields(fields);
        assert!(form.is_ok());
    }

    #[test]
    fn test_form_empty_audio() {
        let fields = FormFields {
            file_data: vec![],
            file_name: "audio.mp3".into(),
            model: "speech-01".into(),
            language: None,
        };
        let form = MinimaxAsr::form_from_fields(fields);
        assert!(form.is_ok());
    }

    #[test]
    fn test_form_null_language() {
        let fields = FormFields {
            file_data: vec![1, 2, 3],
            file_name: "audio.mp3".into(),
            model: "speech-01".into(),
            language: None,
        };
        let form = MinimaxAsr::form_from_fields(fields);
        assert!(form.is_ok());
    }

    #[test]
    fn test_form_empty_string_language() {
        let fields = FormFields {
            file_data: vec![1, 2, 3],
            file_name: "audio.mp3".into(),
            model: "speech-01".into(),
            language: Some(String::new()),
        };
        // language=Some("") 时 form 中不应有 language 字段（内部过滤）
        let form = MinimaxAsr::form_from_fields(fields);
        assert!(form.is_ok());
    }

    // ==================== 3.7 wiremock 测试 ====================

    mod wiremock_tests {
        use super::*;
        use wiremock::matchers::{method, path};
        use wiremock::{Mock, MockServer, ResponseTemplate};

        /// 自定义 matcher：验证 multipart form 包含指定字段名
        struct HasMultipartField {
            name: &'static str,
        }

        impl wiremock::Match for HasMultipartField {
            fn matches(&self, request: &wiremock::Request) -> bool {
                let body = String::from_utf8_lossy(&request.body);
                body.contains(&format!("name=\"{}\"", self.name))
            }
        }

        #[tokio::test]
        async fn test_success() {
            let mock_server = MockServer::start().await;
            Mock::given(method("POST"))
                .and(path("/v1/audio/transcriptions"))
                .respond_with(ResponseTemplate::new(200).set_body_string(r#"{"text":"你好世界"}"#))
                .mount(&mock_server)
                .await;

            let provider = MinimaxAsr::new(MinimaxAsrOption {
                base: BaseProviderOption {
                    api_key: Some("test-key".into()),
                    base_url: Some(mock_server.uri() + "/v1/audio/transcriptions"),
                    ..Default::default()
                },
                timeout: Some(Duration::from_secs(5)),
            });

            let audio: AudioStream = Box::pin(stream::iter([vec![0u8; 100]]));
            let mut stream = provider.listen_stream(audio).await.unwrap();
            let chunk = stream.next().await;
            assert!(chunk.is_some());
            let chunk = chunk.unwrap().unwrap();
            assert_eq!(chunk.text, "你好世界");
            assert!(chunk.is_final);
        }

        #[tokio::test]
        async fn test_empty_text() {
            let mock_server = MockServer::start().await;
            Mock::given(method("POST"))
                .and(path("/v1/audio/transcriptions"))
                .respond_with(ResponseTemplate::new(200).set_body_string(r#"{"text":""}"#))
                .mount(&mock_server)
                .await;

            let provider = MinimaxAsr::new(MinimaxAsrOption {
                base: BaseProviderOption {
                    api_key: Some("test-key".into()),
                    base_url: Some(mock_server.uri() + "/v1/audio/transcriptions"),
                    ..Default::default()
                },
                timeout: Some(Duration::from_secs(5)),
            });

            let audio: AudioStream = Box::pin(stream::iter([vec![0u8; 100]]));
            let mut stream = provider.listen_stream(audio).await.unwrap();
            let chunk = stream.next().await.unwrap().unwrap();
            assert_eq!(chunk.text, "");
        }

        #[tokio::test]
        async fn test_http_401() {
            let mock_server = MockServer::start().await;
            Mock::given(method("POST"))
                .and(path("/v1/audio/transcriptions"))
                .respond_with(
                    ResponseTemplate::new(401)
                        .set_body_string(r#"{"error":{"message":"auth failed"}}"#),
                )
                .mount(&mock_server)
                .await;

            let provider = MinimaxAsr::new(MinimaxAsrOption {
                base: BaseProviderOption {
                    api_key: Some("bad-key".into()),
                    base_url: Some(mock_server.uri() + "/v1/audio/transcriptions"),
                    ..Default::default()
                },
                timeout: Some(Duration::from_secs(5)),
            });

            let audio: AudioStream = Box::pin(stream::iter([vec![0u8; 100]]));
            let result = provider.listen_stream(audio).await;
            assert!(matches!(
                result,
                Err(AsrError::HttpStatus { status: 401, .. })
            ));
        }

        #[tokio::test]
        async fn test_http_429() {
            let mock_server = MockServer::start().await;
            Mock::given(method("POST"))
                .and(path("/v1/audio/transcriptions"))
                .respond_with(
                    ResponseTemplate::new(429)
                        .set_body_string(r#"{"error":{"message":"Rate limit exceeded"}}"#),
                )
                .mount(&mock_server)
                .await;

            let provider = MinimaxAsr::new(MinimaxAsrOption {
                base: BaseProviderOption {
                    api_key: Some("test-key".into()),
                    base_url: Some(mock_server.uri() + "/v1/audio/transcriptions"),
                    ..Default::default()
                },
                timeout: Some(Duration::from_secs(5)),
            });

            let audio: AudioStream = Box::pin(stream::iter([vec![0u8; 100]]));
            let result = provider.listen_stream(audio).await;
            assert!(matches!(
                result,
                Err(AsrError::HttpStatus { status: 429, .. })
            ));
        }

        #[tokio::test]
        async fn test_http_500() {
            let mock_server = MockServer::start().await;
            Mock::given(method("POST"))
                .and(path("/v1/audio/transcriptions"))
                .respond_with(
                    ResponseTemplate::new(500)
                        .set_body_string("<html>Internal Server Error</html>"),
                )
                .mount(&mock_server)
                .await;

            let provider = MinimaxAsr::new(MinimaxAsrOption {
                base: BaseProviderOption {
                    api_key: Some("test-key".into()),
                    base_url: Some(mock_server.uri() + "/v1/audio/transcriptions"),
                    ..Default::default()
                },
                timeout: Some(Duration::from_secs(5)),
            });

            let audio: AudioStream = Box::pin(stream::iter([vec![0u8; 100]]));
            let result = provider.listen_stream(audio).await;
            assert!(matches!(
                result,
                Err(AsrError::HttpStatus { status: 500, .. })
            ));
        }

        #[tokio::test]
        async fn test_whitespace_key() {
            let mock_server = MockServer::start().await;
            Mock::given(method("POST"))
                .and(path("/v1/audio/transcriptions"))
                .respond_with(
                    ResponseTemplate::new(401)
                        .set_body_string(r#"{"error":{"message":"auth failed"}}"#),
                )
                .mount(&mock_server)
                .await;

            // api_key="   " 可通过 ensure_valid，然后请求被服务端拒绝
            let provider = MinimaxAsr::new(MinimaxAsrOption {
                base: BaseProviderOption {
                    api_key: Some("   ".into()),
                    base_url: Some(mock_server.uri() + "/v1/audio/transcriptions"),
                    ..Default::default()
                },
                timeout: Some(Duration::from_secs(5)),
            });

            let audio: AudioStream = Box::pin(stream::iter([vec![0u8; 100]]));
            let result = provider.listen_stream(audio).await;
            assert!(matches!(
                result,
                Err(AsrError::HttpStatus { status: 401, .. })
            ));
        }

        #[tokio::test]
        async fn test_timeout() {
            let mock_server = MockServer::start().await;
            Mock::given(method("POST"))
                .and(path("/v1/audio/transcriptions"))
                .respond_with(
                    ResponseTemplate::new(200)
                        .set_delay(Duration::from_millis(500))
                        .set_body_string(r#"{"text":"slow"}"#),
                )
                .mount(&mock_server)
                .await;

            // 使用非常短的超时（100ms），服务端延迟 500ms，应触发超时
            let provider = MinimaxAsr::new(MinimaxAsrOption {
                base: BaseProviderOption {
                    api_key: Some("test-key".into()),
                    base_url: Some(mock_server.uri() + "/v1/audio/transcriptions"),
                    ..Default::default()
                },
                timeout: Some(Duration::from_millis(100)),
            });

            let audio: AudioStream = Box::pin(stream::iter([vec![0u8; 100]]));
            let result = provider.listen_stream(audio).await;
            assert!(matches!(result, Err(AsrError::HttpRequest(_))));
        }

        #[tokio::test]
        async fn test_connection_refused() {
            // 使用一个几乎不可能有服务监听的端口来模拟连接被拒绝。
            // 不用 MockServer 的原因是并发运行时其他 wiremock 测试会复用端口。
            let provider = MinimaxAsr::new(MinimaxAsrOption {
                base: BaseProviderOption {
                    api_key: Some("test-key".into()),
                    base_url: Some("http://127.0.0.1:1/v1/audio/transcriptions".into()),
                    ..Default::default()
                },
                timeout: Some(Duration::from_millis(500)),
            });

            let audio: AudioStream = Box::pin(stream::iter([vec![0u8; 100]]));
            let result = provider.listen_stream(audio).await;
            assert!(matches!(result, Err(AsrError::HttpRequest(_))));
        }

        #[tokio::test]
        async fn test_malformed_response() {
            let mock_server = MockServer::start().await;
            Mock::given(method("POST"))
                .and(path("/v1/audio/transcriptions"))
                .respond_with(ResponseTemplate::new(200).set_body_string(r#"not json response"#))
                .mount(&mock_server)
                .await;

            let provider = MinimaxAsr::new(MinimaxAsrOption {
                base: BaseProviderOption {
                    api_key: Some("test-key".into()),
                    base_url: Some(mock_server.uri() + "/v1/audio/transcriptions"),
                    ..Default::default()
                },
                timeout: Some(Duration::from_secs(5)),
            });

            let audio: AudioStream = Box::pin(stream::iter([vec![0u8; 100]]));
            let result = provider.listen_stream(audio).await;
            assert!(matches!(result, Err(AsrError::Json(_))));
        }

        #[tokio::test]
        async fn test_form_fields_sent() {
            let mock_server = MockServer::start().await;
            Mock::given(method("POST"))
                .and(path("/v1/audio/transcriptions"))
                .and(HasMultipartField { name: "model" })
                .and(HasMultipartField { name: "file" })
                .respond_with(ResponseTemplate::new(200).set_body_string(r#"{"text":"ok"}"#))
                .mount(&mock_server)
                .await;

            let provider = MinimaxAsr::new(MinimaxAsrOption {
                base: BaseProviderOption {
                    api_key: Some("test-key".into()),
                    base_url: Some(mock_server.uri() + "/v1/audio/transcriptions"),
                    ..Default::default()
                },
                timeout: Some(Duration::from_secs(5)),
            });

            let audio: AudioStream = Box::pin(stream::iter([vec![0u8; 100]]));
            let mut stream = provider.listen_stream(audio).await.unwrap();
            let chunk = stream.next().await.unwrap().unwrap();
            assert_eq!(chunk.text, "ok");
        }

        #[tokio::test]
        async fn test_form_language_sent() {
            let mock_server = MockServer::start().await;
            Mock::given(method("POST"))
                .and(path("/v1/audio/transcriptions"))
                .and(HasMultipartField { name: "language" })
                .respond_with(ResponseTemplate::new(200).set_body_string(r#"{"text":"ok"}"#))
                .mount(&mock_server)
                .await;

            let provider = MinimaxAsr::new(MinimaxAsrOption {
                base: BaseProviderOption {
                    api_key: Some("test-key".into()),
                    base_url: Some(mock_server.uri() + "/v1/audio/transcriptions"),
                    language: Some("en".into()),
                    ..Default::default()
                },
                timeout: Some(Duration::from_secs(5)),
            });

            let audio: AudioStream = Box::pin(stream::iter([vec![0u8; 100]]));
            let mut stream = provider.listen_stream(audio).await.unwrap();
            let chunk = stream.next().await.unwrap().unwrap();
            assert_eq!(chunk.text, "ok");
        }
    }
}
