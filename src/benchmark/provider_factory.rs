//! Provider 工厂
//!
//! 从环境变量读取配置，创建 TTS/ASR Provider 实例。
//! 每个 Provider 类型有自己的 Option 结构体，但都包含 `base: BaseTtsOption` 或 `base: BaseProviderOption`。

use std::fmt;

use crate::tts;
use crate::tts::provider as tts_provider;
use crate::tts::{BaseTtsOption, TtsProvider, VoiceId};

use crate::asr;
use crate::asr::provider as asr_provider;
use crate::asr::traits::AsrProvider;
use crate::asr::{AudioContainerFormat, BaseProviderOption};

// ============================== 错误类型 ==============================
/// Provider 工厂错误
#[derive(Debug)]
pub enum ProviderError {
    MissingEnvVar(String),
    UnknownProvider(String),
    TtsError(tts::TtsError),
    AsrError(asr::AsrError),
}

impl fmt::Display for ProviderError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::MissingEnvVar(name) => write!(f, "缺少环境变量: {}", name),
            Self::UnknownProvider(name) => write!(f, "未知的 Provider: {}", name),
            Self::TtsError(e) => write!(f, "TTS 错误: {}", e),
            Self::AsrError(e) => write!(f, "ASR 错误: {}", e),
        }
    }
}

impl std::error::Error for ProviderError {}

impl From<tts::TtsError> for ProviderError {
    fn from(e: tts::TtsError) -> Self {
        Self::TtsError(e)
    }
}

impl From<asr::AsrError> for ProviderError {
    fn from(e: asr::AsrError) -> Self {
        Self::AsrError(e)
    }
}

// ============================== 环境变量工具 ==============================

/// 读取环境变量，如缺失则返回 None
fn env_opt(key: &str) -> Option<String> {
    std::env::var(key).ok().filter(|v| !v.is_empty())
}

// ============================== TTS Provider 名称 ==============================

/// 所有支持的 TTS Provider
pub const TTS_PROVIDER_NAMES: &[&str] = &[
    "qwen",
    "qwen-realtime",
    "doubao",
    "openai",
    "gemini",
    "glm",
    "minimax",
    "xfyun",
];

/// 所有支持的 ASR Provider
pub const ASR_PROVIDER_NAMES: &[&str] = &["qwen", "doubao", "glm", "mimo", "xfyun"];

// ============================== TTS Provider 创建 ==============================

/// 创建 TTS Provider 实例
pub fn create_tts_provider(
    name: &str,
    model: &str,
    voice: &str,
    format: &str,
    sample_rate: Option<u32>,
) -> Result<Box<dyn TtsProvider>, ProviderError> {
    match name {
        "qwen" => create_qwen_tts(model, voice, format, sample_rate),
        "qwen-realtime" => create_qwen_realtime_tts(model, voice, format, sample_rate),
        "doubao" => create_doubao_tts(model, voice, format, sample_rate),
        "openai" => create_openai_tts(model, voice, format, sample_rate),
        "gemini" => create_gemini_tts(model, voice, format, sample_rate),
        "glm" => create_glm_tts(model, voice, format, sample_rate),
        "minimax" => create_minimax_tts(model, voice, format, sample_rate),
        "xfyun" => create_xfyun_tts(model, voice, format, sample_rate),
        _ => Err(ProviderError::UnknownProvider(name.to_string())),
    }
}

fn create_qwen_tts(
    model: &str,
    voice: &str,
    format: &str,
    sample_rate: Option<u32>,
) -> Result<Box<dyn TtsProvider>, ProviderError> {
    let api_key = env_opt("QWEN_API_KEY");

    Ok(Box::new(tts_provider::QwenTts::new(
        tts_provider::QwenTtsOption {
            base: BaseTtsOption {
                api_key,
                model: Some(model.to_string()),
                voice: Some(VoiceId::new(voice)),
                format: Some(format.to_string()),
                ..Default::default()
            },
            sample_rate,
            ..Default::default()
        },
    )))
}

fn create_qwen_realtime_tts(
    model: &str,
    voice: &str,
    format: &str,
    sample_rate: Option<u32>,
) -> Result<Box<dyn TtsProvider>, ProviderError> {
    let api_key = env_opt("QWEN_API_KEY");

    Ok(Box::new(tts_provider::QwenRealtimeTts::new(
        tts_provider::QwenRealtimeTtsOption {
            base: BaseTtsOption {
                api_key,
                model: Some(model.to_string()),
                voice: Some(VoiceId::new(voice)),
                format: Some(format.to_string()),
                ..Default::default()
            },
            sample_rate,
            instruction: None,
            optimize_instructions: None,
            speech_rate: None,
            pitch_rate: None,
            mode: None,
            language_type: None,
        },
    )))
}

