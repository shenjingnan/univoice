//! DashScope Realtime TTS WebSocket API 协议实现
//!
//! 参考: https://help.aliyun.com/zh/model-studio/developer-reference/tts-realtime-api
//!
//! 与 CosyVoice API (`dashscope.rs`) 的区别:
//! - 端点: `wss://dashscope.aliyuncs.com/api-ws/v1/realtime?model=xxx`
//! - 消息格式: 事件类型 + JSON 结构（而非 header/payload）
//! - 音频通过 Base64 编码在 JSON 事件中传输（而非 Binary WebSocket 帧）
//! - 支持 instructions 指令控制功能

use std::time::Duration;

use crate::tts::error::TtsError;

// ============================== 常量 ==============================

/// DashScope Realtime TTS 默认 WebSocket 地址
pub const QWEN_REALTIME_DEFAULT_BASE_URL: &str = "wss://dashscope.aliyuncs.com/api-ws/v1/realtime";

/// 连接超时
#[cfg(not(test))]
const CONNECT_TIMEOUT: Duration = Duration::from_secs(10);
#[cfg(test)]
pub(crate) const CONNECT_TIMEOUT: Duration = Duration::from_secs(1);

// ============================== 交互模式 ==============================

/// Realtime 交互模式
#[derive(Debug, Clone, Copy, PartialEq, Default)]
pub enum RealtimeMode {
    /// 服务端自动判断合成时机（默认，推荐）
    #[default]
    ServerCommit,
    /// 客户端手动触发合成
    Commit,
}

impl RealtimeMode {
    pub fn as_str(&self) -> &'static str {
        match self {
            RealtimeMode::ServerCommit => "server_commit",
            RealtimeMode::Commit => "commit",
        }
    }
}

// ============================== 客户端事件 ==============================

/// session.update 事件参数
#[derive(Debug, Clone)]
pub struct SessionUpdateParams {
    /// 音色（必填）
    pub voice: String,
    /// 交互模式
    pub mode: RealtimeMode,
    /// 语言类型（如 "Auto", "Chinese", "English"）
    pub language_type: Option<String>,
    /// 音频格式
    pub format: String,
    /// 采样率
    pub sample_rate: u32,
    /// 比特率（仅 opus 格式可用）
    pub bitrate: Option<u32>,
    /// 指令文本（情感控制，仅 instruct 模型支持）
    pub instructions: Option<String>,
    /// 是否启用指令优化
    pub optimize_instructions: bool,
    /// 语速倍率 (0.5~2.0)
    pub speech_rate: Option<f32>,
    /// 音调倍率 (0.5~2.0)
    pub pitch_rate: Option<f32>,
}

// ============================== 服务端事件 ==============================

/// 会话信息（session.created / session.updated 中携带）
#[derive(Debug, Clone)]
pub struct SessionInfo {
    pub id: String,
    pub model: String,
    pub voice: String,
    pub mode: String,
    pub response_format: String,
    pub sample_rate: u32,
}

/// 计费信息（session.finished 中携带）
#[derive(Debug, Clone)]
pub struct UsageInfo {
    /// Qwen3-TTS Realtime 使用的字符数
    pub characters: Option<u32>,
}

/// 统一的服务端事件枚举
#[derive(Debug, Clone)]
pub enum ServerEvent {
    /// session.created — 会话已创建
    SessionCreated { session: SessionInfo },

    /// session.updated — 会话配置已更新
    SessionUpdated { session: SessionInfo },

    /// response.audio.delta — Base64 编码的音频数据块
    AudioDelta { delta: String },

    /// response.done / response.audio.done — 当前响应结束（忽略，仅标记）
    ResponseDone,

    /// session.finished — 会话正常结束
    SessionFinished { usage: Option<UsageInfo> },

    /// error — 服务端错误
    Error { code: String, message: String },

    /// 未知事件类型（忽略）
    Unexpected { event: String },
}

// ============================== 中间解析结构体 ==============================

/// 服务端事件原始解析（两阶段解析用）
#[derive(Debug, serde::Deserialize)]
struct RawServerEvent {
    #[serde(rename = "type")]
    event_type: String,
    #[serde(default)]
    error: Option<RawError>,
    #[serde(default)]
    session: Option<serde_json::Value>,
    #[serde(default)]
    delta: Option<String>,
    #[serde(default)]
    usage: Option<serde_json::Value>,
}

#[derive(Debug, serde::Deserialize)]
struct RawError {
    code: String,
    message: String,
}

