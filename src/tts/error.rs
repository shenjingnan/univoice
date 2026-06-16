use std::time::Duration;

/// TTS 错误类型
#[derive(Debug, thiserror::Error)]
pub enum TtsError {
    #[error("WebSocket error: {0}")]
    Websocket(#[from] tokio_tungstenite::tungstenite::Error),

    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),

    #[error("HTTP error: {0}")]
    Http(#[from] http::Error),

    #[error("URL parse error: {0}")]
    Url(#[from] url::ParseError),

    #[error("Connection timeout after {0}ms")]
    Timeout(u64),

    #[error("Invalid parameter: {0}")]
    InvalidParameter(String),

    #[error("Connection is closed")]
    ConnectionClosed,

    #[error("TTS service error: code={code}, message={message}")]
    ServiceError { code: String, message: String },

    #[error("Unsupported operation: {0}")]
    Unsupported(&'static str),

    #[error("No audio received from TTS service")]
    NoAudio,

    #[error("{0}")]
    Other(String),
}

impl TtsError {
    /// 从 tokio 超时错误创建 Timeout 错误
    pub fn from_elapsed(timeout: Duration) -> Self {
        Self::Timeout(timeout.as_millis() as u64)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // -------- E1-E10: 错误格式化 --------

    #[test]
    fn test_e1_websocket_display() {
        let err = TtsError::Websocket(tokio_tungstenite::tungstenite::Error::ConnectionClosed);
        assert!(err.to_string().contains("WebSocket error"));
    }

    #[test]
    fn test_e2_json_display() {
        let err = TtsError::Json(serde_json::from_str::<()>("").unwrap_err());
        assert!(err.to_string().contains("JSON error"));
    }

    #[test]
    fn test_e3_timeout_display() {
        let err = TtsError::Timeout(5000);
        assert!(err.to_string().contains("5000ms"));
    }

    #[test]
    fn test_e4_invalid_parameter_display() {
        let err = TtsError::InvalidParameter("apiKey required".into());
        assert!(err.to_string().contains("apiKey required"));
    }

    #[test]
    fn test_e5_service_error_display() {
        let err = TtsError::ServiceError {
            code: "400".into(),
            message: "bad request".into(),
        };
        let msg = err.to_string();
        assert!(msg.contains("code=400"));
        assert!(msg.contains("bad request"));
    }

    #[test]
    fn test_e6_connection_closed_display() {
        let err = TtsError::ConnectionClosed;
        assert_eq!(err.to_string(), "Connection is closed");
    }

    #[test]
    fn test_e7_no_audio_display() {
        let err = TtsError::NoAudio;
        assert_eq!(err.to_string(), "No audio received from TTS service");
    }

    #[test]
    fn test_e8_unsupported_display() {
        let err = TtsError::Unsupported("speak_stream");
        assert!(err.to_string().contains("Unsupported"));
        assert!(err.to_string().contains("speak_stream"));
    }

    #[test]
    fn test_e9_http_from() {
        // 通过无效 HTTP 状态码构造 http::Error，验证 From 转换
        let status_err = http::StatusCode::from_u16(0).unwrap_err();
        let http_err: http::Error = status_err.into();
        let err = TtsError::Http(http_err);
        assert!(err.to_string().contains("HTTP error"));
    }

    #[test]
    fn test_e10_url_from() {
        // 通过无效 URL 构造 url::ParseError，验证 From 转换
        let url_err = url::Url::parse("not a valid url").unwrap_err();
        let err = TtsError::Url(url_err);
        assert!(err.to_string().contains("URL parse error"));
    }

    #[test]
    fn test_e11_from_elapsed() {
        let err = TtsError::from_elapsed(Duration::from_secs(3));
        assert!(matches!(err, TtsError::Timeout(v) if v == 3000));
    }
}
