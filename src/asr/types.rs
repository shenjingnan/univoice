use std::pin::Pin;

use futures_util::Stream;

// ============================== 常量 ==============================

/// 默认采样率 16kHz
pub const DEFAULT_SAMPLE_RATE: u32 = 16000;

/// PCM 分块大小：100ms @ 16kHz 16bit mono
pub const DEFAULT_CHUNK_SIZE: usize = 3200;

/// 默认段时长（发送给服务端）
pub const DEFAULT_SEGMENT_DURATION: u32 = 200;

/// 默认资源 ID
pub const DEFAULT_RESOURCE_ID: &str = "volc.bigasr.sauc.duration";

/// 默认 WebSocket 基础 URL
pub const DEFAULT_BASE_URL: &str = "wss://openspeech.bytedance.com/api/v3/sauc";

// ============================== 音频类型 ==============================

/// 音频流类型：异步字节块序列
pub type AudioStream = Pin<Box<dyn Stream<Item = Vec<u8>> + Send>>;

/// 音频容器格式
#[derive(Debug, Default, Clone, Copy, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "lowercase")]
pub enum AudioContainerFormat {
    #[default]
    Pcm,
    Wav,
    Ogg,
    Mp3,
}

impl AudioContainerFormat {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Pcm => "pcm",
            Self::Wav => "wav",
            Self::Ogg => "ogg",
            Self::Mp3 => "mp3",
        }
    }
}

/// 音频编码格式
#[derive(Debug, Default, Clone, Copy, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "lowercase")]
pub enum AudioCodecFormat {
    #[default]
    Raw,
    Opus,
}

impl AudioCodecFormat {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Raw => "raw",
            Self::Opus => "opus",
        }
    }
}

// ============================== 结果类型 ==============================

/// ASR 流式响应块
#[derive(Debug, Clone, serde::Serialize)]
pub struct AsrStreamChunk {
    pub text: String,
    pub is_final: bool,
    pub confidence: Option<f64>,
    pub segment: Option<AsrSegment>,
}

/// ASR 分段信息
#[derive(Debug, Clone, serde::Serialize)]
pub struct AsrSegment {
    pub id: u32,
    pub start: u32,
    pub end: u32,
    pub text: String,
    pub speaker: Option<String>,
    pub confidence: Option<f64>,
}

/// 非流式识别结果
#[derive(Debug, Clone, serde::Serialize)]
pub struct AsrResponse {
    pub text: String,
    pub language: Option<String>,
    pub duration: Option<u32>,
    pub segments: Option<Vec<AsrSegment>>,
}

// ============================== 配置类型 ==============================

/// 基础 ASR 配置
#[derive(Debug, Clone)]
pub struct BaseProviderOption {
    pub api_key: Option<String>,
    pub base_url: Option<String>,
    pub model: Option<String>,
    pub language: Option<String>,
    pub format: Option<AudioContainerFormat>,
    pub codec: Option<AudioCodecFormat>,
}

impl Default for BaseProviderOption {
    fn default() -> Self {
        Self {
            api_key: None,
            base_url: None,
            model: None,
            language: Some("zh-CN".into()),
            format: None,
            codec: None,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // ====== AudioContainerFormat ======

    #[test]
    fn test_a1_container_as_str() {
        assert_eq!(AudioContainerFormat::Pcm.as_str(), "pcm");
        assert_eq!(AudioContainerFormat::Wav.as_str(), "wav");
        assert_eq!(AudioContainerFormat::Ogg.as_str(), "ogg");
        assert_eq!(AudioContainerFormat::Mp3.as_str(), "mp3");
    }

    #[test]
    fn test_a2_container_default() {
        assert_eq!(AudioContainerFormat::default(), AudioContainerFormat::Pcm);
    }

    // ====== AudioCodecFormat ======

    #[test]
    fn test_a3_codec_as_str() {
        assert_eq!(AudioCodecFormat::Raw.as_str(), "raw");
        assert_eq!(AudioCodecFormat::Opus.as_str(), "opus");
    }

    #[test]
    fn test_a4_codec_default() {
        assert_eq!(AudioCodecFormat::default(), AudioCodecFormat::Raw);
    }

    // ====== BaseProviderOption ======

    #[test]
    fn test_a5_base_option_default() {
        let opt = BaseProviderOption::default();
        assert_eq!(opt.language, Some("zh-CN".into()));
        assert!(opt.api_key.is_none());
        assert!(opt.base_url.is_none());
        assert!(opt.model.is_none());
        assert!(opt.format.is_none());
        assert!(opt.codec.is_none());
    }

    // ====== AsrStreamChunk / AsrSegment / AsrResponse ======

    #[test]
    fn test_a6_asr_stream_chunk_construction() {
        let chunk = AsrStreamChunk {
            text: "hello".into(),
            is_final: false,
            confidence: Some(0.95),
            segment: None,
        };
        assert_eq!(chunk.text, "hello");
        assert!(!chunk.is_final);
        assert_eq!(chunk.confidence, Some(0.95));
    }

    #[test]
    fn test_a7_asr_segment_construction() {
        let seg = AsrSegment {
            id: 1,
            start: 0,
            end: 1000,
            text: "测试".into(),
            speaker: Some("spk1".into()),
            confidence: Some(0.9),
        };
        assert_eq!(seg.id, 1);
        assert_eq!(seg.text, "测试");
        assert_eq!(seg.speaker, Some("spk1".into()));
    }

    #[test]
    fn test_a8_asr_response_construction() {
        let resp = AsrResponse {
            text: "result".into(),
            language: Some("zh-CN".into()),
            duration: Some(5000),
            segments: None,
        };
        assert_eq!(resp.text, "result");
        assert_eq!(resp.duration, Some(5000));
        assert!(resp.segments.is_none());
    }
}
