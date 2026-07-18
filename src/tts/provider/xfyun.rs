//! 科大讯飞超拟人 TTS Provider
//!
//! 基于讯飞超拟人语音合成 WebSocket 协议实现语音合成。
//! 对应 TypeScript 端的 `src/tts/providers/xfyun.ts`。
//!
//! 与 [`super::qwen`] 类似，基于 WebSocket 通信，支持非流式 (`synthesize`) 和
//! 流式 (`speak_stream`) 两种模式。**不实现** `connect` / `TtsConnection`，
//! 因为 Xfyun TTS 每次合成都会消耗整个 WebSocket 连接，无法复用。
//! `connect` 保留 trait 默认行为（返回 `Unsupported`）。
//!
//! 与 [`super::glm`] 不同，Xfyun TTS 走 WebSocket 而非 HTTP REST。
//! 鉴权 HMAC-SHA256 流程与 ASR 侧共享（见 [`crate::asr::protocol::xfyun::build_auth_url`]）。

use async_trait::async_trait;
use futures_util::{SinkExt, StreamExt};
use std::time::Duration;
use tokio::net::TcpStream;
use tokio_tungstenite::tungstenite::Message;
use tokio_tungstenite::{MaybeTlsStream, WebSocketStream, connect_async};

use crate::tts::error::TtsError;
use crate::tts::protocol::xfyun::{self, XFYUN_TTS_HOST, XFYUN_TTS_PATH, XfyunTtsProtocolOptions};
use crate::tts::traits::TtsProvider;
use crate::tts::types::{
    BaseTtsOption, TextStream, TtsAudioStream, TtsRequest, TtsResponse, TtsStreamChunk, TtsVoice,
};
use crate::tts::voice_id::VoiceId;

// ============================== 常量 ==============================

/// 连接超时
#[cfg(not(test))]
const CONNECT_TIMEOUT: Duration = Duration::from_secs(10);
#[cfg(test)]
const CONNECT_TIMEOUT: Duration = Duration::from_secs(1);

// ============================== XfyunTtsOption ==============================

/// 科大讯飞超拟人 TTS 专属配置
#[derive(Debug, Clone, Default)]
pub struct XfyunTtsOption {
    pub base: BaseTtsOption,
    pub app_id: Option<String>,
    pub api_secret: Option<String>,
    pub sample_rate: Option<u32>,
    /// 口语化等级（仅 x4 系列发音人支持）
    pub oral_level: Option<String>,
    /// 是否通过大模型进行口语化（仅 x4 系列发音人支持）
    pub spark_assist: Option<u32>,
    /// 是否关闭服务端拆句（仅 x4 系列发音人支持）
    pub stop_split: Option<u32>,
    /// 是否保留原书面语的样子（仅 x4 系列发音人支持）
    pub remain: Option<u32>,
    /// 英文发音方式
    pub reg: Option<u32>,
    /// 数字发音方式
    pub rdn: Option<u32>,
    /// 是否返回拼音标注
    pub rhy: Option<u32>,
    /// 背景音
    pub bgs: Option<u32>,
}

// ============================== XfyunTts ==============================

/// 科大讯飞超拟人 TTS Provider
pub struct XfyunTts {
    api_key: String,
    api_secret: String,
    app_id: String,
    voice: VoiceId,
    format: String,
    sample_rate: u32,
    speed: f32,
    volume: f32,
    pitch: f32,
    // 可选参数
    oral_level: Option<String>,
    spark_assist: Option<u32>,
    stop_split: Option<u32>,
    remain: Option<u32>,
    reg: u32,
    rdn: u32,
    rhy: u32,
    bgs: u32,
}

impl XfyunTts {
    pub fn new(options: XfyunTtsOption) -> Self {
        let base = &options.base;
        Self {
            api_key: base.api_key.clone().unwrap_or_default(),
            api_secret: options.api_secret.unwrap_or_default(),
            app_id: options.app_id.unwrap_or_default(),
            voice: base
                .voice
                .clone()
                .unwrap_or_else(|| VoiceId::from(xfyun::XFYUN_DEFAULT_VOICE)),
            format: base.format.clone().unwrap_or_else(|| "mp3".into()),
            sample_rate: options
                .sample_rate
                .unwrap_or(xfyun::XFYUN_DEFAULT_SAMPLE_RATE),
            speed: base.speed.unwrap_or(1.0),
            volume: base.volume.unwrap_or(1.0),
            pitch: base.pitch.unwrap_or(1.0),
            oral_level: options.oral_level,
            spark_assist: options.spark_assist,
            stop_split: options.stop_split,
            remain: options.remain,
            reg: options.reg.unwrap_or(0),
            rdn: options.rdn.unwrap_or(0),
            rhy: options.rhy.unwrap_or(0),
            bgs: options.bgs.unwrap_or(0),
        }
    }