fn create_doubao_tts(
    model: &str,
    voice: &str,
    format: &str,
    sample_rate: Option<u32>,
) -> Result<Box<dyn TtsProvider>, ProviderError> {
    let app_id = env_opt("DOUBAO_APP_ID");
    let access_token = env_opt("DOUBAO_ACCESS_TOKEN");

    Ok(Box::new(tts_provider::DoubaoTts::new(
        tts_provider::DoubaoTtsOption {
            base: BaseTtsOption {
                model: Some(model.to_string()),
                voice: Some(VoiceId::new(voice)),
                format: Some(format.to_string()),
                ..Default::default()
            },
            app_id,
            access_token,
            sample_rate,
            ..Default::default()
        },
    )))
}

fn create_openai_tts(
    model: &str,
    voice: &str,
    format: &str,
    _sample_rate: Option<u32>,
) -> Result<Box<dyn TtsProvider>, ProviderError> {
    let api_key = env_opt("OPENAI_API_KEY");

    Ok(Box::new(tts_provider::OpenaiTts::new(
        tts_provider::OpenaiTtsOption {
            base: BaseTtsOption {
                api_key,
                model: Some(model.to_string()),
                voice: Some(VoiceId::new(voice)),
                format: Some(format.to_string()),
                ..Default::default()
            },
            api_mode: None,
        },
    )))
}

fn create_gemini_tts(
    model: &str,
    voice: &str,
    format: &str,
    _sample_rate: Option<u32>,
) -> Result<Box<dyn TtsProvider>, ProviderError> {
    let api_key = env_opt("GEMINI_API_KEY");

    Ok(Box::new(tts_provider::GeminiTts::new(
        tts_provider::GeminiTtsOption {
            base: BaseTtsOption {
                api_key,
                model: Some(model.to_string()),
                voice: Some(VoiceId::new(voice)),
                format: Some(format.to_string()),
                ..Default::default()
            },
        },
    )))
}

fn create_glm_tts(
    model: &str,
    voice: &str,
    format: &str,
    _sample_rate: Option<u32>,
) -> Result<Box<dyn TtsProvider>, ProviderError> {
    let api_key = env_opt("GLM_API_KEY");

    Ok(Box::new(tts_provider::GlmTts::new(
        tts_provider::GlmTtsOption {
            base: BaseTtsOption {
                api_key,
                model: Some(model.to_string()),
                voice: Some(VoiceId::new(voice)),
                format: Some(format.to_string()),
                ..Default::default()
            },
            watermark_enabled: None,
        },
    )))
}

fn create_minimax_tts(
    model: &str,
    voice: &str,
    format: &str,
    sample_rate: Option<u32>,
) -> Result<Box<dyn TtsProvider>, ProviderError> {
    let api_key = env_opt("MINIMAX_API_KEY");

    Ok(Box::new(tts_provider::MinimaxTts::new(
        tts_provider::MinimaxTtsOption {
            base: BaseTtsOption {
                api_key,
                model: Some(model.to_string()),
                voice: Some(VoiceId::new(voice)),
                format: Some(format.to_string()),
                ..Default::default()
            },
            sample_rate,
            bitrate: None,
            emotion: None,
            language_boost: None,
            subtitle_enable: None,
            channel: None,
        },
    )))
}

fn create_xfyun_tts(
    model: &str,
    voice: &str,
    format: &str,
    sample_rate: Option<u32>,
) -> Result<Box<dyn TtsProvider>, ProviderError> {
    let app_id = env_opt("XFYUN_APP_ID");
    let api_key = env_opt("XFYUN_API_KEY");
    let api_secret = env_opt("XFYUN_API_SECRET");

    Ok(Box::new(tts_provider::XfyunTts::new(
        tts_provider::XfyunTtsOption {
            base: BaseTtsOption {
                api_key,
                model: Some(model.to_string()),
                voice: Some(VoiceId::new(voice)),
                format: Some(format.to_string()),
                ..Default::default()
            },
            app_id,
            api_secret,
            sample_rate,
            oral_level: None,
            spark_assist: None,
            stop_split: None,
            remain: None,
            reg: None,
            rdn: None,
            rhy: None,
            bgs: None,
        },
    )))
}

// ============================== ASR Provider 创建 ==============================

/// 创建 ASR Provider 实例
pub fn create_asr_provider(
    name: &str,
    model: &str,
    format: Option<AudioContainerFormat>,
    sample_rate: Option<u32>,
) -> Result<Box<dyn AsrProvider>, ProviderError> {
    match name {
        "qwen" => create_qwen_asr(model, format, sample_rate),
        "doubao" => create_doubao_asr(model, format, sample_rate),
        "glm" => create_glm_asr(model, format, sample_rate),
        "mimo" => create_mimo_asr(model, format, sample_rate),
        "xfyun" => create_xfyun_asr(model, format, sample_rate),
        _ => Err(ProviderError::UnknownProvider(name.to_string())),
    }
}

