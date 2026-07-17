//! GLM (智谱 AI) TTS Provider
//!
//! 基于智谱 AI GLM-TTS HTTP REST API 实现语音合成。
//! 对应 TypeScript 端的 `src/tts/providers/glm.ts`。
//!
//! 与 [`super::qwen`] / [`super::doubao`]（基于 WebSocket）不同，GLM 走纯
//! HTTP REST：非流式 `POST` 直接返回二进制音频；流式 `POST stream=true`
//! 返回 SSE（base64 PCM，固定 24000 Hz）。因此本 provider **不实现**
//! `connect` / `TtsConnection`（无长连接），`connect` 保留 trait 默认行为
//! （返回 `Unsupported`）。
//!
//! 协议细节（请求体序列化、SSE 解析、参数映射）见
//! [`crate::tts::protocol::glm`]。

use std::time::Duration;

use async_trait::async_trait;
use futures_util::StreamExt;
use reqwest::header::{ACCEPT, AUTHORIZATION, CONTENT_TYPE};

use crate::tts::error::TtsError;
use crate::tts::protocol::glm::{
    self, GLM_DEFAULT_BASE_URL, GLM_DEFAULT_MODEL, GLM_DEFAULT_VOICE, GlmSpeechRequest,
};
use crate::tts::traits::TtsProvider;
use crate::tts::types::{
    BaseTtsOption, TextStream, TtsAudioStream, TtsRequest, TtsResponse, TtsStreamChunk, TtsVoice,
};
use crate::tts::voice_id::VoiceId;
use crate::tts::voices;

// ============================== 常量 ==============================

/// GLM TTS 默认音频格式（非流式）
const GLM_DEFAULT_FORMAT: &str = "pcm";

/// HTTP 请求超时
#[cfg(not(test))]
const REQUEST_TIMEOUT: Duration = Duration::from_secs(30);
#[cfg(test)]
const REQUEST_TIMEOUT: Duration = Duration::from_secs(2);

// ============================== GlmTtsOption ==============================

/// GLM TTS 专属配置
#[derive(Debug, Clone, Default)]
pub struct GlmTtsOption {
    pub base: BaseTtsOption,
    /// GLM 专属：AI 生成音频水印开关（`None` 不发送，保持服务端默认）
    pub watermark_enabled: Option<bool>,
}

// ============================== GlmTts ==============================

/// GLM TTS Provider
pub struct GlmTts {
    api_key: String,
    base_url: String,
    model: String,
    voice: VoiceId,
    format: String,
    speed: Option<f32>,
    volume: Option<f32>,
    watermark_enabled: Option<bool>,
    client: reqwest::Client,
}

impl GlmTts {
    pub fn new(options: GlmTtsOption) -> Self {
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
                .unwrap_or_else(|| GLM_DEFAULT_BASE_URL.into()),
            model: base
                .model
                .clone()
                .unwrap_or_else(|| GLM_DEFAULT_MODEL.into()),
            voice: base
                .voice
                .clone()
                .unwrap_or_else(|| VoiceId::from(GLM_DEFAULT_VOICE)),
            format: base
                .format
                .clone()
                .unwrap_or_else(|| GLM_DEFAULT_FORMAT.into()),
            speed: base.speed,
            volume: base.volume,
            watermark_enabled: options.watermark_enabled,
            client,
        }
    }

    /// 校验必要参数
    fn ensure_valid(&self) -> Result<(), TtsError> {
        if self.api_key.is_empty() {
            return Err(TtsError::InvalidParameter(
                "apiKey is required for GLM TTS".into(),
            ));
        }
        Ok(())
    }

    /// 构建请求体。`stream=true` 时强制 `pcm` + `base64` 编码
    fn build_request(&self, input: &str, stream: bool) -> GlmSpeechRequest {
        let response_format = if stream {
            "pcm".to_string()
        } else {
            glm::map_format(&self.format).to_string()
        };
        GlmSpeechRequest {
            model: self.model.clone(),
            input: input.to_string(),
            voice: self.voice.as_str().to_string(),
            response_format,
            stream: if stream { Some(true) } else { None },
            encode_format: if stream { Some("base64".into()) } else { None },
            speed: glm::map_speed(self.speed),
            volume: glm::map_volume(self.volume),
            watermark_enabled: self.watermark_enabled,
        }
    }
}

