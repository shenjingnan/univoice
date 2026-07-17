//! OpenAI TTS Provider
//!
//! 基于 OpenAI API 实现语音合成，支持两种 API 模式：
//!
//! - **Speech 模式**：使用 `audio/speech` API（标准 OpenAI TTS，如 `tts-1`、`tts-1-hd`、`gpt-4o-mini-tts`）
//! - **Chat 模式**：使用 `chat/completions` + `audio` 参数（兼容 `mimo-v2-tts` 等服务）
//!
//! 默认根据 model 名称自动推断 API 模式。本 provider **不实现** `connect` / `TtsConnection`
//! （纯 HTTP 无长连接），保留 trait 默认行为（返回 `Unsupported`）。
//!
//! 协议细节（请求体序列化、SSE 解析、格式映射、错误解析）见
//! [`crate::tts::protocol::openai`]。

use std::time::Duration;

use async_trait::async_trait;
use futures_util::StreamExt;
use reqwest::header::{AUTHORIZATION, CONTENT_TYPE};

use base64::Engine;

use crate::tts::error::TtsError;
use crate::tts::protocol::openai::{
    self, OPENAI_DEFAULT_BASE_URL, OPENAI_DEFAULT_MODEL, OPENAI_DEFAULT_VOICE, OpenaiApiMode,
    OpenaiChatAudioParam, OpenaiChatMessage, OpenaiChatRequest, OpenaiSpeechRequest,
    infer_api_mode, map_format_for_chat_api, map_format_for_speech_api,
};
use crate::tts::traits::TtsProvider;
use crate::tts::types::{
    BaseTtsOption, TextStream, TtsAudioStream, TtsRequest, TtsResponse, TtsStreamChunk, TtsVoice,
};
use crate::tts::voice_id::VoiceId;

// ============================== 常量 ==============================

/// HTTP 请求超时
#[cfg(not(test))]
const REQUEST_TIMEOUT: Duration = Duration::from_secs(60);
#[cfg(test)]
const REQUEST_TIMEOUT: Duration = Duration::from_secs(2);

// ============================== OpenaiTtsOption ==============================

/// OpenAI TTS 专属配置
#[derive(Debug, Clone, Default)]
pub struct OpenaiTtsOption {
    pub base: BaseTtsOption,
    /// API 调用模式。`None` 时根据 model 自动推断。
    pub api_mode: Option<OpenaiApiMode>,
}

// ============================== OpenaiTts ==============================

/// OpenAI TTS Provider
pub struct OpenaiTts {
    api_key: String,
    base_url: String,
    model: String,
    voice: VoiceId,
    speed: Option<f32>,
    format: String,
    api_mode: OpenaiApiMode,
    client: reqwest::Client,
}

impl OpenaiTts {
    pub fn new(options: OpenaiTtsOption) -> Self {
        let base = &options.base;
        let client = reqwest::Client::builder()
            .timeout(REQUEST_TIMEOUT)
            .build()
            .expect("reqwest client with timeout must build");

        let model = base
            .model
            .clone()
            .unwrap_or_else(|| OPENAI_DEFAULT_MODEL.into());
        let voice = base
            .voice
            .clone()
            .unwrap_or_else(|| VoiceId::from(OPENAI_DEFAULT_VOICE));

        let api_mode = options.api_mode.unwrap_or_else(|| infer_api_mode(&model));

        Self {
            api_key: base.api_key.clone().unwrap_or_default(),
            base_url: base
                .base_url
                .clone()
                .unwrap_or_else(|| OPENAI_DEFAULT_BASE_URL.into()),
            model,
            voice,
            speed: base.speed,
            format: base.format.clone().unwrap_or_else(|| "mp3".into()),
            api_mode,
            client,
        }
    }

    /// 校验必要参数
    fn ensure_valid(&self) -> Result<(), TtsError> {
        if self.api_key.is_empty() {
            return Err(TtsError::InvalidParameter(
                "apiKey is required for OpenAI TTS (set `api_key` via `BaseTtsOption`)".into(),
            ));
        }
        Ok(())
    }

