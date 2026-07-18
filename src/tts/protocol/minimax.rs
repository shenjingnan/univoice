//! MiniMax TTS 协议层（HTTP + SSE）
//!
//! 基于 MiniMax T2A V2 HTTP REST API：
//! - 非流式：`POST /v1/t2a_v2` 直接返回 JSON（含 hex 编码音频）
//! - 流式：`POST /v1/t2a_v2` + `stream: true` 返回 SSE 事件流
//!
//! 对应 TypeScript 端的 `src/tts/protocols/minimax.ts` WebSocket 实现，
//! 但这里采用 HTTP 方案（WS 的双向流式对 Minimax 无实际加速效果）。
//!
//! 参考 `super::glm` 的 HTTP SSE 模式。

use serde::{Deserialize, Serialize};

use crate::tts::error::TtsError;

// ============================== 常量 ==============================

/// MiniMax TTS 默认 HTTP 端点
pub const MINIMAX_DEFAULT_BASE_URL: &str = "https://api.minimaxi.com/v1/t2a_v2";
/// 备用地址（中国大陆优化）
pub const MINIMAX_BACKUP_BASE_URL: &str = "https://api-bj.minimaxi.com/v1/t2a_v2";
/// MiniMax TTS 默认模型
pub const MINIMAX_DEFAULT_MODEL: &str = "speech-2.8-hd";
/// MiniMax TTS 默认音色（中文青春男声）
pub const MINIMAX_DEFAULT_VOICE: &str = "male-qn-qingse";

// ============================== 请求体 ==============================

/// MiniMax TTS 请求体
#[derive(Debug, Serialize)]
pub struct MinimaxTtsRequest {
    pub model: String,
    pub text: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stream: Option<bool>,
    pub voice_setting: VoiceSetting,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub audio_setting: Option<AudioSetting>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub language_boost: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub subtitle_enable: Option<bool>,
}

/// 语音设置
#[derive(Debug, Serialize)]
pub struct VoiceSetting {
    pub voice_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub speed: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub vol: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pitch: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub emotion: Option<String>,
}

/// 音频设置
#[derive(Debug, Serialize)]
pub struct AudioSetting {
    pub format: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sample_rate: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bitrate: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub channel: Option<u32>,
}

// ============================== 响应体 ==============================

/// MiniMax TTS 响应（同时用于非流式 JSON 和 SSE 的 data 行）
#[derive(Debug, Deserialize)]
pub struct MinimaxResponse {
    #[serde(default)]
    pub data: Option<ResponseData>,
    #[serde(default)]
    pub trace_id: Option<String>,
    #[serde(default)]
    pub extra_info: Option<ExtraInfo>,
    #[serde(default)]
    pub base_resp: Option<BaseResp>,
}

/// 响应数据
#[derive(Debug, Deserialize)]
pub struct ResponseData {
    #[serde(default)]
    pub audio: Option<String>,
    #[serde(default)]
    pub status: Option<i32>,
}

/// 额外信息
#[derive(Debug, Deserialize)]
#[allow(dead_code)]
pub struct ExtraInfo {
    pub audio_length: Option<i64>,
    pub audio_sample_rate: Option<i64>,
    pub audio_size: Option<i64>,
    pub bitrate: Option<i64>,
    pub word_count: Option<i64>,
    pub usage_characters: Option<i64>,
    pub audio_format: Option<String>,
    pub audio_channel: Option<i64>,
}

/// 基础响应状态
#[derive(Debug, Deserialize)]
pub struct BaseResp {
    pub status_code: i32,
    #[serde(default)]
    pub status_msg: Option<String>,
}

// ============================== SSE 解析 ==============================

/// SSE 单帧 data 行解析后的事件
#[derive(Debug)]
pub enum MinimaxStreamEvent {
    /// hex 解码后的音频块
    Audio(Vec<u8>),
    /// 合成完成（status=2）
    Finished,
    /// 业务错误（base_resp.status_code != 0）
    Error(TtsError),
}

/// SSE 行解析器：累积字节流，按 `\n` 切分出完整行
///
/// 同 `super::glm::SseLineParser`，此处独立复制避免跨模块耦合。
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

