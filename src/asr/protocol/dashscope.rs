use std::collections::HashMap;

use serde::{Deserialize, Serialize};

use crate::asr::error::AsrError;

// ============================== 客户端消息类型 ==============================

/// run-task 消息
#[derive(Debug, Clone, Serialize)]
pub struct RunTaskMessage {
    pub header: RunTaskHeader,
    pub payload: RunTaskPayload,
}

#[derive(Debug, Clone, Serialize)]
pub struct RunTaskHeader {
    pub task_id: String,
    pub action: &'static str,
    pub streaming: &'static str,
}

#[derive(Debug, Clone, Serialize)]
pub struct RunTaskPayload {
    pub task_group: &'static str,
    pub task: &'static str,
    pub function: &'static str,
    pub model: String,
    pub parameters: RunTaskParameters,
    pub input: HashMap<String, ()>,
}

#[derive(Debug, Clone, Serialize)]
pub struct RunTaskParameters {
    pub format: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sample_rate: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub language_hints: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub enable_words: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub enable_punctuation_prediction: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub enable_inverse_text_normalization: Option<bool>,
}

/// finish-task 消息
#[derive(Debug, Clone, Serialize)]
pub struct FinishTaskMessage {
    pub header: FinishTaskHeader,
    pub payload: FinishTaskPayload,
}

#[derive(Debug, Clone, Serialize)]
pub struct FinishTaskHeader {
    pub task_id: String,
    pub action: &'static str,
    pub streaming: &'static str,
}

#[derive(Debug, Clone, Serialize)]
pub struct FinishTaskPayload {
    pub input: HashMap<String, ()>,
}

// ============================== 服务端事件类型 ==============================

/// 中间解析结构体：先用 Value 兜底 payload
#[derive(Debug, Deserialize)]
struct RawEvent {
    header: RawEventHeader,
    #[serde(default)]
    payload: serde_json::Value,
}

#[derive(Debug, Deserialize)]
struct RawEventHeader {
    event: String,
    #[allow(dead_code)]
    task_id: Option<String>,
    error_code: Option<String>,
    error_message: Option<String>,
}

/// 句子识别结果
#[derive(Debug, Clone, Deserialize)]
pub struct Sentence {
    pub text: String,
    pub start_time: Option<u32>,
    pub end_time: Option<u32>,
    pub confidence: Option<f64>,
    pub sentence_end: Option<bool>,
}

/// 统一的服务端事件枚举
#[derive(Debug, Clone)]
pub enum ServerEvent {
    /// task-started
    TaskStarted,
    /// result-generated，携带当前句子
    ResultGenerated(Sentence),
    /// task-finished，可能携带最终句子
    TaskFinished(Option<Sentence>),
    /// task-failed，携带错误码和错误信息
    TaskFailed { code: String, message: String },
    /// 未知事件类型
    Unexpected { event: String },
}

// ============================== 协议函数 ==============================

/// 构造 finish-task JSON 字符串
pub fn create_finish_task_message(task_id: &str) -> String {
    let msg = serde_json::json!({
        "header": {
            "task_id": task_id,
            "action": "finish-task",
            "streaming": "duplex"
        },
        "payload": {
            "input": {}
        }
    });
    msg.to_string()
}

/// 解析服务器 Text 帧内容 → ServerEvent
///
/// 两阶段解析:
/// 1. 解析为 RawEvent（header + payload: Value）
/// 2. 按 header.event 分支类型化 payload
pub fn parse_server_response(data: &str) -> Result<ServerEvent, AsrError> {
    let raw: RawEvent = serde_json::from_str(data)?;

    match raw.header.event.as_str() {
        "task-started" => Ok(ServerEvent::TaskStarted),
        "result-generated" => {
            let sentence: Sentence =
                serde_json::from_value(raw.payload["output"]["sentence"].clone())?;
            Ok(ServerEvent::ResultGenerated(sentence))
        }
        "task-finished" => {
            let sentence: Option<Sentence> = raw
                .payload
                .get("output")
                .and_then(|o| o.get("sentence"))
                .filter(|v| v.is_object())
                .and_then(|v| serde_json::from_value(v.clone()).ok());
            Ok(ServerEvent::TaskFinished(sentence))
        }
        "task-failed" => Ok(ServerEvent::TaskFailed {
            code: raw.header.error_code.unwrap_or_default(),
            message: raw.header.error_message.unwrap_or_default(),
        }),
        other => Ok(ServerEvent::Unexpected {
            event: other.to_string(),
        }),
    }
}

// ============================== 测试 ==============================

#[cfg(test)]
mod tests {
    use super::*;

    // -------- 1.1 解析服务器事件 --------