fn create_qwen_asr(
    model: &str,
    format: Option<AudioContainerFormat>,
    sample_rate: Option<u32>,
) -> Result<Box<dyn AsrProvider>, ProviderError> {
    let api_key = env_opt("QWEN_API_KEY");

    Ok(Box::new(asr_provider::QwenAsr::new(
        asr_provider::QwenAsrOption {
            base: BaseProviderOption {
                api_key,
                model: Some(model.to_string()),
                format,
                ..Default::default()
            },
            sample_rate,
            ..Default::default()
        },
    )))
}

fn create_doubao_asr(
    model: &str,
    format: Option<AudioContainerFormat>,
    sample_rate: Option<u32>,
) -> Result<Box<dyn AsrProvider>, ProviderError> {
    let app_key = env_opt("DOUBAO_APP_KEY").or_else(|| env_opt("DOUBAO_APP_ID"));
    let access_key = env_opt("DOUBAO_ACCESS_TOKEN").or_else(|| env_opt("DOUBAO_ACCESS_KEY"));

    Ok(Box::new(asr_provider::DoubaoAsr::new(
        asr_provider::DoubaoAsrOption {
            base: BaseProviderOption {
                model: Some(model.to_string()),
                format,
                ..Default::default()
            },
            app_key,
            access_key,
            sample_rate: sample_rate.unwrap_or(16000),
            bits: 16,
            channel: 1,
            segment_duration: 200,
            enable_itn: true,
            enable_punc: true,
            enable_ddc: false,
            show_utterances: true,
            end_window_size: None,
            enable_nonstream: None,
            vad_segment_duration: None,
            force_to_speech_time: None,
            resource_id: None,
            mode: Default::default(),
        },
    )))
}

fn create_glm_asr(
    model: &str,
    format: Option<AudioContainerFormat>,
    _sample_rate: Option<u32>,
) -> Result<Box<dyn AsrProvider>, ProviderError> {
    let api_key = env_opt("GLM_API_KEY");

    Ok(Box::new(asr_provider::GlmAsr::new(
        asr_provider::GlmAsrOption {
            base: BaseProviderOption {
                api_key,
                model: Some(model.to_string()),
                format,
                ..Default::default()
            },
            hotwords: None,
            context: None,
        },
    )))
}

fn create_mimo_asr(
    model: &str,
    format: Option<AudioContainerFormat>,
    _sample_rate: Option<u32>,
) -> Result<Box<dyn AsrProvider>, ProviderError> {
    // MIMO ASR 使用服务端固定采样率
    let api_key = env_opt("MIMO_API_KEY");

    Ok(Box::new(asr_provider::MimoAsr::new(
        asr_provider::MimoAsrOption {
            base: BaseProviderOption {
                api_key,
                model: Some(model.to_string()),
                format,
                ..Default::default()
            },
            language: None,
        },
    )))
}

fn create_xfyun_asr(
    model: &str,
    format: Option<AudioContainerFormat>,
    sample_rate: Option<u32>,
) -> Result<Box<dyn AsrProvider>, ProviderError> {
    let app_id = env_opt("XFYUN_APP_ID");
    let api_key = env_opt("XFYUN_API_KEY");
    let api_secret = env_opt("XFYUN_API_SECRET");

    Ok(Box::new(asr_provider::XfyunAsr::new(
        asr_provider::XfyunAsrOption {
            base: BaseProviderOption {
                api_key,
                model: Some(model.to_string()),
                format,
                ..Default::default()
            },
            app_id,
            api_secret,
            sample_rate,
            ..Default::default()
        },
    )))
}

// ============================== Provider 列表管理 ==============================

/// 根据 CLI 参数和测试类型解析要测试的 Provider 列表
pub fn resolve_tts_providers(filter: &[String]) -> Vec<String> {
    resolve_providers(filter, TTS_PROVIDER_NAMES)
}

/// 根据 CLI 参数和测试类型解析要测试的 ASR Provider 列表
pub fn resolve_asr_providers(filter: &[String]) -> Vec<String> {
    resolve_providers(filter, ASR_PROVIDER_NAMES)
}

fn resolve_providers(filter: &[String], all: &[&str]) -> Vec<String> {
    if filter.is_empty() {
        // 默认只测试最常用的几个 Provider
        all.iter()
            .take(3) // qwen, doubao, openai for TTS; qwen, doubao, glm for ASR
            .map(|s| s.to_string())
            .collect()
    } else {
        filter
            .iter()
            .flat_map(|f| f.split(','))
            .map(|s| s.trim().to_string())
            .filter(|s| all.contains(&s.as_str()))
            .collect()
    }
}