/// 解析一帧 `data:` 负载为 `MinimaxStreamEvent`
///
/// 返回 `Ok(None)` 表示该帧无有效音频且未结束。
pub fn parse_data(data: &str) -> Result<Option<MinimaxStreamEvent>, TtsError> {
    let data = data.trim();
    if data.is_empty() {
        return Ok(None);
    }

    let resp: MinimaxResponse = serde_json::from_str(data)?;

    // 检查业务错误
    if let Some(base) = &resp.base_resp {
        if base.status_code != 0 {
            return Ok(Some(MinimaxStreamEvent::Error(TtsError::ServiceError {
                code: base.status_code.to_string(),
                message: base
                    .status_msg
                    .clone()
                    .unwrap_or_else(|| format!("status_code={}", base.status_code)),
            })));
        }
    }

    // 检查 data 字段
    let response_data = match resp.data {
        Some(d) => d,
        None => return Ok(None),
    };

    // status=2 表示合成结束
    if response_data.status == Some(2) {
        return Ok(Some(MinimaxStreamEvent::Finished));
    }

    // 解码音频
    if let Some(hex) = &response_data.audio {
        if !hex.is_empty() {
            let audio = decode_hex_audio(hex)?;
            if !audio.is_empty() {
                return Ok(Some(MinimaxStreamEvent::Audio(audio)));
            }
        }
    }

    Ok(None)
}

/// 解码 hex 编码的音频数据
pub(crate) fn decode_hex_audio(hex: &str) -> Result<Vec<u8>, TtsError> {
    let hex = hex.trim();
    if hex.is_empty() {
        return Ok(Vec::new());
    }
    // hex 字符串可能包含小写字母，标准 hex 编码长度为偶数
    if hex.len() % 2 != 0 {
        return Err(TtsError::Other(format!(
            "Minimax hex audio has odd length: {}",
            hex.len()
        )));
    }
    (0..hex.len())
        .step_by(2)
        .map(|i| {
            u8::from_str_radix(&hex[i..i + 2], 16).map_err(|e| {
                TtsError::Other(format!("Minimax hex decode error at position {}: {}", i, e))
            })
        })
        .collect()
}