    /// 获取请求选项（合并 `TtsRequest.options` 覆盖）
    fn resolve_options(&self, request: &TtsRequest) -> (String, VoiceId, Option<f32>, String) {
        let opts = request.options.as_ref();
        let model = opts
            .and_then(|o| o.model.clone())
            .unwrap_or_else(|| self.model.clone());
        let voice = opts
            .and_then(|o| o.voice.clone())
            .unwrap_or_else(|| self.voice.clone());
        let speed = opts.and_then(|o| o.speed).or(self.speed);
        let format = opts
            .and_then(|o| o.format.clone())
            .unwrap_or_else(|| self.format.clone());
        (model, voice, speed, format)
    }
}

// ============================== TtsProvider 实现 ==============================

#[async_trait]
#[allow(clippy::result_large_err)]
impl TtsProvider for OpenaiTts {
    fn name(&self) -> &'static str {
        "openai"
    }

    async fn synthesize(&self, request: TtsRequest) -> Result<TtsResponse, TtsError> {
        self.ensure_valid()?;

        match self.api_mode {
            OpenaiApiMode::Speech => self.synthesize_via_speech_api(&request).await,
            OpenaiApiMode::Chat => self.synthesize_via_chat_api(&request).await,
        }
    }

    async fn speak_stream(&self, input: TextStream) -> Result<TtsAudioStream, TtsError> {
        self.ensure_valid()?;

        // 两种模式都需要先收集完整文本
        let mut text = String::new();
        let mut input = input;
        while let Some(chunk) = input.next().await {
            text.push_str(&chunk);
        }

        match self.api_mode {
            OpenaiApiMode::Speech => self.speak_stream_via_speech_api(&text).await,
            OpenaiApiMode::Chat => self.speak_stream_via_chat_api(&text).await,
        }
    }

    async fn list_voices(&self) -> Result<Vec<TtsVoice>, TtsError> {
        Ok(openai_system_voices())
    }
}

// ============================== Speech 模式 ==============================

impl OpenaiTts {
    /// Speech 模式：非流式合成
    async fn synthesize_via_speech_api(
        &self,
        request: &TtsRequest,
    ) -> Result<TtsResponse, TtsError> {
        let (model, voice, speed, format) = self.resolve_options(request);
        let api_format = map_format_for_speech_api(&format);
        let api_mode = infer_api_mode(&model);

        let body = OpenaiSpeechRequest {
            model: model.clone(),
            input: request.text.clone(),
            voice: voice.to_string(),
            response_format: api_format.to_string(),
            speed,
        };

        let resp =
            self.client
                .post(format!(
                    "{}/audio/speech",
                    self.base_url.trim_end_matches('/')
                ))
                .header(AUTHORIZATION, format!("Bearer {}", self.api_key))
                .header(CONTENT_TYPE, "application/json")
                .body(serde_json::to_vec(&body).map_err(|e| {
                    TtsError::Other(format!("serialize OpenAI speech request: {e}"))
                })?)
                .send()
                .await
                .map_err(|e| TtsError::Other(format!("OpenAI HTTP request failed: {e}")))?;

        // 如果实际 api_mode 与期望不同且有 chat 模式响应特征，重新走 chat 模式
        if api_mode == OpenaiApiMode::Speech {
            // speech API 直接返回二进制，不是 JSON
            let status = resp.status();
            if !status.is_success() {
                let text = resp.text().await.unwrap_or_default();
                return Err(openai::parse_error_body(&text, status.as_u16()));
            }

            let audio = resp
                .bytes()
                .await
                .map_err(|e| TtsError::Other(format!("OpenAI read body failed: {e}")))?
                .to_vec();

            if audio.is_empty() {
                return Err(TtsError::NoAudio);
            }

            return Ok(TtsResponse {
                audio,
                format: format.clone(),
                duration: None,
            });
        }

        // Chat 模式非流式
        let status = resp.status();
        if !status.is_success() {
            let text = resp.text().await.unwrap_or_default();
            return Err(openai::parse_error_body(&text, status.as_u16()));
        }

        let response_body = resp
            .bytes()
            .await
            .map_err(|e| TtsError::Other(format!("OpenAI read body failed: {e}")))?;

        let chat_resp: openai::OpenaiChatResponse = serde_json::from_slice(&response_body)
            .map_err(|e| TtsError::Other(format!("parse OpenAI chat response: {e}")))?;

        let audio_data = chat_resp
            .choices
            .first()
            .and_then(|c| c.message.audio.as_ref())
            .ok_or_else(|| {
                TtsError::Other(
                    "OpenAI chat response contains no audio data (expected `choices[0].message.audio.data`)"
                        .into(),
                )
            })?;

        let audio = base64::engine::general_purpose::STANDARD
            .decode(&audio_data.data)
            .map_err(|e| TtsError::Other(format!("base64 decode audio data: {e}")))?;

        if audio.is_empty() {
            return Err(TtsError::NoAudio);
        }

        Ok(TtsResponse {
            audio,
            format,
            duration: None,
        })
    }