#[derive(Debug, serde::Deserialize)]
struct RawSessionInfo {
    id: Option<String>,
    #[serde(default)]
    model: Option<String>,
    #[serde(default)]
    voice: Option<String>,
    #[serde(default)]
    mode: Option<String>,
    #[serde(default)]
    response_format: Option<String>,
    #[serde(default)]
    sample_rate: Option<u32>,
}

#[derive(Debug, serde::Deserialize)]
struct RawUsage {
    characters: Option<u32>,
}

// ============================== 事件创建函数 ==============================

/// 构造 session.update 的 JSON 字符串
pub fn create_session_update(params: &SessionUpdateParams) -> String {
    let mut session = serde_json::json!({
        "voice": params.voice,
        "mode": params.mode.as_str(),
        "response_format": params.format,
        "sample_rate": params.sample_rate,
    });

    if let Some(ref lang) = params.language_type {
        session["language_type"] = serde_json::json!(lang);
    }
    if let Some(bitrate) = params.bitrate {
        session["bitrate"] = serde_json::json!(bitrate);
    }
    if let Some(ref instructions) = params.instructions {
        session["instructions"] = serde_json::json!(instructions);
    }
    if params.optimize_instructions {
        session["optimize_instructions"] = serde_json::json!(true);
    }
    if let Some(rate) = params.speech_rate {
        session["speech_rate"] = serde_json::json!(rate);
    }
    if let Some(pitch) = params.pitch_rate {
        session["pitch_rate"] = serde_json::json!(pitch);
    }

    let msg = serde_json::json!({
        "event_id": format!("event_{}", uuid::Uuid::new_v4()),
        "type": "session.update",
        "session": session,
    });
    msg.to_string()
}

/// 构造 input_text_buffer.append 的 JSON 字符串
pub fn create_input_text_buffer_append(text: &str) -> String {
    let msg = serde_json::json!({
        "event_id": format!("event_{}", uuid::Uuid::new_v4()),
        "type": "input_text_buffer.append",
        "text": text,
    });
    msg.to_string()
}

/// 构造 session.finish 的 JSON 字符串
pub fn create_session_finish() -> String {
    let msg = serde_json::json!({
        "event_id": format!("event_{}", uuid::Uuid::new_v4()),
        "type": "session.finish",
    });
    msg.to_string()
}

// ============================== WebSocket 请求构建 ==============================

/// 构建带认证头和 model 查询参数的 WebSocket 请求
pub fn create_ws_request(
    base_url: &str,
    model: &str,
    api_key: &str,
) -> Result<http::Request<()>, TtsError> {
    let mut url = url::Url::parse(base_url)
        .map_err(|e| TtsError::Other(format!("Invalid WebSocket URL: {}", e)))?;
    url.query_pairs_mut().append_pair("model", model);

    let uri: http::Uri = url.as_str().parse().map_err(|e: http::uri::InvalidUri| {
        TtsError::Other(format!("Invalid WebSocket URI: {}", e))
    })?;

    let host = match uri.port() {
        Some(port) => format!("{}:{}", uri.host().unwrap_or(""), port),
        None => uri.host().unwrap_or("").to_string(),
    };

    let req = http::Request::builder()
        .uri(&uri)
        .method("GET")
        .header("Host", &host)
        .header("Upgrade", "websocket")
        .header("Connection", "Upgrade")
        .header(
            "Sec-WebSocket-Key",
            &tokio_tungstenite::tungstenite::handshake::client::generate_key(),
        )
        .header("Sec-WebSocket-Version", "13")
        .header("Authorization", &format!("Bearer {}", api_key))
        .body(())
        .map_err(|e| TtsError::Other(format!("HTTP request build error: {}", e)))?;

    Ok(req)
}

// ============================== 服务端事件解析 ==============================

