//! MiniMax TTS Provider
//!
//! 基于 MiniMax T2A V2 HTTP REST API 实现语音合成。
//! 对应 TypeScript 端的 `src/tts/providers/minimax.ts`（WebSocket 实现）。
//!
//! 与 GLM 模式一致：非流式 POST 返回 JSON（含 hex 编码音频）；
//! 流式 POST `stream=true` 返回 SSE（hex 编码音频块）。
//! **不实现** `connect` / `TtsConnection`（HTTP 无长连接）。

use std::time::Duration;

use async_trait::async_trait;
use futures_util::StreamExt;
use reqwest::header::{AUTHORIZATION, CONTENT_TYPE};

use crate::tts::error::TtsError;
use crate::tts::protocol::minimax::{
    self, AudioSetting, MINIMAX_DEFAULT_BASE_URL, MINIMAX_DEFAULT_MODEL, MINIMAX_DEFAULT_VOICE,
    MinimaxStreamEvent, MinimaxTtsRequest, VoiceSetting,
};
use crate::tts::traits::TtsProvider;
use crate::tts::types::{
    BaseTtsOption, TextStream, TtsAudioStream, TtsRequest, TtsResponse, TtsStreamChunk, TtsVoice,
};
use crate::tts::voice_id::VoiceId;
use crate::tts::voices;

// ============================== 常量 ==============================

const MINIMAX_DEFAULT_FORMAT: &str = "mp3";

/// HTTP 请求超时
#[cfg(not(test))]
const REQUEST_TIMEOUT: Duration = Duration::from_secs(30);
#[cfg(test)]
const REQUEST_TIMEOUT: Duration = Duration::from_secs(2);

// ============================== MinimaxTtsOption ==============================

/// MiniMax TTS 专属配置
#[derive(Debug, Clone, Default)]
pub struct MinimaxTtsOption {
    pub base: BaseTtsOption,
    /// 采样率（可选，默认 32000）
    pub sample_rate: Option<u32>,
    /// 比特率（可选，仅 mp3 格式生效，默认 128000）
    pub bitrate: Option<u32>,
    /// 情绪控制（可选）
    pub emotion: Option<String>,
    /// 语种增强（可选）
    pub language_boost: Option<String>,
    /// 是否开启字幕服务
    pub subtitle_enable: Option<bool>,
    /// 声道数（1=单声道，2=双声道）
    pub channel: Option<u32>,
}

// ============================== MinimaxTts ==============================

/// MiniMax TTS Provider
pub struct MinimaxTts {
    api_key: String,
    base_url: String,
    model: String,
    voice: VoiceId,
    format: String,
    speed: Option<f32>,
    volume: Option<f32>,
    pitch: Option<i32>,
    sample_rate: Option<u32>,
    bitrate: Option<u32>,
    emotion: Option<String>,
    language_boost: Option<String>,
    subtitle_enable: Option<bool>,
    channel: Option<u32>,
    client: reqwest::Client,
}

impl MinimaxTts {
    pub fn new(options: MinimaxTtsOption) -> Self {
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
                .unwrap_or_else(|| MINIMAX_DEFAULT_BASE_URL.into()),
            model: base
                .model
                .clone()
                .unwrap_or_else(|| MINIMAX_DEFAULT_MODEL.into()),
            voice: base
                .voice
                .clone()
                .unwrap_or_else(|| VoiceId::from(MINIMAX_DEFAULT_VOICE)),
            format: base
                .format
                .clone()
                .unwrap_or_else(|| MINIMAX_DEFAULT_FORMAT.into()),
            speed: base.speed,
            volume: base.volume,
            pitch: base.pitch.map(|p| p as i32),
            sample_rate: options.sample_rate,
            bitrate: options.bitrate,
            emotion: options.emotion,
            language_boost: options.language_boost,
            subtitle_enable: options.subtitle_enable,
            channel: options.channel,
            client,
        }
    }

    /// 校验必要参数
    fn ensure_valid(&self) -> Result<(), TtsError> {
        if self.api_key.is_empty() {
            return Err(TtsError::InvalidParameter(
                "apiKey is required for Minimax TTS".into(),
            ));
        }
        Ok(())
    }

    /// 构建请求体
    fn build_request(&self, input: &str, stream: bool) -> MinimaxTtsRequest {
        MinimaxTtsRequest {
            model: self.model.clone(),
            text: input.to_string(),
            stream: if stream { Some(true) } else { None },
            voice_setting: VoiceSetting {
                voice_id: self.voice.as_str().to_string(),
                speed: self.speed,
                vol: self.volume,
                pitch: self.pitch,
                emotion: self.emotion.clone(),
            },
            audio_setting: Some(AudioSetting {
                format: self.format.clone(),
                sample_rate: self.sample_rate,
                bitrate: self.bitrate,
                channel: self.channel,
            }),
            language_boost: self.language_boost.clone(),
            subtitle_enable: self.subtitle_enable,
        }
    }
}

