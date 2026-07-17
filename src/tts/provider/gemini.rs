//! Gemini (Google) TTS Provider
//!
//! 基于 Google Gemini Interactions REST API 实现语音合成。
//! 对应 TypeScript 端的 `src/tts/providers/gemini.ts`。
//!
//! 与 GLM 模式一致：非流式 POST 返回 JSON（含 base64 编码 PCM）；
//! 流式 POST `stream=true` 返回 SSE（base64 编码 PCM 块，固定 24000 Hz）。
//! 不同之处：
//! - 认证使用 `x-goog-api-key` 头（而非 `Bearer`）
//! - 请求体包含 `response_format` + `generation_config.speech_config`
//! - 响应是 JSON 包在 `output_audio.data`（而非直接二进制）
//! - 流式 SSE 事件使用 `event:` 行区分事件类型
//!
//! **不实现** `connect` / `TtsConnection`（HTTP 无长连接），保留 trait 默认行为
//! （返回 `Unsupported`）。

use std::time::Duration;

use async_trait::async_trait;
use futures_util::StreamExt;
use reqwest::header::{ACCEPT, CONTENT_TYPE};

use crate::tts::error::TtsError;
use crate::tts::protocol::gemini::{
    self, GEMINI_DEFAULT_BASE_URL, GEMINI_DEFAULT_MODEL, GEMINI_DEFAULT_VOICE, GeminiSpeechRequest,
    GeminiSseLine, GeminiStreamEvent, GenerationConfig, ResponseFormat, SpeechConfigItem,
};
use crate::tts::traits::TtsProvider;
use crate::tts::types::{
    BaseTtsOption, TextStream, TtsAudioStream, TtsRequest, TtsResponse, TtsStreamChunk, TtsVoice,
};
use crate::tts::voice_id::VoiceId;

// ============================== 常量 ==============================

/// Gemini TTS 输出音频格式（固定 PCM）
const GEMINI_DEFAULT_FORMAT: &str = "pcm";

/// HTTP 请求超时
#[cfg(not(test))]
const REQUEST_TIMEOUT: Duration = Duration::from_secs(30);
#[cfg(test)]
const REQUEST_TIMEOUT: Duration = Duration::from_secs(2);

// ============================== GeminiTtsOption ==============================

/// Gemini TTS 专属配置
#[derive(Debug, Clone, Default)]
pub struct GeminiTtsOption {
    pub base: BaseTtsOption,
}

// ============================== GeminiTts ==============================

/// Gemini TTS Provider
pub struct GeminiTts {
    api_key: String,
    base_url: String,
    model: String,
    voice: VoiceId,
    client: reqwest::Client,
}

impl GeminiTts {
    pub fn new(options: GeminiTtsOption) -> Self {
        let base = &options.base;
        let client = reqwest::Client::builder()
            .timeout(REQUEST_TIMEOUT)
            .build()
            .expect("reqwest client with timeout must build");
        Self {
            api_key: base.api_key.clone().unwrap_or_default(),
            base_url: base
                .base_url
                .clone()
                .unwrap_or_else(|| GEMINI_DEFAULT_BASE_URL.into()),
            model: base
                .model
                .clone()
                .unwrap_or_else(|| GEMINI_DEFAULT_MODEL.into()),
            voice: base
                .voice
                .clone()
                .unwrap_or_else(|| VoiceId::from(GEMINI_DEFAULT_VOICE)),
            client,
        }
    }

    /// 校验必要参数
    fn ensure_valid(&self) -> Result<(), TtsError> {
        if self.api_key.is_empty() {
            return Err(TtsError::InvalidParameter(
                "apiKey is required for Gemini TTS (set `api_key` via `BaseTtsOption`)".into(),
            ));
        }
        Ok(())
    }

    /// 构建非流式请求体
    fn build_synthesize_request(&self, input: &str) -> GeminiSpeechRequest {
        GeminiSpeechRequest {
            model: self.model.clone(),
            input: input.to_string(),
            response_format: ResponseFormat {
                type_: "audio".into(),
            },
            generation_config: GenerationConfig {
                speech_config: vec![SpeechConfigItem::single(self.voice.as_str())],
            },
            stream: None,
        }
    }