    /// 将 base TTS 的 0.0-2.0 范围映射为讯飞 0-100 范围
    fn map_param(value: f32) -> u32 {
        (value * 50.0).round() as u32
    }

    /// 构建协议配置选项
    fn build_protocol_options(&self) -> XfyunTtsProtocolOptions {
        XfyunTtsProtocolOptions {
            app_id: self.app_id.clone(),
            vcn: self.voice.as_str().to_string(),
            speed: Self::map_param(self.speed),
            volume: Self::map_param(self.volume),
            pitch: Self::map_param(self.pitch),
            encoding: xfyun::map_audio_encoding(&self.format).into(),
            sample_rate: self.sample_rate,
            bgs: self.bgs,
            reg: self.reg,
            rdn: self.rdn,
            rhy: self.rhy,
            oral_level: self.oral_level.clone(),
            spark_assist: self.spark_assist,
            stop_split: self.stop_split,
            remain: self.remain,
        }
    }

    /// 验证必要参数
    fn ensure_valid(&self) -> Result<(), TtsError> {
        if self.app_id.is_empty() {
            return Err(TtsError::InvalidParameter(
                "appId is required for Xfyun TTS".into(),
            ));
        }
        if self.api_key.is_empty() {
            return Err(TtsError::InvalidParameter(
                "apiKey is required for Xfyun TTS".into(),
            ));
        }
        if self.api_secret.is_empty() {
            return Err(TtsError::InvalidParameter(
                "apiSecret is required for Xfyun TTS".into(),
            ));
        }
        Ok(())
    }

    /// 建立 WebSocket 连接（带鉴权和超时）
    async fn connect_ws(&self) -> Result<WebSocketStream<MaybeTlsStream<TcpStream>>, TtsError> {
        let url = xfyun::build_auth_url(
            XFYUN_TTS_HOST,
            XFYUN_TTS_PATH,
            &self.api_key,
            &self.api_secret,
        )
        .map_err(|e| TtsError::Other(format!("Failed to build auth URL: {e}")))?;

        let (ws, _) = tokio::time::timeout(CONNECT_TIMEOUT, connect_async(&url))
            .await
            .map_err(|_| TtsError::Timeout(CONNECT_TIMEOUT.as_millis() as u64))?
            .map_err(|e| TtsError::Other(format!("WebSocket connection failed: {e}")))?;

        Ok(ws)
    }
}

// ============================== TtsProvider 实现 ==============================

