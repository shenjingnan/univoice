//! 火山引擎双向 WebSocket 二进制协议层
//!
//! 实现了火山引擎 TTS/ASR 系列产品使用的自定义二进制帧协议。
//! 对应 TypeScript 端的 `src/tts/protocols/volcengine.ts`。
//!
//! # 帧结构
//!
//! 所有消息通过 WebSocket `Message::Binary` 传输。
//!
//! ## 帧头 (4 字节)
//!
//! | Byte | 内容 |
//! |------|------|
//! | 0 | `version(4b) \| headerSize(4b)` → 通常 0x11 |
//! | 1 | `msgType(4b) \| flag(4b)` |
//! | 2 | `serialization(4b) \| compression(4b)` → 通常 0x10 |
//! | 3 | padding(0) |
//!
//! ## Writer 顺序 (客户端发送/服务端发送均遵循)
//!
//! 1. `WithEvent` 标志 → `event(4B BE i32)` + `sessionId(4B BE len + UTF-8)`
//!    - 连接级事件 (StartConnection/FinishConnection/ConnectionStarted/ConnectionFailed) 跳过 sessionId
//! 2. `PositiveSeq`/`NegativeSeq` → `sequence(4B BE i32)`
//! 3. `Error` 类型 → `errorCode(4B BE u32)`
//! 4. 所有消息 → `payload(4B BE u32 len + bytes)`
//!
//! ## Reader 顺序 (接收端解析)
//!
//! 1. `PositiveSeq`/`NegativeSeq` → `sequence` / `Error` → `errorCode`
//! 2. `WithEvent` → `event` + `sessionId` + `connectId`
//!    - sessionId 额外跳过 ConnectionFinished
//!    - connectId 仅 ConnectionStarted/ConnectionFailed/ConnectionFinished
//! 3. `payload`

use futures_util::StreamExt;
use tokio_tungstenite::tungstenite::Message;

use crate::tts::error::TtsError;

// ============================================================================
// 枚举
// ============================================================================

/// 事件类型，对应 TS `enum EventType`。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[repr(u32)]
pub enum EventType {
    None = 0,
    StartConnection = 1,
    FinishConnection = 2,
    ConnectionStarted = 50,
    ConnectionFailed = 51,
    ConnectionFinished = 52,
    StartSession = 100,
    CancelSession = 101,
    FinishSession = 102,
    SessionStarted = 150,
    SessionCanceled = 151,
    SessionFinished = 152,
    SessionFailed = 153,
    UsageResponse = 154,
    TaskRequest = 200,
}

/// 消息协议类型 (编码入 header[1] 高 4 位)，对应 TS `enum MsgType`。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[repr(u8)]
pub enum MsgType {
    Invalid = 0,
    FullClientRequest = 0b0001,
    AudioOnlyClient = 0b0010,
    FullServerResponse = 0b1001,
    AudioOnlyServer = 0b1011,
    FrontEndResultServer = 0b1100,
    Error = 0b1111,
}

/// 标志位 (编码入 header[1] 低 4 位)，对应 TS `enum MsgTypeFlagBits`。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[repr(u8)]
pub enum FlagBits {
    NoSeq = 0b000,
    PositiveSeq = 0b001,
    LastNoSeq = 0b010,
    NegativeSeq = 0b011,
    WithEvent = 0b100,
}

/// 版本 (编码入 header[0] 高 4 位)
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[repr(u8)]
pub enum VersionBits {
    Version1 = 1,
}

/// 头部大小系数 (编码入 header[0] 低 4 位)，实际头部字节数 = 4 × value
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[repr(u8)]
pub enum HeaderSizeBits {
    HeaderSize4 = 1,
}

/// 序列化方式 (编码入 header[2] 高 4 位)
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[repr(u8)]
pub enum SerializationBits {
    Raw = 0,
    Json = 0b0001,
}