// ============================== TtsProvider 实现 ==============================

#[async_trait]
#[allow(clippy::result_large_err)]
impl TtsProvider for GlmTts {
    fn name(&self) -> &'static str {
        "glm"
    }

    async fn synthesize(&self, request: TtsRequest) -> Result<TtsResponse, TtsError> {
        self.ensure_valid()?;
        let body = self.build_request(&request.text, false);

        let resp = self
            .client
            .post(&self.base_url)
            .header(AUTHORIZATION, format!("Bearer {}", self.api_key))
            .header(CONTENT_TYPE, "application/json")
            .body(
                serde_json::to_vec(&body)
                    .map_err(|e| TtsError::Other(format!("serialize request: {e}")))?,
            )
            .send()
            .await
            .map_err(|e| TtsError::Other(format!("GLM HTTP request failed: {e}")))?;

        let status = resp.status();
        if !status.is_success() {
            let text = resp.text().await.unwrap_or_default();
            return Err(glm::parse_error_body(&text, status.as_u16()));
        }

        let audio = resp
            .bytes()
            .await
            .map_err(|e| TtsError::Other(format!("GLM read body failed: {e}")))?
            .to_vec();
        if audio.is_empty() {
            return Err(TtsError::NoAudio);
        }

        Ok(TtsResponse {
            audio,
            format: glm::map_format(&self.format).to_string(),
            duration: None,
        })
    }

    async fn speak_stream(&self, input: TextStream) -> Result<TtsAudioStream, TtsError> {
        self.ensure_valid()?;

        // GLM 流式 API 的 input 必须一次性发送：缓冲整个文本流。
        // 低延迟优势体现在音频输出侧（首帧 ~400ms），而非文本输入侧。
        let mut text = String::new();
        let mut input = input;
        while let Some(chunk) = input.next().await {
            text.push_str(&chunk);
        }

        let body = self.build_request(&text, true);
        let resp = self
            .client
            .post(&self.base_url)
            .header(AUTHORIZATION, format!("Bearer {}", self.api_key))
            .header(CONTENT_TYPE, "application/json")
            .header(ACCEPT, "text/event-stream")
            .body(
                serde_json::to_vec(&body)
                    .map_err(|e| TtsError::Other(format!("serialize request: {e}")))?,
            )
            .send()
            .await
            .map_err(|e| TtsError::Other(format!("GLM HTTP request failed: {e}")))?;

        let status = resp.status();
        if !status.is_success() {
            let text = resp.text().await.unwrap_or_default();
            return Err(glm::parse_error_body(&text, status.as_u16()));
        }

        let bytes_stream = resp.bytes_stream();
        let stream = async_stream::stream! {
            let mut parser = glm::SseLineParser::new();
            tokio::pin!(bytes_stream);

            while let Some(chunk) = bytes_stream.next().await {
                let chunk = match chunk {
                    Ok(c) => c,
                    Err(e) => {
                        yield Err(TtsError::Other(format!("GLM stream read failed: {e}")));
                        return;
                    }
                };
                for outcome in process_lines(&mut parser, &chunk) {
                    match outcome {
                        Outcome::Audio(a) => yield Ok(TtsStreamChunk { audio_chunk: a }),
                        Outcome::Stop => return,
                        Outcome::Error(e) => {
                            yield Err(e);
                            return;
                        }
                    }
                }
            }

            // 处理流末尾无换行符的残留尾行
            for outcome in process_flush(&mut parser) {
                match outcome {
                    Outcome::Audio(a) => yield Ok(TtsStreamChunk { audio_chunk: a }),
                    Outcome::Stop => return,
                    Outcome::Error(e) => {
                        yield Err(e);
                        return;
                    }
                }
            }
        };

        Ok(Box::pin(stream))
    }

    async fn list_voices(&self) -> Result<Vec<TtsVoice>, TtsError> {
        Ok(voices::glm::list_voices())
    }
}

