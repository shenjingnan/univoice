use crate::tts::error::TtsError;

// ============================== 客户端消息类型 ==============================

/// run-task 消息参数
#[derive(Debug, Clone)]
pub struct TtsRunTaskParams {
    pub model: String,
    pub voice: String,
    pub format: String,
    pub sample_rate: Option<u32>,
    pub volume: Option<u32>,
    pub rate: Option<f32>,
    pub pitch: Option<f32>,
}

/// continue-task 消息参数
#[derive(Debug, Clone)]
pub struct TtsContinueTaskParams {
    pub task_id: String,
    pub text: String,
}

// ============================== 服务端事件类型 ==============================

/// 服务端句子信息
#[derive(Debug, Clone)]
pub struct TtsSentence {
    pub index: u32,
    pub begin_time: Option<u64>,
    pub end_time: Option<u64>,
    pub text: Option<String>,
}

/// 任务用量
#[derive(Debug, Clone)]
pub struct TtsUsage {
    pub characters: Option<u32>,
    pub duration: Option<u32>,
}

/// 统一的服务端事件枚举
#[derive(Debug, Clone)]
pub enum TtsServerEvent {
    /// task-started — 任务已接受
    TaskStarted,

    /// result-generated — 句子状态通知
    ResultGenerated {
        output_type: String,
        sentence: TtsSentence,
    },

    /// task-finished — 任务正常完成
    TaskFinished { usage: Option<TtsUsage> },

    /// task-failed — 任务失败
    TaskFailed { code: String, message: String },

    /// 未知事件类型
    Unexpected { event: String },
}

// ============================== 中间解析结构体 ==============================

#[derive(Debug, serde::Deserialize)]
struct RawEvent {
    header: RawEventHeader,
    #[serde(default)]
    payload: serde_json::Value,
}

#[derive(Debug, serde::Deserialize)]
struct RawEventHeader {
    event: String,
    #[allow(dead_code)]
    task_id: Option<String>,
    error_code: Option<String>,
    error_message: Option<String>,
}

#[derive(Debug, serde::Deserialize)]
struct RawSentence {
    index: Option<u32>,
    begin_time: Option<u64>,
    end_time: Option<u64>,
    text: Option<String>,
}

#[derive(Debug, serde::Deserialize)]
struct RawUsage {
    characters: Option<u32>,
    duration: Option<u32>,
}

// ============================== 协议函数 ==============================

/// 构造 run-task JSON 字符串
pub fn create_run_task_message(task_id: &str, params: &TtsRunTaskParams) -> String {
    let mut parameters = serde_json::json!({
        "text_type": "PlainText",
        "voice": params.voice,
        "format": params.format,
    });

    if let Some(sample_rate) = params.sample_rate {
        parameters["sample_rate"] = serde_json::json!(sample_rate);
    }
    if let Some(volume) = params.volume {
        parameters["volume"] = serde_json::json!(volume);
    }
    if let Some(rate) = params.rate {
        parameters["rate"] = serde_json::json!(rate);
    }
    if let Some(pitch) = params.pitch {
        parameters["pitch"] = serde_json::json!(pitch);
    }

    let msg = serde_json::json!({
        "header": {
            "task_id": task_id,
            "action": "run-task",
            "streaming": "duplex"
        },
        "payload": {
            "task_group": "audio",
            "task": "tts",
            "function": "SpeechSynthesizer",
            "model": params.model,
            "parameters": parameters,
            "input": {}
        }
    });
    msg.to_string()
}

/// 构造 continue-task JSON 字符串
pub fn create_continue_task_message(task_id: &str, text: &str) -> String {
    let msg = serde_json::json!({
        "header": {
            "task_id": task_id,
            "action": "continue-task",
            "streaming": "duplex"
        },
        "payload": {
            "input": {
                "text": text
            }
        }
    });
    msg.to_string()
}

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

