use std::io::{Read, Write};

use serde::Deserialize;

use crate::asr::error::AsrError;

// ============================== 枚举定义 ==============================

#[repr(u8)]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ProtocolVersion {
    V1 = 0b0001,
}

#[repr(u8)]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MessageType {
    ClientFullRequest = 0b0001,
    ClientAudioOnlyRequest = 0b0010,
    ServerFullResponse = 0b1001,
    ServerErrorResponse = 0b1111,
}

/// MessageTypeSpecificFlags（位标志）
pub mod flags {
    pub const NO_SEQUENCE: u8 = 0b0000;
    pub const POS_SEQUENCE: u8 = 0b0001;
    pub const NEG_SEQUENCE: u8 = 0b0010;
    pub const NEG_WITH_SEQUENCE: u8 = 0b0011;
}

/// 序列化方式常量
pub mod serialization {
    pub const NO_SERIALIZATION: u8 = 0b0000;
    pub const JSON: u8 = 0b0001;
}

/// 压缩方式常量
pub mod compression {
    pub const NONE: u8 = 0b0000;
    pub const GZIP: u8 = 0b0001;
}

// ============================== 请求结构体 ==============================

#[derive(Debug, Clone, serde::Serialize)]
pub struct SaucFullClientRequest {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub user: Option<SaucUser>,
    pub audio: SaucAudioConfig,
    pub request: SaucRequestConfig,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct SaucUser {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub uid: Option<String>,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct SaucAudioConfig {
    pub format: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub codec: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub rate: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bits: Option<u8>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub channel: Option<u8>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub language: Option<String>,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct SaucRequestConfig {
    pub model_name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub enable_itn: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub enable_punc: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub enable_ddc: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub show_utterances: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub end_window_size: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub enable_nonstream: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub vad_segment_duration: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub force_to_speech_time: Option<u32>,
}

// ============================== 响应结构体 ==============================

#[derive(Debug, Clone)]
pub struct SaucResponse {
    pub code: i32,
    pub event: i32,
    pub is_last_package: bool,
    pub payload_sequence: i32,
    pub payload_size: u32,
    pub payload_msg: Option<SaucResponsePayload>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct SaucResponsePayload {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub audio_info: Option<SaucAudioInfo>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub result: Option<SaucResult>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct SaucAudioInfo {
    pub duration: f64,
}

#[derive(Debug, Clone, Deserialize)]
pub struct SaucResult {
    pub text: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub utterances: Option<Vec<SaucUtterance>>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct SaucUtterance {
    pub text: String,
    pub start_time: u32,
    pub end_time: u32,
    pub definite: bool,
}

// ============================== 帧头编码 ==============================

/// 构建 4 字节 SAUC 帧头
pub fn encode_header(
    message_type: MessageType,
    msg_flags: u8,
    serialization_type: u8,
    compression_type: u8,
) -> [u8; 4] {
    [
        ((ProtocolVersion::V1 as u8) << 4) | 0b0001,
        ((message_type as u8) << 4) | msg_flags,
        (serialization_type << 4) | compression_type,
        0x00,
    ]
}

// ============================== Full Client Request 编码 ==============================

/// 构建 Full Client Request 二进制帧
pub fn encode_full_client_request(
    params: &SaucFullClientRequest,
    sequence: i32,
    use_gzip: bool,
) -> Result<Vec<u8>, AsrError> {
    let json = serde_json::to_string(params)?;
    let json_bytes = json.as_bytes();

    let payload = if use_gzip {
        gzip_compress(json_bytes)?
    } else {
        json_bytes.to_vec()
    };

    let header = encode_header(
        MessageType::ClientFullRequest,
        flags::POS_SEQUENCE,
        serialization::JSON,
        if use_gzip {
            compression::GZIP
        } else {
            compression::NONE
        },
    );

    let mut frame = Vec::with_capacity(4 + 4 + 4 + payload.len());
    frame.extend_from_slice(&header);
    frame.extend_from_slice(&sequence.to_be_bytes());
    frame.extend_from_slice(&(payload.len() as u32).to_be_bytes());
    frame.extend_from_slice(&payload);

    Ok(frame)
}

// ============================== Audio Request 编码 ==============================

/// 构建音频数据帧
pub fn encode_audio_request(
    sequence: i32,
    data: &[u8],
    is_last: bool,
) -> Result<Vec<u8>, AsrError> {
    let payload = gzip_compress(data)?;

    let (msg_flags, seq_value) = if is_last {
        (flags::NEG_WITH_SEQUENCE, -sequence)
    } else {
        (flags::POS_SEQUENCE, sequence)
    };

    let header = encode_header(
        MessageType::ClientAudioOnlyRequest,
        msg_flags,
        serialization::NO_SERIALIZATION,
        compression::GZIP,
    );

    let mut frame = Vec::with_capacity(4 + 4 + 4 + payload.len());
    frame.extend_from_slice(&header);
    frame.extend_from_slice(&seq_value.to_be_bytes());
    frame.extend_from_slice(&(payload.len() as u32).to_be_bytes());
    frame.extend_from_slice(&payload);

    Ok(frame)
}

// ============================== 服务端响应解析 ==============================

/// 解析服务端 SAUC 响应
pub fn parse_response(data: &[u8]) -> Result<SaucResponse, AsrError> {
    if data.len() < 4 {
        return Err(AsrError::Other("Response data too short".into()));
    }

    let header_size = (data[0] & 0x0f) as usize;
    let message_type = (data[1] >> 4) & 0x0f;
    let msg_flags = data[1] & 0x0f;
    let serialization_type = (data[2] >> 4) & 0x0f;
    let compression_type = data[2] & 0x0f;

    let mut offset = header_size * 4;
    let mut payload_sequence: i32 = 0;
    let mut is_last = false;
    let mut event: Option<i32> = None;

    // 解析 flags
    if msg_flags & 0x01 != 0 {
        payload_sequence = i32::from_be_bytes(
            data[offset..offset + 4]
                .try_into()
                .map_err(|_| AsrError::Other("Failed to read sequence".into()))?,
        );
        offset += 4;
    }
    if msg_flags & 0x02 != 0 {
        is_last = true;
    }
    if msg_flags & 0x04 != 0 {
        event = Some(i32::from_be_bytes(
            data[offset..offset + 4]
                .try_into()
                .map_err(|_| AsrError::Other("Failed to read event".into()))?,
        ));
        offset += 4;
    }

    let mut code: i32 = 0;
    let mut payload_size: u32 = 0;

    match message_type {
        t if t == MessageType::ClientFullRequest as u8 => {
            // 忽略回显的 CLIENT_FULL_REQUEST
        }
        t if t == MessageType::ServerFullResponse as u8 => {
            payload_size = u32::from_be_bytes(
                data[offset..offset + 4]
                    .try_into()
                    .map_err(|_| AsrError::Other("Failed to read payload size".into()))?,
            );
            offset += 4;
        }
        t if t == MessageType::ServerErrorResponse as u8 => {
            code = i32::from_be_bytes(
                data[offset..offset + 4]
                    .try_into()
                    .map_err(|_| AsrError::Other("Failed to read error code".into()))?,
            );
            payload_size = u32::from_be_bytes(
                data[offset + 4..offset + 8]
                    .try_into()
                    .map_err(|_| AsrError::Other("Failed to read error payload size".into()))?,
            );
            offset += 8;
        }
        _ => {
            return Err(AsrError::Other(format!(
                "Unknown message type: {}",
                message_type
            )));
        }
    }

    // 越界保护
    let raw_payload = if payload_size > 0 {
        let available = data.len().saturating_sub(offset);
        let actual_size = (payload_size as usize).min(available);
        &data[offset..offset + actual_size]
    } else {
        &data[offset..]
    };

    // 解压缩（失败时不阻断）
    let decompressed = if compression_type == compression::GZIP && !raw_payload.is_empty() {
        gzip_decompress(raw_payload).unwrap_or_else(|_| raw_payload.to_vec())
    } else {
        raw_payload.to_vec()
    };

    // JSON 解析（失败时返回 None）
    let payload_msg: Option<SaucResponsePayload> =
        if serialization_type == serialization::JSON && !decompressed.is_empty() {
            serde_json::from_slice(&decompressed).ok()
        } else {
            None
        };

    Ok(SaucResponse {
        code,
        event: event.unwrap_or(0),
        is_last_package: is_last,
        payload_sequence,
        payload_size,
        payload_msg,
    })
}

// ============================== 认证头 ==============================

/// 构建 SAUC 认证 HTTP 请求头
pub fn build_auth_headers(
    app_key: &str,
    access_key: &str,
    resource_id: &str,
) -> Vec<(String, String)> {
    let connect_id = uuid::Uuid::new_v4().to_string();
    vec![
        ("X-Api-App-Key".into(), app_key.to_string()),
        ("X-Api-Access-Key".into(), access_key.to_string()),
        ("X-Api-Resource-Id".into(), resource_id.to_string()),
        ("X-Api-Connect-Id".into(), connect_id),
    ]
}

// ============================== 错误码映射 ==============================

/// 获取错误码的中文描述
pub fn get_error_message(code: i32) -> String {
    match code {
        20000000 => "成功".into(),
        45000001 => "请求参数无效".into(),
        45000002 => "空音频".into(),
        45000081 => "等包超时".into(),
        45000151 => "音频格式不正确".into(),
        55000031 => "服务器繁忙".into(),
        _ if (55000000..56000000).contains(&code) => "服务内部处理错误".into(),
        _ => format!("未知错误: {}", code),
    }
}

// ============================== Gzip 辅助函数 ==============================

fn gzip_compress(data: &[u8]) -> Result<Vec<u8>, AsrError> {
    let mut encoder = flate2::write::GzEncoder::new(Vec::new(), flate2::Compression::default());
    encoder.write_all(data)?;
    encoder.finish().map_err(AsrError::from)
}

fn gzip_decompress(data: &[u8]) -> Result<Vec<u8>, AsrError> {
    let mut decoder = flate2::read::GzDecoder::new(data);
    let mut buf = Vec::new();
    decoder.read_to_end(&mut buf)?;
    Ok(buf)
}

// ============================== 测试 ==============================

#[cfg(test)]
mod tests {
    use super::*;

    fn make_test_params() -> SaucFullClientRequest {
        SaucFullClientRequest {
            user: Some(SaucUser {
                uid: Some("univoice-sdk".into()),
            }),
            audio: SaucAudioConfig {
                format: "pcm".into(),
                codec: Some("raw".into()),
                rate: Some(16000),
                bits: Some(16),
                channel: Some(1),
                language: Some("zh-CN".into()),
            },
            request: SaucRequestConfig {
                model_name: "bigmodel".into(),
                enable_itn: Some(true),
                enable_punc: Some(true),
                enable_ddc: Some(false),
                show_utterances: Some(true),
                end_window_size: None,
                enable_nonstream: None,
                vad_segment_duration: None,
                force_to_speech_time: None,
            },
        }
    }

    // ===== H: 帧头编码 =====

    #[test]
    fn test_h1_encode_header_default() {
        let h = encode_header(
            MessageType::ClientFullRequest,
            flags::POS_SEQUENCE,
            serialization::JSON,
            compression::GZIP,
        );
        assert_eq!(h, [0x11, 0x11, 0x11, 0x00]);
    }

    #[test]
    fn test_h2_encode_header_audio() {
        let h = encode_header(
            MessageType::ClientAudioOnlyRequest,
            flags::POS_SEQUENCE,
            serialization::NO_SERIALIZATION,
            compression::GZIP,
        );
        assert_eq!(h, [0x11, 0x21, 0x01, 0x00]);
    }

    #[test]
    fn test_h3_encode_header_last_frame() {
        let h = encode_header(
            MessageType::ClientAudioOnlyRequest,
            flags::NEG_WITH_SEQUENCE,
            serialization::NO_SERIALIZATION,
            compression::GZIP,
        );
        assert_eq!(h, [0x11, 0x23, 0x01, 0x00]);
    }

    #[test]
    fn test_h4_encode_header_no_compression() {
        let h = encode_header(
            MessageType::ClientFullRequest,
            flags::POS_SEQUENCE,
            serialization::JSON,
            compression::NONE,
        );
        assert_eq!(h, [0x11, 0x11, 0x10, 0x00]);
    }

    #[test]
    fn test_h5_encode_header_no_sequence() {
        let h = encode_header(
            MessageType::ClientAudioOnlyRequest,
            flags::NO_SEQUENCE,
            serialization::NO_SERIALIZATION,
            compression::GZIP,
        );
        assert_eq!(h, [0x11, 0x20, 0x01, 0x00]);
    }

    #[test]
    fn test_h6_encode_header_neg_only() {
        let h = encode_header(
            MessageType::ClientAudioOnlyRequest,
            flags::NEG_SEQUENCE,
            serialization::NO_SERIALIZATION,
            compression::GZIP,
        );
        assert_eq!(h, [0x11, 0x22, 0x01, 0x00]);
    }

    // ===== F: Full Client Request =====

    #[test]
    fn test_f1_encode_full_client_with_gzip() {
        let params = make_test_params();
        let frame = encode_full_client_request(&params, 1, true).unwrap();
        assert!(frame.len() > 12);
        assert_eq!(&frame[0..4], &[0x11, 0x11, 0x11, 0x00]);
        assert_eq!(&frame[4..8], &1i32.to_be_bytes());
        // payload 可解压且合法
        let payload = &frame[12..];
        let decompressed = gzip_decompress(payload).unwrap();
        let parsed: serde_json::Value = serde_json::from_slice(&decompressed).unwrap();
        assert!(parsed.get("audio").is_some());
    }

    #[test]
    fn test_f2_encode_full_client_no_gzip() {
        let params = make_test_params();
        let frame = encode_full_client_request(&params, 1, false).unwrap();
        assert_eq!(&frame[0..4], &[0x11, 0x11, 0x10, 0x00]);
        // 不压缩，payload 为明文 JSON
        let payload = &frame[12..];
        let parsed: serde_json::Value = serde_json::from_slice(payload).unwrap();
        assert!(parsed.get("audio").is_some());
    }

    #[test]
    fn test_f3_encode_full_client_minimal() {
        let params = SaucFullClientRequest {
            user: None,
            audio: SaucAudioConfig {
                format: "pcm".into(),
                codec: None,
                rate: None,
                bits: None,
                channel: None,
                language: None,
            },
            request: SaucRequestConfig {
                model_name: "bigmodel".into(),
                enable_itn: None,
                enable_punc: None,
                enable_ddc: None,
                show_utterances: None,
                end_window_size: None,
                enable_nonstream: None,
                vad_segment_duration: None,
                force_to_speech_time: None,
            },
        };
        let frame = encode_full_client_request(&params, 1, true).unwrap();
        let payload = &frame[12..];
        let decompressed = gzip_decompress(payload).unwrap();
        let parsed: serde_json::Value = serde_json::from_slice(&decompressed).unwrap();
        assert!(parsed.get("audio").is_some());
        assert!(parsed.get("request").is_some());
    }

    // ===== A: Audio Request =====

    #[test]
    fn test_a1_encode_audio_normal() {
        let audio_data = vec![0u8; 3200];
        let frame = encode_audio_request(1, &audio_data, false).unwrap();
        assert_eq!(&frame[0..4], &[0x11, 0x21, 0x01, 0x00]);
        assert_eq!(&frame[4..8], &1i32.to_be_bytes());
        let payload_size = u32::from_be_bytes(frame[8..12].try_into().unwrap()) as usize;
        let compressed = &frame[12..12 + payload_size];
        let decompressed = gzip_decompress(compressed).unwrap();
        assert_eq!(decompressed, audio_data);
    }

    #[test]
    fn test_a2_encode_audio_last_frame() {
        let frame = encode_audio_request(5, &[], true).unwrap();
        assert_eq!(&frame[0..4], &[0x11, 0x23, 0x01, 0x00]);
        assert_eq!(&frame[4..8], &(-5i32).to_be_bytes());
        let payload_size = u32::from_be_bytes(frame[8..12].try_into().unwrap()) as usize;
        assert!(payload_size > 0, "末帧空数据 gzip 后应约有 20 字节");
        let compressed = &frame[12..12 + payload_size];
        let decompressed = gzip_decompress(compressed).unwrap();
        assert!(decompressed.is_empty());
    }

    #[test]
    fn test_a3_encode_audio_sequence_increment() {
        for expected_seq in [2i32, 3, 4] {
            let frame = encode_audio_request(expected_seq, &[0u8; 10], false).unwrap();
            let seq = i32::from_be_bytes(frame[4..8].try_into().unwrap());
            assert_eq!(seq, expected_seq);
        }
    }

    #[test]
    fn test_a4_encode_audio_empty_middle() {
        let frame = encode_audio_request(3, &[], false).unwrap();
        // 空数据也会产生有效的 gzip
        let payload_size = u32::from_be_bytes(frame[8..12].try_into().unwrap()) as usize;
        assert!(payload_size > 0);
        let compressed = &frame[12..12 + payload_size];
        let decompressed = gzip_decompress(compressed).unwrap();
        assert!(decompressed.is_empty());
    }

    #[test]
    fn test_a5_encode_audio_max_sequence() {
        let frame = encode_audio_request(i32::MAX, &[0u8; 1], false).unwrap();
        let seq = i32::from_be_bytes(frame[4..8].try_into().unwrap());
        assert_eq!(seq, i32::MAX);
    }

    // ===== P: 服务端响应解析 =====

    fn build_server_response(
        payload_json: &str,
        sequence: i32,
        is_last: bool,
        has_event: bool,
        event_code: i32,
    ) -> Vec<u8> {
        let compressed = gzip_compress(payload_json.as_bytes()).unwrap();
        let msg_flags = if is_last {
            flags::NEG_WITH_SEQUENCE
        } else {
            flags::POS_SEQUENCE
        } | if has_event { 0b0100 } else { 0 };
        let mut frame = Vec::new();
        frame.extend_from_slice(&[
            0x11,
            (MessageType::ServerFullResponse as u8) << 4 | msg_flags,
            0x11,
            0x00,
        ]);
        // Sequence (仅 POS_SEQUENCE 或 NEG_WITH_SEQUENCE 时)
        frame.extend_from_slice(&sequence.to_be_bytes());
        // Event（可选）
        if has_event {
            frame.extend_from_slice(&event_code.to_be_bytes());
        }
        // Payload size
        frame.extend_from_slice(&(compressed.len() as u32).to_be_bytes());
        // Payload
        frame.extend_from_slice(&compressed);
        frame
    }

    fn build_error_response(code: i32, payload_json: &str) -> Vec<u8> {
        let compressed = gzip_compress(payload_json.as_bytes()).unwrap();
        let mut frame = Vec::new();
        frame.extend_from_slice(&[0x11, 0xF0, 0x11, 0x00]);
        frame.extend_from_slice(&code.to_be_bytes());
        frame.extend_from_slice(&(compressed.len() as u32).to_be_bytes());
        frame.extend_from_slice(&compressed);
        frame
    }

    #[test]
    fn test_p1_parse_full_response_with_text() {
        let frame = build_server_response(r#"{"result":{"text":"你好世界"}}"#, 1, false, false, 0);
        let response = parse_response(&frame).unwrap();
        assert_eq!(response.code, 0);
        assert_eq!(
            response.payload_msg.unwrap().result.unwrap().text,
            "你好世界"
        );
    }

    #[test]
    fn test_p2_parse_full_response_with_utterances() {
        let frame = build_server_response(
            r#"{"result":{"text":"你好","utterances":[{"text":"你好","start_time":0,"end_time":500,"definite":true}]}}"#,
            1,
            false,
            false,
            0,
        );
        let response = parse_response(&frame).unwrap();
        let payload = response.payload_msg.unwrap();
        let result = payload.result.unwrap();
        assert_eq!(result.text, "你好");
        let utt = &result.utterances.unwrap()[0];
        assert_eq!(utt.text, "你好");
        assert!(utt.definite);
    }

    #[test]
    fn test_p3_parse_error_response() {
        let frame = build_error_response(45000001, "");
        let response = parse_response(&frame).unwrap();
        assert_eq!(response.code, 45000001);
        assert!(response.payload_msg.is_none());
    }

    #[test]
    fn test_p4_parse_error_response_with_payload() {
        let frame = build_error_response(55000031, r#"{"message":"busy"}"#);
        let response = parse_response(&frame).unwrap();
        assert_eq!(response.code, 55000031);
        assert!(response.payload_msg.is_some());
    }

    #[test]
    fn test_p5_parse_response_too_short() {
        let result = parse_response(&[0x00, 0x00]);
        assert!(result.is_err());
    }

    #[test]
    fn test_p6_parse_response_with_event() {
        let frame = build_server_response(r#"{"result":{"text":"hi"}}"#, 1, false, true, 20000000);
        let response = parse_response(&frame).unwrap();
        assert_eq!(response.code, 0);
        assert_eq!(response.event, 20000000);
        assert!(response.payload_msg.is_some());
    }

    #[test]
    fn test_p7_parse_response_last_with_event() {
        let frame =
            build_server_response(r#"{"result":{"text":"done"}}"#, -3, true, true, 20000000);
        let response = parse_response(&frame).unwrap();
        assert!(response.is_last_package);
        assert!(response.payload_sequence < 0);
        assert_eq!(response.event, 20000000);
    }

    #[test]
    fn test_p8_parse_response_with_audio_info() {
        let frame = build_server_response(r#"{"audio_info":{"duration":3.5}}"#, 1, false, false, 0);
        let response = parse_response(&frame).unwrap();
        let info = response.payload_msg.unwrap().audio_info.unwrap();
        assert!((info.duration - 3.5).abs() < f64::EPSILON);
    }

    #[test]
    fn test_p9_parse_invalid_json_payload() {
        // 构造一个合法的帧，但 payload 是非法的 JSON
        let compressed = gzip_compress(b"not valid json").unwrap();
        let mut frame = Vec::new();
        frame.extend_from_slice(&[0x11, 0x91, 0x11, 0x00]);
        frame.extend_from_slice(&1i32.to_be_bytes());
        frame.extend_from_slice(&(compressed.len() as u32).to_be_bytes());
        frame.extend_from_slice(&compressed);
        let response = parse_response(&frame).unwrap();
        assert!(response.payload_msg.is_none());
    }

    #[test]
    fn test_p10_parse_response_no_sequence() {
        // NO_SEQUENCE 标志，无 seq 字段
        let compressed = gzip_compress(r#"{"result":{"text":"ok"}}"#.as_bytes()).unwrap();
        let mut frame = Vec::new();
        frame.extend_from_slice(&[0x11, 0x90, 0x11, 0x00]); // ServerFullResponse + NO_SEQUENCE
        frame.extend_from_slice(&(compressed.len() as u32).to_be_bytes());
        frame.extend_from_slice(&compressed);
        let response = parse_response(&frame).unwrap();
        assert_eq!(response.payload_sequence, 0);
    }

    #[test]
    fn test_p11_parse_response_client_full_echo() {
        let json = r#"{"audio":{"format":"pcm"},"request":{"model_name":"bigmodel"}}"#;
        let compressed = gzip_compress(json.as_bytes()).unwrap();
        let mut frame = Vec::new();
        frame.extend_from_slice(&[0x11, 0x11, 0x11, 0x00]);
        frame.extend_from_slice(&1i32.to_be_bytes());
        frame.extend_from_slice(&(compressed.len() as u32).to_be_bytes());
        frame.extend_from_slice(&compressed);
        let response = parse_response(&frame).unwrap();
        assert_eq!(response.code, 0);
        assert!(response.payload_msg.is_none());
    }

    #[test]
    fn test_p12_parse_response_payload_overflow() {
        let mut frame = Vec::new();
        frame.extend_from_slice(&[0x11, 0x91, 0x11, 0x00]);
        frame.extend_from_slice(&1i32.to_be_bytes());
        frame.extend_from_slice(&1_000_000u32.to_be_bytes());
        frame.extend_from_slice(&[0u8; 10]);
        // 不 panic
        let response = parse_response(&frame).unwrap();
        assert!(response.payload_msg.is_none());
    }

    #[test]
    fn test_p13_parse_response_neg_sequence_only() {
        let compressed = gzip_compress(r#"{"result":{"text":"done"}}"#.as_bytes()).unwrap();
        let mut frame = Vec::new();
        // ServerFullResponse + NEG_SEQUENCE | EVENT
        frame.extend_from_slice(&[0x11, 0x96, 0x11, 0x00]);
        frame.extend_from_slice(&0i32.to_be_bytes()); // event = SUCCESS
        frame.extend_from_slice(&(compressed.len() as u32).to_be_bytes());
        frame.extend_from_slice(&compressed);
        let response = parse_response(&frame).unwrap();
        assert!(response.is_last_package);
        assert_eq!(response.payload_sequence, 0);
        assert_eq!(response.event, 0);
        assert!(response.payload_msg.is_some());
    }

    #[test]
    fn test_p14_parse_response_event_only() {
        let compressed = gzip_compress(r#"{"result":{"text":"hi"}}"#.as_bytes()).unwrap();
        let mut frame = Vec::new();
        // ServerFullResponse + EVENT (NO_SEQUENCE)
        frame.extend_from_slice(&[0x11, 0x94, 0x11, 0x00]);
        frame.extend_from_slice(&20000000i32.to_be_bytes()); // event = SUCCESS
        frame.extend_from_slice(&(compressed.len() as u32).to_be_bytes());
        frame.extend_from_slice(&compressed);
        let response = parse_response(&frame).unwrap();
        assert!(!response.is_last_package);
        assert_eq!(response.payload_sequence, 0);
        assert_eq!(response.event, 20000000);
        assert!(response.payload_msg.is_some());
    }

    #[test]
    fn test_p15_parse_response_unexpected_type() {
        let mut frame = Vec::new();
        frame.extend_from_slice(&[0x11, 0x21, 0x01, 0x00]);
        frame.extend_from_slice(&1i32.to_be_bytes());
        let result = parse_response(&frame);
        assert!(result.is_err());
        assert!(
            result
                .unwrap_err()
                .to_string()
                .contains("Unknown message type")
        );
    }

    // ===== E: 错误码映射 =====

    #[test]
    fn test_e1_error_message_success() {
        assert_eq!(get_error_message(20000000), "成功");
    }

    #[test]
    fn test_e2_error_message_invalid_request() {
        assert_eq!(get_error_message(45000001), "请求参数无效");
    }

    #[test]
    fn test_e3_error_message_empty_audio() {
        assert_eq!(get_error_message(45000002), "空音频");
    }

    #[test]
    fn test_e4_error_message_timeout() {
        assert_eq!(get_error_message(45000081), "等包超时");
    }

    #[test]
    fn test_e5_error_message_invalid_format() {
        assert_eq!(get_error_message(45000151), "音频格式不正确");
    }

    #[test]
    fn test_e6_error_message_server_busy() {
        assert_eq!(get_error_message(55000031), "服务器繁忙");
    }

    #[test]
    fn test_e7_error_message_internal() {
        assert_eq!(get_error_message(55000100), "服务内部处理错误");
    }

    #[test]
    fn test_e8_error_message_internal_edge_low() {
        assert_eq!(get_error_message(55000000), "服务内部处理错误");
    }

    #[test]
    fn test_e9_error_message_internal_edge_high() {
        assert_eq!(get_error_message(55999999), "服务内部处理错误");
    }

    #[test]
    fn test_e10_error_message_unknown() {
        assert!(get_error_message(99999999).contains("未知错误"));
    }

    // ===== B: 认证头 =====

    #[test]
    fn test_b1_auth_headers_all_fields() {
        let headers = build_auth_headers("test-app", "test-access", "volc.bigasr.sauc.duration");
        assert!(headers.iter().any(|(k, _)| k == "X-Api-App-Key"));
        assert!(headers.iter().any(|(k, _)| k == "X-Api-Access-Key"));
        assert!(headers.iter().any(|(k, _)| k == "X-Api-Resource-Id"));
        assert!(headers.iter().any(|(k, _)| k == "X-Api-Connect-Id"));
        assert_eq!(
            headers
                .iter()
                .find(|(k, _)| k == "X-Api-App-Key")
                .unwrap()
                .1,
            "test-app"
        );
        assert_eq!(
            headers
                .iter()
                .find(|(k, _)| k == "X-Api-Resource-Id")
                .unwrap()
                .1,
            "volc.bigasr.sauc.duration"
        );
    }

    #[test]
    fn test_b2_auth_headers_default_resource_id() {
        let headers = build_auth_headers("app", "access", "volc.bigasr.sauc.duration");
        assert_eq!(
            headers
                .iter()
                .find(|(k, _)| k == "X-Api-Resource-Id")
                .unwrap()
                .1,
            "volc.bigasr.sauc.duration"
        );
    }

    #[test]
    fn test_b3_auth_headers_connect_id_is_uuid() {
        let headers = build_auth_headers("a", "b", "c");
        let connect_id = headers
            .iter()
            .find(|(k, _)| k == "X-Api-Connect-Id")
            .unwrap()
            .1
            .clone();
        let parsed = uuid::Uuid::parse_str(&connect_id);
        assert!(parsed.is_ok());
    }
}