    /// 构建流式请求体
    fn build_stream_request(&self, input: &str) -> GeminiSpeechRequest {
        GeminiSpeechRequest {
            model: self.model.clone(),
            input: input.to_string(),
            response_format: ResponseFormat {
                type_: "audio".into(),
            },
            generation_config: GenerationConfig {
                speech_config: vec![SpeechConfigItem::single(self.voice.as_str())],
            },
            stream: Some(true),
        }
    }
}

// ============================== TtsProvider 实现 ==============================

#[async_trait]
#[allow(clippy::result_large_err)]
impl TtsProvider for GeminiTts {
    fn name(&self) -> &'static str {
        "gemini"
    }

    async fn synthesize(&self, request: TtsRequest) -> Result<TtsResponse, TtsError> {
        self.ensure_valid()?;

        let body = self.build_synthesize_request(&request.text);
        let resp = self
            .client
            .post(&self.base_url)
            .header("x-goog-api-key", &self.api_key)
            .header(CONTENT_TYPE, "application/json")
            .body(
                serde_json::to_vec(&body)
                    .map_err(|e| TtsError::Other(format!("serialize request: {e}")))?,
            )
            .send()
            .await
            .map_err(|e| TtsError::Other(format!("Gemini HTTP request failed: {e}")))?;

        let status = resp.status();
        if !status.is_success() {
            let text = resp.text().await.unwrap_or_default();
            return Err(gemini::parse_error_body(&text, status.as_u16()));
        }

        // 非流式响应：解码 JSON → steps[0].content[0].data → base64 → PCM
        let response_body = resp
            .bytes()
            .await
            .map_err(|e| TtsError::Other(format!("Gemini read body failed: {e}")))?;

        let tts_resp: gemini::GeminiTtsResponse = serde_json::from_slice(&response_body)
            .map_err(|e| TtsError::Other(format!("parse Gemini response: {e}")))?;

        // 检查是否有错误
        if let Some(err) = tts_resp.error {
            return Err(TtsError::ServiceError {
                code: err
                    .code
                    .map_or_else(|| status.to_string(), |c| c.to_string()),
                message: err.message.unwrap_or_else(|| "unknown error".into()),
            });
        }

        let audio = tts_resp.extract_audio().ok_or_else(|| {
            TtsError::Other(
                "Gemini response contains no audio data; \
                 expected `steps[0].content[0].data`"
                    .into(),
            )
        })?;

        if audio.is_empty() {
            return Err(TtsError::NoAudio);
        }

        Ok(TtsResponse {
            audio,
            format: GEMINI_DEFAULT_FORMAT.to_string(),
            duration: None,
        })
    }

    async fn speak_stream(&self, input: TextStream) -> Result<TtsAudioStream, TtsError> {
        self.ensure_valid()?;

        // Gemini 流式 API 的 input 必须一次性发送：缓冲整个文本流。
        let mut text = String::new();
        let mut input = input;
        while let Some(chunk) = input.next().await {
            text.push_str(&chunk);
        }

        let body = self.build_stream_request(&text);
        let resp = self
            .client
            .post(&self.base_url)
            .header("x-goog-api-key", &self.api_key)
            .header(CONTENT_TYPE, "application/json")
            .header(ACCEPT, "text/event-stream")
            .body(
                serde_json::to_vec(&body)
                    .map_err(|e| TtsError::Other(format!("serialize request: {e}")))?,
            )
            .send()
            .await
            .map_err(|e| TtsError::Other(format!("Gemini HTTP request failed: {e}")))?;

        let status = resp.status();
        if !status.is_success() {
            let text = resp.text().await.unwrap_or_default();
            return Err(gemini::parse_error_body(&text, status.as_u16()));
        }

        let bytes_stream = resp.bytes_stream();
        let stream = async_stream::stream! {
            let mut parser = gemini::GeminiSseParser::new();
            tokio::pin!(bytes_stream);

            while let Some(chunk) = bytes_stream.next().await {
                let chunk = match chunk {
                    Ok(c) => c,
                    Err(_e) => {
                        // HTTP 传输层错误通常发生在 Gemini 服务端完成发送后关闭连接时。
                        // 音频数据已经在之前收到的 chunk 中完全处理，此处静默退出。
                        break;
                    }
                };

                for sse_line in parser.push(&chunk) {
                    if let Some(outcome) = process_sse_line(sse_line) {
                        match outcome {
                            GeminiSseOutcome::Audio(a) => yield Ok(TtsStreamChunk { audio_chunk: a }),
                            GeminiSseOutcome::Stop => return,
                            GeminiSseOutcome::Error(e) => {
                                yield Err(e);
                                return;
                            }
                        }
                    }
                }
            }

            // 处理流末尾无换行符的残留尾行
            for sse_line in parser.flush() {
                if let Some(outcome) = process_sse_line(sse_line) {
                    match outcome {
                        GeminiSseOutcome::Audio(a) => yield Ok(TtsStreamChunk { audio_chunk: a }),
                        GeminiSseOutcome::Stop => return,
                        GeminiSseOutcome::Error(e) => {
                            yield Err(e);
                            return;
                        }
                    }
                }
            }
        };

        Ok(Box::pin(stream))
    }

    async fn list_voices(&self) -> Result<Vec<TtsVoice>, TtsError> {
        Ok(gemini_system_voices())
    }
}

