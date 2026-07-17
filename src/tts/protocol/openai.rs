//! OpenAI TTS 协议层
//!
//! 封装 OpenAI TTS 涉及的两种 API 模式：
//!
//! - **speech 模式**（`POST /audio/speech`）：
//!   请求体 JSON，响应直接为二进制音频（mp3/opus/aac/flac/wav/pcm）。
//!   流式时逐块读取 HTTP 响应体字节。
//!
//! - **chat 模式**（`POST /chat/completions` + `audio` 参数）：
//!   请求体 JSON（标准 Chat Completions + audio 参数），
//!   非流式响应 JSON 中 `choices[0].message.audio.data` 为 base64 编码音频，
//!   流式 SSE 中 `choices[0].delta.audio.data` 为 base64 编码音频块。
//!
//! 对应 TypeScript `src/tts/providers/openai.ts` 中的协议逻辑。

use base64::Engine;
use serde::{Deserialize, Serialize};

use crate::tts::error::TtsError;

// ============================== 常量 ==============================

/// OpenAI TTS 默认 REST 端点
pub const OPENAI_DEFAULT_BASE_URL: &str = "https://api.openai.com/v1";

/// OpenAI TTS 默认模型（speech 模式）
pub const OPENAI_DEFAULT_MODEL: &str = "tts-1";

/// OpenAI TTS 默认音色
pub const OPENAI_DEFAULT_VOICE: &str = "alloy";

/// 自动推断为 speech 模式的模型名前缀
const SPEECH_MODE_MODEL_PREFIXES: &[&str] = &["tts-1", "gpt-4o-mini-tts"];

// ============================== API 模式 ==============================

/// OpenAI TTS API 调用模式
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum OpenaiApiMode {
    /// 使用 `audio/speech` API（标准 OpenAI TTS）
    Speech,
    /// 使用 `chat/completions` + `audio` 参数（兼容 mimo-v2-tts 等）
    Chat,
}

/// 根据模型名推断 API 模式
pub fn infer_api_mode(model: &str) -> OpenaiApiMode {
    if SPEECH_MODE_MODEL_PREFIXES
        .iter()
        .any(|prefix| model.starts_with(prefix))
    {
        OpenaiApiMode::Speech
    } else {
        OpenaiApiMode::Chat
    }
}

// ============================== 格式映射 ==============================

/// Speech API 支持的音频格式
pub const SPEECH_API_FORMATS: &[&str] = &["mp3", "opus", "aac", "flac", "wav", "pcm"];

/// 映射通用 format 到 Speech API 接受的格式
///
/// `ogg` / `ogg_opus` → `opus`，其余直接透传，未知格式回退 `mp3`。
pub fn map_format_for_speech_api(format: &str) -> &'static str {
    match format {
        "ogg" | "ogg_opus" => "opus",
        "mp3" => "mp3",
        "opus" => "opus",
        "aac" => "aac",
        "flac" => "flac",
        "wav" => "wav",
        "pcm" => "pcm",
        _ => "mp3",
    }
}

/// 映射通用 format 到 Chat API 的音频格式
///
/// Chat API 使用 `pcm16` 而非 `pcm`，其余直接透传。
pub fn map_format_for_chat_api(format: &str) -> &str {
    if format == "pcm" { "pcm16" } else { format }
}

// ============================== Speech API 请求 ==============================

/// Speech API 请求体（`POST /audio/speech`）
#[derive(Debug, Serialize)]
pub struct OpenaiSpeechRequest {
    pub model: String,
    pub input: String,
    pub voice: String,
    pub response_format: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub speed: Option<f32>,
}

// ============================== Chat API 请求 ==============================

/// Chat API 请求体（`POST /chat/completions` + `audio` 参数）
#[derive(Debug, Serialize)]
pub struct OpenaiChatRequest {
    pub model: String,
    pub messages: Vec<OpenaiChatMessage>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub audio: Option<OpenaiChatAudioParam>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stream: Option<bool>,
}

#[derive(Debug, Serialize)]
pub struct OpenaiChatMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Serialize)]
pub struct OpenaiChatAudioParam {
    pub voice: String,
    pub format: String,
}

// ============================== Chat API 非流式响应 ==============================

#[derive(Debug, Deserialize)]
pub struct OpenaiChatResponse {
    pub choices: Vec<OpenaiChatChoice>,
}

