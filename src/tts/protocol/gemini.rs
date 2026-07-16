//! Gemini (Google) TTS 协议层
//!
//! 基于 Google Gemini Interactions API 实现语音合成。
//!
//! # 协议要点
//!
//! - 端点：`POST /v1beta/interactions`，`x-goog-api-key` 认证
//! - 非流式：响应 JSON，`output_audio.data` 为 base64 编码的 PCM（24kHz mono 16-bit）
//! - 流式：SSE 事件流，`step.delta` 事件中 `delta.data` 为 base64 编码的 PCM
//! - 结束：`step.end` 或 `step.complete` 事件
//! - 仅 `gemini-3.1-flash-tts-preview` 支持流式

use base64::Engine;
use serde::{Deserialize, Serialize};

use crate::tts::error::TtsError;

// ============================== 常量 ==============================

/// Gemini TTS 默认 REST 端点
pub const GEMINI_DEFAULT_BASE_URL: &str =
    "https://generativelanguage.googleapis.com/v1beta/interactions";
/// Gemini TTS 默认模型（同时支持流式和非流式）
pub const GEMINI_DEFAULT_MODEL: &str = "gemini-3.1-flash-tts-preview";
/// Gemini TTS 默认音色
pub const GEMINI_DEFAULT_VOICE: &str = "Kore";
/// Gemini TTS 固定采样率
pub const GEMINI_SAMPLE_RATE: u32 = 24000;

// ============================== 请求体 ==============================

