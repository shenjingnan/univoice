use crate::asr::types::AsrResponse;

/// 从 ASRResponse 中提取识别文本
///
/// 对应 TypeScript 的 `collectText` 函数。
/// 提取 `response.text` 字段。
///
/// 在 Rust 中，回调功能通过直接访问 `response.segments` 实现，
/// 比 TypeScript 回调模式更简洁。
///
/// # 参数
/// - `response`: ASR 识别响应
///
/// # 返回值
/// - 识别文本
///
/// # 示例
/// ```rust,ignore
/// use univoice::asr::utils::collect_text;
///
/// let text = collect_text(&response);
/// println!("Recognized: {text}");
/// ```
#[must_use]
pub fn collect_text(response: &AsrResponse) -> String {
    response.text.clone()
}

/// 从 ASRResponse 中提取带时间戳的分段文本
///
/// 返回所有分段的文本列表，每段包含时间信息。
///
/// # 参数
/// - `response`: ASR 识别响应
///
/// # 返回值
/// - 分段文本列表，如果没有分段则返回空列表
#[must_use]
pub fn collect_segments(response: &AsrResponse) -> Vec<&str> {
    response
        .segments
        .as_ref()
        .map(|segments| segments.iter().map(|s| s.text.as_str()).collect())
        .unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::asr::types::AsrSegment;

    #[test]
    fn test_collect_text() {
        let response = AsrResponse {
            text: "你好世界".into(),
            language: Some("zh-CN".into()),
            duration: Some(1000),
            segments: None,
        };

        let text = collect_text(&response);
        assert_eq!(text, "你好世界");
    }

    #[test]
    fn test_collect_text_with_segments() {
        let response = AsrResponse {
            text: "hello world".into(),
            language: Some("en".into()),
            duration: Some(2000),
            segments: Some(vec![
                AsrSegment {
                    id: 0,
                    start: 0,
                    end: 500,
                    text: "hello".into(),
                    speaker: None,
                    confidence: Some(0.95),
                },
                AsrSegment {
                    id: 1,
                    start: 500,
                    end: 1000,
                    text: "world".into(),
                    speaker: None,
                    confidence: Some(0.98),
                },
            ]),
        };

        let result = collect_text(&response);
        assert_eq!(result, "hello world");

        let segments = collect_segments(&response);
        assert_eq!(segments, vec!["hello", "world"]);
    }

    #[test]
    fn test_collect_text_empty() {
        let response = AsrResponse {
            text: String::new(),
            language: None,
            duration: None,
            segments: None,
        };

        let text = collect_text(&response);
        assert!(text.is_empty());
    }

    #[test]
    fn test_collect_segments_empty() {
        let response = AsrResponse {
            text: "no segments".into(),
            language: None,
            duration: None,
            segments: None,
        };

        let segments = collect_segments(&response);
        assert!(segments.is_empty());
    }
}