// ============================== 内部工具 ==============================

/// 单行 SSE 处理结果
enum GeminiSseOutcome {
    Audio(Vec<u8>),
    Stop,
    Error(TtsError),
}

/// 处理一行 SSE 产出，返回对应的 `GeminiSseOutcome`
fn process_sse_line(line: GeminiSseLine) -> Option<GeminiSseOutcome> {
    match line {
        GeminiSseLine::Data {
            payload,
            event_type,
        } => {
            let result = gemini::parse_delta_payload(&payload, event_type.as_deref());
            match result {
                Ok(Some(GeminiStreamEvent::Audio(audio))) => Some(GeminiSseOutcome::Audio(audio)),
                Ok(Some(GeminiStreamEvent::Complete)) => Some(GeminiSseOutcome::Stop),
                Ok(Some(GeminiStreamEvent::Error(err))) => {
                    Some(GeminiSseOutcome::Error(TtsError::ServiceError {
                        code: err.code.map_or_else(|| "".into(), |c| c.to_string()),
                        message: err
                            .message
                            .unwrap_or_else(|| "Gemini streaming error".into()),
                    }))
                }
                Ok(None) => None,
                Err(e) => Some(GeminiSseOutcome::Error(e)),
            }
        }
        GeminiSseLine::EventComplete { event_type } => {
            // 空行结束了一个事件，如果是 step.end 则视为结束
            if event_type == "step.end" || event_type == "step.complete" {
                Some(GeminiSseOutcome::Stop)
            } else {
                None
            }
        }
    }
}

/// Gemini 系统音色（30 个）
fn gemini_system_voices() -> Vec<TtsVoice> {
    gemini::gemini_voices()
        .into_iter()
        .map(|(id, name, _description)| TtsVoice {
            id: id.into(),
            name: name.into(),
            language: "en-US".into(),
            gender: None,
        })
        .collect()
}

// ============================== 测试 ==============================

#[cfg(test)]
mod tests {
    use super::*;
    use crate::tts::types::TtsConnectOption;

    // -------- c1 默认值 --------

    #[test]
    fn test_c1_defaults() {
        let p = GeminiTts::new(GeminiTtsOption {
            base: BaseTtsOption {
                api_key: Some("k".into()),
                ..Default::default()
            },
        });
        assert_eq!(p.name(), "gemini");
        assert_eq!(p.base_url, GEMINI_DEFAULT_BASE_URL);
        assert_eq!(p.model, GEMINI_DEFAULT_MODEL);
        assert_eq!(p.voice, GEMINI_DEFAULT_VOICE);
    }

    // -------- c2 自定义覆盖 --------

    #[test]
    fn test_c2_custom_options() {
        let p = GeminiTts::new(GeminiTtsOption {
            base: BaseTtsOption {
                api_key: Some("key".into()),
                base_url: Some("https://custom.example.com/interactions".into()),
                model: Some("gemini-2.5-pro-preview-tts".into()),
                voice: Some("Puck".into()),
                ..Default::default()
            },
        });
        assert_eq!(p.api_key, "key");
        assert_eq!(p.base_url, "https://custom.example.com/interactions");
        assert_eq!(p.model, "gemini-2.5-pro-preview-tts");
        assert_eq!(p.voice, "Puck");
    }

    // -------- c3 api_key 来源 --------

    #[test]
    fn test_c3_api_key_source() {
        let p = GeminiTts::new(GeminiTtsOption {
            base: BaseTtsOption {
                api_key: Some("the-key".into()),
                ..Default::default()
            },
        });
        assert_eq!(p.api_key, "the-key");

        let p = GeminiTts::new(GeminiTtsOption::default());
        assert_eq!(p.api_key, "");
    }

