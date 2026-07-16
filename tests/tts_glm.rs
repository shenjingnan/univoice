//! GLM (智谱) TTS Provider 集成测试
//!
//! 使用 [`MockGlmHttpServer`] 在本地 HTTP mock 上验证 `GlmTts` 的端到端行为，
//! 不依赖真实 API Key 与网络。

use futures_util::StreamExt;

use common::mock_glm_http_server::{GlmMockCommand, MockGlmHttpServer};
use univoice::tts::provider::{GlmTts, GlmTtsOption};
use univoice::tts::{BaseTtsOption, TextStream, TtsError, TtsProvider, TtsRequest};

mod common;

/// 创建指向 mock server 的 GlmTts 实例
fn make_provider(http_url: &str) -> GlmTts {
    GlmTts::new(GlmTtsOption {
        base: BaseTtsOption {
            api_key: Some("test-key".into()),
            base_url: Some(http_url.to_string()),
            ..Default::default()
        },
        ..Default::default()
    })
}

// -------- i1 非流式 happy path --------

#[tokio::test]
async fn test_i1_synthesize_happy_path() {
    let server = MockGlmHttpServer::start().await;
    let url = format!("http://{}", server.addr);
    let tts = make_provider(&url);

    let audio_bytes = b"RIFF<wav-bytes>".to_vec();
    server.send_command(GlmMockCommand::RespondBinary(audio_bytes.clone()));

    let resp = tts
        .synthesize(TtsRequest {
            text: "你好".into(),
            options: None,
        })
        .await
        .expect("synthesize should succeed");

    assert_eq!(resp.audio, audio_bytes);
    // 默认格式 pcm，经 map_format 透传
    assert_eq!(resp.format, "pcm");
}

// -------- i2 流式 happy path（多帧 base64 PCM + stop） --------

#[tokio::test]
async fn test_i2_stream_happy_path() {
    let server = MockGlmHttpServer::start().await;
    let url = format!("http://{}", server.addr);
    let tts = make_provider(&url);

    // "SGVsbG8=" → b"Hello"，"V29ybGQ=" → b"World"
    let frame1 = r#"{"choices":[{"index":0,"delta":{"content":"SGVsbG8="}}]}"#;
    let frame2 = r#"{"choices":[{"index":1,"delta":{"content":"V29ybGQ="}}]}"#;
    let frame3 = r#"{"choices":[{"finish_reason":"stop","index":2}]}"#;
    server.send_command(GlmMockCommand::RespondSse {
        frames: vec![frame1.into(), frame2.into(), frame3.into()],
    });

    let input: TextStream = Box::pin(futures_util::stream::iter(vec!["你好".to_string()]));
    let mut stream = tts.speak_stream(input).await.expect("speak_stream ok");

    let mut chunks = Vec::new();
    while let Some(r) = stream.next().await {
        chunks.push(r.expect("chunk ok"));
    }
    assert_eq!(chunks.len(), 2);
    assert_eq!(chunks[0].audio_chunk, b"Hello");
    assert_eq!(chunks[1].audio_chunk, b"World");
}

// -------- i3 HTTP 错误 → ServiceError --------

#[tokio::test]
async fn test_i3_http_error() {
    let server = MockGlmHttpServer::start().await;
    let url = format!("http://{}", server.addr);
    let tts = make_provider(&url);

    server.send_command(GlmMockCommand::RespondError {
        status: 400,
        code: "1214".into(),
        message: "音色id不存在".into(),
    });

    let result = tts
        .synthesize(TtsRequest {
            text: "x".into(),
            options: None,
        })
        .await;
    match result {
        Err(TtsError::ServiceError { code, message }) => {
            assert_eq!(code, "1214");
            assert!(message.contains("音色"));
        }
        other => panic!("expected ServiceError, got {other:?}"),
    }
}

// -------- i4 SSE 中途 error 帧 --------

#[tokio::test]
async fn test_i4_sse_error_frame() {
    let server = MockGlmHttpServer::start().await;
    let url = format!("http://{}", server.addr);
    let tts = make_provider(&url);

    let err_frame = r#"{"error":{"code":"1214","message":"音色id不存在"}}"#;
    server.send_command(GlmMockCommand::RespondSse {
        frames: vec![err_frame.into()],
    });

    let input: TextStream = Box::pin(futures_util::stream::iter(vec!["x".to_string()]));
    let mut stream = tts.speak_stream(input).await.expect("speak_stream ok");
    let first = stream.next().await.expect("should receive an event");
    match first {
        Err(TtsError::ServiceError { code, .. }) => assert_eq!(code, "1214"),
        other => panic!("expected ServiceError, got {other:?}"),
    }
}

// -------- i5 空音频 → NoAudio --------

#[tokio::test]
async fn test_i5_empty_audio() {
    let server = MockGlmHttpServer::start().await;
    let url = format!("http://{}", server.addr);
    let tts = make_provider(&url);

    server.send_command(GlmMockCommand::RespondBinary(Vec::new()));

    let result = tts
        .synthesize(TtsRequest {
            text: "x".into(),
            options: None,
        })
        .await;
    assert!(matches!(result, Err(TtsError::NoAudio)));
}

// -------- i6 跨 chunk 的 SSE 帧（行拼接） --------

#[tokio::test]
async fn test_i6_cross_chunk_sse() {
    let server = MockGlmHttpServer::start().await;
    let url = format!("http://{}", server.addr);
    let tts = make_provider(&url);

    // 一帧 SSE 被拆成多段，验证 SseLineParser 的跨 chunk 拼接
    server.send_command(GlmMockCommand::RespondSseSplit {
        chunks: vec![
            "data: {\"choices\":[".into(),
            "{\"index\":0,\"delta\":{\"content\":\"AA==\"}}]}\n\n".into(),
            "data: {\"choices\":[".into(),
            "{\"finish_reason\":\"stop\"}]}\n\n".into(),
        ],
    });

    let input: TextStream = Box::pin(futures_util::stream::iter(vec!["x".to_string()]));
    let mut stream = tts.speak_stream(input).await.expect("speak_stream ok");

    let mut chunks = Vec::new();
    while let Some(r) = stream.next().await {
        match r {
            Ok(c) => chunks.push(c),
            Err(e) => panic!("unexpected error: {e}"),
        }
    }
    // 仅第一帧含音频；stop 帧不产出
    assert_eq!(chunks.len(), 1);
    // base64 "AA==" → 单字节 0x00
    assert_eq!(chunks[0].audio_chunk, b"\x00");
}
