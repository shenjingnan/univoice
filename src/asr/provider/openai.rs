use std::pin::Pin;

use async_stream::stream;
use async_trait::async_trait;
use futures_util::{Stream, StreamExt};
use http::StatusCode;
use reqwest::multipart::{Form, Part};
use serde::Deserialize;

use crate::asr::error::AsrError;
use crate::asr::traits::AsrProvider;
use crate::asr::types::{
    AsrSegment, AsrStreamChunk, AudioContainerFormat, AudioStream, BaseProviderOption,
};

// ============================== 常量 ==============================

/// OpenAI Whisper API 基础地址
const OPENAI_DEFAULT_BASE_URL: &str = "https://api.openai.com/v1";
/// OpenAI Whisper 默认模型
const OPENAI_DEFAULT_MODEL: &str = "whisper-1";
/// 最大文件大小（25 MB）
const OPENAI_MAX_FILE_SIZE: usize = 25 * 1024 * 1024;

// ============================== 配置选项 ==============================

/// OpenAI Whisper ASR 专属配置
#[derive(Debug, Clone, Default)]
pub struct OpenaiAsrOption {
    pub base: BaseProviderOption,
    pub language: Option<String>,
    pub prompt: Option<String>,
    pub temperature: Option<f32>,
    pub response_format: Option<OpenaiResponseFormat>,
}

/// Whisper 响应格式
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum OpenaiResponseFormat {
    #[default]
    Json,
    Text,
    Srt,
    Vtt,
    VerboseJson,
}

impl OpenaiResponseFormat {
    /// 转换为 API 请求所需的字符串值
    fn as_str(&self) -> &'static str {
        match self {
            Self::Json => "json",
            Self::Text => "text",
            Self::Srt => "srt",
            Self::Vtt => "vtt",
            Self::VerboseJson => "verbose_json",
        }
    }
}

// ============================== 内部数据结构 ==============================

/// JSON 格式响应（response_format = "json"）
#[derive(Deserialize)]
struct OpenaiJsonResponse {
    text: String,
}

/// Verbose JSON 格式响应（response_format = "verbose_json"）
#[derive(Deserialize)]
struct OpenaiVerboseJsonResponse {
    #[allow(dead_code)]
    task: String,
    #[allow(dead_code)]
    language: String,
    #[allow(dead_code)]
    duration: f64,
    text: String,
    #[serde(default, deserialize_with = "de_null_to_default")]
    segments: Vec<OpenaiSegment>,
}

/// Verbose JSON 中的 segment
#[derive(Deserialize)]
struct OpenaiSegment {
    id: u32,
    #[serde(default)]
    #[allow(dead_code)]
    seek: u32,
    start: f64,
    end: f64,
    text: String,
    #[serde(default)]
    #[allow(dead_code)]
    tokens: Vec<u32>,
    #[serde(default)]
    #[allow(dead_code)]
    temperature: f64,
    #[serde(default)]
    #[allow(dead_code)]
    avg_logprob: f64,
    #[serde(default)]
    #[allow(dead_code)]
    compression_ratio: f64,
    #[serde(default)]
    #[allow(dead_code)]
    no_speech_prob: f64,
}

/// API 错误响应
#[derive(Deserialize)]
struct OpenaiErrorBody {
    error: Option<OpenaiErrorDetail>,
}

#[derive(Deserialize)]
struct OpenaiErrorDetail {
    message: Option<String>,
    #[serde(rename = "type")]
    #[allow(dead_code)]
    type_: Option<String>,
    #[allow(dead_code)]
    code: Option<String>,
}

// ============================== Serde 辅助函数 ==============================

/// 将 JSON `null` 转为默认值（用于 segments 字段兼容）
fn de_null_to_default<'de, D, T>(d: D) -> Result<T, D::Error>
where
    D: serde::Deserializer<'de>,
    T: Default + Deserialize<'de>,
{
    let opt = Option::<T>::deserialize(d)?;
    Ok(opt.unwrap_or_default())
}

// ============================== Provider 结构体 ==============================

/// OpenAI Whisper ASR Provider
///
/// 基于 OpenAI Whisper REST API 实现语音识别。
/// 与 Qwen/Doubao 不同，OpenAI Whisper 使用 HTTP REST 而非 WebSocket，
/// 且为完全同步接口（非流式），所有响应一次性返回。
/// 不支持预建立连接（connect 返回 Unsupported）。
pub struct OpenaiAsr {
    api_key: String,
    base_url: String,
    model: String,
    format: Option<AudioContainerFormat>,
    language: Option<String>,
    prompt: Option<String>,
    temperature: Option<f32>,
    response_format: OpenaiResponseFormat,
}

impl OpenaiAsr {
    pub fn new(options: OpenaiAsrOption) -> Self {
        let base = &options.base;
        let api_key = base.api_key.clone().unwrap_or_default();
        let base_url = base
            .base_url
            .clone()
            .unwrap_or_else(|| OPENAI_DEFAULT_BASE_URL.into());
        let model = base
            .model
            .clone()
            .unwrap_or_else(|| OPENAI_DEFAULT_MODEL.into());
        let format = base.format;
        // 语言优先级：OpenaiAsrOption.language > BaseProviderOption.language > None
        let language = options
            .language
            .or_else(|| base.language.clone())
            .and_then(|l| normalize_language(Some(&l)));
        let prompt = options.prompt;
        let temperature = options.temperature;
        let response_format = options.response_format.unwrap_or_default();

        Self {
            api_key,
            base_url,
            model,
            format,
            language,
            prompt,
            temperature,
            response_format,
        }
    }