// ============================== 内部工具 ==============================

/// 单行 SSE 处理结果
enum Outcome {
    Audio(Vec<u8>),
    Stop,
    Error(TtsError),
}

/// 处理一批新字节产出的完整行
fn process_lines(parser: &mut glm::SseLineParser, bytes: &[u8]) -> Vec<Outcome> {
    let mut out = Vec::new();
    for line in parser.push(bytes) {
        if let Some(data) = glm::extract_data(&line) {
            if let Some(o) = process_data(data) {
                out.push(o);
            }
        }
    }
    out
}

/// 处理流末尾残留尾行
fn process_flush(parser: &mut glm::SseLineParser) -> Vec<Outcome> {
    let mut out = Vec::new();
    for line in parser.flush() {
        if let Some(data) = glm::extract_data(&line) {
            if let Some(o) = process_data(data) {
                out.push(o);
            }
        }
    }
    out
}

/// 解析一帧 `data:` 负载为 `Outcome`；无有效内容返回 `None`
fn process_data(data: &str) -> Option<Outcome> {
    match glm::parse_data(data) {
        Ok(Some(glm::GlmStreamEvent::Audio(audio))) => Some(Outcome::Audio(audio)),
        Ok(Some(glm::GlmStreamEvent::Finish)) => Some(Outcome::Stop),
        Ok(Some(glm::GlmStreamEvent::Error(err))) => Some(Outcome::Error(TtsError::ServiceError {
            code: err.code.unwrap_or_default(),
            message: err.message.unwrap_or_default(),
        })),
        Ok(None) => None,
        Err(e) => Some(Outcome::Error(e)),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::tts::types::TtsConnectOption;

    // -------- c1 默认值 --------

    #[test]
    fn test_c1_defaults() {
        let p = GlmTts::new(GlmTtsOption {
            base: BaseTtsOption {
                api_key: Some("k".into()),
                ..Default::default()
            },
            ..Default::default()
        });
        assert_eq!(p.name(), "glm");
        assert_eq!(p.base_url, GLM_DEFAULT_BASE_URL);
        assert_eq!(p.model, GLM_DEFAULT_MODEL);
        assert_eq!(p.voice, GLM_DEFAULT_VOICE);
        assert_eq!(p.format, "pcm");
        assert!(p.speed.is_none());
        assert!(p.volume.is_none());
        assert!(p.watermark_enabled.is_none());
    }

    // -------- c2 自定义覆盖 --------

    #[test]
    fn test_c2_custom_options() {
        let p = GlmTts::new(GlmTtsOption {
            base: BaseTtsOption {
                api_key: Some("key".into()),
                base_url: Some("https://custom.example.com/speech".into()),
                model: Some("glm-tts".into()),
                voice: Some("xiaochen".into()),
                format: Some("wav".into()),
                speed: Some(1.5),
                volume: Some(0.5),
                ..Default::default()
            },
            watermark_enabled: Some(true),
        });
        assert_eq!(p.api_key, "key");
        assert_eq!(p.base_url, "https://custom.example.com/speech");
        assert_eq!(p.voice, "xiaochen");
        assert_eq!(p.format, "wav");
        assert_eq!(p.speed, Some(1.5));
        assert_eq!(p.volume, Some(0.5));
        assert_eq!(p.watermark_enabled, Some(true));
    }

    // -------- c3 api_key 来源 --------

    #[test]
    fn test_c3_api_key_source() {
        let p = GlmTts::new(GlmTtsOption {
            base: BaseTtsOption {
                api_key: Some("the-key".into()),
                ..Default::default()
            },
            ..Default::default()
        });
        assert_eq!(p.api_key, "the-key");

        let p = GlmTts::new(GlmTtsOption::default());
        assert_eq!(p.api_key, "");
    }

    // -------- c4 model/voice 默认回退 --------

    #[test]
    fn test_c4_model_voice_defaults() {
        let p = GlmTts::new(GlmTtsOption {
            base: BaseTtsOption {
                api_key: Some("k".into()),
                ..Default::default()
            },
            ..Default::default()
        });
        assert_eq!(p.model, GLM_DEFAULT_MODEL);
        assert_eq!(p.voice, GLM_DEFAULT_VOICE);
    }

    // -------- v1 空 api_key 校验 --------

    #[test]
    fn test_v1_empty_api_key() {
        let p = GlmTts::new(GlmTtsOption::default());
        assert!(matches!(
            p.ensure_valid(),
            Err(TtsError::InvalidParameter(_))
        ));
    }

    // -------- v2 合法 api_key --------

    #[test]
    fn test_v2_valid_api_key() {
        let p = GlmTts::new(GlmTtsOption {
            base: BaseTtsOption {
                api_key: Some("valid".into()),
                ..Default::default()
            },
            ..Default::default()
        });
        assert!(p.ensure_valid().is_ok());
    }

    // -------- m1 非流式请求体（stream 字段不发） --------

    #[test]
    fn test_m1_non_stream_request() {
        let p = GlmTts::new(GlmTtsOption {
            base: BaseTtsOption {
                api_key: Some("k".into()),
                format: Some("wav".into()),
                ..Default::default()
            },
            ..Default::default()
        });
        let req = p.build_request("你好", false);
        assert_eq!(req.stream, None);
        assert_eq!(req.encode_format, None);
        assert_eq!(req.response_format, "wav");
        assert_eq!(req.input, "你好");
    }

    // -------- m2 流式请求体（强制 pcm + base64） --------

    #[test]
    fn test_m2_stream_request() {
        let p = GlmTts::new(GlmTtsOption {
            base: BaseTtsOption {
                api_key: Some("k".into()),
                format: Some("wav".into()), // 即使设 wav，流式也强制 pcm
                ..Default::default()
            },
            ..Default::default()
        });
        let req = p.build_request("hi", true);
        assert_eq!(req.stream, Some(true));
        assert_eq!(req.encode_format.as_deref(), Some("base64"));
        assert_eq!(req.response_format, "pcm");
    }

    // -------- m3 speed/volume 映射 --------

    #[test]
    fn test_m3_speed_volume_mapping() {
        let p = GlmTts::new(GlmTtsOption {
            base: BaseTtsOption {
                api_key: Some("k".into()),
                speed: Some(1.5),
                volume: Some(0.5),
                ..Default::default()
            },
            ..Default::default()
        });
        let req = p.build_request("hi", false);
        assert_eq!(req.speed, Some(1.5));
        assert_eq!(req.volume, Some(5.0));
    }

    // -------- m4 watermark 透传 --------

    #[test]
    fn test_m4_watermark_passthrough() {
        let p = GlmTts::new(GlmTtsOption {
            base: BaseTtsOption {
                api_key: Some("k".into()),
                ..Default::default()
            },
            watermark_enabled: Some(true),
        });
        let req = p.build_request("hi", false);
        assert_eq!(req.watermark_enabled, Some(true));
    }

    // -------- l1 list_voices 返回 7 个系统音色 --------

    #[tokio::test]
    async fn test_l1_list_voices() {
        let p = GlmTts::new(GlmTtsOption {
            base: BaseTtsOption {
                api_key: Some("k".into()),
                ..Default::default()
            },
            ..Default::default()
        });
        let voices = p.list_voices().await.unwrap();
        assert_eq!(voices.len(), 7);
        assert!(voices.iter().any(|v| v.id == "tongtong"));
        assert!(voices.iter().all(|v| v.language == "zh-CN"));
    }

    // -------- s1 connect 返回 Unsupported（默认行为） --------

    #[tokio::test]
    async fn test_s1_connect_unsupported() {
        let p = GlmTts::new(GlmTtsOption {
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