/// 解析服务器 Text 帧内容 → ServerEvent
///
/// 两阶段解析:
/// 1. 解析为 RawServerEvent（type + option 字段）
/// 2. 按 event_type 分支处理
pub fn parse_server_event(data: &str) -> Result<ServerEvent, TtsError> {
    let raw: RawServerEvent = serde_json::from_str(data)?;

    match raw.event_type.as_str() {
        "error" => {
            let err = raw.error.unwrap_or(RawError {
                code: "unknown".into(),
                message: "unknown error".into(),
            });
            Ok(ServerEvent::Error {
                code: err.code,
                message: err.message,
            })
        }
        "session.created" | "session.updated" => {
            let session_info = raw
                .session
                .and_then(|v| serde_json::from_value::<RawSessionInfo>(v).ok())
                .unwrap_or(RawSessionInfo {
                    id: None,
                    model: None,
                    voice: None,
                    mode: None,
                    response_format: None,
                    sample_rate: None,
                });

            let info = SessionInfo {
                id: session_info.id.unwrap_or_default(),
                model: session_info.model.unwrap_or_default(),
                voice: session_info.voice.unwrap_or_default(),
                mode: session_info.mode.unwrap_or_default(),
                response_format: session_info.response_format.unwrap_or_default(),
                sample_rate: session_info.sample_rate.unwrap_or(0),
            };

            match raw.event_type.as_str() {
                "session.created" => Ok(ServerEvent::SessionCreated { session: info }),
                _ => Ok(ServerEvent::SessionUpdated { session: info }),
            }
        }
        "response.audio.delta" => {
            let delta = raw.delta.unwrap_or_default();
            Ok(ServerEvent::AudioDelta { delta })
        }
        "response.done" | "response.audio.done" => Ok(ServerEvent::ResponseDone),
        "session.finished" => {
            let usage = raw.usage.and_then(|v| {
                serde_json::from_value::<RawUsage>(v)
                    .ok()
                    .map(|u| UsageInfo {
                        characters: u.characters,
                    })
            });
            Ok(ServerEvent::SessionFinished { usage })
        }
        other => Ok(ServerEvent::Unexpected {
            event: other.to_string(),
        }),
    }
}

// ============================== 连接 & 初始化辅助函数 ==============================

use futures_util::StreamExt;
use tokio::net::TcpStream;
use tokio_tungstenite::tungstenite::Message;
use tokio_tungstenite::{MaybeTlsStream, WebSocketStream, connect_async};

/// 建立 WebSocket 连接
pub async fn connect_ws(
    base_url: &str,
    model: &str,
    api_key: &str,
) -> Result<WebSocketStream<MaybeTlsStream<TcpStream>>, TtsError> {
    let request = create_ws_request(base_url, model, api_key)?;
    let (ws, _) = tokio::time::timeout(CONNECT_TIMEOUT, connect_async(request))
        .await
        .map_err(|_| TtsError::Timeout(CONNECT_TIMEOUT.as_millis() as u64))??;
    Ok(ws)
}

/// 从 WebSocket 读取下一个 Text 消息并解析为 ServerEvent
pub async fn receive_event(
    ws: &mut WebSocketStream<MaybeTlsStream<TcpStream>>,
) -> Result<ServerEvent, TtsError> {
    loop {
        match ws.next().await {
            Some(Ok(Message::Text(data))) => {
                return parse_server_event(&data);
            }
            Some(Ok(Message::Close(_))) | None => {
                return Err(TtsError::Other("Connection closed by server".into()));
            }
            Some(Err(e)) => return Err(TtsError::Websocket(e)),
            _ => {} // ping/pong
        }
    }
}

/// 等待特定类型的事件（跳过中间事件）
pub async fn wait_for_event_type(
    ws: &mut WebSocketStream<MaybeTlsStream<TcpStream>>,
    target_type: &'static [&'static str],
) -> Result<ServerEvent, TtsError> {
    loop {
        let event = receive_event(ws).await?;
        let event_type_str = match &event {
            ServerEvent::SessionCreated { .. } => "session.created",
            ServerEvent::SessionUpdated { .. } => "session.updated",
            ServerEvent::AudioDelta { .. } => "response.audio.delta",
            ServerEvent::ResponseDone => "response.done",
            ServerEvent::SessionFinished { .. } => "session.finished",
            ServerEvent::Error { .. } => "error",
            ServerEvent::Unexpected { event } => event.as_str(),
        };

        if target_type.contains(&event_type_str) {
            return Ok(event);
        }
        if matches!(event, ServerEvent::Error { .. }) {
            return Ok(event);
        }
        // 其他事件忽略，继续等待
    }
}