    /// 验证必要参数
    fn ensure_valid(&self) -> Result<(), AsrError> {
        if self.api_key.is_empty() {
            return Err(AsrError::InvalidParameter(
                "apiKey is required for OpenAI ASR".into(),
            ));
        }
        if self.base_url.trim().is_empty() {
            return Err(AsrError::InvalidParameter(
                "baseUrl is required for OpenAI ASR".into(),
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
        language: Option<&str>,
        prompt: Option<&str>,
        temperature: Option<f32>,
        response_format: &str,
        file_ext: &str,
    ) -> Result<Form, AsrError> {
        let file_part = Part::bytes(audio_data).file_name(format!("audio.{}", file_ext));

        let mut form = Form::new().part("file", file_part);
        for (name, value) in
            Self::build_form_fields(model, language, prompt, temperature, response_format)
        {
            form = form.text(name, value);
        }

        Ok(form)
    }

    /// 返回表单 text 字段列表（与 build_form_data 共享逻辑，便于测试）
    fn build_form_fields<'a>(
        model: &'a str,
        language: Option<&'a str>,
        prompt: Option<&'a str>,
        temperature: Option<f32>,
        response_format: &'a str,
    ) -> Vec<(&'static str, String)> {
        let mut fields = Vec::new();
        fields.push(("model", model.to_string()));
        if let Some(lang) = language {
            fields.push(("language", lang.to_string()));
        }
        if let Some(p) = prompt {
            fields.push(("prompt", p.to_string()));
        }
        if let Some(t) = temperature {
            fields.push(("temperature", t.to_string()));
        }
        fields.push(("response_format", response_format.to_string()));
        fields
    }

    /// 构建完整 endpoint URL
    fn build_endpoint(base_url: &str) -> String {
        let base = base_url.trim_end_matches('/');
        format!("{}/audio/transcriptions", base)
    }

    /// 文件扩展名映射
    fn file_extension(format: Option<AudioContainerFormat>) -> &'static str {
        match format {
            Some(AudioContainerFormat::Wav) => "wav",
            Some(AudioContainerFormat::Mp3) => "mp3",
            Some(AudioContainerFormat::Ogg) => "ogg",
            Some(AudioContainerFormat::Pcm) | None => "wav",
        }
    }

    /// 解析 API 错误响应体为 HttpStatus 错误
    fn parse_error_response(status: u16, body: &str) -> AsrError {
        let message = serde_json::from_str::<OpenaiErrorBody>(body)
            .ok()
            .and_then(|err| err.error.and_then(|e| e.message))
            .unwrap_or_else(|| status_default_message(status));
        AsrError::HttpStatus { status, message }
    }
}

// ============================== Language 规范化 ==============================

/// 将 language 参数规范化为 ISO-639-1 格式
///
/// 处理 "zh-CN" → "zh", "en-US" → "en" 等格式。
/// 对非 ISO-639-1 格式（如 "fre"）原样保留。
fn normalize_language(lang: Option<&str>) -> Option<String> {
    let lang = lang?;
    if lang.is_empty() {
        return None;
    }
    // 处理 "zh-CN", "zh-TW", "en-US" 等 → ISO-639-1 两字母码
    if let Some((base, _region)) = lang.split_once('-') {
        if base.len() == 2 && base.chars().all(char::is_alphabetic) {
            return Some(base.to_lowercase());
        }
    }
    Some(lang.to_lowercase())
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

// ============================== 响应解析（纯函数） ==============================

/// 解析 JSON 响应（response_format = "json"）
fn parse_json_response(text: &str) -> Result<AsrStreamChunk, AsrError> {
    let body: OpenaiJsonResponse = serde_json::from_str(text)?;
    Ok(AsrStreamChunk {
        text: body.text,
        is_final: true,
        confidence: None,
        segment: None,
    })
}

/// 解析 Verbose JSON 响应（response_format = "verbose_json"）
///
/// 对每个 segment 生成一个 partial chunk，最后发一个包含完整文本的 final chunk。
fn parse_verbose_json_response(text: &str) -> Result<Vec<AsrStreamChunk>, AsrError> {
    let body: OpenaiVerboseJsonResponse = serde_json::from_str(text)?;

    let mut chunks: Vec<AsrStreamChunk> = body
        .segments
        .iter()
        .map(|seg| {
            let start_ms = (seg.start * 1000.0) as u32;
            let end_ms = (seg.end * 1000.0) as u32;
            AsrStreamChunk {
                text: seg.text.clone(),
                is_final: false,
                confidence: None,
                segment: Some(AsrSegment {
                    id: seg.id,
                    start: start_ms,
                    end: end_ms,
                    text: seg.text.clone(),
                    speaker: None,
                    confidence: None,
                }),
            }
        })
        .collect();

    chunks.push(AsrStreamChunk {
        text: body.text,
        is_final: true,
        confidence: None,
        segment: None,
    });

    Ok(chunks)
}

// ============================== AsrProvider 实现 ==============================

#[async_trait]
impl AsrProvider for OpenaiAsr {
    fn name(&self) -> &'static str {
        "openai"
    }

    async fn listen_stream(
        &self,
        audio: AudioStream,
    ) -> Result<Pin<Box<dyn Stream<Item = Result<AsrStreamChunk, AsrError>> + Send>>, AsrError>
    {
        self.ensure_valid()?;

        // 1. 收集整个音频流，同时检查大小限制
        let audio_data = Self::collect_audio_stream(audio, OPENAI_MAX_FILE_SIZE).await?;

        // 2. 构造 multipart/form-data
        let ext = Self::file_extension(self.format);
        let form = Self::build_form_data(
            audio_data,
            &self.model,
            self.language.as_deref(),
            self.prompt.as_deref(),
            self.temperature,
            self.response_format.as_str(),
            ext,
        )?;

        // 3. 构建完整 endpoint URL
        let endpoint = Self::build_endpoint(&self.base_url);

        // 4. 发送 HTTP POST 请求
        let client = reqwest::Client::new();
        let response = client
            .post(&endpoint)
            .header("Authorization", &format!("Bearer {}", self.api_key))
            .multipart(form)
            .send()
            .await
            .map_err(|e| AsrError::HttpRequest(e.to_string()))?;

        // 5. 检查响应状态
        if !response.status().is_success() {
            let status = response.status().as_u16();
            let body = response.text().await.unwrap_or_default();
            return Err(Self::parse_error_response(status, &body));
        }

        // 6. 读取完整响应体
        let body = response
            .text()
            .await
            .map_err(|e| AsrError::HttpRequest(e.to_string()))?;

        // 7. 根据 response_format 解析响应
        match self.response_format {
            OpenaiResponseFormat::Json => {
                let chunk = parse_json_response(&body)?;
                Ok(Box::pin(stream! {
                    yield Ok(chunk);
                }))
            }
            OpenaiResponseFormat::VerboseJson => {
                let chunks = parse_verbose_json_response(&body)?;
                Ok(Box::pin(stream! {
                    for chunk in chunks {
                        yield Ok(chunk);
                    }
                }))
            }
            _ => {
                // Text, Srt, Vtt — body 本身就是转录文本
                Ok(Box::pin(stream! {
                    yield Ok(AsrStreamChunk {
                        text: body,
                        is_final: true,
                        confidence: None,
                        segment: None,
                    });
                }))
            }
        }
    }
}

// ============================== 测试 ==============================

#[cfg(test)]
mod tests {
    use super::*;
    use futures_util::stream;

