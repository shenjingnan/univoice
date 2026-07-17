use std::pin::Pin;
use std::time::Duration;

use futures_util::Stream;

use crate::tts::error::TtsError;
use crate::tts::voice_id::VoiceId;

/// TTS 流式文本输入
pub type TextStream = Pin<Box<dyn Stream<Item = String> + Send>>;

/// TTS 流式音频输出
pub type TtsAudioStream = Pin<Box<dyn Stream<Item = Result<TtsStreamChunk, TtsError>> + Send>>;

/// TTS 请求
#[derive(Debug, Clone)]
pub struct TtsRequest {
    pub text: String,
    /// 每次合成可临时覆盖实例配置（如 model/voice/speed 等），None 表示使用实例默认
    pub options: Option<BaseTtsOption>,
}

/// TTS 非流式响应
#[derive(Debug, Clone)]
pub struct TtsResponse {
    pub audio: Vec<u8>,
    pub format: String,
    pub duration: Option<u32>,
}

/// TTS 流式音频块
#[derive(Debug, Clone)]
pub struct TtsStreamChunk {
    pub audio_chunk: Vec<u8>,
}

/// TTS 连接选项
#[derive(Debug, Clone)]
pub struct TtsConnectOption {
    pub timeout: Duration,
}

impl Default for TtsConnectOption {
    fn default() -> Self {
        Self {
            timeout: Duration::from_secs(10),
        }
    }
}

/// 基础 Provider 配置（所有 TTS Provider 通用字段）
///
/// `volume` 范围为 0.0~1.0，协议发送时需转换为 0~100。
#[derive(Debug, Clone)]
pub struct BaseTtsOption {
    pub api_key: Option<String>,
    pub base_url: Option<String>,
    pub model: Option<String>,
    pub voice: Option<VoiceId>,
    pub speed: Option<f32>,
    pub volume: Option<f32>,
    pub pitch: Option<f32>,
    pub format: Option<String>,
    pub language: Option<String>,
}

impl Default for BaseTtsOption {
    fn default() -> Self {
        Self {
            api_key: None,
            base_url: None,
            model: None,
            voice: None,
            speed: None,
            volume: None,
            pitch: None,
            format: None,
            language: Some("zh-CN".into()),
        }
    }
}

/// TTS 音色信息
#[derive(Debug, Clone)]
pub struct TtsVoice {
    pub id: String,
    pub name: String,
    pub language: String,
    pub gender: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    // -------- T1: BaseTtsOption 默认值 --------

    #[test]
    fn test_t1_base_option_defaults() {
        let opt = BaseTtsOption::default();
        assert_eq!(opt.language, Some("zh-CN".into()));
        assert!(opt.api_key.is_none());
        assert!(opt.base_url.is_none());
        assert!(opt.model.is_none());
        assert!(opt.voice.is_none());
        assert!(opt.speed.is_none());
        assert!(opt.volume.is_none());
        assert!(opt.pitch.is_none());
        assert!(opt.format.is_none());
    }

    // -------- T2: TtsConnectOption 默认超时 --------

    #[test]
    fn test_t2_connect_option_default() {
        let opt = TtsConnectOption::default();
        assert_eq!(opt.timeout, Duration::from_secs(10));
    }

    // -------- T3: TtsRequest 构造 --------

    #[test]
    fn test_t3_request_construction() {
        let req = TtsRequest {
            text: "你好".into(),
            options: None,
        };
        assert_eq!(req.text, "你好");
        assert!(req.options.is_none());
    }

    // -------- T4: TtsRequest 带 options --------

    #[test]
    fn test_t4_request_with_options() {
        let options = BaseTtsOption {
            model: Some("custom".into()),
            ..Default::default()
        };
        let req = TtsRequest {
            text: "test".into(),
            options: Some(options),
        };
        let opts = req.options.unwrap();
        assert_eq!(opts.model.unwrap(), "custom");
        assert!(opts.voice.is_none());
    }
}