/// 压缩方式 (编码入 header[2] 低 4 位)
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[repr(u8)]
pub enum CompressionBits {
    None = 0,
}

// ============================================================================
// VolcMessage
// ============================================================================

/// 火山引擎协议消息
#[derive(Debug, Clone)]
pub struct VolcMessage {
    pub version: VersionBits,
    pub header_size: HeaderSizeBits,
    pub msg_type: MsgType,
    pub flag: FlagBits,
    pub serialization: SerializationBits,
    pub compression: CompressionBits,
    pub event: Option<EventType>,
    pub session_id: Option<String>,
    pub connect_id: Option<String>,
    pub sequence: Option<i32>,
    pub error_code: Option<u32>,
    pub payload: Vec<u8>,
}

impl Default for VolcMessage {
    fn default() -> Self {
        Self {
            version: VersionBits::Version1,
            header_size: HeaderSizeBits::HeaderSize4,
            msg_type: MsgType::Invalid,
            flag: FlagBits::NoSeq,
            serialization: SerializationBits::Json,
            compression: CompressionBits::None,
            event: None,
            session_id: None,
            connect_id: None,
            sequence: None,
            error_code: None,
            payload: Vec::new(),
        }
    }
}

impl VolcMessage {
    fn new(msg_type: MsgType, flag: FlagBits) -> Self {
        Self {
            msg_type,
            flag,
            ..Default::default()
        }
    }

    // ---- Builder ----

    pub fn build_start_connection() -> Self {
        let mut msg = Self::new(MsgType::FullClientRequest, FlagBits::WithEvent);
        msg.event = Some(EventType::StartConnection);
        msg.payload = b"{}".to_vec();
        msg
    }

    pub fn build_finish_connection() -> Self {
        let mut msg = Self::new(MsgType::FullClientRequest, FlagBits::WithEvent);
        msg.event = Some(EventType::FinishConnection);
        msg.payload = b"{}".to_vec();
        msg
    }

    pub fn build_start_session(payload: Vec<u8>, session_id: &str) -> Self {
        let mut msg = Self::new(MsgType::FullClientRequest, FlagBits::WithEvent);
        msg.event = Some(EventType::StartSession);
        msg.session_id = Some(session_id.to_string());
        msg.payload = payload;
        msg
    }

    pub fn build_finish_session(session_id: &str) -> Self {
        let mut msg = Self::new(MsgType::FullClientRequest, FlagBits::WithEvent);
        msg.event = Some(EventType::FinishSession);
        msg.session_id = Some(session_id.to_string());
        msg.payload = b"{}".to_vec();
        msg
    }

    pub fn build_task_request(payload: Vec<u8>, session_id: &str) -> Self {
        let mut msg = Self::new(MsgType::FullClientRequest, FlagBits::WithEvent);
        msg.event = Some(EventType::TaskRequest);
        msg.session_id = Some(session_id.to_string());
        msg.payload = payload;
        msg
    }
}

// ============================================================================
// 内部: sessionId/connectId 判断 (对应 TS writeSessionId / readSessionId)
// ============================================================================

fn should_write_session_id(event: Option<EventType>) -> bool {
    !matches!(
        event,
        Some(EventType::StartConnection)
            | Some(EventType::FinishConnection)
            | Some(EventType::ConnectionStarted)
            | Some(EventType::ConnectionFailed)
    )
}

fn should_read_session_id(event: Option<EventType>) -> bool {
    !matches!(
        event,
        Some(EventType::StartConnection)
            | Some(EventType::FinishConnection)
            | Some(EventType::ConnectionStarted)
            | Some(EventType::ConnectionFailed)
            | Some(EventType::ConnectionFinished)
    )
}

fn should_read_connect_id(event: Option<EventType>) -> bool {
    matches!(
        event,
        Some(EventType::ConnectionStarted)
            | Some(EventType::ConnectionFailed)
            | Some(EventType::ConnectionFinished)
    )
}