#[derive(Debug, Deserialize)]
pub struct OpenaiChatChoice {
    pub message: OpenaiChatMessageBody,
}

#[derive(Debug, Deserialize)]
pub struct OpenaiChatMessageBody {
    #[serde(default)]
    pub audio: Option<OpenaiChatAudioData>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct OpenaiChatAudioData {
    /// base64 编码的完整音频
    pub data: String,
}

// ============================== Chat API 流式响应（SSE） ==============================

#[derive(Debug, Deserialize)]
pub struct OpenaiChatStreamChunk {
    #[serde(default)]
    pub choices: Vec<OpenaiChatStreamChoice>,
    #[serde(default)]
    pub error: Option<OpenaiChatError>,
}

#[derive(Debug, Deserialize)]
pub struct OpenaiChatStreamChoice {
    #[serde(default)]
    pub delta: OpenaiChatStreamDelta,
    #[serde(default)]
    pub finish_reason: Option<String>,
}

#[derive(Debug, Default, Deserialize)]
pub struct OpenaiChatStreamDelta {
    #[serde(default)]
    pub audio: Option<OpenaiChatStreamAudio>,
}

#[derive(Debug, Default, Deserialize)]
pub struct OpenaiChatStreamAudio {
    /// base64 编码的音频块
    #[serde(default)]
    pub data: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct OpenaiChatError {
    #[serde(default)]
    pub message: Option<String>,
    #[serde(default)]
    pub code: Option<String>,
}

// ============================== SSE 事件类型 ==============================

/// 单帧 `data:` 解析后的事件
#[derive(Debug, Clone)]
pub enum OpenaiStreamEvent {
    /// base64 解码后的音频块
    Audio(Vec<u8>),
    /// 合成结束
    Finish,
    /// 业务错误
    Error(OpenaiChatError),
}

// ============================== SSE 行解析器 ==============================

/// SSE 行解析器：累积字节流，按 `\n` 切分出完整行
#[derive(Default)]
pub struct SseLineParser {
    buffer: Vec<u8>,
}

impl SseLineParser {
    pub fn new() -> Self {
        Self::default()
    }

    /// 喂入新字节，返回由此产生的完整行（已去除行尾 `\r`/`\n`）
    pub fn push(&mut self, bytes: &[u8]) -> Vec<String> {
        self.buffer.extend_from_slice(bytes);
        let mut lines = Vec::new();
        while let Some(pos) = self.buffer.iter().position(|&b| b == b'\n') {
            let line_bytes: Vec<u8> = self.buffer.drain(..=pos).collect();
            let s = String::from_utf8_lossy(&line_bytes);
            lines.push(s.trim_end_matches(['\r', '\n']).to_string());
        }
        lines
    }