/// Gemini TTS `/interactions` 请求体
#[derive(Debug, Clone, Serialize)]
pub struct GeminiSpeechRequest {
    pub model: String,
    pub input: String,
    #[serde(rename = "response_format")]
    pub response_format: ResponseFormat,
    #[serde(rename = "generation_config")]
    pub generation_config: GenerationConfig,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stream: Option<bool>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ResponseFormat {
    #[serde(rename = "type")]
    pub type_: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct GenerationConfig {
    #[serde(rename = "speech_config")]
    pub speech_config: Vec<SpeechConfigItem>,
}

/// 单角色或多角色语音配置
///
/// - 单角色：仅设置 `voice`，`None` 表示不发送该字段
/// - 多角色：同时设置 `speaker` 和 `voice`
#[derive(Debug, Clone, Serialize)]
pub struct SpeechConfigItem {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub speaker: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub voice: Option<String>,
}

impl SpeechConfigItem {
    /// 单角色配置
    pub fn single(voice: &str) -> Self {
        Self {
            speaker: None,
            voice: Some(voice.to_string()),
        }
    }

    /// 多角色配置
    pub fn multi(speaker: &str, voice: &str) -> Self {
        Self {
            speaker: Some(speaker.to_string()),
            voice: Some(voice.to_string()),
        }
    }
}

// ============================== 非流式响应 ==============================

/// Gemini TTS 非流式响应
///
/// 实际响应示例：
/// ```json
/// {
///   "steps": [{"content": [{"mime_type": "audio/l16", "data": "<base64>"}]}],
///   "error": {"code": 400, "message": "...", "status": "..."}
/// }
/// ```
#[derive(Debug, Deserialize)]
pub struct GeminiTtsResponse {
    /// 交互状态（如 "completed"）
    #[serde(default)]
    pub status: Option<String>,
    /// 音频内容步骤
    #[serde(default)]
    pub steps: Vec<Step>,
    /// 业务错误
    #[serde(default)]
    pub error: Option<GeminiErrorBody>,
}

/// 一个步骤中的音频内容
#[derive(Debug, Deserialize)]
pub struct Step {
    #[serde(default)]
    pub content: Vec<StepContent>,
}

/// 单块音频内容
#[derive(Debug, Deserialize)]
pub struct StepContent {
    /// MIME 类型（如 "audio/l16"）
    #[serde(default)]
    pub mime_type: Option<String>,
    /// base64 编码的 PCM 音频
    #[serde(default)]
    pub data: Option<String>,
}

impl GeminiTtsResponse {
    /// 从响应中提取音频数据（base64 → PCM）
    pub fn extract_audio(&self) -> Option<Vec<u8>> {
        let data = self.steps.first()?.content.first()?.data.as_ref()?;
        base64::engine::general_purpose::STANDARD.decode(data).ok()
    }

    /// 检查响应是否包含错误
    pub fn has_error(&self) -> bool {
        self.error.is_some()
    }
}

#[derive(Debug, Clone, Deserialize)]
pub struct GeminiErrorBody {
    #[serde(default)]
    pub code: Option<i32>,
    #[serde(default)]
    pub message: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
}

// ============================== 流式 SSE 事件 ==============================

/// 流式 SSE 单帧事件（`data:` 负载）
///
/// 实际格式示例：
/// ```json
/// {"index":0,"delta":{"mime_type":"audio/l16","data":"<base64>"},"event_type":"step.delta"}
/// {"interaction":{...},"event_type":"interaction.created"}
/// {"index":0,"step":{"type":"model_output"},"event_type":"step.start"}
/// {"interaction_id":"...","status":"completed","event_type":"interaction.status_update"}
/// ```
#[derive(Debug, Deserialize)]
pub struct GeminiStreamPayload {
    #[serde(default)]
    pub delta: Option<StreamDelta>,
    #[serde(default)]
    pub error: Option<GeminiErrorBody>,
    /// 事件类型（在 data 中也会重复）
    #[serde(default)]
    pub event_type: Option<String>,
    /// 状态（如 "completed"、"in_progress"）
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub interaction: Option<serde_json::Value>,
    #[serde(default)]
    pub step: Option<serde_json::Value>,
}

/// 流式 delta 内容
#[derive(Debug, Deserialize)]
pub struct StreamDelta {
    /// MIME 类型（如 "audio/l16"）
    #[serde(default)]
    pub mime_type: Option<String>,
    /// base64 编码的 PCM 音频数据
    #[serde(default)]
    pub data: Option<String>,
}

/// 解析后的流式事件
#[derive(Debug, Clone)]
pub enum GeminiStreamEvent {
    /// base64 解码后的 PCM 音频块
    Audio(Vec<u8>),
    /// 合成结束
    Complete,
    /// 业务错误
    Error(GeminiErrorBody),
}

// ============================== SSE 解析 ==============================

/// SSE 行解析器（累积字节流，按 `\n` 切分出完整行）
///
/// 与 GLM 的 `SseLineParser` 逻辑一致，但额外跟踪当前 `event:` 类型。
#[derive(Default)]
pub struct GeminiSseParser {
    buffer: Vec<u8>,
    /// 当前累积的 `event:` 类型（两行之间的状态）
    current_event: Option<String>,
}

impl GeminiSseParser {
    pub fn new() -> Self {
        Self::default()
    }

    /// 喂入新字节，返回由此产生的完整事件（`Event::Data` 或 `Event::EventType`）
    pub fn push(&mut self, bytes: &[u8]) -> Vec<GeminiSseLine> {
        self.buffer.extend_from_slice(bytes);
        let mut events = Vec::new();
        while let Some(p) = self.buffer.iter().position(|&b| b == b'\n') {
            let line_bytes: Vec<u8> = self.buffer.drain(..=p).collect();
            let s = String::from_utf8_lossy(&line_bytes);
            let line = s.trim_end_matches(['\r', '\n']).to_string();

            if line.is_empty() {
                // 空行表示事件结束，若有当前事件类型则产出完整事件
                if let Some(event_type) = self.current_event.take() {
                    events.push(GeminiSseLine::EventComplete { event_type });
                }
                continue;
            }

            if let Some(data) = line.strip_prefix("event:") {
                let event_type = data.trim().to_string();
                self.current_event = Some(event_type);
                continue;
            }

            if let Some(data) = line.strip_prefix("data:") {
                let payload = data.trim().to_string();
                let event_type = self.current_event.clone();
                events.push(GeminiSseLine::Data {
                    payload,
                    event_type,
                });
                continue;
            }

            // 其他行（如 `: comment`）忽略
        }
        events
    }

    /// 字节流结束时调用，吐出残留的尾行
    pub fn flush(&mut self) -> Vec<GeminiSseLine> {
        if self.buffer.is_empty() && self.current_event.is_none() {
            return Vec::new();
        }
        let mut events = Vec::new();
        if !self.buffer.is_empty() {
            let remaining = std::mem::take(&mut self.buffer);
            let s = String::from_utf8_lossy(&remaining);
            let trimmed = s.trim();
            if !trimmed.is_empty() {
                let event_type = self.current_event.clone();
                events.push(GeminiSseLine::Data {
                    payload: trimmed.to_string(),
                    event_type,
                });
            }
        }
        self.current_event = None;
        events
    }
}

/// SSE 解析产出的一行
#[derive(Debug, Clone)]
pub enum GeminiSseLine {
    /// 一个 `data:` 行（可能带有关联的 `event:` 类型）
    Data {
        payload: String,
        event_type: Option<String>,
    },
    /// 空行结束了一个完整事件（携带之前记录的 `event:` 类型）
    EventComplete { event_type: String },
}

/// 将一行 `data:` 负载解析为 `GeminiStreamEvent`
///
/// `event_type` 为关联的事件类型（来自之前 `event:` 行）或 `None`。
///
/// 实际事件类型：
/// - `interaction.created` — 交互创建
/// - `step.start` — 步骤开始
/// - `step.delta` — 音频数据块（`delta.mime_type == "audio/l16"`）
/// - `interaction.status_update` — 状态更新（`status: "completed"` 表示结束）
pub fn parse_delta_payload(
    payload: &str,
    event_type: Option<&str>,
) -> Result<Option<GeminiStreamEvent>, TtsError> {
    let payload = payload.trim();
    if payload.is_empty() {
        return Ok(None);
    }

    // [DONE] 标记
    if payload == "[DONE]" {
        return Ok(Some(GeminiStreamEvent::Complete));
    }

    // 只处理已知事件类型
    match event_type {
        Some("step.delta") | Some("step.complete") | Some("step.end") | None => {
            let parsed: GeminiStreamPayload = serde_json::from_str(payload)?;

            if let Some(err) = parsed.error {
                return Ok(Some(GeminiStreamEvent::Error(err)));
            }

            // 检查 step.delta 中的音频数据
            if let Some(delta) = &parsed.delta {
                let is_audio = delta
                    .mime_type
                    .as_deref()
                    .is_some_and(|m| m.starts_with("audio/"));
                if is_audio {
                    if let Some(data) = &delta.data {
                        let audio = base64::engine::general_purpose::STANDARD
                            .decode(data)
                            .map_err(|e| {
                                TtsError::Other(format!("Gemini base64 decode error: {e}"))
                            })?;
                        if !audio.is_empty() {
                            return Ok(Some(GeminiStreamEvent::Audio(audio)));
                        }
                    }
                }
            }

            // 无音频内容的 delta → 忽略（保持连接，等待更多数据）
            Ok(None)
        }
        Some("interaction.status_update") => {
            // 状态更新事件：status == "completed" 表示结束
            if let Ok(parsed) = serde_json::from_str::<GeminiStreamPayload>(payload) {
                if parsed.status.as_deref() == Some("completed") {
                    return Ok(Some(GeminiStreamEvent::Complete));
                }
            }
            Ok(None)
        }
        Some(_other) => {
            // 其他事件（interaction.created, step.start 等）忽略
            Ok(None)
        }
    }
}

// ============================== 错误解析 ==============================

/// 解析 HTTP 错误响应体为 `TtsError`
///
/// Gemini API 错误有两种格式：
/// - 标准格式：`{"error": {"code": 400, "message": "...", "status": "..."}}`
/// - 直接格式：`{"code": 400, "message": "...", "status": "..."}`（流式错误帧）
pub fn parse_error_body(body: &str, status: u16) -> TtsError {
    // 1. 先尝试标准 Gemini 错误格式 `{"error": {...}}`
    if let Ok(val) = serde_json::from_str::<serde_json::Value>(body) {
        if let Some(err) = val.get("error") {
            if let (Some(code), Some(message)) = (
                err.get("code").and_then(|c| c.as_i64()),
                err.get("message").and_then(|m| m.as_str()),
            ) {
                return TtsError::ServiceError {
                    code: code.to_string(),
                    message: message.to_string(),
                };
            }
            // 如果 "error" 对象有 status 但没有 message，或者有其他字段
            let code = err
                .get("code")
                .and_then(|c| c.as_i64())
                .map_or_else(|| status.to_string(), |c| c.to_string());
            let message = err
                .get("message")
                .and_then(|m| m.as_str())
                .unwrap_or("unknown error")
                .to_string();
            return TtsError::ServiceError { code, message };
        }
    }
    // 2. 尝试直接反序列化 `GeminiErrorBody`
    if let Ok(resp) = serde_json::from_str::<GeminiErrorBody>(body) {
        return TtsError::ServiceError {
            code: resp
                .code
                .map_or_else(|| status.to_string(), |c| c.to_string()),
            message: resp.message.unwrap_or_else(|| format!("HTTP {status}")),
        };
    }
    // 3. 无法解析
    TtsError::Other(format!("Gemini TTS HTTP {status}: {body}"))
}

// ============================== 音色列表 ==============================

/// Gemini TTS 内置的 30 个音色
pub fn gemini_voices() -> Vec<(&'static str, &'static str, &'static str)> {
    vec![
        ("Zephyr", "Zephyr", "Bright"),
        ("Puck", "Puck", "Upbeat"),
        ("Charon", "Charon", "Informative"),
        ("Kore", "Kore", "Firm"),
        ("Fenrir", "Fenrir", "Excitable"),
        ("Leda", "Leda", "Youthful"),
        ("Orus", "Orus", "Firm"),
        ("Aoede", "Aoede", "Breezy"),
        ("Callirrhoe", "Callirrhoe", "Easy-going"),
        ("Autonoe", "Autonoe", "Bright"),
        ("Enceladus", "Enceladus", "Breathy"),
        ("Iapetus", "Iapetus", "Clear"),
        ("Umbriel", "Umbriel", "Easy-going"),
        ("Algieba", "Algieba", "Smooth"),
        ("Despina", "Despina", "Smooth"),
        ("Erinome", "Erinome", "Clear"),
        ("Algenib", "Algenib", "Gravelly"),
        ("Rasalgethi", "Rasalgethi", "Informative"),
        ("Laomedeia", "Laomedeia", "Upbeat"),
        ("Achernar", "Achernar", "Soft"),
        ("Alnilam", "Alnilam", "Firm"),
        ("Schedar", "Schedar", "Even"),
        ("Gacrux", "Gacrux", "Mature"),
        ("Pulcherrima", "Pulcherrima", "Forward"),
        ("Achird", "Achird", "Friendly"),
        ("Zubenelgenubi", "Zubenelgenubi", "Casual"),
        ("Vindemiatrix", "Vindemiatrix", "Gentle"),
        ("Sadachbia", "Sadachbia", "Lively"),
        ("Sadaltager", "Sadaltager", "Knowledgeable"),
        ("Sulafat", "Sulafat", "Warm"),
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    // -------- p1 单角色请求体序列化 --------

    #[test]
    fn test_p1_single_voice_request() {
        let req = GeminiSpeechRequest {
            model: "gemini-3.1-flash-tts-preview".into(),
            input: "Hello world".into(),
            response_format: ResponseFormat {
                type_: "audio".into(),
            },
            generation_config: GenerationConfig {
                speech_config: vec![SpeechConfigItem::single("Kore")],
            },
            stream: None,
        };
        let json = serde_json::to_string(&req).unwrap();
        assert!(json.contains(r#""model":"gemini-3.1-flash-tts-preview""#));
        assert!(json.contains(r#""input":"Hello world""#));
        assert!(json.contains(r#""response_format":{"type":"audio"}"#));
        assert!(json.contains(r#""speech_config":[{"voice":"Kore"}]"#));
        assert!(!json.contains(r#""stream""#));
    }

    // -------- p2 流式请求体包含 stream 字段 --------

    #[test]
    fn test_p2_stream_request() {
        let req = GeminiSpeechRequest {
            model: "gemini-3.1-flash-tts-preview".into(),
            input: "hi".into(),
            response_format: ResponseFormat {
                type_: "audio".into(),
            },
            generation_config: GenerationConfig {
                speech_config: vec![SpeechConfigItem::single("Kore")],
            },
            stream: Some(true),
        };
        let json = serde_json::to_string(&req).unwrap();
        assert!(json.contains(r#""stream":true"#));
    }

    // -------- p3 多角色请求体 --------

    #[test]
    fn test_p3_multi_speaker_request() {
        let req = GeminiSpeechRequest {
            model: "gemini-3.1-flash-tts-preview".into(),
            input: "Joe: Hello.\nJane: Hi!".into(),
            response_format: ResponseFormat {
                type_: "audio".into(),
            },
            generation_config: GenerationConfig {
                speech_config: vec![
                    SpeechConfigItem::multi("Joe", "Kore"),
                    SpeechConfigItem::multi("Jane", "Puck"),
                ],
            },
            stream: None,
        };
        let json = serde_json::to_string(&req).unwrap();
        assert!(json.contains(r#""speaker":"Joe""#));
        assert!(json.contains(r#""voice":"Kore""#));
        assert!(json.contains(r#""speaker":"Jane""#));
        assert!(json.contains(r#""voice":"Puck""#));
    }

    // -------- p4 非流式响应反序列化 --------

    #[test]
    fn test_p4_non_stream_response() {
        let json = r#"{"steps":[{"content":[{"mime_type":"audio/l16","data":"SGVsbG8="}]}]}"#;
        let resp: GeminiTtsResponse = serde_json::from_str(json).unwrap();
        assert_eq!(resp.status.as_deref(), None); // status is not set in this test
        assert_eq!(resp.steps.len(), 1);
        assert_eq!(resp.steps[0].content.len(), 1);
        assert_eq!(resp.steps[0].content[0].data.as_deref(), Some("SGVsbG8="));
        assert_eq!(
            resp.steps[0].content[0].mime_type.as_deref(),
            Some("audio/l16")
        );
        // Test extract_audio
        let audio = resp.extract_audio().unwrap();
        assert_eq!(audio, b"Hello");
    }

    // -------- p5 非流式响应无音频 --------

    #[test]
    fn test_p5_response_no_audio() {
        let json = r#"{"status":"completed","steps":[]}"#;
        let resp: GeminiTtsResponse = serde_json::from_str(json).unwrap();
        assert_eq!(resp.status.as_deref(), Some("completed"));
        assert!(resp.steps.is_empty());
        assert!(resp.extract_audio().is_none());
    }

    // -------- p5b 完整实际响应反序列化 --------

    #[test]
    fn test_p5b_full_response() {
        let json = r#"{
            "id":"test-id",
            "status":"completed",
            "usage":{"total_tokens":46},
            "steps":[{"content":[{"mime_type":"audio/l16","data":"SGVsbG8="}]}]
        }"#;
        let resp: GeminiTtsResponse = serde_json::from_str(json).unwrap();
        assert_eq!(resp.status.as_deref(), Some("completed"));
        assert!(resp.error.is_none());
        let audio = resp.extract_audio().unwrap();
        assert_eq!(audio, b"Hello");
    }

    // -------- p6 SSE 解析：基本 data 行 --------

    #[test]
    fn test_p6_sse_basic_data() {
        let mut parser = GeminiSseParser::new();
        let events = parser.push(b"data: {\"delta\":{\"type\":\"audio\",\"data\":\"AA==\"}}\n\n");
        assert_eq!(events.len(), 1);
        match &events[0] {
            GeminiSseLine::Data {
                payload,
                event_type,
            } => {
                assert!(payload.contains("audio"));
                assert!(event_type.is_none());
            }
            _ => panic!("expected Data"),
        }
    }

    // -------- p7 SSE 解析：event + data 行 --------

    #[test]
    fn test_p7_sse_event_and_data() {
        let mut parser = GeminiSseParser::new();
        let events = parser.push(
            b"event: step.delta\ndata: {\"delta\":{\"type\":\"audio\",\"data\":\"SGVsbG8=\"}}\n\n",
        );
        // Expected: data line followed by EventComplete for step.delta
        assert!(!events.is_empty());
        match &events[0] {
            GeminiSseLine::Data {
                payload,
                event_type,
            } => {
                assert!(payload.contains("SGVsbG8="));
                assert_eq!(event_type.as_deref(), Some("step.delta"));
            }
            _ => panic!("expected Data"),
        }
    }

    // -------- p8 SSE 跨 chunk 拼接 --------

    #[test]
    fn test_p8_sse_cross_chunk() {
        let mut parser = GeminiSseParser::new();
        let events = parser.push(b"data: {\"delta\"");
        assert!(events.is_empty(), "不完整行不应产出");

        let events = parser.push(b":{\"type\":\"audio\",\"data\":\"AA==\"}}\n\n");
        assert_eq!(events.len(), 1);
        assert!(matches!(&events[0], GeminiSseLine::Data { .. }));
    }

    // -------- p9 SSE flush 尾行 --------

    #[test]
    fn test_p9_sse_flush_tail() {
        let mut parser = GeminiSseParser::new();
        parser.push(b"data: {\"delta\":{\"type\":\"audio\",\"data\":\"AA==\"}}");
        let events = parser.flush();
        assert_eq!(events.len(), 1);
        match &events[0] {
            GeminiSseLine::Data { payload, .. } => {
                assert!(payload.contains("AA=="));
            }
            _ => panic!("expected Data"),
        }
    }

    // -------- p10 parse_delta_payload 音频解码（step.delta + mime_type） --------

    #[test]
    fn test_p10_parse_audio_delta() {
        let payload = r#"{"delta":{"mime_type":"audio/l16","data":"SGVsbG8="}}"#;
        match parse_delta_payload(payload, Some("step.delta"))
            .unwrap()
            .unwrap()
        {
            GeminiStreamEvent::Audio(bytes) => assert_eq!(bytes, b"Hello"),
            other => panic!("expected Audio, got {other:?}"),
        }
    }

    // -------- p11 parse_delta_payload 无 event_type（仍匹配） --------

    #[test]
    fn test_p11_parse_no_event_type() {
        let payload = r#"{"delta":{"mime_type":"audio/l16","data":"SGVsbG8="}}"#;
        match parse_delta_payload(payload, None).unwrap().unwrap() {
            GeminiStreamEvent::Audio(bytes) => assert_eq!(bytes, b"Hello"),
            other => panic!("expected Audio, got {other:?}"),
        }
    }

    // -------- p12 parse_delta_payload interaction.status_update completed --------

    #[test]
    fn test_p12_parse_complete() {
        // interaction.status_update 事件中 status=completed 表示合成结束
        let payload = r#"{"interaction_id":"test","status":"completed","event_type":"interaction.status_update"}"#;
        match parse_delta_payload(payload, Some("interaction.status_update"))
            .unwrap()
            .unwrap()
        {
            GeminiStreamEvent::Complete => {} // expected
            other => panic!("expected Complete, got {other:?}"),
        }
    }

    // -------- p12b step.end 空 payload 不再产生 Complete --------

    #[test]
    fn test_p12b_step_end_empty_payload() {
        // step.end 事件没有音频数据时，返回 None（不中断流）
        let payload = r#"{}"#;
        assert!(
            parse_delta_payload(payload, Some("step.delta"))
                .unwrap()
                .is_none()
        );
    }

    // -------- p13 parse_delta_payload 空负载 --------

    #[test]
    fn test_p13_parse_empty_payload() {
        assert!(parse_delta_payload("", None).unwrap().is_none());
        assert!(parse_delta_payload("  ", None).unwrap().is_none());
    }

    // -------- p14 错误帧解析 --------

    #[test]
    fn test_p14_parse_error_payload() {
        let payload =
            r#"{"error":{"code":400,"message":"Invalid voice","status":"INVALID_ARGUMENT"}}"#;
        match parse_delta_payload(payload, Some("step.delta"))
            .unwrap()
            .unwrap()
        {
            GeminiStreamEvent::Error(err) => {
                assert_eq!(err.code, Some(400));
                assert_eq!(err.message.as_deref(), Some("Invalid voice"));
            }
            other => panic!("expected Error, got {other:?}"),
        }
    }

    // -------- p15 parse_error_body --------

    #[test]
    fn test_p15_parse_error_body() {
        // 标准 Gemini 错误格式
        let body =
            r#"{"error":{"code":400,"message":"Invalid API key","status":"INVALID_ARGUMENT"}}"#;
        match parse_error_body(body, 400) {
            TtsError::ServiceError { code, message } => {
                assert_eq!(code, "400");
                assert!(message.contains("Invalid API key"));
            }
            other => panic!("expected ServiceError, got {other:?}"),
        }

        // 非 JSON → Other
        assert!(matches!(
            parse_error_body("not json", 500),
            TtsError::Other(_)
        ));
    }

    // -------- p16 GeminiSseParser 多事件流 --------

    #[test]
    fn test_p16_multi_event_stream() {
        let mut parser = GeminiSseParser::new();
        let input = b"event: step.delta\ndata: {\"delta\":{\"type\":\"audio\",\"data\":\"AA==\"}}\n\nevent: step.end\ndata: {}\n\n";
        let events = parser.push(input);
        // Should produce: data(step.delta) + EventComplete + data(step.end) + EventComplete
        assert_eq!(events.len(), 4);

        // First data line
        match &events[0] {
            GeminiSseLine::Data { event_type, .. } => {
                assert_eq!(event_type.as_deref(), Some("step.delta"));
            }
            _ => panic!("expected Data"),
        }
        // First EventComplete - emitted by empty line
        match &events[1] {
            GeminiSseLine::EventComplete { event_type } => {
                assert_eq!(event_type, "step.delta");
            }
            _ => panic!("expected EventComplete"),
        }
        // Second data line
        match &events[2] {
            GeminiSseLine::Data { event_type, .. } => {
                assert_eq!(event_type.as_deref(), Some("step.end"));
            }
            _ => panic!("expected Data"),
        }
    }

    // -------- p17 SpeechConfigItem 构造 --------

    #[test]
    fn test_p17_speech_config_constructors() {
        let single = SpeechConfigItem::single("Kore");
        assert_eq!(single.voice, Some("Kore".to_string()));
        assert!(single.speaker.is_none());

        let multi = SpeechConfigItem::multi("Joe", "Puck");
        assert_eq!(multi.speaker, Some("Joe".to_string()));
        assert_eq!(multi.voice, Some("Puck".to_string()));
    }

    // -------- p18 注释行被忽略 --------

    #[test]
    fn test_p18_comment_line_ignored() {
        let mut parser = GeminiSseParser::new();
        let events = parser
            .push(b": comment line\ndata: {\"delta\":{\"type\":\"audio\",\"data\":\"AA==\"}}\n\n");
        // Only the data line produces an event; the empty line has no active event type
        assert_eq!(events.len(), 1);
    }
}