    #[test]
    fn test_p1_task_started() {
        let data = r#"{"header":{"task_id":"abc","event":"task-started"},"payload":{}}"#;
        let event = parse_server_response(data).unwrap();
        assert!(matches!(event, ServerEvent::TaskStarted));
    }

    #[test]
    fn test_p2_result_generated_full() {
        let data = r#"{
            "header": {"task_id":"abc","event":"result-generated","task_status":"Running"},
            "payload": {"output": {"sentence": {
                "text": "你好世界",
                "start_time": 1000, "end_time": 3000,
                "confidence": 0.95, "sentence_end": true
            }}}
        }"#;
        let event = parse_server_response(data).unwrap();
        match event {
            ServerEvent::ResultGenerated(s) => {
                assert_eq!(s.text, "你好世界");
                assert_eq!(s.start_time, Some(1000));
                assert_eq!(s.end_time, Some(3000));
                assert_eq!(s.confidence, Some(0.95));
                assert_eq!(s.sentence_end, Some(true));
            }
            _ => panic!("Expected ResultGenerated, got {:?}", event),
        }
    }

    #[test]
    fn test_p3_result_generated_minimal() {
        let data = r#"{"header":{"event":"result-generated"},"payload":{"output":{"sentence":{"text":"你好"}}}}"#;
        let event = parse_server_response(data).unwrap();
        match event {
            ServerEvent::ResultGenerated(s) => {
                assert_eq!(s.text, "你好");
                assert_eq!(s.start_time, None);
                assert_eq!(s.confidence, None);
                assert_eq!(s.sentence_end, None);
            }
            _ => panic!("Expected ResultGenerated"),
        }
    }

    #[test]
    fn test_p4_task_finished_with_sentence() {
        let data = r#"{
            "header": {"task_id":"abc","event":"task-finished","task_status":"Completed"},
            "payload": {"output": {"sentence": {"text":"结束","start_time":5000,"end_time":6000,"confidence":0.99}}}
        }"#;
        let event = parse_server_response(data).unwrap();
        match event {
            ServerEvent::TaskFinished(Some(s)) => {
                assert_eq!(s.text, "结束");
                assert_eq!(s.start_time, Some(5000));
                assert_eq!(s.end_time, Some(6000));
            }
            _ => panic!("Expected TaskFinished(Some)"),
        }
    }

    #[test]
    fn test_p5_task_finished_no_sentence() {
        let data = r#"{"header":{"event":"task-finished"},"payload":{"output":{}}}"#;
        let event = parse_server_response(data).unwrap();
        assert!(matches!(event, ServerEvent::TaskFinished(None)));
    }

    #[test]
    fn test_p6_task_failed() {
        let data = r#"{"header":{"event":"task-failed","error_code":"400","error_message":"Invalid audio format"}}"#;
        let event = parse_server_response(data).unwrap();
        match event {
            ServerEvent::TaskFailed { code, message } => {
                assert_eq!(code, "400");
                assert_eq!(message, "Invalid audio format");
            }
            _ => panic!("Expected TaskFailed"),
        }
    }

    #[test]
    fn test_p7_unexpected_event() {
        let data = r#"{"header":{"event":"unknown-event-type"},"payload":{}}"#;
        let event = parse_server_response(data).unwrap();
        match event {
            ServerEvent::Unexpected { event } => {
                assert_eq!(event, "unknown-event-type");
            }
            _ => panic!("Expected Unexpected"),
        }
    }

    // -------- 1.2 构造客户端消息 --------

    #[test]
    fn test_p8_finish_task_message() {
        let json = create_finish_task_message("task-123");
        let parsed: serde_json::Value = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed["header"]["task_id"], "task-123");
        assert_eq!(parsed["header"]["action"], "finish-task");
        assert_eq!(parsed["header"]["streaming"], "duplex");
        assert_eq!(parsed["payload"]["input"], serde_json::json!({}));
    }

    // -------- 1.3 RunTaskMessage 序列化 --------

    #[test]
    fn test_p9_run_task_message_full() {
        let msg = RunTaskMessage {
            header: RunTaskHeader {
                task_id: "tid-1".into(),
                action: "run-task",
                streaming: "duplex",
            },
            payload: RunTaskPayload {
                task_group: "audio",
                task: "asr",
                function: "recognition",
                model: "paraformer-realtime-v2".into(),
                parameters: RunTaskParameters {
                    format: "mp3".into(),
                    sample_rate: Some(16000),
                    language_hints: Some(vec!["zh".into()]),
                    enable_words: Some(true),
                    enable_punctuation_prediction: Some(true),
                    enable_inverse_text_normalization: Some(true),
                },
                input: HashMap::new(),
            },
        };
        let json = serde_json::to_value(&msg).unwrap();
        assert_eq!(json["header"]["action"], "run-task");
        assert_eq!(json["payload"]["model"], "paraformer-realtime-v2");
        assert_eq!(json["payload"]["parameters"]["format"], "mp3");
        assert_eq!(json["payload"]["parameters"]["sample_rate"], 16000);
        assert_eq!(json["payload"]["parameters"]["language_hints"][0], "zh");
        assert_eq!(json["payload"]["parameters"]["enable_words"], true);
        assert_eq!(json["payload"]["input"], serde_json::json!({}));
    }

    #[test]
    fn test_p10_run_task_message_minimal() {
        let msg = RunTaskMessage {
            header: RunTaskHeader {
                task_id: "tid-2".into(),
                action: "run-task",
                streaming: "duplex",
            },
            payload: RunTaskPayload {
                task_group: "audio",
                task: "asr",
                function: "recognition",
                model: "m".into(),
                parameters: RunTaskParameters {
                    format: "wav".into(),
                    sample_rate: None,
                    language_hints: None,
                    enable_words: None,
                    enable_punctuation_prediction: None,
                    enable_inverse_text_normalization: None,
                },
                input: HashMap::new(),
            },
        };
        let json = serde_json::to_value(&msg).unwrap();
        let params = &json["payload"]["parameters"];
        assert_eq!(params["format"], "wav");
        assert!(params.get("sample_rate").is_none());
        assert!(params.get("language_hints").is_none());
        assert!(params.get("enable_words").is_none());
        assert!(params.get("enable_punctuation_prediction").is_none());
        assert!(params.get("enable_inverse_text_normalization").is_none());
    }

    // -------- 1.4 边界和错误场景 --------

    #[test]
    fn test_p11_null_optional_fields() {
        let data = r#"{"header":{"event":"result-generated"},"payload":{"output":{"sentence":{
            "text":"hello","start_time":null,"confidence":null,"sentence_end":null
        }}}}"#;
        let event = parse_server_response(data).unwrap();
        match event {
            ServerEvent::ResultGenerated(s) => {
                assert_eq!(s.text, "hello");
                assert_eq!(s.start_time, None);
                assert_eq!(s.confidence, None);
                assert_eq!(s.sentence_end, None);
            }
            _ => panic!("Expected ResultGenerated"),
        }
    }

    #[test]
    fn test_p12_unicode_text() {
        let data = r#"{"header":{"event":"result-generated"},"payload":{"output":{"sentence":{"text":"こんにちは世界🌍"}}}}"#;
        let event = parse_server_response(data).unwrap();
        match event {
            ServerEvent::ResultGenerated(s) => {
                assert_eq!(s.text, "こんにちは世界🌍");
            }
            _ => panic!("Expected ResultGenerated"),
        }
    }

    #[test]
    fn test_p13_confidence_boundaries() {
        // 1.0
        let data = r#"{"header":{"event":"result-generated"},"payload":{"output":{"sentence":{"text":"a","confidence":1.0}}}}"#;
        let event = parse_server_response(data).unwrap();
        match event {
            ServerEvent::ResultGenerated(s) => {
                assert!((s.confidence.unwrap() - 1.0).abs() < 1e-10);
            }
            _ => panic!("Expected ResultGenerated"),
        }

        // 0.0
        let data = r#"{"header":{"event":"result-generated"},"payload":{"output":{"sentence":{"text":"a","confidence":0.0}}}}"#;
        let event = parse_server_response(data).unwrap();
        match event {
            ServerEvent::ResultGenerated(s) => {
                assert!((s.confidence.unwrap() - 0.0).abs() < 1e-10);
            }
            _ => panic!("Expected ResultGenerated"),
        }
    }

    #[test]
    fn test_p14_extra_unknown_fields() {
        let data = r#"{
            "header":{"event":"result-generated"},
            "payload":{"output":{"sentence":{"text":"hello"}},"usage":{"duration":5000}}
        }"#;
        let event = parse_server_response(data).unwrap();
        assert!(matches!(event, ServerEvent::ResultGenerated(s) if s.text == "hello"));
    }

    #[test]
    fn test_p15_empty_input() {
        let result = parse_server_response("");
        assert!(result.is_err());
    }

    #[test]
    fn test_p16_malformed_json() {
        let result = parse_server_response("not json at all");
        assert!(result.is_err());
    }

    #[test]
    fn test_p17_missing_required_field() {
        let data =
            r#"{"header":{"event":"result-generated"},"payload":{"output":{"sentence":{}}}}"#;
        let result = parse_server_response(data);
        assert!(result.is_err());
    }

    #[test]
    fn test_p18_empty_text() {
        let data = r#"{"header":{"event":"result-generated"},"payload":{"output":{"sentence":{"text":""}}}}"#;
        let event = parse_server_response(data).unwrap();
        match event {
            ServerEvent::ResultGenerated(s) => {
                assert_eq!(s.text, "");
            }
            _ => panic!("Expected ResultGenerated"),
        }
    }
}
