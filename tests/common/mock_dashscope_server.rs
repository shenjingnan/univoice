use std::time::Duration;

use futures_util::{SinkExt, StreamExt};
use tokio::net::TcpListener;
use tokio::sync::{mpsc, oneshot};
use tokio_tungstenite::tungstenite::Message;

/// Mock 服务器的行为指令
#[derive(Debug, Clone)]
pub enum ServerCommand {
    /// 等待接收 run-task，回复 task-started
    ExpectRunTask,
    /// 等待接收音频 Binary，回复 result-generated（可按序发送多条）
    ExpectAudioThenResults {
        sentences: Vec<String>,
        is_final: Vec<bool>,
    },
    /// 等待接收 finish-task，回复 task-finished（可选最终句子）
    ExpectFinishTask { final_sentence: Option<String> },
    /// 收到 run-task 后立即回复 task-failed（拒绝任务）
    #[allow(dead_code)]
    SendTaskFailed { code: String, message: String },
    /// 不发送任何响应（模拟超时/挂起）
    #[allow(dead_code)]
    Hang { duration: Duration },
}

/// Mock 服务器的句柄
pub struct MockDashScopeServer {
    pub addr: std::net::SocketAddr,
    cmd_tx: mpsc::UnboundedSender<ServerCommand>,
    shutdown_tx: Option<oneshot::Sender<()>>,
    handle: Option<tokio::task::JoinHandle<()>>,
    /// 服务器内部错误
    pub errors: Vec<String>,
    error_rx: mpsc::UnboundedReceiver<String>,
}