/// 执行 session 初始化（必须的握手阶段）
///
/// 流程: 等待 session.created → 发送 session.update → 等待 session.updated
pub async fn initialize_session(
    ws: &mut WebSocketStream<MaybeTlsStream<TcpStream>>,
    params: &SessionUpdateParams,
) -> Result<(), TtsError> {
    use futures_util::SinkExt;
    use tokio_tungstenite::tungstenite::Message;

    // 1. 等待 session.created
    let event = wait_for_event_type(ws, &["session.created"]).await?;
    match event {
        ServerEvent::SessionCreated { session } => {
            tracing::debug!("[Qwen Realtime] 会话已创建: id={}", session.id);
        }
        ServerEvent::Error { code, message } => {
            return Err(TtsError::ServiceError { code, message });
        }
        _ => {
            return Err(TtsError::Other(
                "Expected session.created, got unexpected event".into(),
            ));
        }
    }

    // 2. 发送 session.update
    let update_msg = create_session_update(params);
    ws.send(Message::Text(update_msg)).await?;

    // 3. 等待 session.updated
    let event = wait_for_event_type(ws, &["session.updated"]).await?;
    match event {
        ServerEvent::SessionUpdated { .. } => {
            tracing::debug!("[Qwen Realtime] 会话已配置");
            Ok(())
        }
        ServerEvent::Error { code, message } => Err(TtsError::ServiceError { code, message }),
        _ => Err(TtsError::Other(
            "Expected session.updated, got unexpected event".into(),
        )),
    }
}

// ============================== 测试 ==============================

#[cfg(test)]
mod tests {
    use super::*;

    // -------- 1.1 服务端事件解析 --------

