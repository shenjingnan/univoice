use futures_util::StreamExt;

use common::mock_dashscope_server::{MockDashScopeServer, ServerCommand};
use univoice::asr::{
    AsrConnectOption, AsrError, AsrProvider, AudioInput, AudioStream, BaseProviderOption,
    ConnectionState, DEFAULT_CHUNK_SIZE, QwenAsr, QwenAsrOption, adapt_audio_input,
};

mod common;

/// 辅助函数：创建 QwenAsr 实例，指向 mock server
fn make_provider(ws_url: &str) -> QwenAsr {
    QwenAsr::new(QwenAsrOption {
        base: BaseProviderOption {
            api_key: Some("test-key".into()),
            base_url: Some(ws_url.to_string()),
            ..Default::default()
        },
        ..Default::default()
    })
}

/// 辅助函数：创建模拟音频数据流
fn make_audio_stream() -> AudioStream {
    let audio_data = vec![0u8; 32000];
    adapt_audio_input(AudioInput::Data(audio_data), DEFAULT_CHUNK_SIZE)
}

// -------- 3.1 正常流程 --------

#[tokio::test]
async fn test_m1_happy_path() {
    let mut server = MockDashScopeServer::start().await;
    let ws_url = format!("ws://{}", server.addr);

    let provider = make_provider(&ws_url);
    let audio = make_audio_stream();

    // 驱动 mock server 行为
    server.send_command(ServerCommand::ExpectRunTask);
    server.send_command(ServerCommand::ExpectAudioThenResults {
        sentences: vec!["你好".into(), "世界".into()],
        is_final: vec![false, true],
    });
    server.send_command(ServerCommand::ExpectFinishTask {
        final_sentence: None,
    });

    // 执行识别
    let mut stream = provider.listen_stream(audio).await.unwrap();
    let mut chunks = Vec::new();
    while let Some(result) = stream.next().await {
        chunks.push(result.unwrap());
    }

    // 验证
    assert_eq!(chunks.len(), 2);
    assert_eq!(chunks[0].text, "你好");
    assert!(!chunks[0].is_final);
    assert_eq!(chunks[1].text, "世界");
    assert!(chunks[1].is_final);

    server.check_errors().await;
    assert!(
        server.errors.is_empty(),
        "Mock server errors: {:?}",
        server.errors
    );
}

#[tokio::test]
async fn test_m2_happy_path_final_sentence() {
    let mut server = MockDashScopeServer::start().await;
    let ws_url = format!("ws://{}", server.addr);

    let provider = make_provider(&ws_url);
    let audio = make_audio_stream();

    server.send_command(ServerCommand::ExpectRunTask);
    server.send_command(ServerCommand::ExpectAudioThenResults {
        sentences: vec!["中间结果".into()],
        is_final: vec![false],
    });
    server.send_command(ServerCommand::ExpectFinishTask {
        final_sentence: Some("最终结果".into()),
    });

    let mut stream = provider.listen_stream(audio).await.unwrap();
    let mut chunks = Vec::new();
    while let Some(result) = stream.next().await {
        chunks.push(result.unwrap());
    }

    assert_eq!(chunks.len(), 2);
    assert_eq!(chunks[0].text, "中间结果");
    assert!(!chunks[0].is_final);
    assert_eq!(chunks[1].text, "最终结果");
    assert!(chunks[1].is_final);

    server.check_errors().await;
    assert!(
        server.errors.is_empty(),
        "Mock server errors: {:?}",
        server.errors
    );
}

// -------- 3.2 错误场景 --------

#[tokio::test]
async fn test_m3_task_failed_rejection() {
    let server = MockDashScopeServer::start().await;
    let ws_url = format!("ws://{}", server.addr);

    let provider = make_provider(&ws_url);
    let audio = make_audio_stream();

    server.send_command(ServerCommand::SendTaskFailed {
        code: "400".into(),
        message: "Invalid audio format".into(),
    });

    let result = provider.listen_stream(audio).await;
    match result {
        Err(AsrError::AsrServiceError { code: _, message }) => {
            assert!(message.contains("Invalid audio format"));
        }
        Ok(_) => panic!("Expected error, got Ok"),
        Err(e) => panic!("Expected AsrServiceError, got {}", e),
    }
}