// ============================================================================
// 序列化: marshal_message (对应 TS marshalMessage)
// ============================================================================

/// 将 VolcMessage 序列化为二进制字节。
pub fn marshal_message(msg: &VolcMessage) -> Result<Vec<u8>, TtsError> {
    let mut buf = Vec::with_capacity(64);

    // 帧头 (4 字节)
    let byte0: u8 = ((msg.version as u8) << 4) | (msg.header_size as u8);
    let byte1: u8 = ((msg.msg_type as u8) << 4) | (msg.flag as u8);
    let byte2: u8 = ((msg.serialization as u8) << 4) | (msg.compression as u8);
    buf.push(byte0);
    buf.push(byte1);
    buf.push(byte2);
    buf.push(0); // padding

    // Writer 顺序: event → sessionId → [seq/errorCode] → payload
    if msg.flag == FlagBits::WithEvent {
        m_write_event(&mut buf, msg.event);
        m_write_session_id(&mut buf, msg.event, msg.session_id.as_deref());
    }

    match msg.msg_type {
        MsgType::AudioOnlyClient
        | MsgType::AudioOnlyServer
        | MsgType::FrontEndResultServer
        | MsgType::FullClientRequest
        | MsgType::FullServerResponse => {
            if msg.flag == FlagBits::PositiveSeq || msg.flag == FlagBits::NegativeSeq {
                buf.extend_from_slice(&msg.sequence.unwrap_or(0).to_be_bytes());
            }
        }
        MsgType::Error => {
            buf.extend_from_slice(&msg.error_code.unwrap_or(0).to_be_bytes());
        }
        MsgType::Invalid => {}
    }

    m_write_payload(&mut buf, &msg.payload);
    Ok(buf)
}

fn m_write_event(buf: &mut Vec<u8>, event: Option<EventType>) {
    let val = event.map(|e| e as u32).unwrap_or(0);
    buf.extend_from_slice(&val.to_be_bytes());
}

fn m_write_session_id(buf: &mut Vec<u8>, event: Option<EventType>, session_id: Option<&str>) {
    if !should_write_session_id(event) {
        return;
    }
    let id = session_id.unwrap_or("");
    let bytes = id.as_bytes();
    buf.extend_from_slice(&(bytes.len() as u32).to_be_bytes());
    buf.extend_from_slice(bytes);
}

fn m_write_payload(buf: &mut Vec<u8>, payload: &[u8]) {
    buf.extend_from_slice(&(payload.len() as u32).to_be_bytes());
    buf.extend_from_slice(payload);
}

// ============================================================================
// 反序列化: unmarshal_message (对应 TS unmarshalMessage)
// ============================================================================