    #[test]
    fn test_p1_session_created() {
        let data = r#"{
            "event_id": "event_xxx",
            "type": "session.created",
            "session": {
                "id": "sess_001",
                "model": "qwen3-tts-flash-realtime",
                "voice": "Cherry",
                "mode": "server_commit",
                "response_format": "pcm",
                "sample_rate": 24000
            }
        }"#;
        let event = parse_server_event(data).unwrap();
        match event {
            ServerEvent::SessionCreated { session } => {
                assert_eq!(session.id, "sess_001");
                assert_eq!(session.model, "qwen3-tts-flash-realtime");
                assert_eq!(session.voice, "Cherry");
                assert_eq!(session.mode, "server_commit");
                assert_eq!(session.response_format, "pcm");
                assert_eq!(session.sample_rate, 24000);
            }
            _ => panic!("Expected SessionCreated"),
        }
    }

    #[test]
    fn test_p2_session_created_minimal() {
        let data =
            r#"{"event_id":"e1","type":"session.created","session":{"id":"s1","model":"m1"}}"#;
        let event = parse_server_event(data).unwrap();
        match event {
            ServerEvent::SessionCreated { session } => {
                assert_eq!(session.id, "s1");
                assert_eq!(session.model, "m1");
                assert_eq!(session.voice, "");
                assert_eq!(session.sample_rate, 0);
            }
            _ => panic!("Expected SessionCreated"),
        }
    }

    #[test]
    fn test_p3_session_updated() {
        let data = r#"{
            "event_id": "event_xxx",
            "type": "session.updated",
            "session": {
                "id": "sess_001",
                "model": "qwen3-tts-flash-realtime",
                "mode": "commit",
                "response_format": "mp3",
                "sample_rate": 16000
            }
        }"#;
        let event = parse_server_event(data).unwrap();
        match event {
            ServerEvent::SessionUpdated { session } => {
                assert_eq!(session.id, "sess_001");
                assert_eq!(session.mode, "commit");
                assert_eq!(session.response_format, "mp3");
                assert_eq!(session.sample_rate, 16000);
            }
            _ => panic!("Expected SessionUpdated"),
        }
    }

    #[test]
    fn test_p4_audio_delta() {
        let data = r#"{
            "event_id": "event_B1osWMZBtrEQbiIwW0qHQ",
            "type": "response.audio.delta",
            "response_id": "resp_001",
            "item_id": "item_001",
            "output_index": 0,
            "content_index": 0,
            "delta": "base64encodedaudiodata"
        }"#;
        let event = parse_server_event(data).unwrap();
        match event {
            ServerEvent::AudioDelta { delta } => {
                assert_eq!(delta, "base64encodedaudiodata");
            }
            _ => panic!("Expected AudioDelta"),
        }
    }

    #[test]
    fn test_p5_audio_delta_empty() {
        let data = r#"{"event_id":"e1","type":"response.audio.delta","delta":""}"#;
        let event = parse_server_event(data).unwrap();
        match event {
            ServerEvent::AudioDelta { delta } => {
                assert!(delta.is_empty());
            }
            _ => panic!("Expected AudioDelta"),
        }
    }

    #[test]
    fn test_p6_session_finished() {
        let data = r#"{
            "event_id": "event_2239",
            "type": "session.finished",
            "usage": {"characters": 25}
        }"#;
        let event = parse_server_event(data).unwrap();
        match event {
            ServerEvent::SessionFinished { usage } => {
                let usage = usage.unwrap();
                assert_eq!(usage.characters, Some(25));
            }
            _ => panic!("Expected SessionFinished"),
        }
    }

    #[test]
    fn test_p7_session_finished_no_usage() {
        let data = r#"{"event_id":"e1","type":"session.finished"}"#;
        let event = parse_server_event(data).unwrap();
        match event {
            ServerEvent::SessionFinished { usage } => {
                assert!(usage.is_none());
            }
            _ => panic!("Expected SessionFinished"),
        }
    }

    #[test]
    fn test_p8_error_event() {
        let data = r#"{
            "event_id": "event_QzAVZRVa9hKqM5VOaHunh",
            "type": "error",
            "error": {
                "code": "invalid_value",
                "message": "Session update error: session already started"
            }
        }"#;
        let event = parse_server_event(data).unwrap();
        match event {
            ServerEvent::Error { code, message } => {
                assert_eq!(code, "invalid_value");
                assert!(message.contains("session already started"));
            }
            _ => panic!("Expected Error"),
        }
    }

    #[test]
    fn test_p9_response_done() {
        let data = r#"{"event_id":"e1","type":"response.done"}"#;
        let event = parse_server_event(data).unwrap();
        assert!(matches!(event, ServerEvent::ResponseDone));
    }

    #[test]
    fn test_p10_audio_done() {
        let data = r#"{"event_id":"e1","type":"response.audio.done"}"#;
        let event = parse_server_event(data).unwrap();
        assert!(matches!(event, ServerEvent::ResponseDone));
    }

    // -------- 1.2 边界与错误场景 --------

    #[test]
    fn test_p11_unexpected_event() {
        let data = r#"{"event_id":"e1","type":"response.output_item.added"}"#;
        let event = parse_server_event(data).unwrap();
        match event {
            ServerEvent::Unexpected { event } => {
                assert_eq!(event, "response.output_item.added");
            }
            _ => panic!("Expected Unexpected"),
        }
    }

    #[test]
    fn test_p12_empty_input() {
        let result = parse_server_event("");
        assert!(result.is_err());
    }

    #[test]
    fn test_p13_malformed_json() {
        let result = parse_server_event("not json at all");
        assert!(result.is_err());
    }

    #[test]
    fn test_p14_missing_type() {
        let data = r#"{"event_id":"e1"}"#;
        let result = parse_server_event(data);
        assert!(result.is_err());
    }

    #[test]
    fn test_p15_unknown_event_with_extra() {
        let data = r#"{"event_id":"e1","type":"unknown.custom.event","foo":"bar"}"#;
        let event = parse_server_event(data).unwrap();
        assert!(matches!(event, ServerEvent::Unexpected { .. }));
    }

    // -------- 1.3 客户端事件构造 --------

    #[test]
    fn test_p20_session_update_full() {
        let params = SessionUpdateParams {
            voice: "Cherry".into(),
            mode: RealtimeMode::ServerCommit,
            language_type: Some("Chinese".into()),
            format: "pcm".into(),
            sample_rate: 24000,
            bitrate: None,
            instructions: Some("speak softly".into()),
            optimize_instructions: true,
            speech_rate: Some(1.2),
            pitch_rate: Some(1.0),
        };
        let json = create_session_update(&params);
        let parsed: serde_json::Value = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed["type"], "session.update");
        assert_eq!(parsed["session"]["voice"], "Cherry");
        assert_eq!(parsed["session"]["mode"], "server_commit");
        assert_eq!(parsed["session"]["language_type"], "Chinese");
        assert_eq!(parsed["session"]["response_format"], "pcm");
        assert_eq!(parsed["session"]["sample_rate"], 24000);
        assert_eq!(parsed["session"]["instructions"], "speak softly");
        assert_eq!(parsed["session"]["optimize_instructions"], true);
        let speech_rate = parsed["session"]["speech_rate"].as_f64().unwrap();
        assert!((speech_rate - 1.2).abs() < 1e-6);
        let pitch_rate = parsed["session"]["pitch_rate"].as_f64().unwrap();
        assert!((pitch_rate - 1.0).abs() < 1e-6);
        assert!(parsed["event_id"].as_str().unwrap().starts_with("event_"));
    }

    #[test]
    fn test_p21_session_update_minimal() {
        let params = SessionUpdateParams {
            voice: "Cherry".into(),
            mode: RealtimeMode::ServerCommit,
            language_type: None,
            format: "mp3".into(),
            sample_rate: 16000,
            bitrate: None,
            instructions: None,
            optimize_instructions: false,
            speech_rate: None,
            pitch_rate: None,
        };
        let json = create_session_update(&params);
        let parsed: serde_json::Value = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed["session"]["voice"], "Cherry");
        assert_eq!(parsed["session"]["mode"], "server_commit");
        assert_eq!(parsed["session"]["response_format"], "mp3");
        assert_eq!(parsed["session"]["sample_rate"], 16000);
        assert!(parsed["session"].get("instructions").is_none());
        assert!(parsed["session"].get("speech_rate").is_none());
    }

    #[test]
    fn test_p22_session_update_commit_mode() {
        let params = SessionUpdateParams {
            voice: "Ethan".into(),
            mode: RealtimeMode::Commit,
            language_type: Some("English".into()),
            format: "wav".into(),
            sample_rate: 48000,
            bitrate: None,
            instructions: None,
            optimize_instructions: false,
            speech_rate: None,
            pitch_rate: None,
        };
        let json = create_session_update(&params);
        let parsed: serde_json::Value = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed["session"]["mode"], "commit");
        assert_eq!(parsed["session"]["language_type"], "English");
        assert_eq!(parsed["session"]["response_format"], "wav");
        assert_eq!(parsed["session"]["sample_rate"], 48000);
    }

    #[test]
    fn test_p23_append_event() {
        let json = create_input_text_buffer_append("你好世界");
        let parsed: serde_json::Value = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed["type"], "input_text_buffer.append");
        assert_eq!(parsed["text"], "你好世界");
        assert!(parsed["event_id"].as_str().unwrap().starts_with("event_"));
    }

    #[test]
    fn test_p24_append_empty_text() {
        let json = create_input_text_buffer_append("");
        let parsed: serde_json::Value = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed["text"], "");
    }

    #[test]
    fn test_p25_append_special_chars() {
        let json = create_input_text_buffer_append("line1\nline2\"quote\"");
        let parsed: serde_json::Value = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed["text"], "line1\nline2\"quote\"");
    }

    #[test]
    fn test_p26_finish_event() {
        let json = create_session_finish();
        let parsed: serde_json::Value = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed["type"], "session.finish");
        assert!(parsed["event_id"].as_str().unwrap().starts_with("event_"));
    }

    // -------- 1.4 RealtimeMode --------

    #[test]
    fn test_p30_mode_default() {
        assert_eq!(RealtimeMode::default(), RealtimeMode::ServerCommit);
    }

    #[test]
    fn test_p31_mode_as_str() {
        assert_eq!(RealtimeMode::ServerCommit.as_str(), "server_commit");
        assert_eq!(RealtimeMode::Commit.as_str(), "commit");
    }

    // -------- 1.5 WS 请求构建 --------

    #[test]
    fn test_p40_ws_request_normal() {
        let req = create_ws_request(
            "wss://dashscope.aliyuncs.com/api-ws/v1/realtime",
            "qwen3-tts-flash-realtime",
            "test-api-key",
        )
        .unwrap();
        assert_eq!(req.method(), "GET");
        assert_eq!(
            req.headers()
                .get("Authorization")
                .unwrap()
                .to_str()
                .unwrap(),
            "Bearer test-api-key"
        );
        assert_eq!(
            req.headers().get("Upgrade").unwrap().to_str().unwrap(),
            "websocket"
        );
        let uri = req.uri();
        assert!(
            uri.path_and_query()
                .unwrap()
                .as_str()
                .contains("model=qwen3-tts-flash-realtime")
        );
    }

    #[test]
    fn test_p41_ws_request_invalid_url() {
        let result = create_ws_request("not a valid url", "model", "key");
        assert!(result.is_err());
    }

    #[test]
    fn test_p42_ws_request_different_model() {
        let req = create_ws_request(
            "wss://dashscope.aliyuncs.com/api-ws/v1/realtime",
            "qwen3-tts-instruct-flash-realtime",
            "key",
        )
        .unwrap();
        let uri_str = req.uri().to_string();
        assert!(uri_str.contains("model=qwen3-tts-instruct-flash-realtime"));
    }

    #[test]
    fn test_p43_ws_request_host_header() {
        let req = create_ws_request(
            "wss://custom-host:8443/api-ws/v1/realtime",
            "test-model",
            "key",
        )
        .unwrap();
        assert_eq!(
            req.headers().get("Host").unwrap().to_str().unwrap(),
            "custom-host:8443"
        );
    }
}
