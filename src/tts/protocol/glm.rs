//! GLM (智谱 AI) TTS 协议层
//!
//! 基于智谱 AI GLM-TTS HTTP REST API。对应 TypeScript 端的
//! `src/tts/providers/glm.ts` 中的协议逻辑。
//!
//! 本模块只负责「纯协议」：请求体序列化、SSE 流式响应解析、错误解析、
//! 参数映射。HTTP 发起与 `TtsProvider` 实现见
//! [`crate::tts::provider::glm`]。
//!
//! # 协议要点
//!
//! - 端点：`POST /paas/v4/audio/speech`，Bearer 认证
//! - 非流式：响应体直接为二进制音频（wav / pcm）
//! - 流式：`text/event-stream`，每行 `data: <json>`，
//!   `choices[0].delta.content` 为 base64 编码的 PCM（固定 24000 Hz）
//! - 结束：`choices[0].finish_reason == "stop"`，或 `[DONE]` 哨兵

use base64::Engine;
use serde::{Deserialize, Serialize};

use crate::tts::error::TtsError;

// ============================== 常量 ==============================

/// GLM TTS 默认 REST 端点
pub const GLM_DEFAULT_BASE_URL: &str = "https://open.bigmodel.cn/api/paas/v4/audio/speech";
/// GLM TTS 默认模型
pub const GLM_DEFAULT_MODEL: &str = "glm-tts";
/// GLM TTS 默认音色
pub const GLM_DEFAULT_VOICE: &str = "tongtong";
/// GLM TTS 固定采样率（由服务端 `delta.return_sample_rate` 返回）
pub const GLM_SAMPLE_RATE: u32 = 24000;

// ============================== 请求体 ==============================

/// GLM TTS `/audio/speech` 请求体
///
/// 所有 `Option` 字段为 `None` 时不会出现在序列化结果中，
/// 以严格对齐 GLM API 语义（未设置即使用服务端默认值）。
#[derive(Debug, Clone, Serialize)]
pub struct GlmSpeechRequest {
    pub model: String,
    pub input: String,
    pub voice: String,
    pub response_format: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stream: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub encode_format: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub speed: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub volume: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub watermark_enabled: Option<bool>,
}

// ============================== 响应体 ==============================

/// GLM 流式响应单帧（SSE 的 `data:` 负载），也复用于错误体解析
#[derive(Debug, Deserialize)]
pub struct GlmStreamResponse {
    #[serde(default)]
    pub choices: Vec<GlmChoice>,
    #[serde(default)]
    pub error: Option<GlmError>,
}

#[derive(Debug, Deserialize)]
pub struct GlmChoice {
    #[serde(default)]
    #[allow(dead_code)]
    pub index: Option<u32>,
    #[serde(default)]
    pub delta: GlmDelta,
    #[serde(default)]
    pub finish_reason: Option<String>,
}

#[derive(Debug, Default, Deserialize)]
pub struct GlmDelta {
    /// base64 编码的 PCM 音频
    #[serde(default)]
    pub content: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct GlmError {
    #[serde(default)]
    pub code: Option<String>,
    #[serde(default)]
    pub message: Option<String>,
}

// ============================== SSE 解析事件 ==============================

/// 单帧 `data:` 解析后的事件
#[derive(Debug, Clone)]
pub enum GlmStreamEvent {
    /// base64 解码后的 PCM 音频块
    Audio(Vec<u8>),
    /// 合成结束（`finish_reason=stop` 或 `[DONE]`）
    Finish,
    /// 业务错误
    Error(GlmError),
}

/// SSE 行解析器：累积字节流，按 `\n` 切分出完整行
///
/// 处理一帧 SSE 数据被拆分到多个 TCP chunk 的情况。
/// 内部以字节缓冲，避免多字节字符被截断（SSE 实际为 ASCII，属额外保险）。
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