/// 从二进制字节解析 VolcMessage。
pub fn unmarshal_message(data: &[u8]) -> Result<VolcMessage, TtsError> {
    if data.len() < 4 {
        return Err(TtsError::Other(format!(
            "volcengine message too short: {} bytes",
            data.len()
        )));
    }

    let byte0 = data[0];
    let byte1 = data[1];
    let byte2 = data[2];

    let _version_val = byte0 >> 4;
    let header_size_val = byte0 & 0x0f;
    let msg_type_val = byte1 >> 4;
    let flag_val = byte1 & 0x0f;
    let serialization_val = byte2 >> 4;
    let compression_val = byte2 & 0x0f;

    // 只支持 HeaderSize4
    if header_size_val != HeaderSizeBits::HeaderSize4 as u8 {
        return Err(TtsError::Other(format!(
            "unsupported header_size: {}",
            header_size_val
        )));
    }

    let header_bytes = 4 * header_size_val as usize; // = 4
    if header_bytes > data.len() {
        return Err(TtsError::Other("header exceeds data length".into()));
    }

    let msg_type = match msg_type_val {
        0b0001 => MsgType::FullClientRequest,
        0b0010 => MsgType::AudioOnlyClient,
        0b1001 => MsgType::FullServerResponse,
        0b1011 => MsgType::AudioOnlyServer,
        0b1100 => MsgType::FrontEndResultServer,
        0b1111 => MsgType::Error,
        _ => MsgType::Invalid,
    };
    let flag = match flag_val {
        0b000 => FlagBits::NoSeq,
        0b001 => FlagBits::PositiveSeq,
        0b010 => FlagBits::LastNoSeq,
        0b011 => FlagBits::NegativeSeq,
        0b100 => FlagBits::WithEvent,
        _ => FlagBits::NoSeq,
    };
    let serialization = match serialization_val {
        0b0000 => SerializationBits::Raw,
        0b0001 => SerializationBits::Json,
        _ => SerializationBits::Raw,
    };
    let compression = match compression_val {
        0b0000 => CompressionBits::None,
        _ => CompressionBits::None,
    };

    let mut msg = VolcMessage {
        header_size: HeaderSizeBits::HeaderSize4,
        msg_type,
        flag,
        serialization,
        compression,
        ..Default::default()
    };

    let mut offset = header_bytes;

    // Reader 顺序: [seq/errorCode] → event → sessionId → connectId → payload
    match msg.msg_type {
        MsgType::AudioOnlyClient
        | MsgType::AudioOnlyServer
        | MsgType::FrontEndResultServer
        | MsgType::FullClientRequest
        | MsgType::FullServerResponse => {
            if msg.flag == FlagBits::PositiveSeq || msg.flag == FlagBits::NegativeSeq {
                let (val, new_off) = um_read_i32(data, offset)?;
                msg.sequence = Some(val);
                offset = new_off;
            }
        }
        MsgType::Error => {
            let (val, new_off) = um_read_u32(data, offset)?;
            msg.error_code = Some(val);
            offset = new_off;
        }
        MsgType::Invalid => {}
    }

    if msg.flag == FlagBits::WithEvent {
        // event
        let (event_val, new_off) = um_read_i32(data, offset)?;
        msg.event = i32_to_event(event_val);
        offset = new_off;

        // sessionId (连接级事件跳过)
        if should_read_session_id(msg.event) {
            let (s, new_off) = um_read_string(data, offset)?;
            if !s.is_empty() {
                msg.session_id = Some(s);
            }
            offset = new_off;
        }

        // connectId (仅 ConnectionStarted/ConnectionFailed/ConnectionFinished)
        if should_read_connect_id(msg.event) {
            let (s, new_off) = um_read_string(data, offset)?;
            if !s.is_empty() {
                msg.connect_id = Some(s);
            }
            offset = new_off;
        }
    }

    // payload
    let (payload, new_off) = um_read_payload(data, offset)?;
    msg.payload = payload;
    offset = new_off;

    let _ = offset; // suppress unused

    Ok(msg)
}

fn i32_to_event(val: i32) -> Option<EventType> {
    match val {
        0 => Some(EventType::None),
        1 => Some(EventType::StartConnection),
        2 => Some(EventType::FinishConnection),
        50 => Some(EventType::ConnectionStarted),
        51 => Some(EventType::ConnectionFailed),
        52 => Some(EventType::ConnectionFinished),
        100 => Some(EventType::StartSession),
        101 => Some(EventType::CancelSession),
        102 => Some(EventType::FinishSession),
        150 => Some(EventType::SessionStarted),
        151 => Some(EventType::SessionCanceled),
        152 => Some(EventType::SessionFinished),
        153 => Some(EventType::SessionFailed),
        154 => Some(EventType::UsageResponse),
        200 => Some(EventType::TaskRequest),
        _ => None,
    }
}

fn um_read_i32(data: &[u8], offset: usize) -> Result<(i32, usize), TtsError> {
    if offset + 4 > data.len() {
        return Err(TtsError::Other("insufficient data for i32".into()));
    }
    let val = i32::from_be_bytes([
        data[offset],
        data[offset + 1],
        data[offset + 2],
        data[offset + 3],
    ]);
    Ok((val, offset + 4))
}