    /// Speech 模式：流式合成（逐块读取 HTTP 响应体）
    async fn speak_stream_via_speech_api(&self, text: &str) -> Result<TtsAudioStream, TtsError> {
        let body = OpenaiSpeechRequest {
            model: self.model.clone(),
            input: text.to_string(),
            voice: self.voice.to_string(),
            response_format: map_format_for_speech_api(&self.format).to_string(),
            speed: self.speed,
        };

        let resp =
            self.client
                .post(format!(
                    "{}/audio/speech",
                    self.base_url.trim_end_matches('/')
                ))
                .header(AUTHORIZATION, format!("Bearer {}", self.api_key))
                .header(CONTENT_TYPE, "application/json")
                .body(serde_json::to_vec(&body).map_err(|e| {
                    TtsError::Other(format!("serialize OpenAI speech request: {e}"))
                })?)
                .send()
                .await
                .map_err(|e| TtsError::Other(format!("OpenAI HTTP request failed: {e}")))?;

        let status = resp.status();
        if !status.is_success() {
            let text = resp.text().await.unwrap_or_default();
            return Err(openai::parse_error_body(&text, status.as_u16()));
        }

        let bytes_stream = resp.bytes_stream();
        let stream = async_stream::stream! {
            tokio::pin!(bytes_stream);
            while let Some(chunk) = bytes_stream.next().await {
                let chunk = match chunk {
                    Ok(c) => c,
                    Err(e) => {
                        yield Err(TtsError::Other(format!("OpenAI stream read failed: {e}")));
                        return;
                    }
                };
                if !chunk.is_empty() {
                    yield Ok(TtsStreamChunk { audio_chunk: chunk.to_vec() });
                }
            }
        };

        Ok(Box::pin(stream))
    }

    /// Chat 模式：非流式合成
    async fn synthesize_via_chat_api(&self, request: &TtsRequest) -> Result<TtsResponse, TtsError> {
        let (model, voice, _speed, format) = self.resolve_options(request);
        let api_format = map_format_for_chat_api(&format);

        let body = OpenaiChatRequest {
            model: model.clone(),
            messages: vec![OpenaiChatMessage {
                role: "assistant".into(),
                content: request.text.clone(),
            }],
            audio: Some(OpenaiChatAudioParam {
                voice: voice.to_string(),
                format: api_format.to_string(),
            }),
            stream: None,
        };

        let resp = self
            .client
            .post(format!(
                "{}/chat/completions",
                self.base_url.trim_end_matches('/')
            ))
            .header(AUTHORIZATION, format!("Bearer {}", self.api_key))
            .header(CONTENT_TYPE, "application/json")
            .body(
                serde_json::to_vec(&body)
                    .map_err(|e| TtsError::Other(format!("serialize OpenAI chat request: {e}")))?,
            )
            .send()
            .await
            .map_err(|e| TtsError::Other(format!("OpenAI HTTP request failed: {e}")))?;

        let status = resp.status();
        if !status.is_success() {
            let text = resp.text().await.unwrap_or_default();
            return Err(openai::parse_error_body(&text, status.as_u16()));
        }

        let response_body = resp
            .bytes()
            .await
            .map_err(|e| TtsError::Other(format!("OpenAI read body failed: {e}")))?;

        let chat_resp: openai::OpenaiChatResponse = serde_json::from_slice(&response_body)
            .map_err(|e| TtsError::Other(format!("parse OpenAI chat response: {e}")))?;

        let audio_data = chat_resp
            .choices
            .first()
            .and_then(|c| c.message.audio.as_ref())
            .ok_or_else(|| {
                TtsError::Other(
                    "OpenAI chat response contains no audio data (expected `choices[0].message.audio.data`)"
                        .into(),
                )
            })?;

        let audio = base64::engine::general_purpose::STANDARD
            .decode(&audio_data.data)
            .map_err(|e| TtsError::Other(format!("base64 decode audio data: {e}")))?;

        if audio.is_empty() {
            return Err(TtsError::NoAudio);
        }

        Ok(TtsResponse {
            audio,
            format: format.clone(),
            duration: None,
        })
    }