/// 解析 HTTP 错误响应体为 `TtsError`
///
/// MiniMax 错误格式：`{ "base_resp": { "status_code": 1004, "status_msg": "..." } }`
pub fn parse_error_body(body: &str, status: u16) -> TtsError {
    if let Ok(resp) = serde_json::from_str::<MinimaxResponse>(body) {
        if let Some(base) = resp.base_resp {
            if base.status_code != 0 {
                return TtsError::ServiceError {
                    code: base.status_code.to_string(),
                    message: base.status_msg.unwrap_or_else(|| format!("HTTP {status}")),
                };
            }
        }
    }
    TtsError::Other(format!("Minimax TTS HTTP {status}: {body}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    // ============ 请求体序列化 ============

    #[test]
    fn test_m1_request_serialize_minimal() {
        let req = MinimaxTtsRequest {
            model: "speech-2.8-hd".into(),
            text: "你好".into(),
            stream: None,
            voice_setting: VoiceSetting {
                voice_id: "male-qn-qingse".into(),
                speed: None,
                vol: None,
                pitch: None,
                emotion: None,
            },
            audio_setting: None,
            language_boost: None,
            subtitle_enable: None,
        };
        let json = serde_json::to_string(&req).unwrap();
        assert!(json.contains(r#""model":"speech-2.8-hd""#));
        assert!(json.contains(r#""text":"你好""#));
        assert!(json.contains(r#""voice_id":"male-qn-qingse""#));
        // stream=None → 不出现
        assert!(!json.contains("stream"));
        // audio_setting=None → 不出现
        assert!(!json.contains("audio_setting"));
    }

    #[test]
    fn test_m2_request_serialize_full() {
        let req = MinimaxTtsRequest {
            model: "speech-2.8-hd".into(),
            text: "hello".into(),
            stream: Some(true),
            voice_setting: VoiceSetting {
                voice_id: "female-shaonv".into(),
                speed: Some(1.2),
                vol: Some(5.0),
                pitch: Some(2),
                emotion: Some("happy".into()),
            },
            audio_setting: Some(AudioSetting {
                format: "mp3".into(),
                sample_rate: Some(24000),
                bitrate: Some(128000),
                channel: Some(1),
            }),
            language_boost: Some("Chinese".into()),
            subtitle_enable: Some(true),
        };
        let json = serde_json::to_string(&req).unwrap();
        assert!(json.contains(r#""stream":true"#));
        assert!(json.contains(r#""speed":1.2"#));
        assert!(json.contains(r#""vol":5.0"#));
        assert!(json.contains(r#""pitch":2"#));
        assert!(json.contains(r#""emotion":"happy""#));
        assert!(json.contains(r#""sample_rate":24000"#));
        assert!(json.contains(r#""bitrate":128000"#));
        assert!(json.contains(r#""channel":1"#));
        assert!(json.contains(r#""language_boost":"Chinese""#));
        assert!(json.contains(r#""subtitle_enable":true"#));
    }

    // ============ 响应体反序列化 ============

    #[test]
    fn test_m3_response_deserialize_success() {
        let json = r#"{
            "data": { "audio": "48656c6c6f", "status": 2 },
            "base_resp": { "status_code": 0, "status_msg": "success" }
        }"#;
        let resp: MinimaxResponse = serde_json::from_str(json).unwrap();
        assert!(resp.data.is_some());
        assert_eq!(
            resp.data.as_ref().unwrap().audio.as_deref(),
            Some("48656c6c6f")
        );
        assert_eq!(resp.data.as_ref().unwrap().status, Some(2));
        assert_eq!(resp.base_resp.as_ref().unwrap().status_code, 0);
    }

    #[test]
    fn test_m4_response_deserialize_error() {
        let json = r#"{
            "base_resp": { "status_code": 1004, "status_msg": "鉴权失败" }
        }"#;
        let resp: MinimaxResponse = serde_json::from_str(json).unwrap();
        assert!(resp.data.is_none());
        let base = resp.base_resp.unwrap();
        assert_eq!(base.status_code, 1004);
    }

    #[test]
    fn test_m5_response_data_null() {
        let json = r#"{"data": null, "base_resp": { "status_code": 0, "status_msg": "success" }}"#;
        let resp: MinimaxResponse = serde_json::from_str(json).unwrap();
        assert!(resp.data.is_none());
    }

    // ============ hex 编解码 ============

    #[test]
    fn test_m6_decode_hex() {
        // "48656c6c6f" hex → b"Hello"
        let result = decode_hex_audio("48656c6c6f").unwrap();
        assert_eq!(result, b"Hello");
    }

    #[test]
    fn test_m7_decode_hex_empty() {
        let result = decode_hex_audio("").unwrap();
        assert!(result.is_empty());
    }

    #[test]
    fn test_m8_decode_hex_odd_length() {
        let result = decode_hex_audio("48656c6c6");
        assert!(result.is_err());
    }

    // ============ SSE 事件解析 ============

    #[test]
    fn test_m9_parse_audio_event() {
        // "48656c6c6f" = "Hello"
        let data = r#"{"data":{"audio":"48656c6c6f","status":1},"base_resp":{"status_code":0}}"#;
        match parse_data(data).unwrap().unwrap() {
            MinimaxStreamEvent::Audio(bytes) => assert_eq!(bytes, b"Hello"),
            other => panic!("expected Audio, got {:?}", other),
        }
    }

    #[test]
    fn test_m10_parse_finished_event() {
        let data = r#"{"data":{"audio":"","status":2},"base_resp":{"status_code":0,"status_msg":"success"}}"#;
        match parse_data(data).unwrap().unwrap() {
            MinimaxStreamEvent::Finished => {} // ok
            other => panic!("expected Finished, got {:?}", other),
        }
    }

    #[test]
    fn test_m11_parse_error_event() {
        let data = r#"{"base_resp":{"status_code":1004,"status_msg":"鉴权失败"}}"#;
        match parse_data(data).unwrap().unwrap() {
            MinimaxStreamEvent::Error(err) => {
                assert!(err.to_string().contains("1004"));
            }
            other => panic!("expected Error, got {:?}", other),
        }
    }

    #[test]
    fn test_m12_parse_empty_data() {
        assert!(parse_data("").unwrap().is_none());
    }

    // ============ SSE 行解析器 ============

    #[test]
    fn test_m13_parser_cross_chunk() {
        let mut parser = SseLineParser::new();
        let lines = parser.push(b"data: {\"data\"");
        assert!(lines.is_empty(), "不完整行不应产出");

        let lines = parser.push(b":{\"audio\":\"00\"},\"base_resp\":{\"status_code\":0}}\n\n");
        assert_eq!(lines.len(), 2);
        assert!(lines[0].starts_with("data:"));
        assert!(lines[1].is_empty());
    }

    #[test]
    fn test_m14_parser_flush_tail() {
        let mut parser = SseLineParser::new();
        parser.push(b"data: {\"data\":{\"audio\":\"00\"},\"base_resp\":{\"status_code\":0}}");
        let tail = parser.flush();
        assert_eq!(tail.len(), 1);
        assert!(tail[0].starts_with("data:"));
    }

    // ============ extract_data ============

    #[test]
    fn test_m15_extract_data() {
        assert_eq!(extract_data("data: hello"), Some("hello"));
        assert_eq!(extract_data("data:hello"), Some("hello"));
        assert_eq!(extract_data(": comment"), None);
        assert_eq!(extract_data(""), None);
    }

    // ============ parse_error_body ============

    #[test]
    fn test_m16_parse_error_body() {
        let body = r#"{"base_resp":{"status_code":1004,"status_msg":"鉴权失败"}}"#;
        match parse_error_body(body, 401) {
            TtsError::ServiceError { code, message } => {
                assert_eq!(code, "1004");
                assert!(message.contains("鉴权"));
            }
            other => panic!("expected ServiceError, got {other:?}"),
        }

        // 非 JSON → Other
        assert!(matches!(
            parse_error_body("not json", 500),
            TtsError::Other(_)
        ));
    }
}