    /// 字节流结束时调用，吐出残留的尾行（无换行符结尾的最后一段）
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

/// 解析一帧 `data:` 负载（JSON 字符串或 `[DONE]`）
///
/// 返回 `Ok(None)` 表示该帧无有效音频且未结束（如空内容）。
pub fn parse_data(data: &str) -> Result<Option<GlmStreamEvent>, TtsError> {
    let data = data.trim();
    if data.is_empty() {
        return Ok(None);
    }
    if data == "[DONE]" {
        return Ok(Some(GlmStreamEvent::Finish));
    }

    let resp: GlmStreamResponse = serde_json::from_str(data)?;

    if let Some(err) = resp.error {
        return Ok(Some(GlmStreamEvent::Error(err)));
    }

    if let Some(choice) = resp.choices.first() {
        if choice.finish_reason.as_deref() == Some("stop") {
            return Ok(Some(GlmStreamEvent::Finish));
        }
        if let Some(content) = &choice.delta.content {
            let audio = base64::engine::general_purpose::STANDARD
                .decode(content)
                .map_err(|e| TtsError::Other(format!("base64 decode error: {e}")))?;
            if !audio.is_empty() {
                return Ok(Some(GlmStreamEvent::Audio(audio)));
            }
        }
    }

    Ok(None)
}

// ============================== 参数映射 ==============================

/// GLM 仅支持 wav/pcm；其他格式回退 wav
pub fn map_format(format: &str) -> &'static str {
    match format {
        "wav" => "wav",
        "pcm" => "pcm",
        _ => "wav",
    }
}

/// speed 映射：`None` 不发送；`Some(v)` clamp 到 GLM 取值范围 `[0.5, 2.0]`
pub fn map_speed(speed: Option<f32>) -> Option<f32> {
    speed.map(|v| v.clamp(0.5, 2.0))
}

/// volume 映射：`BaseTtsOption.volume`（0.0~1.0）→ GLM `(0.0, 10.0]`
///
/// `None` 不发送（保持 GLM 默认 1.0）；`Some(v)` 线性放大 10 倍并 clamp 到
/// `(0.001, 10.0]`（GLM volume 为开区间，下界不含 0）。
pub fn map_volume(volume: Option<f32>) -> Option<f32> {
    volume.map(|v| (v * 10.0).clamp(0.001, 10.0))
}