/// 解析服务器 Text 帧内容 → TtsServerEvent
///
/// 两阶段解析:
/// 1. 解析为 RawEvent（header + payload: Value）
/// 2. 按 header.event 分支类型化 payload
pub fn parse_server_response(data: &str) -> Result<TtsServerEvent, TtsError> {
    let raw: RawEvent = serde_json::from_str(data)?;

    match raw.header.event.as_str() {
        "task-started" => Ok(TtsServerEvent::TaskStarted),
        "result-generated" => {
            let output = &raw.payload["output"];
            let output_type = output["type"].as_str().unwrap_or("").to_string();
            let sentence_val = &output["sentence"];
            let sentence: RawSentence =
                serde_json::from_value(sentence_val.clone()).unwrap_or(RawSentence {
                    index: None,
                    begin_time: None,
                    end_time: None,
                    text: None,
                });
            Ok(TtsServerEvent::ResultGenerated {
                output_type,
                sentence: TtsSentence {
                    index: sentence.index.unwrap_or(0),
                    begin_time: sentence.begin_time,
                    end_time: sentence.end_time,
                    text: sentence.text,
                },
            })
        }
        "task-finished" => {
            let usage = raw.payload.get("usage").map(|u| {
                let ru: RawUsage = serde_json::from_value(u.clone()).unwrap_or(RawUsage {
                    characters: None,
                    duration: None,
                });
                TtsUsage {
                    characters: ru.characters,
                    duration: ru.duration,
                }
            });
            Ok(TtsServerEvent::TaskFinished { usage })
        }
        "task-failed" => Ok(TtsServerEvent::TaskFailed {
            code: raw.header.error_code.unwrap_or_default(),
            message: raw.header.error_message.unwrap_or_default(),
        }),
        other => Ok(TtsServerEvent::Unexpected {
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
        assert!(matches!(event, TtsServerEvent::TaskStarted));
    }

    #[test]
    fn test_p2_task_started_extra_fields() {
        let data = r#"{"header":{"task_id":"abc","event":"task-started","task_status":"Running"},"payload":{"extra":"data"}}"#;
        let event = parse_server_response(data).unwrap();
        assert!(matches!(event, TtsServerEvent::TaskStarted));
    }

    #[test]
    fn test_p3_result_generated_sentence_begin() {
        let data = r#"{
            "header": {"task_id":"abc","event":"result-generated","task_status":"Running"},
            "payload": {"output": {
                "type": "sentence-begin",
                "sentence": {"index": 0, "begin_time": 100}
            }}
        }"#;
        let event = parse_server_response(data).unwrap();
        match event {
            TtsServerEvent::ResultGenerated {
                output_type,
                sentence,
            } => {
                assert_eq!(output_type, "sentence-begin");
                assert_eq!(sentence.index, 0);
                assert_eq!(sentence.begin_time, Some(100));
                assert_eq!(sentence.end_time, None);
                assert_eq!(sentence.text, None);
            }
            _ => panic!("Expected ResultGenerated, got {:?}", event),
        }
    }

    #[test]
    fn test_p4_result_generated_sentence_synthesis() {
        let data = r#"{
            "header": {"task_id":"abc","event":"result-generated","task_status":"Running"},
            "payload": {"output": {
                "type": "sentence-synthesis",
                "sentence": {"index": 0, "text": "正在合成"}
            }}
        }"#;
        let event = parse_server_response(data).unwrap();
        match event {
            TtsServerEvent::ResultGenerated {
                output_type,
                sentence,
            } => {
                assert_eq!(output_type, "sentence-synthesis");
                assert_eq!(sentence.text, Some("正在合成".into()));
            }
            _ => panic!("Expected ResultGenerated"),
        }
    }

    #[test]
    fn test_p5_result_generated_sentence_end_full() {
        let data = r#"{
            "header": {"task_id":"abc","event":"result-generated","task_status":"Running"},
            "payload": {"output": {
                "type": "sentence-end",
                "sentence": {"index": 1, "begin_time": 200, "end_time": 3000, "text": "你好世界"}
            }}
        }"#;
        let event = parse_server_response(data).unwrap();
        match event {
            TtsServerEvent::ResultGenerated {
                output_type,
                sentence,
            } => {
                assert_eq!(output_type, "sentence-end");
                assert_eq!(sentence.index, 1);
                assert_eq!(sentence.begin_time, Some(200));
                assert_eq!(sentence.end_time, Some(3000));
                assert_eq!(sentence.text, Some("你好世界".into()));
            }
            _ => panic!("Expected ResultGenerated"),
        }
    }

    #[test]
    fn test_p6_result_generated_sentence_end_minimal() {
        let data = r#"{
            "header": {"task_id":"abc","event":"result-generated","task_status":"Running"},
            "payload": {"output": {
                "type": "sentence-end",
                "sentence": {"index": 0}
            }}
        }"#;
        let event = parse_server_response(data).unwrap();
        match event {
            TtsServerEvent::ResultGenerated {
                output_type,
                sentence,
            } => {
                assert_eq!(output_type, "sentence-end");
                assert_eq!(sentence.begin_time, None);
                assert_eq!(sentence.end_time, None);
                assert_eq!(sentence.text, None);
            }
            _ => panic!("Expected ResultGenerated"),
        }
    }

    #[test]
    fn test_p7_task_finished_full() {
        let data = r#"{
            "header": {"task_id":"abc","event":"task-finished","task_status":"Completed"},
            "payload": {"usage": {"characters": 100, "duration": 5000}}
        }"#;
        let event = parse_server_response(data).unwrap();
        match event {
            TtsServerEvent::TaskFinished { usage } => {
                let usage = usage.unwrap();
                assert_eq!(usage.characters, Some(100));
                assert_eq!(usage.duration, Some(5000));
            }
            _ => panic!("Expected TaskFinished"),
        }
    }

    #[test]
    fn test_p8_task_finished_no_usage() {
        let data = r#"{"header":{"task_id":"abc","event":"task-finished"},"payload":{}}"#;
        let event = parse_server_response(data).unwrap();
        assert!(matches!(
            event,
            TtsServerEvent::TaskFinished { usage: None }
        ));
    }

    #[test]
    fn test_p9_task_failed() {
        let data = r#"{"header":{"event":"task-failed","error_code":"400","error_message":"rate limit"},"payload":{}}"#;
        let event = parse_server_response(data).unwrap();
        match event {
            TtsServerEvent::TaskFailed { code, message } => {
                assert_eq!(code, "400");
                assert_eq!(message, "rate limit");
            }
            _ => panic!("Expected TaskFailed"),
        }
    }

    #[test]
    fn test_p10_task_failed_empty_message() {
        let data = r#"{"header":{"event":"task-failed","error_code":"500","error_message":""},"payload":{}}"#;
        let event = parse_server_response(data).unwrap();
        match event {
            TtsServerEvent::TaskFailed { code, message } => {
                assert_eq!(code, "500");
                assert_eq!(message, "");
            }
            _ => panic!("Expected TaskFailed"),
        }
    }

    // -------- 1.2 边界与错误场景 --------

    #[test]
    fn test_p11_unexpected_event() {
        let data = r#"{"header":{"event":"unknown-event-type"},"payload":{}}"#;
        let event = parse_server_response(data).unwrap();
        match event {
            TtsServerEvent::Unexpected { event } => {
                assert_eq!(event, "unknown-event-type");
            }
            _ => panic!("Expected Unexpected"),
        }
    }

    #[test]
    fn test_p12_empty_input() {
        let result = parse_server_response("");
        assert!(result.is_err());
    }

    #[test]
    fn test_p13_malformed_json() {
        let result = parse_server_response("not json at all");
        assert!(result.is_err());
    }

    #[test]
    fn test_p14_missing_required_field() {
        let data = r#"{}"#;
        let result = parse_server_response(data);
        assert!(result.is_err());
    }

    #[test]
    fn test_p15_unicode_text() {
        let data = r#"{
            "header": {"task_id":"abc","event":"result-generated","task_status":"Running"},
            "payload": {"output": {
                "type": "sentence-end",
                "sentence": {"index": 0, "text": "こんにちは世界🌍"}
            }}
        }"#;
        let event = parse_server_response(data).unwrap();
        match event {
            TtsServerEvent::ResultGenerated { sentence, .. } => {
                assert_eq!(sentence.text, Some("こんにちは世界🌍".into()));
            }
            _ => panic!("Expected ResultGenerated"),
        }
    }

    #[test]
    fn test_p16_long_text() {
        let long_text = "a".repeat(10000);
        let data = format!(
            r#"{{"header":{{"task_id":"abc","event":"result-generated","task_status":"Running"}},"payload":{{"output":{{"type":"sentence-end","sentence":{{"index":0,"text":"{}"}}}}}}}}"#,
            long_text
        );
        let event = parse_server_response(&data).unwrap();
        match event {
            TtsServerEvent::ResultGenerated { sentence, .. } => {
                assert_eq!(sentence.text, Some(long_text));
            }
            _ => panic!("Expected ResultGenerated"),
        }
    }

    #[test]
    fn test_p17_empty_payload() {
        let data = r#"{"header":{"event":"result-generated"},"payload":{}}"#;
        let event = parse_server_response(data).unwrap();
        match event {
            TtsServerEvent::ResultGenerated { output_type, .. } => {
                assert_eq!(output_type, "");
            }
            _ => panic!("Expected ResultGenerated"),
        }
    }

    #[test]
    fn test_p18_extra_unknown_fields() {
        let data = r#"{
            "header": {"task_id":"abc","event":"result-generated","task_status":"Running"},
            "payload": {"output": {
                "type": "sentence-end",
                "sentence": {"index": 0, "text": "hello"}
            }, "usage": {"characters": 5, "duration": 1000}}
        }"#;
        let event = parse_server_response(data).unwrap();
        match event {
            TtsServerEvent::ResultGenerated { sentence, .. } => {
                assert_eq!(sentence.text, Some("hello".into()));
            }
            _ => panic!("Expected ResultGenerated"),
        }
    }

    #[test]
    fn test_p19_unknown_task_status() {
        let data = r#"{
            "header": {"task_id":"abc","event":"result-generated","task_status":"UnknownStatus"},
            "payload": {"output": {
                "type": "sentence-end",
                "sentence": {"index": 0, "text": "ok"}
            }}
        }"#;
        let event = parse_server_response(data).unwrap();
        assert!(matches!(event, TtsServerEvent::ResultGenerated { .. }));
    }

    // -------- 1.3 构造客户端消息 --------

    #[test]
    fn test_p20_run_task_full() {
        let params = TtsRunTaskParams {
            model: "cosyvoice-v3-flash".into(),
            voice: "longxiaochun_v3".into(),
            format: "mp3".into(),
            sample_rate: Some(24000),
            volume: Some(50),
            rate: Some(1.0),
            pitch: Some(1.0),
        };
        let json = create_run_task_message("tid-1", &params);
        let parsed: serde_json::Value = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed["header"]["action"], "run-task");
        assert_eq!(parsed["header"]["streaming"], "duplex");
        assert_eq!(parsed["payload"]["task_group"], "audio");
        assert_eq!(parsed["payload"]["task"], "tts");
        assert_eq!(parsed["payload"]["function"], "SpeechSynthesizer");
        assert_eq!(parsed["payload"]["model"], "cosyvoice-v3-flash");
        assert_eq!(parsed["payload"]["parameters"]["text_type"], "PlainText");
        assert_eq!(parsed["payload"]["parameters"]["voice"], "longxiaochun_v3");
        assert_eq!(parsed["payload"]["parameters"]["format"], "mp3");
        assert_eq!(parsed["payload"]["parameters"]["sample_rate"], 24000);
        assert_eq!(parsed["payload"]["parameters"]["volume"], 50);
        assert_eq!(parsed["payload"]["parameters"]["rate"], 1.0);
        assert_eq!(parsed["payload"]["parameters"]["pitch"], 1.0);
        assert_eq!(parsed["payload"]["input"], serde_json::json!({}));
    }

    #[test]
    fn test_p21_run_task_minimal() {
        let params = TtsRunTaskParams {
            model: "m".into(),
            voice: "v".into(),
            format: "wav".into(),
            sample_rate: None,
            volume: None,
            rate: None,
            pitch: None,
        };
        let json = create_run_task_message("tid-2", &params);
        let parsed: serde_json::Value = serde_json::from_str(&json).unwrap();
        let params_json = &parsed["payload"]["parameters"];
        assert_eq!(params_json["format"], "wav");
        assert!(params_json.get("sample_rate").is_none());
        assert!(params_json.get("volume").is_none());
        assert!(params_json.get("rate").is_none());
        assert!(params_json.get("pitch").is_none());
    }

    #[test]
    fn test_p22_continue_task_normal() {
        let json = create_continue_task_message("tid-1", "你好世界");
        let parsed: serde_json::Value = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed["header"]["action"], "continue-task");
        assert_eq!(parsed["payload"]["input"]["text"], "你好世界");
    }

    #[test]
    fn test_p23_continue_task_empty() {
        let json = create_continue_task_message("tid-1", "");
        let parsed: serde_json::Value = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed["payload"]["input"]["text"], "");
    }

    #[test]
    fn test_p24_continue_task_special_chars() {
        let json = create_continue_task_message("tid-1", "line1\nline2\"quote\"");
        let parsed: serde_json::Value = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed["payload"]["input"]["text"], "line1\nline2\"quote\"");
    }

    #[test]
    fn test_p25_finish_task() {
        let json = create_finish_task_message("tid-1");
        let parsed: serde_json::Value = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed["header"]["action"], "finish-task");
        assert_eq!(parsed["header"]["streaming"], "duplex");
        assert_eq!(parsed["payload"]["input"], serde_json::json!({}));
    }
}