fn um_read_u32(data: &[u8], offset: usize) -> Result<(u32, usize), TtsError> {
    if offset + 4 > data.len() {
        return Err(TtsError::Other("insufficient data for u32".into()));
    }
    let val = u32::from_be_bytes([
        data[offset],
        data[offset + 1],
        data[offset + 2],
        data[offset + 3],
    ]);
    Ok((val, offset + 4))
}

fn um_read_string(data: &[u8], offset: usize) -> Result<(String, usize), TtsError> {
    let (len, offset) = um_read_u32(data, offset)?;
    let len = len as usize;
    if offset + len > data.len() {
        return Err(TtsError::Other("insufficient data for string".into()));
    }
    let s = String::from_utf8_lossy(&data[offset..offset + len]).to_string();
    Ok((s, offset + len))
}

fn um_read_payload(data: &[u8], offset: usize) -> Result<(Vec<u8>, usize), TtsError> {
    let (len, offset) = um_read_u32(data, offset)?;
    let len = len as usize;
    if offset + len > data.len() {
        return Err(TtsError::Other("insufficient data for payload".into()));
    }
    Ok((data[offset..offset + len].to_vec(), offset + len))
}

// ============================================================================
// 高层接收函数
// ============================================================================

/// 从实现了 `Stream<Item = Result<Message, tungstenite::Error>>` 的源接收并解析一条消息。
///
/// 可同时用于 `WebSocketStream` (未 split) 和 `SplitStream` (read half)。
/// 内部自动忽略 Ping/Pong 帧。
pub async fn recv_message<S>(stream: &mut S) -> Result<VolcMessage, TtsError>
where
    S: futures_util::Stream<Item = Result<Message, tokio_tungstenite::tungstenite::Error>> + Unpin,
{
    loop {
        match stream.next().await {
            Some(Ok(Message::Binary(data))) => return unmarshal_message(&data),
            Some(Ok(Message::Ping(_) | Message::Pong(_))) => continue,
            Some(Ok(Message::Close(_))) | None => {
                return Err(TtsError::Other(
                    "WebSocket connection closed while receiving volcengine message".into(),
                ));
            }
            Some(Err(e)) => return Err(TtsError::Websocket(e)),
            _ => continue,
        }
    }
}

/// 等待特定 MsgType + EventType 的消息。
///
/// 内部循环调用 `recv_message`，忽略非目标消息。遇到 `Error` 消息时返回 `ServiceError`。
pub async fn wait_for_event<S>(
    stream: &mut S,
    expected_type: MsgType,
    expected_event: EventType,
) -> Result<VolcMessage, TtsError>
where
    S: futures_util::Stream<Item = Result<Message, tokio_tungstenite::tungstenite::Error>> + Unpin,
{
    loop {
        let msg = recv_message(stream).await?;
        if msg.msg_type == expected_type && msg.event == Some(expected_event) {
            return Ok(msg);
        }
        if msg.msg_type == MsgType::Error {
            let error_msg = String::from_utf8_lossy(&msg.payload).to_string();
            return Err(TtsError::ServiceError {
                code: msg.error_code.unwrap_or(0).to_string(),
                message: error_msg,
            });
        }
    }
}