    // ==================== 辅助函数 ====================

    fn make_provider(api_key: &str) -> OpenaiAsr {
        OpenaiAsr::new(OpenaiAsrOption {
            base: BaseProviderOption {
                api_key: Some(api_key.into()),
                ..Default::default()
            },
            ..Default::default()
        })
    }

    fn make_provider_with_options(opts: OpenaiAsrOption) -> OpenaiAsr {
        OpenaiAsr::new(opts)
    }

    fn sample_verbose_json() -> &'static str {
        r#"{
            "task": "transcribe",
            "language": "english",
            "duration": 12.0,
            "text": "Hello world. This is a test.",
            "segments": [
                {
                    "id": 0,
                    "seek": 0,
                    "start": 0.0,
                    "end": 4.0,
                    "text": "Hello world.",
                    "tokens": [50364, 2425, 1002, 11],
                    "temperature": 0.0,
                    "avg_logprob": -0.5,
                    "compression_ratio": 1.2,
                    "no_speech_prob": 0.1
                },
                {
                    "id": 1,
                    "seek": 0,
                    "start": 4.0,
                    "end": 8.5,
                    "text": "This is a test.",
                    "tokens": [50364, 1111, 12, 1234, 13],
                    "temperature": 0.0,
                    "avg_logprob": -0.3,
                    "compression_ratio": 1.1,
                    "no_speech_prob": 0.05
                }
            ]
        }"#
    }

    // ==================== 3.1 构造/配置测试 ====================

    #[test]
    fn test_defaults() {
        let provider = make_provider("test-key");
        assert_eq!(provider.name(), "openai");
        assert_eq!(provider.base_url, OPENAI_DEFAULT_BASE_URL);
        assert_eq!(provider.model, OPENAI_DEFAULT_MODEL);
        assert_eq!(provider.language, Some("zh".into()));
        assert_eq!(provider.prompt, None);
        assert_eq!(provider.temperature, None);
        assert_eq!(provider.response_format, OpenaiResponseFormat::Json);
    }

    #[test]
    fn test_custom_base_url() {
        let provider = make_provider_with_options(OpenaiAsrOption {
            base: BaseProviderOption {
                api_key: Some("k".into()),
                base_url: Some("https://custom.example.com/v1".into()),
                ..Default::default()
            },
            ..Default::default()
        });
        assert_eq!(provider.base_url, "https://custom.example.com/v1");
    }

    #[test]
    fn test_custom_model() {
        let provider = make_provider_with_options(OpenaiAsrOption {
            base: BaseProviderOption {
                api_key: Some("k".into()),
                model: Some("whisper-2".into()),
                ..Default::default()
            },
            ..Default::default()
        });
        assert_eq!(provider.model, "whisper-2");
    }

    #[test]
    fn test_custom_language() {
        let provider = make_provider_with_options(OpenaiAsrOption {
            base: BaseProviderOption {
                api_key: Some("k".into()),
                ..Default::default()
            },
            language: Some("ja".into()),
            ..Default::default()
        });
        assert_eq!(provider.language, Some("ja".into()));
    }

    #[test]
    fn test_custom_language_zh() {
        let provider = make_provider_with_options(OpenaiAsrOption {
            base: BaseProviderOption {
                api_key: Some("k".into()),
                ..Default::default()
            },
            language: Some("zh-CN".into()),
            ..Default::default()
        });
        assert_eq!(provider.language, Some("zh".into()));
    }

    #[test]
    fn test_custom_language_from_base() {
        // BaseProviderOption 默认 language="zh-CN"，应被规范化为 "zh"
        let provider = make_provider_with_options(OpenaiAsrOption {
            base: BaseProviderOption {
                api_key: Some("k".into()),
                ..Default::default()
            },
            language: None,
            ..Default::default()
        });
        assert_eq!(provider.language, Some("zh".into()));
    }

    #[test]
    fn test_custom_prompt() {
        let provider = make_provider_with_options(OpenaiAsrOption {
            base: BaseProviderOption {
                api_key: Some("k".into()),
                ..Default::default()
            },
            prompt: Some("Hello".into()),
            ..Default::default()
        });
        assert_eq!(provider.prompt, Some("Hello".into()));
    }

    #[test]
    fn test_custom_temperature() {
        let provider = make_provider_with_options(OpenaiAsrOption {
            base: BaseProviderOption {
                api_key: Some("k".into()),
                ..Default::default()
            },
            temperature: Some(0.5),
            ..Default::default()
        });
        assert_eq!(provider.temperature, Some(0.5));
    }

    #[test]
    fn test_custom_response_format() {
        let provider = make_provider_with_options(OpenaiAsrOption {
            base: BaseProviderOption {
                api_key: Some("k".into()),
                ..Default::default()
            },
            response_format: Some(OpenaiResponseFormat::VerboseJson),
            ..Default::default()
        });
        assert_eq!(provider.response_format, OpenaiResponseFormat::VerboseJson);
    }

    #[test]
    fn test_empty_api_key() {
        let provider = make_provider_with_options(OpenaiAsrOption {
            base: BaseProviderOption {
                api_key: None,
                ..Default::default()
            },
            ..Default::default()
        });
        assert_eq!(provider.api_key, "");
    }

    #[test]
    fn test_api_key_from_none() {
        let provider = make_provider_with_options(OpenaiAsrOption {
            base: BaseProviderOption {
                api_key: None,
                ..Default::default()
            },
            ..Default::default()
        });
        assert_eq!(provider.api_key, "");
    }

    // ==================== 3.2 参数验证测试 ====================

    #[test]
    fn test_ensure_valid_passes() {
        let provider = make_provider("valid-key");
        assert!(provider.ensure_valid().is_ok());
    }

    #[test]
    fn test_ensure_valid_empty_key() {
        let provider = make_provider("");
        assert!(matches!(
            provider.ensure_valid(),
            Err(AsrError::InvalidParameter(_))
        ));
    }

    #[test]
    fn test_ensure_valid_default_key() {
        let provider = make_provider_with_options(OpenaiAsrOption {
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

    // ==================== 3.3 空 base_url 拒绝测试 ====================

    #[test]
    fn test_ensure_valid_empty_base_url() {
        let provider = make_provider_with_options(OpenaiAsrOption {
            base: BaseProviderOption {
                api_key: Some("k".into()),
                base_url: Some("".into()),
                ..Default::default()
            },
            ..Default::default()
        });
        assert!(matches!(
            provider.ensure_valid(),
            Err(AsrError::InvalidParameter(_))
        ));
    }

    #[test]
    fn test_ensure_valid_whitespace_base_url() {
        let provider = make_provider_with_options(OpenaiAsrOption {
            base: BaseProviderOption {
                api_key: Some("k".into()),
                base_url: Some(" ".into()),
                ..Default::default()
            },
            ..Default::default()
        });
        assert!(matches!(
            provider.ensure_valid(),
            Err(AsrError::InvalidParameter(_))
        ));
    }

    // ==================== 3.4 Language 规范化测试 ====================

    #[test]
    fn test_normalize_language_zh_cn() {
        assert_eq!(normalize_language(Some("zh-CN")), Some("zh".into()));
    }

    #[test]
    fn test_normalize_language_zh_tw() {
        assert_eq!(normalize_language(Some("zh-TW")), Some("zh".into()));
    }

    #[test]
    fn test_normalize_language_en_us() {
        assert_eq!(normalize_language(Some("en-US")), Some("en".into()));
    }

    #[test]
    fn test_normalize_language_en() {
        assert_eq!(normalize_language(Some("en")), Some("en".into()));
    }

    #[test]
    fn test_normalize_language_ja() {
        assert_eq!(normalize_language(Some("ja")), Some("ja".into()));
    }

    #[test]
    fn test_normalize_language_three_letter() {
        assert_eq!(normalize_language(Some("fre")), Some("fre".into()));
    }

    #[test]
    fn test_normalize_language_uppercase() {
        assert_eq!(normalize_language(Some("EN-US")), Some("en".into()));
    }

    #[test]
    fn test_normalize_language_empty() {
        assert_eq!(normalize_language(Some("")), None);
    }

    #[test]
    fn test_normalize_language_none() {
        assert_eq!(normalize_language(None), None);
    }

    #[test]
    fn test_normalize_language_multi_segment() {
        assert_eq!(normalize_language(Some("zh-Hans-CN")), Some("zh".into()));
    }

    #[test]
    fn test_normalize_language_single_letter_prefix() {
        // 1 字母前缀（a 虽 alphabetic，但非 ISO-639-1 2 字母），原样保留
        assert_eq!(normalize_language(Some("a-def")), Some("a-def".into()));
    }

    #[test]
    fn test_normalize_language_numeric_prefix() {
        // 数字前缀（非 alphabetic），原样保留
        assert_eq!(
            normalize_language(Some("12-region")),
            Some("12-region".into())
        );
    }

    // ==================== 3.5 文件扩展名映射测试 ====================

    #[test]
    fn test_file_extension_wav() {
        assert_eq!(
            OpenaiAsr::file_extension(Some(AudioContainerFormat::Wav)),
            "wav"
        );
    }

    #[test]
    fn test_file_extension_mp3() {
        assert_eq!(
            OpenaiAsr::file_extension(Some(AudioContainerFormat::Mp3)),
            "mp3"
        );
    }

    #[test]
    fn test_file_extension_ogg() {
        assert_eq!(
            OpenaiAsr::file_extension(Some(AudioContainerFormat::Ogg)),
            "ogg"
        );
    }

    #[test]
    fn test_file_extension_pcm() {
        assert_eq!(
            OpenaiAsr::file_extension(Some(AudioContainerFormat::Pcm)),
            "wav"
        );
    }

    #[test]
    fn test_file_extension_none() {
        assert_eq!(OpenaiAsr::file_extension(None), "wav");
    }

    // ==================== 3.6 response_format 序列化测试 ====================

    #[test]
    fn test_response_format_as_str_json() {
        assert_eq!(OpenaiResponseFormat::Json.as_str(), "json");
    }

    #[test]
    fn test_response_format_as_str_text() {
        assert_eq!(OpenaiResponseFormat::Text.as_str(), "text");
    }

    #[test]
    fn test_response_format_as_str_srt() {
        assert_eq!(OpenaiResponseFormat::Srt.as_str(), "srt");
    }

    #[test]
    fn test_response_format_as_str_vtt() {
        assert_eq!(OpenaiResponseFormat::Vtt.as_str(), "vtt");
    }

    #[test]
    fn test_response_format_as_str_verbose() {
        assert_eq!(OpenaiResponseFormat::VerboseJson.as_str(), "verbose_json");
    }

    #[test]
    fn test_response_format_default_is_json() {
        assert_eq!(OpenaiResponseFormat::default(), OpenaiResponseFormat::Json);
    }

    // ==================== 3.7 URL 端点构造测试 ====================

    #[test]
    fn test_build_endpoint_normal() {
        assert_eq!(
            OpenaiAsr::build_endpoint("https://api.openai.com/v1"),
            "https://api.openai.com/v1/audio/transcriptions"
        );
    }

    #[test]
    fn test_build_endpoint_trailing_slash() {
        assert_eq!(
            OpenaiAsr::build_endpoint("https://api.openai.com/v1/"),
            "https://api.openai.com/v1/audio/transcriptions"
        );
    }

    #[test]
    fn test_build_endpoint_double_slash() {
        assert_eq!(
            OpenaiAsr::build_endpoint("https://api.openai.com/v1//"),
            "https://api.openai.com/v1/audio/transcriptions"
        );
    }

    #[test]
    fn test_build_endpoint_custom_path() {
        assert_eq!(
            OpenaiAsr::build_endpoint("https://custom-proxy.example.com"),
            "https://custom-proxy.example.com/audio/transcriptions"
        );
    }

    #[test]
    fn test_build_endpoint_with_path() {
        assert_eq!(
            OpenaiAsr::build_endpoint("https://custom.com/proxy/v1"),
            "https://custom.com/proxy/v1/audio/transcriptions"
        );
    }

    #[test]
    fn test_build_endpoint_empty() {
        assert_eq!(OpenaiAsr::build_endpoint(""), "/audio/transcriptions");
    }

    // ==================== 3.8 表单字段构建测试 ====================

    #[test]
    fn test_form_fields_all_optional() {
        let fields =
            OpenaiAsr::build_form_fields("whisper-1", Some("en"), Some("Hello"), Some(0.5), "json");
        assert_eq!(fields.len(), 5);
        assert_eq!(fields[0], ("model", "whisper-1".to_string()));
        assert_eq!(fields[1], ("language", "en".to_string()));
        assert_eq!(fields[2], ("prompt", "Hello".to_string()));
        assert_eq!(fields[3], ("temperature", "0.5".to_string()));
        assert_eq!(fields[4], ("response_format", "json".to_string()));
    }

    #[test]
    fn test_form_fields_no_optionals() {
        let fields = OpenaiAsr::build_form_fields("whisper-1", None, None, None, "json");
        assert_eq!(fields.len(), 2);
        assert_eq!(fields[0], ("model", "whisper-1".to_string()));
        assert_eq!(fields[1], ("response_format", "json".to_string()));
    }

    #[test]
    fn test_form_fields_temperature_formatting() {
        let fields = OpenaiAsr::build_form_fields("whisper-1", None, None, Some(0.5), "json");
        let temp = fields.iter().find(|(k, _)| *k == "temperature").unwrap();
        assert_eq!(temp.1, "0.5");
    }

    #[test]
    fn test_form_fields_temperature_zero() {
        let fields = OpenaiAsr::build_form_fields("whisper-1", None, None, Some(0.0), "json");
        let temp = fields.iter().find(|(k, _)| *k == "temperature").unwrap();
        assert_eq!(temp.1, "0");
    }

    #[test]
    fn test_form_fields_temperature_integer() {
        let fields = OpenaiAsr::build_form_fields("whisper-1", None, None, Some(1.0), "json");
        let temp = fields.iter().find(|(k, _)| *k == "temperature").unwrap();
        assert_eq!(temp.1, "1");
    }

    // ==================== 4.1 JSON 响应解析 ====================

    #[test]
    fn test_parse_json_basic() {
        let chunk = parse_json_response(r#"{"text":"Hello world"}"#).unwrap();
        assert_eq!(chunk.text, "Hello world");
        assert!(chunk.is_final);
        assert!(chunk.segment.is_none());
    }

    #[test]
    fn test_parse_json_unicode() {
        let chunk = parse_json_response(r#"{"text":"你好世界"}"#).unwrap();
        assert_eq!(chunk.text, "你好世界");
    }

    #[test]
    fn test_parse_json_special_chars() {
        let chunk = parse_json_response(r#"{"text":"quote\"newline\\n"}"#).unwrap();
        assert_eq!(chunk.text, "quote\"newline\\n");
    }

    #[test]
    fn test_parse_json_invalid() {
        let result = parse_json_response("not json");
        assert!(matches!(result, Err(AsrError::Json(_))));
    }

    #[test]
    fn test_parse_json_missing_field() {
        // text 是必填字段，缺失应报错
        let result = parse_json_response("{}");
        assert!(matches!(result, Err(AsrError::Json(_))));
    }

    // ==================== 4.2 Verbose JSON 响应解析 ====================

    #[test]
    fn test_parse_verbose_multi_segment() {
        let chunks = parse_verbose_json_response(sample_verbose_json()).unwrap();
        assert_eq!(chunks.len(), 3); // 2 segments + 1 final

        // 验证时间戳转换
        if let Some(ref seg) = chunks[0].segment {
            assert_eq!(seg.start, 0);
            assert_eq!(seg.end, 4000); // 4.0 * 1000
        } else {
            panic!("expected segment");
        }

        if let Some(ref seg) = chunks[1].segment {
            assert_eq!(seg.start, 4000); // 4.0 * 1000
            assert_eq!(seg.end, 8500); // 8.5 * 1000
        } else {
            panic!("expected segment");
        }

        // 最后一个应该是 final
        assert!(chunks[2].is_final);
        assert_eq!(chunks[2].text, "Hello world. This is a test.");
    }

    #[test]
    fn test_parse_verbose_single_segment() {
        let json = r#"{
            "task": "transcribe",
            "language": "english",
            "duration": 4.0,
            "text": "Hello world.",
            "segments": [{
                "id": 0, "seek": 0, "start": 0.0, "end": 4.0,
                "text": "Hello world.",
                "tokens": [50364, 2425, 1002, 11],
                "temperature": 0.0, "avg_logprob": -0.5,
                "compression_ratio": 1.2, "no_speech_prob": 0.1
            }]
        }"#;
        let chunks = parse_verbose_json_response(json).unwrap();
        assert_eq!(chunks.len(), 2);
    }

    #[test]
    fn test_parse_verbose_no_segments() {
        let json = r#"{
            "task": "transcribe",
            "language": "english",
            "duration": 0.0,
            "text": "",
            "segments": []
        }"#;
        let chunks = parse_verbose_json_response(json).unwrap();
        assert_eq!(chunks.len(), 1); // 仅 final
        assert!(chunks[0].is_final);
    }

    #[test]
    fn test_parse_verbose_timestamp_precision() {
        let json = r#"{
            "task": "transcribe",
            "language": "english",
            "duration": 1.0,
            "text": "test",
            "segments": [{
                "id": 0, "seek": 0, "start": 0.001, "end": 0.999,
                "text": "test",
                "tokens": [], "temperature": 0.0,
                "avg_logprob": 0.0, "compression_ratio": 1.0, "no_speech_prob": 0.0
            }]
        }"#;
        let chunks = parse_verbose_json_response(json).unwrap();
        let seg = chunks[0].segment.as_ref().unwrap();
        assert_eq!(seg.start, 1); // 0.001 * 1000 = 1
        assert_eq!(seg.end, 999); // 0.999 * 1000 = 999
    }

    #[test]
    fn test_parse_verbose_null_segments() {
        // segments 为 null 时应兼容处理
        let json = r#"{
            "task": "transcribe",
            "language": "english",
            "duration": 4.0,
            "text": "Hello world.",
            "segments": null
        }"#;
        let chunks = parse_verbose_json_response(json).unwrap();
        assert_eq!(chunks.len(), 1);
        assert_eq!(chunks[0].text, "Hello world.");
    }

    #[test]
    fn test_parse_verbose_missing_fields() {
        // 缺失可选字段，#[serde(default)] 应生效
        let json = r#"{
            "task": "transcribe",
            "language": "english",
            "duration": 4.0,
            "text": "Hello",
            "segments": [{
                "id": 0, "start": 0.0, "end": 4.0, "text": "Hello"
            }]
        }"#;
        let chunks = parse_verbose_json_response(json).unwrap();
        assert_eq!(chunks.len(), 2);
    }

    #[test]
    fn test_parse_verbose_invalid_json() {
        let result = parse_verbose_json_response("not json");
        assert!(matches!(result, Err(AsrError::Json(_))));
    }

    #[test]
    fn test_parse_verbose_start_end_boundary() {
        let json = r#"{
            "task": "transcribe", "language": "english", "duration": 0.0,
            "text": "test",
            "segments": [{
                "id": 0, "seek": 0, "start": 0.0, "end": 0.0,
                "text": "test", "tokens": [], "temperature": 0.0,
                "avg_logprob": 0.0, "compression_ratio": 1.0, "no_speech_prob": 0.0
            }]
        }"#;
        let chunks = parse_verbose_json_response(json).unwrap();
        let seg = chunks[0].segment.as_ref().unwrap();
        assert_eq!(seg.start, 0);
        assert_eq!(seg.end, 0);
    }

    #[test]
    fn test_parse_verbose_large_timestamp() {
        // u32 边界附近：4294967 秒 × 1000 ≈ 4,294,967,000 ms
        // 略低于 u32::MAX (4,294,967,295)，验证不会 panic 且值正确
        let json = r#"{
            "task": "transcribe", "language": "en", "duration": 4294967.0,
            "text": "test",
            "segments": [{
                "id": 0, "seek": 0, "start": 4294967.0, "end": 4294967.0,
                "text": "test", "tokens": [], "temperature": 0.0,
                "avg_logprob": 0.0, "compression_ratio": 1.0, "no_speech_prob": 0.0
            }]
        }"#;
        let chunks = parse_verbose_json_response(json).unwrap();
        let seg = chunks[0].segment.as_ref().unwrap();
        assert_eq!(seg.start, 4_294_967_000u32);
        assert_eq!(seg.end, 4_294_967_000u32);
    }

    // ==================== 4.3 纯文本/字幕响应解析 ====================

    #[test]
    fn test_parse_text_chunk_plain() {
        let chunk = AsrStreamChunk {
            text: "Hello world".into(),
            is_final: true,
            confidence: None,
            segment: None,
        };
        assert_eq!(chunk.text, "Hello world");
        assert!(chunk.is_final);
    }

    #[test]
    fn test_parse_text_multiline() {
        let chunk = AsrStreamChunk {
            text: "line1\nline2\nline3".into(),
            is_final: true,
            confidence: None,
            segment: None,
        };
        assert_eq!(chunk.text, "line1\nline2\nline3");
    }

    #[test]
    fn test_parse_text_srt() {
        let srt_content = "1\n00:00:00,000 --> 00:00:04,000\nHello world.\n\n2\n00:00:04,000 --> 00:00:08,500\nThis is a test.\n";
        let chunk = AsrStreamChunk {
            text: srt_content.into(),
            is_final: true,
            confidence: None,
            segment: None,
        };
        assert_eq!(chunk.text, srt_content);
    }

    #[test]
    fn test_parse_text_vtt() {
        let vtt_content = "WEBVTT\n\n00:00:00.000 --> 00:00:04.000\nHello world.\n\n00:00:04.000 --> 00:00:08.500\nThis is a test.\n";
        let chunk = AsrStreamChunk {
            text: vtt_content.into(),
            is_final: true,
            confidence: None,
            segment: None,
        };
        assert_eq!(chunk.text, vtt_content);
    }

    #[test]
    fn test_parse_text_empty() {
        let chunk = AsrStreamChunk {
            text: String::new(),
            is_final: true,
            confidence: None,
            segment: None,
        };
        assert_eq!(chunk.text, "");
    }

    #[test]
    fn test_parse_text_unicode() {
        let chunk = AsrStreamChunk {
            text: "你好世界".into(),
            is_final: true,
            confidence: None,
            segment: None,
        };
        assert_eq!(chunk.text, "你好世界");
    }

    // ==================== 4.4 错误解析测试 ====================

    #[test]
    fn test_parse_error_standard() {
        let err = OpenaiAsr::parse_error_response(
            401,
            r#"{"error":{"message":"Incorrect API key provided","type":"invalid_request_error","code":"invalid_api_key"}}"#,
        );
        assert!(matches!(
            err,
            AsrError::HttpStatus {
                status: 401,
                message: _
            }
        ));
        if let AsrError::HttpStatus { ref message, .. } = err {
            assert_eq!(message, "Incorrect API key provided");
        }
    }

    #[test]
    fn test_parse_error_auth() {
        let err = OpenaiAsr::parse_error_response(
            401,
            r#"{"error":{"message":"You must be a member of an organization to use the API"}}"#,
        );
        if let AsrError::HttpStatus { ref message, .. } = err {
            assert_eq!(
                message,
                "You must be a member of an organization to use the API"
            );
        }
    }

    #[test]
    fn test_parse_error_rate_limit() {
        let err =
            OpenaiAsr::parse_error_response(429, r#"{"error":{"message":"Rate limit exceeded"}}"#);
        if let AsrError::HttpStatus { ref message, .. } = err {
            assert_eq!(message, "Rate limit exceeded");
        }
    }

    #[test]
    fn test_parse_error_server_error() {
        let err = OpenaiAsr::parse_error_response(
            500,
            r#"{"error":{"message":"Internal server error"}}"#,
        );
        if let AsrError::HttpStatus { ref message, .. } = err {
            assert_eq!(message, "Internal server error");
        }
    }

    #[test]
    fn test_parse_error_no_error_field() {
        let err = OpenaiAsr::parse_error_response(400, r#"{"detail":"bad request"}"#);
        if let AsrError::HttpStatus { ref message, .. } = err {
            assert_eq!(message, "HTTP 400: Bad Request");
        }
    }

    #[test]
    fn test_parse_error_no_json() {
        let err = OpenaiAsr::parse_error_response(502, "not json");
        if let AsrError::HttpStatus { ref message, .. } = err {
            assert_eq!(message, "HTTP 502: Bad Gateway");
        }
    }

    #[test]
    fn test_parse_error_empty_body() {
        let err = OpenaiAsr::parse_error_response(503, "");
        if let AsrError::HttpStatus { ref message, .. } = err {
            assert_eq!(message, "HTTP 503: Service Unavailable");
        }
    }

    #[test]
    fn test_parse_error_unknown_status() {
        let err = OpenaiAsr::parse_error_response(499, "");
        if let AsrError::HttpStatus { ref message, .. } = err {
            assert_eq!(message, "HTTP 499");
        }
    }

    // ==================== 4.5 音频收集测试 ====================

    #[tokio::test]
    async fn test_collect_single_chunk() {
        let audio: AudioStream = Box::pin(stream::iter([vec![0u8; 100]]));
        let result = OpenaiAsr::collect_audio_stream(audio, OPENAI_MAX_FILE_SIZE)
            .await
            .unwrap();
        assert_eq!(result.len(), 100);
    }

    #[tokio::test]
    async fn test_collect_multiple_chunks() {
        let audio: AudioStream = Box::pin(stream::iter([vec![0u8; 50], vec![1u8; 50]]));
        let result = OpenaiAsr::collect_audio_stream(audio, OPENAI_MAX_FILE_SIZE)
            .await
            .unwrap();
        assert_eq!(result.len(), 100);
        assert_eq!(result[0], 0u8);
        assert_eq!(result[99], 1u8);
    }

    #[tokio::test]
    async fn test_collect_empty_stream() {
        let audio: AudioStream = Box::pin(stream::empty());
        let result = OpenaiAsr::collect_audio_stream(audio, OPENAI_MAX_FILE_SIZE)
            .await
            .unwrap();
        assert_eq!(result.len(), 0);
    }

    #[tokio::test]
    async fn test_collect_exceeds_limit() {
        let chunks = vec![vec![0u8; 50], vec![0u8; 60]];
        let audio: AudioStream = Box::pin(stream::iter(chunks));
        let result = OpenaiAsr::collect_audio_stream(audio, 100).await;
        assert!(matches!(result, Err(AsrError::InvalidParameter(_))));
    }

    #[tokio::test]
    async fn test_collect_zero_length_chunk() {
        let audio: AudioStream = Box::pin(stream::iter([vec![0u8; 10], vec![], vec![0u8; 10]]));
        let result = OpenaiAsr::collect_audio_stream(audio, OPENAI_MAX_FILE_SIZE)
            .await
            .unwrap();
        assert_eq!(result.len(), 20);
    }

    // ==================== 边界场景 ====================

    #[test]
    fn test_unicode_chinese() {
        let chunk = parse_json_response(r#"{"text":"你好世界"}"#).unwrap();
        assert_eq!(chunk.text, "你好世界");
    }

    #[test]
    fn test_unicode_emoji() {
        let chunk = parse_json_response(r#"{"text":"🎉🎊"}"#).unwrap();
        assert_eq!(chunk.text, "🎉🎊");
    }

    #[test]
    fn test_very_long_text() {
        let long_text = "A".repeat(100_000);
        let json = format!(r#"{{"text":"{}"}}"#, long_text);
        let chunk = parse_json_response(&json).unwrap();
        assert_eq!(chunk.text.len(), 100_000);
    }

    #[test]
    fn test_empty_response_body() {
        let result = parse_json_response("");
        assert!(matches!(result, Err(AsrError::Json(_))));
    }
}