impl MockDashScopeServer {
    /// 启动 Mock 服务器，绑定 127.0.0.1 动态端口
    pub async fn start() -> Self {
        let listener = TcpListener::bind("127.0.0.1:0")
            .await
            .expect("Failed to bind mock server");
        let addr = listener.local_addr().unwrap();

        let (cmd_tx, mut cmd_rx) = mpsc::unbounded_channel::<ServerCommand>();
        let (shutdown_tx, mut shutdown_rx) = oneshot::channel::<()>();
        let (error_tx, error_rx) = mpsc::unbounded_channel::<String>();

        let handle = tokio::spawn(async move {
            eprintln!(
                "[MOCK SERVER] Task started, waiting for connection on {}",
                addr
            );

            // 接受连接
            let (tcp_stream, _) = tokio::select! {
                result = listener.accept() => {
                    match result {
                        Ok(conn) => conn,
                        Err(e) => {
                            let _ = error_tx.send(format!("Accept error: {}", e));
                            return;
                        }
                    }
                }
                _ = &mut shutdown_rx => return,
            };

            // 升级为 WebSocket
            let ws_stream = match tokio_tungstenite::accept_async(tcp_stream).await {
                Ok(ws) => ws,
                Err(e) => {
                    eprintln!("[MOCK SERVER] WS accept error: {}", e);
                    let _ = error_tx.send(format!("WS accept error: {}", e));
                    return;
                }
            };

            let (mut write, mut read) = ws_stream.split();
            let step_timeout = Duration::from_secs(5);

            // 逐个处理命令
            let mut cmd_count = 0;
            while let Some(cmd) = cmd_rx.recv().await {
                cmd_count += 1;
                eprintln!("[MOCK SERVER] Processing command #{}: {:?}", cmd_count, cmd);
                match cmd {
                    ServerCommand::ExpectRunTask => {
                        let result = tokio::time::timeout(step_timeout, read.next()).await;

                        match result {
                            Ok(Some(Ok(Message::Text(data)))) => {
                                if !data.contains("run-task") {
                                    eprintln!(
                                        "[MOCK SERVER] Expected run-task, got: {}",
                                        &data[..data.len().min(200)]
                                    );
                                    let _ = error_tx.send(format!(
                                        "Expected run-task, got: {}",
                                        &data[..data.len().min(200)]
                                    ));
                                    return;
                                }
                            }
                            Ok(Some(Ok(other))) => {
                                eprintln!("[MOCK SERVER] Expected Text(run-task), got {:?}", other);
                                let _ = error_tx
                                    .send(format!("Expected Text(run-task), got {:?}", other));
                                return;
                            }
                            Ok(Some(Err(e))) => {
                                eprintln!("[MOCK SERVER] WS error in ExpectRunTask: {}", e);
                                let _ = error_tx.send(format!("WS error in ExpectRunTask: {}", e));
                                return;
                            }
                            Ok(None) => {
                                eprintln!("[MOCK SERVER] Stream ended in ExpectRunTask");
                                let _ = error_tx.send("Stream ended in ExpectRunTask".into());
                                return;
                            }
                            Err(_) => {
                                eprintln!("[MOCK SERVER] Timeout waiting for run-task");
                                let _ = error_tx.send("Timeout waiting for run-task".into());
                                return;
                            }
                        }

                        // 发送 task-started
                        let response = serde_json::json!({
                            "header": {"task_id": "mock-task-id", "event": "task-started"},
                            "payload": {}
                        });
                        eprintln!("[MOCK SERVER] Sending task-started");
                        if write
                            .send(Message::Text(response.to_string()))
                            .await
                            .is_err()
                        {
                            eprintln!("[MOCK SERVER] Failed to send task-started");
                            return;
                        }
                        eprintln!("[MOCK SERVER] Sent task-started");
                    }

                    ServerCommand::SendTaskFailed { code, message } => {
                        let response = serde_json::json!({
                            "header": {
                                "event": "task-failed",
                                "error_code": code,
                                "error_message": message
                            }
                        });
                        if write
                            .send(Message::Text(response.to_string()))
                            .await
                            .is_err()
                        {
                            return;
                        }
                    }

                    ServerCommand::ExpectAudioThenResults {
                        sentences,
                        is_final,
                    } => {
                        // 等待二进制音频数据
                        let result = tokio::time::timeout(step_timeout, read.next()).await;

                        match result {
                            Ok(Some(Ok(Message::Binary(data)))) => {
                                eprintln!(
                                    "[MOCK SERVER] Received Binary audio, {} bytes",
                                    data.len()
                                );
                            }
                            Ok(Some(Ok(other))) => {
                                let _ = error_tx
                                    .send(format!("Expected Binary(audio), got {:?}", other));
                                return;
                            }
                            Ok(Some(Err(e))) => {
                                let _ = error_tx.send(format!("WS error in ExpectAudio: {}", e));
                                return;
                            }
                            Ok(None) => {
                                let _ = error_tx.send("Stream ended in ExpectAudio".into());
                                return;
                            }
                            Err(_) => {
                                let _ = error_tx.send("Timeout waiting for audio".into());
                                return;
                            }
                        }

                        // 发送 result-generated
                        eprintln!(
                            "[MOCK SERVER] Sending {} result-generated messages",
                            sentences.len()
                        );
                        for (i, sentence) in sentences.iter().enumerate() {
                            let is_last = is_final.get(i).copied().unwrap_or(true);
                            let response = serde_json::json!({
                                "header": {
                                    "task_id": "mock-task-id",
                                    "event": "result-generated",
                                    "task_status": "Running"
                                },
                                "payload": {
                                    "output": {
                                        "sentence": {
                                            "text": sentence,
                                            "start_time": (i as u32) * 1000,
                                            "end_time": ((i + 1) as u32) * 1000,
                                            "confidence": 0.95,
                                            "sentence_end": is_last
                                        }
                                    }
                                }
                            });

                            if write
                                .send(Message::Text(response.to_string()))
                                .await
                                .is_err()
                            {
                                return;
                            }
                        }
                    }

                    ServerCommand::ExpectFinishTask { final_sentence } => {
                        eprintln!("[MOCK SERVER] ExpectFinishTask waiting for finish-task...");
                        // 循环跳过客户端可能仍在发送的残余音频 Binary 帧
                        let msg_text = loop {
                            let result = tokio::time::timeout(step_timeout, read.next()).await;
                            match result {
                                Ok(Some(Ok(Message::Text(data)))) => {
                                    if !data.contains("finish-task") {
                                        let _ = error_tx.send(format!(
                                            "Expected finish-task, got: {}",
                                            &data[..data.len().min(200)]
                                        ));
                                        return;
                                    }
                                    break data; // ✅ 收到 finish-task
                                }
                                Ok(Some(Ok(Message::Binary(_)))) => {
                                    // 客户端还在发送音频帧，继续等待 finish-task
                                    eprintln!(
                                        "[MOCK SERVER] Skipping residual audio frame in ExpectFinishTask"
                                    );
                                    continue;
                                }
                                Ok(Some(Ok(other))) => {
                                    let _ = error_tx.send(format!(
                                        "Expected Text(finish-task), got {:?}",
                                        other
                                    ));
                                    return;
                                }
                                Ok(Some(Err(e))) => {
                                    eprintln!("[MOCK SERVER] WS error in ExpectFinishTask: {}", e);
                                    let _ = error_tx
                                        .send(format!("WS error in ExpectFinishTask: {}", e));
                                    return;
                                }
                                Ok(None) => {
                                    let _ =
                                        error_tx.send("Stream ended in ExpectFinishTask".into());
                                    return;
                                }
                                Err(_) => {
                                    let _ = error_tx.send("Timeout waiting for finish-task".into());
                                    return;
                                }
                            }
                        };
                        let _ = msg_text; // 已确认为 finish-task

                        // 发送 task-finished
                        let response = if let Some(sentence) = final_sentence {
                            serde_json::json!({
                                "header": {
                                    "task_id": "mock-task-id",
                                    "event": "task-finished",
                                    "task_status": "Completed"
                                },
                                "payload": {
                                    "output": {
                                        "sentence": {
                                            "text": sentence,
                                            "start_time": 0,
                                            "end_time": 1000,
                                            "confidence": 1.0
                                        }
                                    },
                                    "usage": {"duration": 1000}
                                }
                            })
                        } else {
                            serde_json::json!({
                                "header": {
                                    "task_id": "mock-task-id",
                                    "event": "task-finished",
                                    "task_status": "Completed"
                                },
                                "payload": {
                                    "output": {},
                                    "usage": {"duration": 1000}
                                }
                            })
                        };

                        if write
                            .send(Message::Text(response.to_string()))
                            .await
                            .is_err()
                        {
                            return;
                        }
                    }

                    ServerCommand::Hang { duration } => {
                        tokio::time::sleep(duration).await;
                    }
                }
            }
        });

        Self {
            addr,
            cmd_tx,
            shutdown_tx: Some(shutdown_tx),
            handle: Some(handle),
            errors: Vec::new(),
            error_rx,
        }
    }

    /// 发送命令到 Mock 服务器
    pub fn send_command(&self, cmd: ServerCommand) {
        let _ = self.cmd_tx.send(cmd);
    }

    /// 检查服务器是否有错误
    pub async fn check_errors(&mut self) {
        while let Ok(err) = self.error_rx.try_recv() {
            self.errors.push(err);
        }
    }
}

impl Drop for MockDashScopeServer {
    fn drop(&mut self) {
        if let Some(tx) = self.shutdown_tx.take() {
            let _ = tx.send(());
        }
        if let Some(handle) = self.handle.take() {
            handle.abort();
        }
    }
}
