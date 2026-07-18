use std::time::Duration;

/// ASR 错误类型
#[derive(Debug, thiserror::Error)]
pub enum AsrError {
    #[error("WebSocket error: {0}")]
    Websocket(#[from] tokio_tungstenite::tungstenite::Error),

    #[error("HTTP error: {0}")]
    Http(#[from] http::Error),

    #[error("URL parse error: {0}")]
    Url(#[from] url::ParseError),

    #[error("Gzip error: {0}")]
    Gzip(#[from] std::io::Error),

    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),

    #[error("UTF-8 error: {0}")]
    Utf8(#[from] std::string::FromUtf8Error),

    #[error("ASR init failed: {0}")]
    InitFailed(String),

    #[error("ASR error: code={code}, message={message}")]
    AsrServiceError { code: i32, message: String },

    #[error("Connection timeout after {0}ms")]
    Timeout(u64),

    #[error("Invalid parameter: {0}")]
    InvalidParameter(String),

    #[error("Connection is closed")]
    ConnectionClosed,

    #[error("Unsupported operation: {0}")]
    Unsupported(&'static str),

    #[error("HTTP request failed: {0}")]
    HttpRequest(String),

    #[error("HTTP error {status}: {message}")]
    HttpStatus { status: u16, message: String },

    #[error("{0}")]
    Other(String),
}

impl AsrError {
    /// 从 tokio 超时错误创建 Timeout 错误
    pub fn from_elapsed(timeout: Duration) -> Self {
        Self::Timeout(timeout.as_millis() as u64)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_e1_from_elapsed_millis() {
        let err = AsrError::from_elapsed(Duration::from_millis(500));
        assert!(matches!(err, AsrError::Timeout(500)));
    }

    #[test]
    fn test_e2_from_elapsed_seconds() {
        let err = AsrError::from_elapsed(Duration::from_secs(30));
        assert!(matches!(err, AsrError::Timeout(30_000)));
    }

    #[test]
    fn test_e3_from_elapsed_zero() {
        let err = AsrError::from_elapsed(Duration::ZERO);
        assert!(matches!(err, AsrError::Timeout(0)));
    }
}