    /// 字节流结束时调用，吐出残留的尾行
    pub fn flush(&mut self) -> Vec<String> {
        if self.buffer.is_empty() {
            return Vec::new();
        }
        let remaining = std::mem::take(&mut self.buffer);
        let s = String::from_utf8_lossy(&remaining);
        let trimmed = s.trim();
        if trimmed.is_empty() {
            Vec::new()
        } else {
            vec![trimmed.to_string()]
        }
    }
}

/// 从一行文本中剥离 `data:` 前缀，返回负载部分；非数据行返回 `None`
pub fn extract_data(line: &str) -> Option<&str> {
    let rest = line.trim().strip_prefix("data:")?;
    Some(rest.trim())
}

// ============================== SSE 数据解析 ==============================

/// 解析一帧 `data:` 负载（JSON 字符串或 `[DONE]`）
pub fn parse_data(data: &str) -> Result<Option<OpenaiStreamEvent>, TtsError> {
    let data = data.trim();
    if data.is_empty() {
        return Ok(None);
    }
    if data == "[DONE]" {
        return Ok(Some(OpenaiStreamEvent::Finish));
    }

    let chunk: OpenaiChatStreamChunk = serde_json::from_str(data)?;

    // 检查 API 错误
    if let Some(err) = chunk.error {
        if let Some(ref msg) = err.message {
            if !msg.is_empty() {
                return Ok(Some(OpenaiStreamEvent::Error(err)));
            }
        }
    }

    if let Some(choice) = chunk.choices.first() {
        // 检查 finish_reason
        if let Some(ref reason) = choice.finish_reason {
            if !reason.is_empty() {
                return Ok(Some(OpenaiStreamEvent::Finish));
            }
        }
        // 提取音频数据
        if let Some(ref audio) = choice.delta.audio {
            if let Some(ref data) = audio.data {
                let bytes = base64::engine::general_purpose::STANDARD
                    .decode(data.as_bytes())
                    .map_err(|e| TtsError::Other(format!("base64 decode error: {e}")))?;
                if !bytes.is_empty() {
                    return Ok(Some(OpenaiStreamEvent::Audio(bytes)));
                }
            }
        }
    }

    Ok(None)
}

// ============================== 错误解析 ==============================

/// 解析 OpenAI HTTP 错误响应体为 `TtsError`
pub fn parse_error_body(body: &str, status: u16) -> TtsError {
    // 尝试解析 OpenAI 标准错误格式：{"error": {"message": "...", "code": "..."}}
    if let Ok(resp) = serde_json::from_str::<OpenaiChatStreamChunk>(body) {
        if let Some(err) = resp.error {
            return TtsError::ServiceError {
                code: err.code.unwrap_or_else(|| status.to_string()),
                message: err
                    .message
                    .unwrap_or_else(|| format!("OpenAI TTS HTTP {status}")),
            };
        }
    }
    // 回退：直接提取 error.message
    if let Ok(val) = serde_json::from_str::<serde_json::Value>(body) {
        if let Some(msg) = val
            .get("error")
            .and_then(|e| e.get("message"))
            .and_then(|m| m.as_str())
        {
            let code = val
                .get("error")
                .and_then(|e| e.get("code"))
                .and_then(|c| c.as_str())
                .unwrap_or_default();
            return TtsError::ServiceError {
                code: code.to_string(),
                message: msg.to_string(),
            };
        }
    }
    TtsError::Other(format!("OpenAI TTS HTTP {status}: {body}"))
}

// ============================== 音色列表 ==============================

/// OpenAI TTS 标准音色
pub fn openai_voices() -> Vec<(&'static str, &'static str, Option<&'static str>)> {
    vec![
        ("alloy", "Alloy", Some("en-US")),
        ("echo", "Echo", Some("en-US")),
        ("fable", "Fable", Some("en-US")),
        ("nova", "Nova", Some("en-US")),
        ("shimmer", "Shimmer", Some("en-US")),
        ("ash", "Ash", Some("en-US")),
        ("ballad", "Ballad", Some("en-US")),
        ("coral", "Coral", Some("en-US")),
        ("sage", "Sage", Some("en-US")),
        ("verse", "Verse", Some("en-US")),
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    // -------- m1: 模型名自动推断 API 模式 --------

    #[test]
    fn test_m1_infer_speech_mode() {
        assert_eq!(infer_api_mode("tts-1"), OpenaiApiMode::Speech);
        assert_eq!(infer_api_mode("tts-1-hd"), OpenaiApiMode::Speech);
        assert_eq!(infer_api_mode("gpt-4o-mini-tts"), OpenaiApiMode::Speech);
    }

    #[test]
    fn test_m1b_infer_chat_mode() {
        assert_eq!(infer_api_mode("gpt-4o-audio-preview"), OpenaiApiMode::Chat);
        assert_eq!(infer_api_mode("mimo-v2-tts"), OpenaiApiMode::Chat);
        assert_eq!(infer_api_mode("gpt-4o"), OpenaiApiMode::Chat);
    }

    // -------- m2: Speech API 格式映射 --------

    #[test]
    fn test_m2_map_speech_formats() {
        assert_eq!(map_format_for_speech_api("mp3"), "mp3");
        assert_eq!(map_format_for_speech_api("wav"), "wav");
        assert_eq!(map_format_for_speech_api("pcm"), "pcm");
        assert_eq!(map_format_for_speech_api("opus"), "opus");
        assert_eq!(map_format_for_speech_api("ogg"), "opus");
        assert_eq!(map_format_for_speech_api("ogg_opus"), "opus");
        assert_eq!(map_format_for_speech_api("flac"), "flac");
        assert_eq!(map_format_for_speech_api("unknown"), "mp3");
    }

    // -------- m3: Chat API 格式映射 --------

    #[test]
    fn test_m3_map_chat_formats() {
        assert_eq!(map_format_for_chat_api("pcm"), "pcm16");
        assert_eq!(map_format_for_chat_api("wav"), "wav");
        assert_eq!(map_format_for_chat_api("mp3"), "mp3");
        assert_eq!(map_format_for_chat_api("pcm16"), "pcm16");
    }

    // -------- m4: Speech API 请求序列化 --------

    #[test]
    fn test_m4_speech_request_serialize() {
        let req = OpenaiSpeechRequest {
            model: "tts-1".into(),
            input: "你好".into(),
            voice: "alloy".into(),
            response_format: "mp3".into(),
            speed: None,
        };
        let json = serde_json::to_string(&req).unwrap();
        assert!(json.contains(r#""model":"tts-1""#));
        assert!(json.contains(r#""input":"你好""#));
        assert!(json.contains(r#""voice":"alloy""#));
        assert!(json.contains(r#""response_format":"mp3""#));
        assert!(!json.contains("speed")); // None 序列化时跳过
    }

    #[test]
    fn test_m4b_speech_request_with_speed() {
        let req = OpenaiSpeechRequest {
            model: "tts-1".into(),
            input: "hello".into(),
            voice: "alloy".into(),
            response_format: "wav".into(),
            speed: Some(1.25),
        };
        let json = serde_json::to_string(&req).unwrap();
        assert!(json.contains(r#""speed":1.25"#));
    }

    // -------- m5: Chat API 请求序列化 --------

    #[test]
    fn test_m5_chat_request_serialize() {
        let req = OpenaiChatRequest {
            model: "gpt-4o-audio-preview".into(),
            messages: vec![OpenaiChatMessage {
                role: "assistant".into(),
                content: "hello".into(),
            }],
            audio: Some(OpenaiChatAudioParam {
                voice: "alloy".into(),
                format: "pcm16".into(),
            }),
            stream: None,
        };
        let json = serde_json::to_string(&req).unwrap();
        assert!(json.contains(r#""model":"gpt-4o-audio-preview""#));
        assert!(json.contains(r#""role":"assistant""#));
        assert!(json.contains(r#""audio""#));
        assert!(json.contains(r#""voice":"alloy""#));
        assert!(!json.contains(r#""stream""#)); // None 跳过
    }

    #[test]
    fn test_m5b_chat_request_stream() {
        let req = OpenaiChatRequest {
            model: "mimo-v2-tts".into(),
            messages: vec![OpenaiChatMessage {
                role: "assistant".into(),
                content: "hi".into(),
            }],
            audio: Some(OpenaiChatAudioParam {
                voice: "alloy".into(),
                format: "pcm16".into(),
            }),
            stream: Some(true),
        };
        let json = serde_json::to_string(&req).unwrap();
        assert!(json.contains(r#""stream":true"#));
    }

    // -------- m6: Chat 非流式响应解析 --------

    #[test]
    fn test_m6_chat_response_parse() {
        let json = r#"{"choices":[{"message":{"audio":{"data":"SGVsbG8="}}}]}"#;
        let resp: OpenaiChatResponse = serde_json::from_str(json).unwrap();
        assert_eq!(resp.choices.len(), 1);
        let audio = resp.choices[0].message.audio.clone().unwrap();
        assert_eq!(audio.data, "SGVsbG8=");
    }

    // -------- m7: Chat 流式 chunk 解析 --------

    #[test]
    fn test_m7_stream_chunk_parse() {
        let json = r#"{"choices":[{"delta":{"audio":{"data":"SGVsbG8="}}}]}"#;
        let chunk: OpenaiChatStreamChunk = serde_json::from_str(json).unwrap();
        assert_eq!(chunk.choices.len(), 1);
        let data = chunk.choices[0]
            .delta
            .audio
            .as_ref()
            .and_then(|a| a.data.as_ref());
        assert_eq!(data, Some(&"SGVsbG8=".to_string()));
    }

    // -------- m8: [DONE] 与 finish_reason --------

    #[test]
    fn test_m8_parse_done_and_finish() {
        assert!(matches!(
            parse_data("[DONE]").unwrap(),
            Some(OpenaiStreamEvent::Finish)
        ));
        let finish = r#"{"choices":[{"delta":{},"finish_reason":"stop"}]}"#;
        assert!(matches!(
            parse_data(finish).unwrap(),
            Some(OpenaiStreamEvent::Finish)
        ));
    }

    // -------- m9: error 帧 --------

    #[test]
    fn test_m9_parse_error() {
        let data = r#"{"error":{"code":"invalid_api_key","message":"Incorrect API key"}}"#;
        match parse_data(data).unwrap().unwrap() {
            OpenaiStreamEvent::Error(err) => {
                assert_eq!(err.message.as_deref(), Some("Incorrect API key"));
                assert_eq!(err.code.as_deref(), Some("invalid_api_key"));
            }
            _ => panic!("expected OpenaiStreamEvent::Error"),
        }
    }

    // -------- m10: base64 解码 --------

    #[test]
    fn test_m10_audio_decode() {
        // "SGVsbG8=" = "Hello" in base64
        let data = r#"{"choices":[{"delta":{"audio":{"data":"SGVsbG8="}}}]}"#;
        match parse_data(data).unwrap().unwrap() {
            OpenaiStreamEvent::Audio(bytes) => assert_eq!(bytes, b"Hello"),
            _ => panic!("expected OpenaiStreamEvent::Audio"),
        }
    }

    // -------- m11: empty audio data --------

    #[test]
    fn test_m11_empty_audio_skipped() {
        // data == "" → 应该被跳过
        let data = r#"{"choices":[{"delta":{"audio":{"data":""}}}]}"#;
        assert!(matches!(parse_data(data).unwrap(), None));
    }

    // -------- m12: SSE 行解析器 --------

    #[test]
    fn test_m12_parser_cross_chunk() {
        let mut parser = SseLineParser::new();
        let lines = parser.push(b"data: {\"choices\"");
        assert!(lines.is_empty(), "不完整行不应产出");

        let lines = parser.push(b":[{\"delta\":{}}]}\n\n");
        assert_eq!(lines.len(), 2, "应产出 data 行 + 空行");
        assert!(lines[0].starts_with("data:"));
        assert!(lines[1].is_empty());
    }

    #[test]
    fn test_m12b_parser_flush_tail() {
        let mut parser = SseLineParser::new();
        parser.push(b"data: [DONE]");
        let tail = parser.flush();
        assert_eq!(tail.len(), 1);
        assert_eq!(tail[0], "data: [DONE]");
    }

    // -------- m13: extract_data --------

    #[test]
    fn test_m13_extract_data() {
        assert_eq!(extract_data("data: hello"), Some("hello"));
        assert_eq!(extract_data("data:hello"), Some("hello"));
        assert_eq!(extract_data(": comment"), None);
        assert_eq!(extract_data(""), None);
        assert_eq!(extract_data("event: x"), None);
    }

    // -------- m14: parse_error_body --------

    #[test]
    fn test_m14_parse_error_body() {
        let body = r#"{"error":{"code":"invalid_api_key","message":"Incorrect API key"}}"#;
        match parse_error_body(body, 401) {
            TtsError::ServiceError { code, message } => {
                assert_eq!(code, "invalid_api_key");
                assert!(message.contains("Incorrect"));
            }
            other => panic!("expected ServiceError, got {other:?}"),
        }
    }

    #[test]
    fn test_m14b_parse_error_body_non_json() {
        let err = parse_error_body("not json", 500);
        assert!(matches!(err, TtsError::Other(_)));
        assert!(err.to_string().contains("500"));
    }

    // -------- m15: openai_voices --------

    #[test]
    fn test_m15_voices() {
        let voices = openai_voices();
        assert_eq!(voices.len(), 10);
        assert!(voices.iter().any(|v| v.0 == "alloy"));
        assert!(voices.iter().any(|v| v.0 == "echo"));
        assert!(voices.iter().any(|v| v.0 == "shimmer"));
        assert!(voices.iter().all(|v| v.2 == Some("en-US")));
    }

    // -------- m16: 空 choices 或 delta --------

    #[test]
    fn test_m16_empty_choices() {
        let json = r#"{"choices":[]}"#;
        let chunk: OpenaiChatStreamChunk = serde_json::from_str(json).unwrap();
        assert!(chunk.choices.is_empty());
    }

    #[test]
    fn test_m16b_chunk_no_audio() {
        // choices 存在但 delta 没有 audio 字段
        let json = r#"{"choices":[{"delta":{"content":"hello"}}]}"#;
        let chunk: OpenaiChatStreamChunk = serde_json::from_str(json).unwrap();
        assert!(chunk.choices[0].delta.audio.is_none());
    }
}