    /// Chat 模式：流式合成（SSE base64 音频块）
    async fn speak_stream_via_chat_api(&self, text: &str) -> Result<TtsAudioStream, TtsError> {
        let api_format = map_format_for_chat_api(&self.format);

        let body = OpenaiChatRequest {
            model: self.model.clone(),
            messages: vec![OpenaiChatMessage {
                role: "assistant".into(),
                content: text.to_string(),
            }],
            audio: Some(OpenaiChatAudioParam {
                voice: self.voice.to_string(),
                format: api_format.to_string(),
            }),
            stream: Some(true),
        };

        let resp = self
            .client
            .post(format!(
                "{}/chat/completions",
                self.base_url.trim_end_matches('/')
            ))
            .header(AUTHORIZATION, format!("Bearer {}", self.api_key))
            .header(CONTENT_TYPE, "application/json")
            .body(
                serde_json::to_vec(&body)
                    .map_err(|e| TtsError::Other(format!("serialize OpenAI chat request: {e}")))?,
            )
            .send()
            .await
            .map_err(|e| TtsError::Other(format!("OpenAI HTTP request failed: {e}")))?;

        let status = resp.status();
        if !status.is_success() {
            let text = resp.text().await.unwrap_or_default();
            return Err(openai::parse_error_body(&text, status.as_u16()));
        }

        let bytes_stream = resp.bytes_stream();
        let stream = async_stream::stream! {
            let mut parser = openai::SseLineParser::new();
            tokio::pin!(bytes_stream);

            while let Some(chunk) = bytes_stream.next().await {
                let chunk = match chunk {
                    Ok(c) => c,
                    Err(e) => {
                        yield Err(TtsError::Other(format!("OpenAI stream read failed: {e}")));
                        return;
                    }
                };

                for line in parser.push(&chunk) {
                    if let Some(data) = openai::extract_data(&line) {
                        if let Some(event) = match openai::parse_data(data) {
                            Ok(Some(e)) => Some(e),
                            Ok(None) => None,
                            Err(e) => {
                                yield Err(e);
                                return;
                            }
                        } {
                            match event {
                                openai::OpenaiStreamEvent::Audio(audio) => {
                                    yield Ok(TtsStreamChunk { audio_chunk: audio });
                                }
                                openai::OpenaiStreamEvent::Finish => return,
                                openai::OpenaiStreamEvent::Error(err) => {
                                    yield Err(TtsError::ServiceError {
                                        code: err.code.unwrap_or_default(),
                                        message: err.message.unwrap_or_else(|| "OpenAI streaming error".into()),
                                    });
                                    return;
                                }
                            }
                        }
                    }
                }
            }

            // 处理流末尾的残留尾行
            for line in parser.flush() {
                if let Some(data) = openai::extract_data(&line) {
                    if let Ok(Some(event)) = openai::parse_data(data) {
                        match event {
                            openai::OpenaiStreamEvent::Audio(audio) => {
                                yield Ok(TtsStreamChunk { audio_chunk: audio });
                            }
                            openai::OpenaiStreamEvent::Finish => return,
                            openai::OpenaiStreamEvent::Error(err) => {
                                yield Err(TtsError::ServiceError {
                                    code: err.code.unwrap_or_default(),
                                    message: err.message.unwrap_or_else(|| "OpenAI streaming error".into()),
                                });
                                return;
                            }
                        }
                    }
                }
            }
        };

        Ok(Box::pin(stream))
    }
}

// ============================== 内部工具 ==============================