#[tokio::test]
async fn test_m4_connection_timeout() {
    // 端口 1 连接被拒（非超时），端口 0 不可用（被占用）
    // 使用保留端口以确保连接失败
    let provider = QwenAsr::new(QwenAsrOption {
        base: BaseProviderOption {
            api_key: Some("test-key".into()),
            base_url: Some("ws://127.0.0.1:1".into()),
            ..Default::default()
        },
        ..Default::default()
    });
    let audio: AudioStream = Box::pin(futures_util::stream::empty());

    let result = provider.listen_stream(audio).await;
    // 连接被拒绝或超时都算正确（取决于 OS 的行为）
    match result {
        Err(AsrError::Timeout(_) | AsrError::Websocket(_)) => { /* expected */ }
        Ok(_) => panic!("Expected error, got Ok"),
        Err(e) => panic!("Expected Timeout or Websocket error, got {}", e),
    }
}

#[tokio::test]
async fn test_m5_mid_stream_service_error() {
    let mut server = MockDashScopeServer::start().await;
    let ws_url = format!("ws://{}", server.addr);

    let provider = make_provider(&ws_url);
    let audio = make_audio_stream();

    server.send_command(ServerCommand::ExpectRunTask);
    server.send_command(ServerCommand::ExpectAudioThenResults {
        sentences: vec!["部分结果".into()],
        is_final: vec![false],
    });
    // 不发 ExpectFinishTask，而是发送 task-failed
    server.send_command(ServerCommand::SendTaskFailed {
        code: "500".into(),
        message: "Internal server error".into(),
    });

    let mut stream = provider.listen_stream(audio).await.unwrap();
    let mut got_partial = false;
    let mut got_error = false;

    while let Some(result) = stream.next().await {
        match result {
            Ok(chunk) => {
                if chunk.text == "部分结果" {
                    got_partial = true;
                }
            }
            Err(AsrError::AsrServiceError {
                code: _,
                message: _,
            }) => {
                got_error = true;
            }
            Err(other) => {
                panic!("Unexpected error: {}", other);
            }
        }
    }

    assert!(got_partial, "Should have received partial result");
    assert!(got_error, "Should have received error");

    server.check_errors().await;
    assert!(
        server.errors.is_empty(),
        "Mock server errors: {:?}",
        server.errors
    );
}

// -------- 3.3 边界场景 --------

#[tokio::test]
async fn test_m6_empty_audio() {
    let mut server = MockDashScopeServer::start().await;
    let ws_url = format!("ws://{}", server.addr);

    let provider = make_provider(&ws_url);
    // 空音频流
    let audio: AudioStream = Box::pin(futures_util::stream::empty());

    server.send_command(ServerCommand::ExpectRunTask);
    server.send_command(ServerCommand::ExpectFinishTask {
        final_sentence: None,
    });

    let mut stream = provider.listen_stream(audio).await.unwrap();
    let mut chunk_count = 0;
    while let Some(result) = stream.next().await {
        result.unwrap();
        chunk_count += 1;
    }

    // 空音频不应产生任何 chunk
    assert_eq!(chunk_count, 0);

    server.check_errors().await;
    assert!(
        server.errors.is_empty(),
        "Mock server errors: {:?}",
        server.errors
    );
}

#[tokio::test]
async fn test_m7_connect_then_listen() {
    let mut server = MockDashScopeServer::start().await;
    let ws_url = format!("ws://{}", server.addr);

    let provider = make_provider(&ws_url);
    let audio = make_audio_stream();

    server.send_command(ServerCommand::ExpectRunTask);
    server.send_command(ServerCommand::ExpectAudioThenResults {
        sentences: vec!["你好".into()],
        is_final: vec![true],
    });
    server.send_command(ServerCommand::ExpectFinishTask {
        final_sentence: None,
    });

    // Step 1: 预建立连接
    let mut connection = provider
        .connect(AsrConnectOption::default())
        .await
        .expect("connect failed");

    // Step 2: 在已建立连接上识别
    let mut stream = connection.listen_stream(audio).await.unwrap();
    let mut chunks = Vec::new();
    while let Some(result) = stream.next().await {
        chunks.push(result.unwrap());
    }

    assert_eq!(chunks.len(), 1);
    assert_eq!(chunks[0].text, "你好");

    // Step 3: 关闭连接
    connection.close().await.unwrap();
    assert_eq!(connection.state(), ConnectionState::Closed);

    // Step 4: close 后再 listen 应返回错误
    let audio2: AudioStream = Box::pin(futures_util::stream::empty());
    let result = connection.listen_stream(audio2).await;
    assert!(matches!(result, Err(AsrError::ConnectionClosed)));

    server.check_errors().await;
    assert!(
        server.errors.is_empty(),
        "Mock server errors: {:?}",
        server.errors
    );
}