/// 解析 HTTP 错误响应体为 `TtsError`
///
/// 优先识别 `{"error":{"code","message"}}` → `ServiceError`；
/// 无法解析时回退到 `Other`。
pub fn parse_error_body(body: &str, status: u16) -> TtsError {
    if let Ok(resp) = serde_json::from_str::<GlmStreamResponse>(body) {
        if let Some(err) = resp.error {
            return TtsError::ServiceError {
                code: err.code.unwrap_or_else(|| status.to_string()),
                message: err.message.unwrap_or_else(|| format!("HTTP {status}")),
            };
        }
    }
    TtsError::Other(format!("GLM TTS HTTP {status}: {body}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    // -------- p1 请求体序列化（None 字段不出现） --------

    #[test]
    fn test_p1_request_skip_none() {
        let req = GlmSpeechRequest {
            model: "glm-tts".into(),
            input: "你好".into(),
            voice: "tongtong".into(),
            response_format: "pcm".into(),
            stream: None,
            encode_format: None,
            speed: None,
            volume: None,
            watermark_enabled: None,
        };
        let json = serde_json::to_string(&req).unwrap();
        assert_eq!(
            json,
            r#"{"model":"glm-tts","input":"你好","voice":"tongtong","response_format":"pcm"}"#
        );
    }

    #[test]
    fn test_p1b_request_stream_fields() {
        let req = GlmSpeechRequest {
            model: "glm-tts".into(),
            input: "hi".into(),
            voice: "tongtong".into(),
            response_format: "pcm".into(),
            stream: Some(true),
            encode_format: Some("base64".into()),
            speed: Some(1.0),
            volume: Some(5.0),
            watermark_enabled: Some(true),
        };
        let json = serde_json::to_string(&req).unwrap();
        assert!(json.contains(r#""stream":true"#));
        assert!(json.contains(r#""encode_format":"base64""#));
        assert!(json.contains(r#""watermark_enabled":true"#));
        assert!(json.contains(r#""speed":1.0"#));
    }

    // -------- p2 流式响应反序列化 --------

    #[test]
    fn test_p2_parse_delta_content() {
        let data = r#"{"choices":[{"index":0,"delta":{"content":"SGVsbG8="}}]}"#;
        let resp: GlmStreamResponse = serde_json::from_str(data).unwrap();
        assert_eq!(resp.choices.len(), 1);
        assert_eq!(resp.choices[0].delta.content.as_deref(), Some("SGVsbG8="));
    }

    // -------- p3 SSE 行解析器（跨 chunk 拼接） --------

    #[test]
    fn test_p3_parser_cross_chunk() {
        let mut parser = SseLineParser::new();
        let lines = parser.push(b"data: {\"choices\"");
        assert!(lines.is_empty(), "不完整行不应产出");

        let lines = parser.push(b":[{\"delta\":{\"content\":\"AA==\"}}]}\n\n");
        assert_eq!(lines.len(), 2, "应产出 data 行 + 空行");
        assert!(lines[0].starts_with("data:"));
        assert!(lines[1].is_empty());
    }

    #[test]
    fn test_p3b_parser_flush_tail() {
        let mut parser = SseLineParser::new();
        // 最后一行没有换行符
        parser.push(b"data: {\"choices\":[{\"delta\":{\"content\":\"AA==\"}}]}");
        let tail = parser.flush();
        assert_eq!(tail.len(), 1);
        assert!(tail[0].starts_with("data:"));
    }

    // -------- p4 [DONE] 与 finish_reason=stop --------

    #[test]
    fn test_p4_parse_done_and_stop() {
        assert!(matches!(
            parse_data("[DONE]").unwrap(),
            Some(GlmStreamEvent::Finish)
        ));
        let stop = r#"{"choices":[{"finish_reason":"stop","index":2}]}"#;
        assert!(matches!(
            parse_data(stop).unwrap(),
            Some(GlmStreamEvent::Finish)
        ));
    }

    // -------- p5 error 帧 --------

    #[test]
    fn test_p5_parse_error_frame() {
        let data = r#"{"error":{"code":"1214","message":"音色id不存在"}}"#;
        match parse_data(data).unwrap().unwrap() {
            GlmStreamEvent::Error(err) => {
                assert_eq!(err.code.as_deref(), Some("1214"));
                assert_eq!(err.message.as_deref(), Some("音色id不存在"));
            }
            _ => panic!("expected GlmStreamEvent::Error"),
        }
    }

    // -------- p6 base64 content 解码 --------

    #[test]
    fn test_p6_audio_decode() {
        // "SGVsbG8=" base64 → b"Hello"
        let data = r#"{"choices":[{"index":0,"delta":{"content":"SGVsbG8="}}]}"#;
        match parse_data(data).unwrap().unwrap() {
            GlmStreamEvent::Audio(bytes) => assert_eq!(bytes, b"Hello"),
            _ => panic!("expected GlmStreamEvent::Audio"),
        }
    }

    // -------- p7 map_format 回退 --------

    #[test]
    fn test_p7_map_format() {
        assert_eq!(map_format("wav"), "wav");
        assert_eq!(map_format("pcm"), "pcm");
        assert_eq!(map_format("mp3"), "wav");
        assert_eq!(map_format(""), "wav");
    }

    // -------- p8 map_volume 映射 --------

    #[test]
    fn test_p8_map_volume() {
        assert_eq!(map_volume(None), None);
        assert!((map_volume(Some(0.5)).unwrap() - 5.0).abs() < 1e-6);
        assert!((map_volume(Some(1.0)).unwrap() - 10.0).abs() < 1e-6);
        // 下界 clamp（GLM volume 开区间，不含 0）
        assert!((map_volume(Some(0.0)).unwrap() - 0.001).abs() < 1e-6);
        // 上界 clamp
        assert!((map_volume(Some(2.0)).unwrap() - 10.0).abs() < 1e-6);
    }

    // -------- p9 map_speed clamp --------

    #[test]
    fn test_p9_map_speed() {
        assert_eq!(map_speed(None), None);
        assert!((map_speed(Some(1.0)).unwrap() - 1.0).abs() < 1e-6);
        assert!((map_speed(Some(3.0)).unwrap() - 2.0).abs() < 1e-6);
        assert!((map_speed(Some(0.1)).unwrap() - 0.5).abs() < 1e-6);
    }

    // -------- p10 parse_error_body --------

    #[test]
    fn test_p10_parse_error_body() {
        let body = r#"{"error":{"code":"1214","message":"音色id不存在"}}"#;
        match parse_error_body(body, 400) {
            TtsError::ServiceError { code, message } => {
                assert_eq!(code, "1214");
                assert!(message.contains("音色"));
            }
            other => panic!("expected ServiceError, got {other:?}"),
        }

        // 非 JSON → Other
        assert!(matches!(
            parse_error_body("not json", 500),
            TtsError::Other(_)
        ));
    }

    // -------- 补充：extract_data 行识别 --------

    #[test]
    fn test_extract_data_variants() {
        assert_eq!(extract_data("data: hello"), Some("hello"));
        assert_eq!(extract_data("data:hello"), Some("hello"));
        assert_eq!(extract_data(": comment"), None);
        assert_eq!(extract_data(""), None);
        assert_eq!(extract_data("event: x"), None);
    }
}
