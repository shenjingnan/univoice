//! GLM TTS HTTP mock server（用于集成测试）
//!
//! 基于 tokio `TcpListener` 手写最小 HTTP/1.1 服务器，仿
//! [`mock_dashscope_server`] 的命令驱动模式。每条命令对应一次
//! accept + 读请求 + 写响应（响应带 `Connection: close`）。
//!
//! 用于在无网络、无真实 API Key 的条件下验证 [`GlmTts`] 的非流式 /
//! 流式 / 错误处理 / 跨 chunk SSE 拼接行为。

use std::time::Duration;

use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;
use tokio::sync::{mpsc, oneshot};

/// Mock 行为指令
#[derive(Debug, Clone)]
#[allow(clippy::enum_variant_names)] // 统一 `Respond` 前缀以清晰表达「响应」语义
pub enum GlmMockCommand {
    /// 200 + 二进制音频（非流式 synthesize）
    #[allow(dead_code)]
    RespondBinary(Vec<u8>),
    /// 200 + `text/event-stream`，每帧为 data 负载 JSON（自动加 `data: ` 前缀）
    #[allow(dead_code)]
    RespondSse { frames: Vec<String> },
    /// 200 + `text/event-stream`，按原始字节片段逐段写入（模拟跨 TCP chunk，验证行拼接）
    #[allow(dead_code)]
    RespondSseSplit { chunks: Vec<String> },
    /// 错误状态码 + `{"error":{"code","message"}}`
    #[allow(dead_code)]
    RespondError {
        status: u16,
        code: String,
        message: String,
    },
}

/// GLM HTTP mock 句柄
pub struct MockGlmHttpServer {
    pub addr: std::net::SocketAddr,
    cmd_tx: mpsc::UnboundedSender<GlmMockCommand>,
    shutdown_tx: Option<oneshot::Sender<()>>,
    handle: Option<tokio::task::JoinHandle<()>>,
}

impl MockGlmHttpServer {
    /// 启动 mock，绑定 `127.0.0.1` 动态端口
    pub async fn start() -> Self {
        let listener = TcpListener::bind("127.0.0.1:0")
            .await
            .expect("Failed to bind GLM mock server");
        let addr = listener.local_addr().unwrap();
        let (cmd_tx, mut cmd_rx) = mpsc::unbounded_channel::<GlmMockCommand>();
        let (shutdown_tx, mut shutdown_rx) = oneshot::channel::<()>();

        let handle = tokio::spawn(async move {
            let step_timeout = Duration::from_secs(5);
            while let Some(cmd) = cmd_rx.recv().await {
                // 每条命令接受一个新连接
                let (mut sock, _) = tokio::select! {
                    r = listener.accept() => match r {
                        Ok(c) => c,
                        Err(_) => continue,
                    },
                    _ = &mut shutdown_rx => return,
                };

                // 读请求 headers（忽略 body；GLM 请求体很小，不会阻塞写入）
                let _ = tokio::time::timeout(step_timeout, read_headers(&mut sock)).await;

                match cmd {
                    GlmMockCommand::RespondBinary(audio) => {
                        let resp = build_binary_response(&audio);
                        let _ = sock.write_all(&resp).await;
                    }
                    GlmMockCommand::RespondSse { frames } => {
                        let head = b"HTTP/1.1 200 OK\r\nContent-Type: text/event-stream\r\nConnection: close\r\n\r\n";
                        let _ = sock.write_all(head).await;
                        for frame in &frames {
                            let line = format!("data: {frame}\n\n");
                            let _ = sock.write_all(line.as_bytes()).await;
                        }
                    }
                    GlmMockCommand::RespondSseSplit { chunks } => {
                        let head = b"HTTP/1.1 200 OK\r\nContent-Type: text/event-stream\r\nConnection: close\r\n\r\n";
                        let _ = sock.write_all(head).await;
                        for chunk in &chunks {
                            let _ = sock.write_all(chunk.as_bytes()).await;
                            // flush + 让出调度，促使 reqwest 分次读到 chunk 边界
                            let _ = sock.flush().await;
                            tokio::time::sleep(Duration::from_millis(5)).await;
                        }
                    }
                    GlmMockCommand::RespondError {
                        status,
                        code,
                        message,
                    } => {
                        let resp = build_error_response(status, &code, &message);
                        let _ = sock.write_all(&resp).await;
                    }
                }
                let _ = sock.shutdown().await;
            }
        });

        Self {
            addr,
            cmd_tx,
            shutdown_tx: Some(shutdown_tx),
            handle: Some(handle),
        }
    }

    /// 发送命令
    pub fn send_command(&self, cmd: GlmMockCommand) {
        let _ = self.cmd_tx.send(cmd);
    }
}

impl Drop for MockGlmHttpServer {
    fn drop(&mut self) {
        if let Some(tx) = self.shutdown_tx.take() {
            let _ = tx.send(());
        }
        if let Some(h) = self.handle.take() {
            h.abort();
        }
    }
}

/// 读 HTTP 请求 headers 直到 `\r\n\r\n`
async fn read_headers(sock: &mut tokio::net::TcpStream) {
    let mut buf = Vec::new();
    let mut tmp = [0u8; 2048];
    loop {
        let n = match sock.read(&mut tmp).await {
            Ok(n) => n,
            Err(_) => return,
        };
        if n == 0 {
            return;
        }
        buf.extend_from_slice(&tmp[..n]);
        if buf.windows(4).any(|w| w == b"\r\n\r\n") {
            return;
        }
        if buf.len() > 1 << 20 {
            return;
        }
    }
}

fn build_binary_response(audio: &[u8]) -> Vec<u8> {
    let head = format!(
        "HTTP/1.1 200 OK\r\nContent-Type: application/octet-stream\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
        audio.len()
    );
    let mut out = head.into_bytes();
    out.extend_from_slice(audio);
    out
}

fn build_error_response(status: u16, code: &str, message: &str) -> Vec<u8> {
    let reason = http_reason_phrase(status);
    let body = serde_json::json!({ "error": { "code": code, "message": message } }).to_string();
    let head = format!(
        "HTTP/1.1 {} {reason}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
        status,
        body.len()
    );
    let mut out = head.into_bytes();
    out.extend_from_slice(body.as_bytes());
    out
}

fn http_reason_phrase(status: u16) -> &'static str {
    match status {
        200 => "OK",
        400 => "Bad Request",
        401 => "Unauthorized",
        403 => "Forbidden",
        404 => "Not Found",
        429 => "Too Many Requests",
        500 => "Internal Server Error",
        _ => "Error",
    }
}