/// 系统音色列表
fn openai_system_voices() -> Vec<TtsVoice> {
    openai::openai_voices()
        .into_iter()
        .map(|(id, name, _language)| TtsVoice {
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
        let p = OpenaiTts::new(OpenaiTtsOption {
            base: BaseTtsOption {
                api_key: Some("k".into()),
                ..Default::default()
            },
            ..Default::default()
        });
        assert_eq!(p.name(), "openai");
        assert_eq!(p.base_url, OPENAI_DEFAULT_BASE_URL);
        assert_eq!(p.model, OPENAI_DEFAULT_MODEL);
        assert_eq!(p.voice, OPENAI_DEFAULT_VOICE);
        assert_eq!(p.format, "mp3");
        assert!(p.speed.is_none());
        assert_eq!(p.api_mode, OpenaiApiMode::Speech);
    }

    // -------- c2 自定义覆盖 --------

    #[test]
    fn test_c2_custom_options() {
        let p = OpenaiTts::new(OpenaiTtsOption {
            base: BaseTtsOption {
                api_key: Some("key".into()),
                base_url: Some("https://custom.example.com/v1".into()),
                model: Some("tts-1-hd".into()),
                voice: Some("echo".into()),
                speed: Some(1.2),
                format: Some("wav".into()),
                ..Default::default()
            },
            ..Default::default()
        });
        assert_eq!(p.api_key, "key");
        assert_eq!(p.base_url, "https://custom.example.com/v1");
        assert_eq!(p.model, "tts-1-hd");
        assert_eq!(p.voice, "echo");
        assert_eq!(p.speed, Some(1.2));
        assert_eq!(p.format, "wav");
        assert_eq!(p.api_mode, OpenaiApiMode::Speech);
    }

    // -------- c3 api_key 来源 --------

    #[test]
    fn test_c3_api_key_source() {
        let p = OpenaiTts::new(OpenaiTtsOption {
            base: BaseTtsOption {
                api_key: Some("the-key".into()),
                ..Default::default()
            },
            ..Default::default()
        });
        assert_eq!(p.api_key, "the-key");

        let p = OpenaiTts::new(OpenaiTtsOption::default());
        assert_eq!(p.api_key, "");
    }

    // -------- c4 model → api_mode 自动推断 --------

    #[test]
    fn test_c4_api_mode_inference() {
        // tts-1 → speech
        let p = OpenaiTts::new(OpenaiTtsOption {
            base: BaseTtsOption {
                api_key: Some("k".into()),
                model: Some("tts-1".into()),
                ..Default::default()
            },
            ..Default::default()
        });
        assert_eq!(p.api_mode, OpenaiApiMode::Speech);

        // 未知模型 → chat
        let p = OpenaiTts::new(OpenaiTtsOption {
            base: BaseTtsOption {
                api_key: Some("k".into()),
                model: Some("gpt-4o-audio-preview".into()),
                ..Default::default()
            },
            ..Default::default()
        });
        assert_eq!(p.api_mode, OpenaiApiMode::Chat);
    }

    // -------- c5 显式指定 api_mode --------

    #[test]
    fn test_c5_explicit_api_mode() {
        let p = OpenaiTts::new(OpenaiTtsOption {
            base: BaseTtsOption {
                api_key: Some("k".into()),
                model: Some("tts-1".into()),
                ..Default::default()
            },
            api_mode: Some(OpenaiApiMode::Chat),
        });
        assert_eq!(p.api_mode, OpenaiApiMode::Chat);

        let p = OpenaiTts::new(OpenaiTtsOption {
            base: BaseTtsOption {
                api_key: Some("k".into()),
                model: Some("mimo-v2-tts".into()),
                ..Default::default()
            },
            api_mode: Some(OpenaiApiMode::Speech),
        });
        assert_eq!(p.api_mode, OpenaiApiMode::Speech);
    }

    // -------- v1 空 api_key 校验 --------

    #[test]
    fn test_v1_empty_api_key() {
        let p = OpenaiTts::new(OpenaiTtsOption::default());
        assert!(matches!(
            p.ensure_valid(),
            Err(TtsError::InvalidParameter(_))
        ));
    }

    // -------- v2 合法 api_key --------

    #[test]
    fn test_v2_valid_api_key() {
        let p = OpenaiTts::new(OpenaiTtsOption {
            base: BaseTtsOption {
                api_key: Some("valid".into()),
                ..Default::default()
            },
            ..Default::default()
        });
        assert!(p.ensure_valid().is_ok());
    }

    // -------- l1 list_voices 返回 10 个系统音色 --------

    #[tokio::test]
    async fn test_l1_list_voices() {
        let p = OpenaiTts::new(OpenaiTtsOption {
            base: BaseTtsOption {
                api_key: Some("k".into()),
                ..Default::default()
            },
            ..Default::default()
        });
        let voices = p.list_voices().await.unwrap();
        assert_eq!(voices.len(), 10);
        assert!(voices.iter().any(|v| v.id == "alloy"));
        assert!(voices.iter().any(|v| v.id == "echo"));
        assert!(voices.iter().any(|v| v.id == "shimmer"));
        assert!(voices.iter().all(|v| v.language == "en-US"));
    }

    // -------- s1 connect 返回 Unsupported（默认行为） --------

    #[tokio::test]
    async fn test_s1_connect_unsupported() {
        let p = OpenaiTts::new(OpenaiTtsOption {
            base: BaseTtsOption {
                api_key: Some("k".into()),
                ..Default::default()
            },
            ..Default::default()
        });
        let result = p.connect(TtsConnectOption::default()).await;
        assert!(matches!(result, Err(TtsError::Unsupported(_))));
    }

    // -------- s2 speak_stream 空 api_key 校验 --------

    #[tokio::test]
    async fn test_s2_speak_stream_no_api_key() {
        let p = OpenaiTts::new(OpenaiTtsOption::default());
        let input: TextStream = Box::pin(futures_util::stream::iter(vec!["hello".to_string()]));
        let result = p.speak_stream(input).await;
        assert!(matches!(result, Err(TtsError::InvalidParameter(_))));
    }

    // -------- w1 自定义 voice --------

    #[test]
    fn test_w1_custom_voice() {
        let p = OpenaiTts::new(OpenaiTtsOption {
            base: BaseTtsOption {
                api_key: Some("k".into()),
                voice: Some("echo".into()),
                ..Default::default()
            },
            ..Default::default()
        });
        assert_eq!(p.voice, "echo");
    }

    // -------- w2 synthesize 空 api_key 校验 --------

    #[tokio::test]
    async fn test_w2_synthesize_no_api_key() {
        let p = OpenaiTts::new(OpenaiTtsOption::default());
        let req = TtsRequest {
            text: "hello".into(),
            options: None,
        };
        let result = p.synthesize(req).await;
        assert!(matches!(result, Err(TtsError::InvalidParameter(_))));
    }

    // -------- w3 resolve_options 合并 --------

    #[test]
    fn test_w3_resolve_options() {
        let p = OpenaiTts::new(OpenaiTtsOption {
            base: BaseTtsOption {
                api_key: Some("k".into()),
                model: Some("tts-1".into()),
                voice: Some("alloy".into()),
                speed: Some(1.0),
                format: Some("mp3".into()),
                ..Default::default()
            },
            ..Default::default()
        });

        // 无覆盖 → 实例默认值
        let req = TtsRequest {
            text: "hello".into(),
            options: None,
        };
        let (model, voice, speed, format) = p.resolve_options(&req);
        assert_eq!(model, "tts-1");
        assert_eq!(voice, "alloy");
        assert_eq!(speed, Some(1.0));
        assert_eq!(format, "mp3");

        // 有覆盖 → 使用覆盖值
        let req = TtsRequest {
            text: "hello".into(),
            options: Some(BaseTtsOption {
                model: Some("gpt-4o-audio-preview".into()),
                voice: Some("echo".into()),
                speed: Some(1.5),
                format: Some("wav".into()),
                ..Default::default()
            }),
        };
        let (model, voice, speed, format) = p.resolve_options(&req);
        assert_eq!(model, "gpt-4o-audio-preview");
        assert_eq!(voice, "echo");
        assert_eq!(speed, Some(1.5));
        assert_eq!(format, "wav");
    }

    // -------- w4 Chat 模式 synthesize 空 api_key --------

    #[tokio::test]
    async fn test_w4_chat_synthesize_no_api_key() {
        let p = OpenaiTts::new(OpenaiTtsOption {
            base: BaseTtsOption {
                model: Some("gpt-4o-audio-preview".into()),
                ..Default::default()
            },
            ..Default::default()
        });
        let req = TtsRequest {
            text: "hello".into(),
            options: None,
        };
        let result = p.synthesize(req).await;
        assert!(matches!(result, Err(TtsError::InvalidParameter(_))));
    }

    // -------- w5 校验不支持 connect --------

    #[tokio::test]
    async fn test_w5_connect_unsupported() {
        let p = OpenaiTts::new(OpenaiTtsOption {
            base: BaseTtsOption {
                api_key: Some("k".into()),
                ..Default::default()
            },
            ..Default::default()
        });
        let result = p.connect(TtsConnectOption::default()).await;
        assert!(matches!(result, Err(TtsError::Unsupported(_))));
    }
}