// ============================== TtsProvider 实现 ==============================

#[async_trait]
#[allow(clippy::result_large_err)]
impl TtsProvider for MinimaxTts {
    fn name(&self) -> &'static str {
        "minimax"
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
            .map_err(|e| TtsError::Other(format!("Minimax HTTP request failed: {e}")))?;

        let status = resp.status();
        if !status.is_success() {
            let text = resp.text().await.unwrap_or_default();
            return Err(minimax::parse_error_body(&text, status.as_u16()));
        }

        let response_body = resp
            .bytes()
            .await
            .map_err(|e| TtsError::Other(format!("Minimax read body failed: {e}")))?;

        let minimax_resp: minimax::MinimaxResponse = serde_json::from_slice(&response_body)
            .map_err(|e| TtsError::Other(format!("Minimax parse response: {e}")))?;

        // 检查业务错误
        if let Some(base) = &minimax_resp.base_resp {
            if base.status_code != 0 {
                return Err(TtsError::ServiceError {
                    code: base.status_code.to_string(),
                    message: base
                        .status_msg
                        .clone()
                        .unwrap_or_else(|| "unknown error".into()),
                });
            }
        }

        // 提取并解码音频
        let audio = match minimax_resp.data {
            Some(d) => match d.audio {
                Some(hex) if !hex.is_empty() => {
                    let mut raw_hex = hex.as_str();
                    // 移除可能的 BOM 或空白前缀
                    raw_hex = raw_hex.trim();

                    let start = std::time::Instant::now();
                    let result = minimax::decode_hex_audio(raw_hex).map_err(|e| {
                        TtsError::Other(format!("Minimax audio decode failed: {e}"))
                    })?;
                    let elapsed = start.elapsed();
                    tracing::debug!(
                        elapsed_us = elapsed.as_micros(),
                        size = result.len(),
                        "Minimax hex decoded"
                    );
                    result
                }
                _ => {
                    return Err(TtsError::NoAudio);
                }
            },
            None => {
                return Err(TtsError::NoAudio);
            }
        };

        if audio.is_empty() {
            return Err(TtsError::NoAudio);
        }

        Ok(TtsResponse {
            audio,
            format: self.format.clone(),
            duration: None,
        })
    }

    async fn speak_stream(&self, input: TextStream) -> Result<TtsAudioStream, TtsError> {
        self.ensure_valid()?;

        // MiniMax HTTP API 的 text 参数必须一次性发送。
        // 流式加速体现在音频输出侧（首帧 ~ 几百毫秒），而非文本输入侧。
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
            .body(
                serde_json::to_vec(&body)
                    .map_err(|e| TtsError::Other(format!("serialize request: {e}")))?,
            )
            .send()
            .await
            .map_err(|e| TtsError::Other(format!("Minimax HTTP request failed: {e}")))?;

        let status = resp.status();
        if !status.is_success() {
            let text = resp.text().await.unwrap_or_default();
            return Err(minimax::parse_error_body(&text, status.as_u16()));
        }

        let bytes_stream = resp.bytes_stream();
        let stream = async_stream::stream! {
            let mut parser = minimax::SseLineParser::new();
            tokio::pin!(bytes_stream);

            while let Some(chunk_result) = bytes_stream.next().await {
                let chunk = match chunk_result {
                    Ok(c) => c.to_vec(),
                    Err(e) => {
                        yield Err(TtsError::Other(format!("Minimax stream read failed: {e}")));
                        return;
                    }
                };
                for outcome in process_lines(&mut parser, &chunk) {
                    match outcome {
                        MinimaxStreamEvent::Audio(a) => yield Ok(TtsStreamChunk { audio_chunk: a }),
                        MinimaxStreamEvent::Finished => return,
                        MinimaxStreamEvent::Error(e) => {
                            yield Err(e);
                            return;
                        }
                    }
                }
            }

            // 处理流末尾无换行符的残留尾行
            for outcome in process_flush(&mut parser) {
                match outcome {
                    MinimaxStreamEvent::Audio(a) => yield Ok(TtsStreamChunk { audio_chunk: a }),
                    MinimaxStreamEvent::Finished => return,
                    MinimaxStreamEvent::Error(e) => {
                        yield Err(e);
                        return;
                    }
                }
            }
        };

        Ok(Box::pin(stream))
    }

    async fn list_voices(&self) -> Result<Vec<TtsVoice>, TtsError> {
        Ok(voices::minimax::list_voices())
    }
}