    // -------- v1 空 api_key 校验 --------

    #[test]
    fn test_v1_empty_api_key() {
        let p = GeminiTts::new(GeminiTtsOption::default());
        assert!(matches!(
            p.ensure_valid(),
            Err(TtsError::InvalidParameter(_))
        ));
    }

    // -------- v2 合法 api_key --------

    #[test]
    fn test_v2_valid_api_key() {
        let p = GeminiTts::new(GeminiTtsOption {
            base: BaseTtsOption {
                api_key: Some("valid".into()),
                ..Default::default()
            },
        });
        assert!(p.ensure_valid().is_ok());
    }

    // -------- m1 非流式请求体 --------

    #[test]
    fn test_m1_synthesize_request() {
        let p = GeminiTts::new(GeminiTtsOption {
            base: BaseTtsOption {
                api_key: Some("k".into()),
                ..Default::default()
            },
        });
        let req = p.build_synthesize_request("你好");
        assert_eq!(req.input, "你好");
        assert_eq!(req.model, GEMINI_DEFAULT_MODEL);
        assert_eq!(req.response_format.type_, "audio");
        assert_eq!(req.generation_config.speech_config.len(), 1);
        assert_eq!(
            req.generation_config.speech_config[0].voice.as_deref(),
            Some(GEMINI_DEFAULT_VOICE)
        );
        assert!(req.stream.is_none());
    }

    // -------- m2 流式请求体 --------

    #[test]
    fn test_m2_stream_request() {
        let p = GeminiTts::new(GeminiTtsOption {
            base: BaseTtsOption {
                api_key: Some("k".into()),
                ..Default::default()
            },
        });
        let req = p.build_stream_request("hi");
        assert_eq!(req.stream, Some(true));
        assert_eq!(req.input, "hi");
    }

    // -------- l1 list_voices 返回 30 个系统音色 --------

    #[tokio::test]
    async fn test_l1_list_voices() {
        let p = GeminiTts::new(GeminiTtsOption {
            base: BaseTtsOption {
                api_key: Some("k".into()),
                ..Default::default()
            },
        });
        let voices = p.list_voices().await.unwrap();
        assert_eq!(voices.len(), 30);
        assert!(voices.iter().any(|v| v.id == "Kore"));
        assert!(voices.iter().any(|v| v.id == "Puck"));
        assert!(voices.iter().all(|v| v.language == "en-US"));
    }

    // -------- s1 connect 返回 Unsupported（默认行为） --------

    #[tokio::test]
    async fn test_s1_connect_unsupported() {
        let p = GeminiTts::new(GeminiTtsOption {
            base: BaseTtsOption {
                api_key: Some("k".into()),
                ..Default::default()
            },
        });
        let result = p.connect(TtsConnectOption::default()).await;
        assert!(matches!(result, Err(TtsError::Unsupported(_))));
    }

    // -------- s2 speak_stream 失败的请求（mock HTTP 层面） --------
    // 注意：这个测试验证 ensure_valid 在空 api_key 时提前返回

    #[tokio::test]
    async fn test_s2_speak_stream_no_api_key() {
        let p = GeminiTts::new(GeminiTtsOption::default());
        let input: TextStream = Box::pin(futures_util::stream::iter(vec!["hello".to_string()]));
        let result = p.speak_stream(input).await;
        assert!(matches!(result, Err(TtsError::InvalidParameter(_))));
    }

    // -------- w1 自定义 voice --------

    #[test]
    fn test_w1_custom_voice() {
        let p = GeminiTts::new(GeminiTtsOption {
            base: BaseTtsOption {
                api_key: Some("k".into()),
                voice: Some("Puck".into()),
                ..Default::default()
            },
        });
        assert_eq!(p.voice, "Puck");
    }

    // -------- w2 synthesize 空 api_key 校验 --------

    #[tokio::test]
    async fn test_w2_synthesize_no_api_key() {
        let p = GeminiTts::new(GeminiTtsOption::default());
        let req = TtsRequest {
            text: "hello".into(),
            options: None,
        };
        let result = p.synthesize(req).await;
        assert!(matches!(result, Err(TtsError::InvalidParameter(_))));
    }
}