#[async_trait]
#[allow(clippy::result_large_err)]
impl TtsProvider for XfyunTts {
    fn name(&self) -> &'static str {
        "xfyun"
    }

    async fn synthesize(&self, request: TtsRequest) -> Result<TtsResponse, TtsError> {
        self.ensure_valid()?;

        let protocol_options = self.build_protocol_options();
        let mut ws = self.connect_ws().await?;

        // 一次性发送所有文本（status=2）
        let payload = xfyun::create_request_payload(&protocol_options, &request.text, 2, 0);
        ws.send(Message::Text(payload)).await?;

        // 收集音频数据
        let audio_chunks = collect_audio_synthesize(&mut ws).await?;

        if audio_chunks.is_empty() {
            return Err(TtsError::NoAudio);
        }

        let total_len: usize = audio_chunks.iter().map(|c| c.len()).sum();
        let mut audio = Vec::with_capacity(total_len);
        for chunk in audio_chunks {
            audio.extend_from_slice(&chunk);
        }

        Ok(TtsResponse {
            audio,
            format: self.format.clone(),
            duration: None,
        })
    }

    async fn speak_stream(&self, input: TextStream) -> Result<TtsAudioStream, TtsError> {
        self.ensure_valid()?;

        let protocol_options = self.build_protocol_options();
        let ws = self.connect_ws().await?;

        let (mut write, mut read) = ws.split();

        // 创建 channel
        let (tx, mut rx) = tokio::sync::mpsc::channel::<Vec<u8>>(64);

        // 发送任务：逐块发送文本流
        let send_handle: tokio::task::JoinHandle<Result<(), TtsError>> = tokio::spawn(async move {
            let mut seq = 0u32;
            let mut is_first = true;
            let mut input = input;

            while let Some(chunk) = input.next().await {
                if chunk.is_empty() {
                    continue; // 跳过空文本块
                }

                let status = if is_first {
                    is_first = false;
                    0u32
                } else {
                    1u32
                };

                let payload = xfyun::create_request_payload(&protocol_options, &chunk, status, seq);
                write.send(Message::Text(payload)).await?;
                seq += 1;
            }

            // 结束帧（status=2）
            let end_payload = xfyun::create_request_payload(&protocol_options, "", 2, seq);
            write.send(Message::Text(end_payload)).await?;

            Ok(())
        });

        // 接收任务：收集音频数据
        let recv_handle: tokio::task::JoinHandle<Result<(), TtsError>> = tokio::spawn(async move {
            while let Some(msg) = read.next().await {
                let msg =
                    msg.map_err(|e| TtsError::Other(format!("WebSocket receive error: {e}")))?;

                let text = match msg {
                    Message::Text(t) => t,
                    Message::Binary(data) => String::from_utf8(data)
                        .map_err(|e| TtsError::Other(format!("Non-UTF8 binary data: {e}")))?,
                    Message::Close(_) => return Ok(()),
                    Message::Ping(_) | Message::Pong(_) | Message::Frame(_) => continue,
                };

                let response = xfyun::parse_response(&text)?;

                if !xfyun::is_success(&response) {
                    return Err(TtsError::ServiceError {
                        code: response.header.code.to_string(),
                        message: response.header.message,
                    });
                }

                if let Some(audio) = xfyun::extract_audio(&response) {
                    if tx.send(audio).await.is_err() {
                        return Ok(());
                    }
                }

                if xfyun::is_finished(&response) {
                    return Ok(());
                }
            }
            Ok(())
        });

        // 构造输出流
        let stream = async_stream::stream! {
            while let Some(audio) = rx.recv().await {
                yield Ok(TtsStreamChunk { audio_chunk: audio });
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

    async fn list_voices(&self) -> Result<Vec<TtsVoice>, TtsError> {
        let voices = xfyun::list_voices();
        Ok(voices
            .into_iter()
            .map(|v| TtsVoice {
                id: v.vcn.to_string(),
                name: v.name.to_string(),
                language: v.language.to_string(),
                gender: Some(v.gender.to_string()),
            })
            .collect())
    }
}

// ============================== 内部辅助函数 ==============================

/// 在 WebSocket 上收集 synthesize 的音频数据
async fn collect_audio_synthesize(
    ws: &mut WebSocketStream<MaybeTlsStream<TcpStream>>,
) -> Result<Vec<Vec<u8>>, TtsError> {
    let mut audio_chunks: Vec<Vec<u8>> = Vec::new();

    loop {
        match ws.next().await {
            Some(Ok(Message::Text(data))) => {
                let response = xfyun::parse_response(&data)?;

                if !xfyun::is_success(&response) {
                    return Err(TtsError::ServiceError {
                        code: response.header.code.to_string(),
                        message: response.header.message,
                    });
                }

                if let Some(audio) = xfyun::extract_audio(&response) {
                    audio_chunks.push(audio);
                }

                if xfyun::is_finished(&response) {
                    break;
                }
            }
            Some(Ok(Message::Binary(data))) => {
                // 理论上 Xfyun TTS 只返回文本帧，但兼容处理
                let text = String::from_utf8(data)
                    .map_err(|e| TtsError::Other(format!("Non-UTF8 binary data: {e}")))?;
                let response = xfyun::parse_response(&text)?;
                if !xfyun::is_success(&response) {
                    return Err(TtsError::ServiceError {
                        code: response.header.code.to_string(),
                        message: response.header.message,
                    });
                }
                if let Some(audio) = xfyun::extract_audio(&response) {
                    audio_chunks.push(audio);
                }
                if xfyun::is_finished(&response) {
                    break;
                }
            }
            Some(Ok(Message::Close(_))) | None => break,
            Some(Ok(Message::Ping(_) | Message::Pong(_) | Message::Frame(_))) => {}
            Some(Err(e)) => {
                return Err(TtsError::Other(format!("WebSocket error: {e}")));
            }
        }
    }

    Ok(audio_chunks)
}

// ============================== 测试 ==============================

#[cfg(test)]
mod tests {
    use super::*;

    // -------- 2.1 构造与默认值 --------

    #[test]
    fn test_c1_defaults() {
        let provider = XfyunTts::new(XfyunTtsOption {
            base: BaseTtsOption {
                api_key: Some("test-key".into()),
                ..Default::default()
            },
            app_id: Some("test-app".into()),
            api_secret: Some("test-secret".into()),
            ..Default::default()
        });
        assert_eq!(provider.name(), "xfyun");
        assert_eq!(provider.app_id, "test-app");
        assert_eq!(provider.api_key, "test-key");
        assert_eq!(provider.api_secret, "test-secret");
        assert_eq!(provider.voice, xfyun::XFYUN_DEFAULT_VOICE);
        assert_eq!(provider.format, "mp3");
        assert_eq!(provider.sample_rate, xfyun::XFYUN_DEFAULT_SAMPLE_RATE);
        assert_eq!(provider.speed, 1.0);
        assert_eq!(provider.volume, 1.0);
        assert_eq!(provider.pitch, 1.0);
        assert_eq!(provider.bgs, 0);
        assert_eq!(provider.reg, 0);
        assert_eq!(provider.rdn, 0);
        assert_eq!(provider.rhy, 0);
        assert!(provider.oral_level.is_none());
        assert!(provider.spark_assist.is_none());
        assert!(provider.stop_split.is_none());
        assert!(provider.remain.is_none());
    }

    #[test]
    fn test_c2_custom_options() {
        let provider = XfyunTts::new(XfyunTtsOption {
            base: BaseTtsOption {
                api_key: Some("custom-key".into()),
                voice: Some("x5_lingfeiyi_flow".into()),
                speed: Some(1.5),
                volume: Some(0.8),
                pitch: Some(1.2),
                format: Some("pcm".into()),
                ..Default::default()
            },
            app_id: Some("custom-app".into()),
            api_secret: Some("custom-secret".into()),
            sample_rate: Some(16000),
            oral_level: Some("high".into()),
            spark_assist: Some(1),
            stop_split: Some(1),
            remain: Some(0),
            reg: Some(1),
            rdn: Some(2),
            rhy: Some(1),
            bgs: Some(1),
        });
        assert_eq!(provider.app_id, "custom-app");
        assert_eq!(provider.api_key, "custom-key");
        assert_eq!(provider.api_secret, "custom-secret");
        assert_eq!(provider.voice, "x5_lingfeiyi_flow");
        assert_eq!(provider.format, "pcm");
        assert_eq!(provider.sample_rate, 16000);
        assert_eq!(provider.speed, 1.5);
        assert_eq!(provider.volume, 0.8);
        assert_eq!(provider.pitch, 1.2);
        assert_eq!(provider.bgs, 1);
        assert_eq!(provider.reg, 1);
        assert_eq!(provider.rdn, 2);
        assert_eq!(provider.rhy, 1);
        assert_eq!(provider.oral_level, Some("high".into()));
        assert_eq!(provider.spark_assist, Some(1));
        assert_eq!(provider.stop_split, Some(1));
        assert_eq!(provider.remain, Some(0));
    }

    #[test]
    fn test_c3_empty_credentials() {
        let provider = XfyunTts::new(XfyunTtsOption::default());
        assert_eq!(provider.app_id, "");
        assert_eq!(provider.api_key, "");
        assert_eq!(provider.api_secret, "");
    }

    #[test]
    fn test_c4_credentials_from_base() {
        let provider = XfyunTts::new(XfyunTtsOption {
            base: BaseTtsOption {
                api_key: Some("base-key".into()),
                ..Default::default()
            },
            app_id: Some("opt-app".into()),
            api_secret: Some("opt-secret".into()),
            ..Default::default()
        });
        assert_eq!(provider.api_key, "base-key");
        assert_eq!(provider.app_id, "opt-app");
        assert_eq!(provider.api_secret, "opt-secret");
    }

    // -------- 2.2 参数映射 --------

    #[test]
    fn test_m1_map_param_default() {
        assert_eq!(XfyunTts::map_param(1.0), 50);
    }

    #[test]
    fn test_m2_map_param_min() {
        assert_eq!(XfyunTts::map_param(0.0), 0);
    }

    #[test]
    fn test_m3_map_param_max() {
        assert_eq!(XfyunTts::map_param(2.0), 100);
    }

    #[test]
    fn test_m4_map_param_mid() {
        assert_eq!(XfyunTts::map_param(1.5), 75);
        assert_eq!(XfyunTts::map_param(0.5), 25);
    }

    #[test]
    fn test_m5_map_param_rounding() {
        // 0.1 * 50 = 5.0 → 5
        assert_eq!(XfyunTts::map_param(0.1), 5);
        // 1.76 * 50 = 88.0 → 88
        assert_eq!(XfyunTts::map_param(1.76), 88);
    }

    // -------- 2.3 build_protocol_options --------

    #[test]
    fn test_b1_protocol_options_default() {
        let provider = XfyunTts::new(XfyunTtsOption {
            base: BaseTtsOption {
                api_key: Some("k".into()),
                ..Default::default()
            },
            app_id: Some("app".into()),
            api_secret: Some("s".into()),
            ..Default::default()
        });
        let opts = provider.build_protocol_options();
        assert_eq!(opts.app_id, "app");
        assert_eq!(opts.vcn, xfyun::XFYUN_DEFAULT_VOICE);
        assert_eq!(opts.speed, 50);
        assert_eq!(opts.volume, 50);
        assert_eq!(opts.pitch, 50);
        assert_eq!(opts.encoding, "lame");
        assert_eq!(opts.sample_rate, 24000);
        assert_eq!(opts.bgs, 0);
        assert_eq!(opts.reg, 0);
        assert_eq!(opts.rdn, 0);
        assert_eq!(opts.rhy, 0);
    }

    #[test]
    fn test_b2_protocol_options_custom() {
        let provider = XfyunTts::new(XfyunTtsOption {
            base: BaseTtsOption {
                api_key: Some("k".into()),
                voice: Some("x5_lingfeiyi_flow".into()),
                speed: Some(1.5),
                volume: Some(0.8),
                pitch: Some(1.2),
                format: Some("pcm".into()),
                ..Default::default()
            },
            app_id: Some("app".into()),
            api_secret: Some("s".into()),
            sample_rate: Some(16000),
            reg: Some(1),
            rdn: Some(2),
            rhy: Some(1),
            bgs: Some(1),
            oral_level: Some("high".into()),
            spark_assist: Some(1),
            ..Default::default()
        });
        let opts = provider.build_protocol_options();
        assert_eq!(opts.app_id, "app");
        assert_eq!(opts.vcn, "x5_lingfeiyi_flow");
        assert_eq!(opts.speed, 75); // 1.5 * 50
        assert_eq!(opts.volume, 40); // 0.8 * 50
        assert_eq!(opts.pitch, 60); // 1.2 * 50
        assert_eq!(opts.encoding, "raw");
        assert_eq!(opts.sample_rate, 16000);
        assert_eq!(opts.bgs, 1);
        assert_eq!(opts.reg, 1);
        assert_eq!(opts.rdn, 2);
        assert_eq!(opts.rhy, 1);
        assert_eq!(opts.oral_level, Some("high".into()));
        assert_eq!(opts.spark_assist, Some(1));
    }

    #[test]
    fn test_b3_format_mp3_encoding_lame() {
        let provider = XfyunTts::new(XfyunTtsOption {
            base: BaseTtsOption {
                api_key: Some("k".into()),
                format: Some("mp3".into()),
                ..Default::default()
            },
            app_id: Some("a".into()),
            api_secret: Some("s".into()),
            ..Default::default()
        });
        let opts = provider.build_protocol_options();
        assert_eq!(opts.encoding, "lame");
    }

    #[test]
    fn test_b4_format_pcm_encoding_raw() {
        let provider = XfyunTts::new(XfyunTtsOption {
            base: BaseTtsOption {
                api_key: Some("k".into()),
                format: Some("pcm".into()),
                ..Default::default()
            },
            app_id: Some("a".into()),
            api_secret: Some("s".into()),
            ..Default::default()
        });
        let opts = provider.build_protocol_options();
        assert_eq!(opts.encoding, "raw");
    }

    // -------- 2.4 参数验证 --------

    #[test]
    fn test_v1_empty_app_id() {
        let provider = XfyunTts::new(XfyunTtsOption {
            base: BaseTtsOption {
                api_key: Some("key".into()),
                ..Default::default()
            },
            app_id: Some("".into()),
            api_secret: Some("secret".into()),
            ..Default::default()
        });
        let result = provider.ensure_valid();
        assert!(matches!(result, Err(TtsError::InvalidParameter(msg)) if msg.contains("appId")));
    }

    #[test]
    fn test_v2_empty_api_key() {
        let provider = XfyunTts::new(XfyunTtsOption {
            base: BaseTtsOption {
                api_key: Some("".into()),
                ..Default::default()
            },
            app_id: Some("app".into()),
            api_secret: Some("secret".into()),
            ..Default::default()
        });
        let result = provider.ensure_valid();
        assert!(matches!(result, Err(TtsError::InvalidParameter(msg)) if msg.contains("apiKey")));
    }

    #[test]
    fn test_v3_empty_api_secret() {
        let provider = XfyunTts::new(XfyunTtsOption {
            base: BaseTtsOption {
                api_key: Some("key".into()),
                ..Default::default()
            },
            app_id: Some("app".into()),
            api_secret: Some("".into()),
            ..Default::default()
        });
        let result = provider.ensure_valid();
        assert!(
            matches!(result, Err(TtsError::InvalidParameter(msg)) if msg.contains("apiSecret"))
        );
    }

    #[test]
    fn test_v4_all_valid() {
        let provider = XfyunTts::new(XfyunTtsOption {
            base: BaseTtsOption {
                api_key: Some("key".into()),
                ..Default::default()
            },
            app_id: Some("app".into()),
            api_secret: Some("secret".into()),
            ..Default::default()
        });
        assert!(provider.ensure_valid().is_ok());
    }

    #[test]
    fn test_v5_all_empty() {
        let provider = XfyunTts::new(XfyunTtsOption::default());
        assert!(provider.ensure_valid().is_err());
    }

    // -------- 2.5 synthesize 参数校验 --------

    #[tokio::test]
    async fn test_s1_synthesize_missing_app_id() {
        let provider = XfyunTts::new(XfyunTtsOption {
            base: BaseTtsOption {
                api_key: Some("key".into()),
                ..Default::default()
            },
            app_id: Some("".into()),
            api_secret: Some("secret".into()),
            ..Default::default()
        });
        let request = TtsRequest {
            text: "你好".into(),
            options: None,
        };
        let result = provider.synthesize(request).await;
        assert!(matches!(result, Err(TtsError::InvalidParameter(msg)) if msg.contains("appId")));
    }

    #[tokio::test]
    async fn test_s2_synthesize_missing_api_key() {
        let provider = XfyunTts::new(XfyunTtsOption {
            base: BaseTtsOption {
                api_key: Some("".into()),
                ..Default::default()
            },
            app_id: Some("app".into()),
            api_secret: Some("secret".into()),
            ..Default::default()
        });
        let request = TtsRequest {
            text: "你好".into(),
            options: None,
        };
        let result = provider.synthesize(request).await;
        assert!(matches!(result, Err(TtsError::InvalidParameter(msg)) if msg.contains("apiKey")));
    }

    #[tokio::test]
    async fn test_s3_synthesize_missing_api_secret() {
        let provider = XfyunTts::new(XfyunTtsOption {
            base: BaseTtsOption {
                api_key: Some("key".into()),
                ..Default::default()
            },
            app_id: Some("app".into()),
            api_secret: Some("".into()),
            ..Default::default()
        });
        let request = TtsRequest {
            text: "你好".into(),
            options: None,
        };
        let result = provider.synthesize(request).await;
        assert!(
            matches!(result, Err(TtsError::InvalidParameter(msg)) if msg.contains("apiSecret"))
        );
    }

    #[tokio::test]
    async fn test_s4_synthesize_valid_credential() {
        let provider = XfyunTts::new(XfyunTtsOption {
            base: BaseTtsOption {
                api_key: Some("valid-key".into()),
                ..Default::default()
            },
            app_id: Some("valid-app".into()),
            api_secret: Some("valid-secret".into()),
            ..Default::default()
        });
        let request = TtsRequest {
            text: "你好".into(),
            options: None,
        };
        // 凭证有效，但 WebSocket 连接会失败（无真实服务）
        let result = provider.synthesize(request).await;
        match result {
            Err(TtsError::InvalidParameter(_)) => panic!("不应是参数错误"),
            Err(_) => { /* 连接失败或其他错误，预期行为 */ }
            Ok(_) => panic!("不应连接成功"),
        }
    }

    // -------- 2.6 speak_stream 参数校验 --------

    #[tokio::test]
    async fn test_t1_speak_stream_missing_app_id() {
        let provider = XfyunTts::new(XfyunTtsOption {
            base: BaseTtsOption {
                api_key: Some("key".into()),
                ..Default::default()
            },
            app_id: Some("".into()),
            api_secret: Some("secret".into()),
            ..Default::default()
        });
        let input: TextStream = Box::pin(futures_util::stream::empty());
        let result = provider.speak_stream(input).await;
        assert!(matches!(result, Err(TtsError::InvalidParameter(msg)) if msg.contains("appId")));
    }

    #[tokio::test]
    async fn test_t2_speak_stream_missing_api_key() {
        let provider = XfyunTts::new(XfyunTtsOption {
            base: BaseTtsOption {
                api_key: Some("".into()),
                ..Default::default()
            },
            app_id: Some("app".into()),
            api_secret: Some("secret".into()),
            ..Default::default()
        });
        let input: TextStream = Box::pin(futures_util::stream::empty());
        let result = provider.speak_stream(input).await;
        assert!(matches!(result, Err(TtsError::InvalidParameter(msg)) if msg.contains("apiKey")));
    }

    #[tokio::test]
    async fn test_t3_speak_stream_missing_api_secret() {
        let provider = XfyunTts::new(XfyunTtsOption {
            base: BaseTtsOption {
                api_key: Some("key".into()),
                ..Default::default()
            },
            app_id: Some("app".into()),
            api_secret: Some("".into()),
            ..Default::default()
        });
        let input: TextStream = Box::pin(futures_util::stream::empty());
        let result = provider.speak_stream(input).await;
        assert!(
            matches!(result, Err(TtsError::InvalidParameter(msg)) if msg.contains("apiSecret"))
        );
    }

    #[tokio::test]
    async fn test_t4_speak_stream_valid_credential() {
        let provider = XfyunTts::new(XfyunTtsOption {
            base: BaseTtsOption {
                api_key: Some("valid-key".into()),
                ..Default::default()
            },
            app_id: Some("valid-app".into()),
            api_secret: Some("valid-secret".into()),
            ..Default::default()
        });
        let input: TextStream = Box::pin(futures_util::stream::empty());
        // 凭证有效，但 WebSocket 连接会失败
        let result = provider.speak_stream(input).await;
        match result {
            Err(TtsError::InvalidParameter(_)) => panic!("不应是参数错误"),
            Err(_) => { /* 连接失败或其他错误，预期行为 */ }
            Ok(_) => panic!("不应连接成功"),
        }
    }

    // -------- 2.7 list_voices --------

    #[test]
    fn test_l1_list_voices_not_empty() {
        let provider = XfyunTts::new(XfyunTtsOption {
            base: BaseTtsOption {
                api_key: Some("k".into()),
                ..Default::default()
            },
            app_id: Some("a".into()),
            api_secret: Some("s".into()),
            ..Default::default()
        });
        let rt = tokio::runtime::Runtime::new().unwrap();
        let voices = rt.block_on(provider.list_voices()).unwrap();
        assert!(voices.len() > 50);
    }

    #[test]
    fn test_l2_list_voices_structure() {
        let provider = XfyunTts::new(XfyunTtsOption {
            base: BaseTtsOption {
                api_key: Some("k".into()),
                ..Default::default()
            },
            app_id: Some("a".into()),
            api_secret: Some("s".into()),
            ..Default::default()
        });
        let rt = tokio::runtime::Runtime::new().unwrap();
        let voices = rt.block_on(provider.list_voices()).unwrap();
        let default_voice = voices.iter().find(|v| v.id.contains("lingxiaoxuan"));
        assert!(default_voice.is_some());
        assert_eq!(default_voice.unwrap().gender.as_deref(), Some("女"));
    }
}