// ============================== 内部工具 ==============================

/// 处理一批新字节产出的完整行
fn process_lines(parser: &mut minimax::SseLineParser, bytes: &[u8]) -> Vec<MinimaxStreamEvent> {
    let mut out = Vec::new();
    for line in parser.push(bytes) {
        if let Some(data) = minimax::extract_data(&line) {
            if let Some(event) = process_data(data) {
                out.push(event);
            }
        }
    }
    out
}

/// 处理流末尾残留尾行
fn process_flush(parser: &mut minimax::SseLineParser) -> Vec<MinimaxStreamEvent> {
    let mut out = Vec::new();
    for line in parser.flush() {
        if let Some(data) = minimax::extract_data(&line) {
            if let Some(event) = process_data(data) {
                out.push(event);
            }
        }
    }
    out
}

/// 解析一帧 `data:` 负载为 `MinimaxStreamEvent`；无有效内容返回 `None`
fn process_data(data: &str) -> Option<MinimaxStreamEvent> {
    match minimax::parse_data(data) {
        Ok(Some(event)) => Some(event),
        Ok(None) => None,
        Err(e) => Some(MinimaxStreamEvent::Error(e)),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::tts::types::TtsConnectOption;

    // -------- c1 默认值 --------

    #[test]
    fn test_c1_defaults() {
        let p = MinimaxTts::new(MinimaxTtsOption {
            base: BaseTtsOption {
                api_key: Some("k".into()),
                ..Default::default()
            },
            ..Default::default()
        });
        assert_eq!(p.name(), "minimax");
        assert_eq!(p.base_url, MINIMAX_DEFAULT_BASE_URL);
        assert_eq!(p.model, MINIMAX_DEFAULT_MODEL);
        assert_eq!(p.voice, MINIMAX_DEFAULT_VOICE);
        assert_eq!(p.format, "mp3");
        assert!(p.speed.is_none());
        assert!(p.volume.is_none());
        assert!(p.pitch.is_none());
    }

    // -------- c2 自定义覆盖 --------

    #[test]
    fn test_c2_custom_options() {
        let p = MinimaxTts::new(MinimaxTtsOption {
            base: BaseTtsOption {
                api_key: Some("key".into()),
                base_url: Some("https://custom.example.com/v1/t2a_v2".into()),
                model: Some("speech-2.6-hd".into()),
                voice: Some("female-shaonv".into()),
                format: Some("wav".into()),
                speed: Some(1.5),
                volume: Some(5.0),
                pitch: Some(2.0),
                ..Default::default()
            },
            sample_rate: Some(24000),
            bitrate: Some(64000),
            emotion: Some("happy".into()),
            language_boost: Some("Chinese".into()),
            subtitle_enable: Some(true),
            channel: Some(2),
        });
        assert_eq!(p.api_key, "key");
        assert_eq!(p.base_url, "https://custom.example.com/v1/t2a_v2");
        assert_eq!(p.model, "speech-2.6-hd");
        assert_eq!(p.voice, "female-shaonv");
        assert_eq!(p.format, "wav");
        assert_eq!(p.speed, Some(1.5));
        assert_eq!(p.volume, Some(5.0));
        assert_eq!(p.pitch, Some(2));
        assert_eq!(p.sample_rate, Some(24000));
        assert_eq!(p.bitrate, Some(64000));
        assert_eq!(p.emotion, Some("happy".into()));
        assert_eq!(p.language_boost, Some("Chinese".into()));
        assert_eq!(p.subtitle_enable, Some(true));
        assert_eq!(p.channel, Some(2));
    }

    // -------- c3 api_key 来源 --------

    #[test]
    fn test_c3_api_key_source() {
        let p = MinimaxTts::new(MinimaxTtsOption {
            base: BaseTtsOption {
                api_key: Some("the-key".into()),
                ..Default::default()
            },
            ..Default::default()
        });
        assert_eq!(p.api_key, "the-key");

        let p = MinimaxTts::new(MinimaxTtsOption::default());
        assert_eq!(p.api_key, "");
    }

    // -------- c4 model/voice 默认回退 --------

    #[test]
    fn test_c4_model_voice_defaults() {
        let p = MinimaxTts::new(MinimaxTtsOption {
            base: BaseTtsOption {
                api_key: Some("k".into()),
                ..Default::default()
            },
            ..Default::default()
        });
        assert_eq!(p.model, MINIMAX_DEFAULT_MODEL);
        assert_eq!(p.voice, MINIMAX_DEFAULT_VOICE);
    }

    // -------- c5 pitch 类型转换 f32→i32 --------

    #[test]
    fn test_c5_pitch_conversion() {
        let p = MinimaxTts::new(MinimaxTtsOption {
            base: BaseTtsOption {
                api_key: Some("k".into()),
                pitch: Some(2.7),
                ..Default::default()
            },
            ..Default::default()
        });
        assert_eq!(p.pitch, Some(2));
    }

    // -------- v1 空 api_key 校验 --------

    #[test]
    fn test_v1_empty_api_key() {
        let p = MinimaxTts::new(MinimaxTtsOption::default());
        assert!(matches!(
            p.ensure_valid(),
            Err(TtsError::InvalidParameter(_))
        ));
    }

    // -------- v2 合法 api_key --------

    #[test]
    fn test_v2_valid_api_key() {
        let p = MinimaxTts::new(MinimaxTtsOption {
            base: BaseTtsOption {
                api_key: Some("valid".into()),
                ..Default::default()
            },
            ..Default::default()
        });
        assert!(p.ensure_valid().is_ok());
    }

    // -------- b1 非流式请求体（stream 字段不发） --------

    #[test]
    fn test_b1_non_stream_request() {
        let p = MinimaxTts::new(MinimaxTtsOption {
            base: BaseTtsOption {
                api_key: Some("k".into()),
                ..Default::default()
            },
            ..Default::default()
        });
        let req = p.build_request("你好", false);
        assert_eq!(req.stream, None);
        assert_eq!(req.text, "你好");
        assert_eq!(req.model, "speech-2.8-hd");
        assert_eq!(req.voice_setting.voice_id, "male-qn-qingse");
    }

    // -------- b2 流式请求体（stream=true） --------

    #[test]
    fn test_b2_stream_request() {
        let p = MinimaxTts::new(MinimaxTtsOption {
            base: BaseTtsOption {
                api_key: Some("k".into()),
                ..Default::default()
            },
            ..Default::default()
        });
        let req = p.build_request("hello", true);
        assert_eq!(req.stream, Some(true));
    }

    // -------- b3 自定义参数请求体 --------

    #[test]
    fn test_b3_custom_request() {
        let p = MinimaxTts::new(MinimaxTtsOption {
            base: BaseTtsOption {
                api_key: Some("k".into()),
                model: Some("speech-2.6-turbo".into()),
                voice: Some("female-shaonv".into()),
                speed: Some(1.2),
                volume: Some(5.0),
                pitch: Some(3.0),
                format: Some("wav".into()),
                ..Default::default()
            },
            sample_rate: Some(24000),
            bitrate: Some(64000),
            emotion: Some("happy".into()),
            language_boost: Some("Chinese".into()),
            subtitle_enable: Some(true),
            channel: Some(2),
        });
        let req = p.build_request("测试", true);
        assert_eq!(req.model, "speech-2.6-turbo");
        assert_eq!(req.voice_setting.voice_id, "female-shaonv");
        assert_eq!(req.voice_setting.speed, Some(1.2));
        assert_eq!(req.voice_setting.vol, Some(5.0));
        assert_eq!(req.voice_setting.pitch, Some(3));
        assert_eq!(req.voice_setting.emotion, Some("happy".into()));
        let audio = req.audio_setting.unwrap();
        assert_eq!(audio.format, "wav");
        assert_eq!(audio.sample_rate, Some(24000));
        assert_eq!(audio.bitrate, Some(64000));
        assert_eq!(audio.channel, Some(2));
        assert_eq!(req.language_boost, Some("Chinese".into()));
        assert_eq!(req.subtitle_enable, Some(true));
    }

    // -------- l1 list_voices --------

    #[tokio::test]
    async fn test_l1_list_voices() {
        let p = MinimaxTts::new(MinimaxTtsOption {
            base: BaseTtsOption {
                api_key: Some("k".into()),
                ..Default::default()
            },
            ..Default::default()
        });
        let voices = p.list_voices().await.unwrap();
        assert!(!voices.is_empty());
        assert!(voices.iter().any(|v| v.id == "male-qn-qingse"));
        assert!(voices.iter().any(|v| v.id == "female-shaonv"));
    }

    // -------- s1 connect 返回 Unsupported（默认行为） --------

    #[tokio::test]
    async fn test_s1_connect_unsupported() {
        let p = MinimaxTts::new(MinimaxTtsOption {
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