// ============================================================================
// 测试
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    // ---- P1-P4: marshal 客户端消息 ----

    #[test]
    fn test_p1_marshal_start_connection() {
        let msg = VolcMessage::build_start_connection();
        let bytes = marshal_message(&msg).unwrap();

        // header: version=1,headerSize=1 | FullClientRequest=1<<4|WithEvent=4 | JSON=1<<4|None=0
        assert_eq!(bytes[0], 0x11);
        assert_eq!(bytes[1], 0x14);
        assert_eq!(bytes[2], 0x10);
        assert_eq!(bytes[3], 0x00);

        // event = StartConnection(1) — 4B BE
        assert_eq!(&bytes[4..8], &[0, 0, 0, 1]);

        // payload len=2, payload="{}"
        assert_eq!(&bytes[8..12], &[0, 0, 0, 2]);
        assert_eq!(&bytes[12..14], b"{}");

        // total: 4(header) + 4(event) + 4(len) + 2(body) = 14
        assert_eq!(bytes.len(), 14);
    }

    #[test]
    fn test_p2_marshal_start_session() {
        let session_id = "test-session";
        let payload_json = br#"{"event":100}"#;
        let msg = VolcMessage::build_start_session(payload_json.to_vec(), session_id);
        let bytes = marshal_message(&msg).unwrap();

        assert_eq!(bytes[0], 0x11);
        assert_eq!(bytes[1], 0x14);

        // event = StartSession(100)
        assert_eq!(&bytes[4..8], &[0, 0, 0, 100]);

        // sessionId
        let off = 8;
        let sid_len =
            u32::from_be_bytes([bytes[off], bytes[off + 1], bytes[off + 2], bytes[off + 3]])
                as usize;
        assert_eq!(sid_len, session_id.len());
        assert_eq!(&bytes[off + 4..off + 4 + sid_len], session_id.as_bytes());

        // payload
        let poff = off + 4 + sid_len;
        let p_len = u32::from_be_bytes([
            bytes[poff],
            bytes[poff + 1],
            bytes[poff + 2],
            bytes[poff + 3],
        ]) as usize;
        assert_eq!(p_len, payload_json.len());
        assert_eq!(&bytes[poff + 4..], payload_json.as_slice());
    }

    #[test]
    fn test_p3_marshal_finish_session() {
        let msg = VolcMessage::build_finish_session("sid-1");
        let bytes = marshal_message(&msg).unwrap();

        assert_eq!(bytes[0], 0x11);
        assert_eq!(bytes[4], 0x00); // event byte 0
        assert_eq!(bytes[5], 0x00);
        assert_eq!(bytes[6], 0x00);
        assert_eq!(bytes[7], 102); // event = FinishSession = 102

        // sid len = 5, sid = "sid-1", payload len=2, payload="{}"
        assert_eq!(bytes.len(), 4 + 4 + 4 + 5 + 4 + 2); // 23
    }

    #[test]
    fn test_p4_marshal_task_request() {
        let payload = br#"{"text":"hello","event":200}"#;
        let msg = VolcMessage::build_task_request(payload.to_vec(), "task-sid");
        let bytes = marshal_message(&msg).unwrap();

        // event = TaskRequest = 200
        assert_eq!(&bytes[4..8], &[0, 0, 0, 200]);

        // round-trip
        let parsed = unmarshal_message(&bytes).unwrap();
        assert_eq!(parsed.event, Some(EventType::TaskRequest));
        assert_eq!(parsed.session_id.as_deref(), Some("task-sid"));
        assert_eq!(parsed.payload, payload);
    }

    // ---- P5-P9: unmarshal 服务端消息 ----

    #[test]
    fn test_p5_unmarshal_connection_started() {
        let mut buf = vec![0x11, 0x94, 0x10, 0x00]; // FullServerResponse(9)<<4 | WithEvent(4) = 0x94
        buf.extend_from_slice(&50u32.to_be_bytes()); // event = ConnectionStarted
        // No sessionId field (connection-level event — reader skips it)
        buf.extend_from_slice(&10u32.to_be_bytes()); // connectId len=10
        buf.extend_from_slice(b"conn-12345");
        buf.extend_from_slice(&0u32.to_be_bytes()); // payload len=0

        let msg = unmarshal_message(&buf).unwrap();
        assert_eq!(msg.msg_type, MsgType::FullServerResponse);
        assert_eq!(msg.flag, FlagBits::WithEvent);
        assert_eq!(msg.event, Some(EventType::ConnectionStarted));
        assert!(msg.session_id.is_none());
        assert_eq!(msg.connect_id.as_deref(), Some("conn-12345"));
    }

    #[test]
    fn test_p6_unmarshal_session_started() {
        let mut buf = vec![0x11, 0x94, 0x10, 0x00];
        buf.extend_from_slice(&150u32.to_be_bytes()); // event = SessionStarted
        buf.extend_from_slice(&5u32.to_be_bytes()); // sessionId len=5
        buf.extend_from_slice(b"sid-1");
        // No connectId (only connection-level events have connectId)
        buf.extend_from_slice(&0u32.to_be_bytes()); // payload len=0

        let msg = unmarshal_message(&buf).unwrap();
        assert_eq!(msg.event, Some(EventType::SessionStarted));
        assert_eq!(msg.session_id.as_deref(), Some("sid-1"));
    }

    #[test]
    fn test_p7_unmarshal_audio_only() {
        let audio = &[0x01, 0x02, 0x03, 0x04];
        let mut buf = vec![0x11, 0xB0, 0x10, 0x00]; // AudioOnlyServer(11)<<4 | NoSeq(0) = 0xB0
        buf.extend_from_slice(&(audio.len() as u32).to_be_bytes());
        buf.extend_from_slice(audio);

        let msg = unmarshal_message(&buf).unwrap();
        assert_eq!(msg.msg_type, MsgType::AudioOnlyServer);
        assert_eq!(msg.payload, audio);
        assert!(msg.event.is_none());
    }

    #[test]
    fn test_p8_unmarshal_error() {
        let mut buf = vec![0x11, 0xF0, 0x10, 0x00]; // Error(15)<<4 | NoSeq(0) = 0xF0
        buf.extend_from_slice(&400u32.to_be_bytes()); // errorCode
        let err_msg = b"rate limit";
        buf.extend_from_slice(&(err_msg.len() as u32).to_be_bytes());
        buf.extend_from_slice(err_msg);

        let msg = unmarshal_message(&buf).unwrap();
        assert_eq!(msg.msg_type, MsgType::Error);
        assert_eq!(msg.error_code, Some(400));
        assert_eq!(String::from_utf8_lossy(&msg.payload), "rate limit");
    }

    #[test]
    fn test_p9_unmarshal_session_finished() {
        let mut buf = vec![0x11, 0x94, 0x10, 0x00];
        buf.extend_from_slice(&152u32.to_be_bytes()); // event = SessionFinished
        buf.extend_from_slice(&5u32.to_be_bytes()); // sessionId len=5
        buf.extend_from_slice(b"sid-1");
        // No connectId (only connection-level events have connectId)
        buf.extend_from_slice(&0u32.to_be_bytes()); // payload len=0

        let msg = unmarshal_message(&buf).unwrap();
        assert_eq!(msg.event, Some(EventType::SessionFinished));
        assert_eq!(msg.session_id.as_deref(), Some("sid-1"));
    }

    // ---- P10: Round-trip ----

    #[test]
    fn test_p10_roundtrip_symmetry() {
        // StartConnection
        let (m, _bytes) = (VolcMessage::build_start_connection(), None::<Vec<u8>>);
        let bytes = marshal_message(&m).unwrap();
        let p = unmarshal_message(&bytes).unwrap();
        assert_eq!(p.msg_type, MsgType::FullClientRequest);
        assert_eq!(p.flag, FlagBits::WithEvent);
        assert_eq!(p.event, Some(EventType::StartConnection));
        assert_eq!(p.payload, b"{}");
        assert!(p.session_id.is_none());

        // StartSession
        let m = VolcMessage::build_start_session(br#"{"k":"v"}"#.to_vec(), "rt-sid");
        let bytes = marshal_message(&m).unwrap();
        let p = unmarshal_message(&bytes).unwrap();
        assert_eq!(p.event, Some(EventType::StartSession));
        assert_eq!(p.session_id.as_deref(), Some("rt-sid"));
        assert_eq!(p.payload, br#"{"k":"v"}"#);

        // FinishSession
        let m = VolcMessage::build_finish_session("fs-sid");
        let bytes = marshal_message(&m).unwrap();
        let p = unmarshal_message(&bytes).unwrap();
        assert_eq!(p.event, Some(EventType::FinishSession));
        assert_eq!(p.session_id.as_deref(), Some("fs-sid"));

        // TaskRequest
        let m = VolcMessage::build_task_request(br#"{"t":"hi"}"#.to_vec(), "tr-sid");
        let bytes = marshal_message(&m).unwrap();
        let p = unmarshal_message(&bytes).unwrap();
        assert_eq!(p.event, Some(EventType::TaskRequest));
        assert_eq!(p.session_id.as_deref(), Some("tr-sid"));
        assert_eq!(p.payload, br#"{"t":"hi"}"#);
    }

    // ---- P11-P16: 边界 ----

    #[test]
    fn test_p11_empty_payload() {
        let mut buf = vec![0x11, 0xB0, 0x10, 0x00];
        buf.extend_from_slice(&0u32.to_be_bytes()); // payload len=0

        let msg = unmarshal_message(&buf).unwrap();
        assert_eq!(msg.msg_type, MsgType::AudioOnlyServer);
        assert!(msg.payload.is_empty());
    }

    #[test]
    fn test_p12_large_payload() {
        let data = vec![0xABu8; 65535];
        let mut buf = vec![0x11, 0xB0, 0x10, 0x00];
        buf.extend_from_slice(&(data.len() as u32).to_be_bytes());
        buf.extend_from_slice(&data);

        let msg = unmarshal_message(&buf).unwrap();
        assert_eq!(msg.payload.len(), 65535);
        assert_eq!(msg.payload[0], 0xAB);
        assert_eq!(msg.payload[65534], 0xAB);
    }

    #[test]
    fn test_p13_truncated_data() {
        // 3 bytes (less than minimum 4)
        assert!(unmarshal_message(&[0x11, 0x14, 0x10]).is_err());

        // header OK but payload len exceeds remaining data
        let mut buf = vec![0x11, 0xB0, 0x10, 0x00];
        buf.extend_from_slice(&100u32.to_be_bytes()); // claims 100 bytes
        assert!(unmarshal_message(&buf).is_err());
    }

    #[test]
    fn test_p14_unsupported_header_size() {
        // header_size = 2 (instead of 1)
        let buf = [0x12, 0x14, 0x10, 0x00];
        assert!(unmarshal_message(&buf).is_err());
    }

    #[test]
    fn test_p15_finish_connection_no_session_id() {
        let msg = VolcMessage::build_finish_connection();
        let bytes = marshal_message(&msg).unwrap();

        // 4(header) + 4(event) + 4(payload_len) + 2(payload) = 14
        assert_eq!(bytes.len(), 14);

        let parsed = unmarshal_message(&bytes).unwrap();
        assert_eq!(parsed.event, Some(EventType::FinishConnection));
        assert!(parsed.session_id.is_none());
    }

    #[test]
    fn test_p16_read_connection_finished() {
        let mut buf = vec![0x11, 0x94, 0x10, 0x00];
        buf.extend_from_slice(&52u32.to_be_bytes()); // event = ConnectionFinished
        // should_read_session_id skips ConnectionFinished
        // should_read_connect_id reads connectId
        buf.extend_from_slice(&8u32.to_be_bytes()); // connectId len=8
        buf.extend_from_slice(b"conn-abc");
        buf.extend_from_slice(&0u32.to_be_bytes()); // payload len=0

        let msg = unmarshal_message(&buf).unwrap();
        assert_eq!(msg.event, Some(EventType::ConnectionFinished));
        assert!(msg.session_id.is_none());
        assert_eq!(msg.connect_id.as_deref(), Some("conn-abc"));
    }
}
