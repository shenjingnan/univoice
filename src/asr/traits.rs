use std::pin::Pin;
use std::time::Duration;

use async_trait::async_trait;
use futures_util::Stream;

use crate::asr::error::AsrError;
use crate::asr::types::{AsrResponse, AsrStreamChunk, AudioStream};

/// ASR Provider 核心 trait
#[async_trait]
pub trait AsrProvider: Send + Sync {
    /// 返回 provider 名称（如 "doubao"）
    fn name(&self) -> &'static str;

    /// 流式语音识别：接收音频流，返回识别结果流
    async fn listen_stream(
        &self,
        audio: AudioStream,
    ) -> Result<Pin<Box<dyn Stream<Item = Result<AsrStreamChunk, AsrError>> + Send>>, AsrError>;

    /// 预建立 WebSocket 连接（可选覆盖）
    async fn connect(
        &self,
        _options: AsrConnectOption,
    ) -> Result<Box<dyn AsrConnection>, AsrError> {
        Err(AsrError::Unsupported("connect"))
    }
}

/// ASR 连接实例：在已建立的连接上进行多次识别
#[async_trait]
pub trait AsrConnection: Send {
    /// 当前连接状态
    fn state(&self) -> ConnectionState;

    /// 流式识别
    async fn listen_stream(
        &mut self,
        audio: AudioStream,
    ) -> Result<Pin<Box<dyn Stream<Item = Result<AsrStreamChunk, AsrError>> + Send>>, AsrError>;

    /// 非流式识别
    async fn listen(&mut self, audio: AudioStream) -> Result<AsrResponse, AsrError>;

    /// 关闭连接（幂等）
    async fn close(&mut self) -> Result<(), AsrError>;
}

/// 连接状态
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ConnectionState {
    Connected,
    Closed,
}

/// 连接选项
#[derive(Debug, Clone)]
pub struct AsrConnectOption {
    pub timeout: Duration,
}

impl Default for AsrConnectOption {
    fn default() -> Self {
        Self {
            timeout: Duration::from_secs(10),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_t1_connection_state_debug_clone() {
        assert_eq!(format!("{:?}", ConnectionState::Connected), "Connected");
        assert_eq!(format!("{:?}", ConnectionState::Closed), "Closed");
        assert_ne!(ConnectionState::Connected, ConnectionState::Closed);
    }

    #[test]
    fn test_t2_connect_option_default() {
        let opt = AsrConnectOption::default();
        assert_eq!(opt.timeout, Duration::from_secs(10));
    }

    #[test]
    fn test_t3_connect_option_custom() {
        let opt = AsrConnectOption {
            timeout: Duration::from_secs(30),
        };
        assert_eq!(opt.timeout, Duration::from_secs(30));
    }
}
