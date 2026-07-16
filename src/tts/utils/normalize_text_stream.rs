use futures_util::StreamExt;

use crate::tts::types::TextStream;

/// 将字符串转换为 TTS 文本流
///
/// 对应 TypeScript 中 `normalizeTextStream` 处理 `string` 输入的场景。
/// 将单条文本包装为一个异步流，便于直接传入 `speak_stream` 等方法。
///
/// # 参数
/// - `text`: 要合成的文本
///
/// # 返回值
/// - 包含单条文本的流
///
/// # 示例
/// ```rust,ignore
/// use univoice::tts::utils::text_to_stream;
///
/// let stream = text_to_stream("你好世界".to_string());
/// ```
pub fn text_to_stream(text: String) -> TextStream {
    Box::pin(futures_util::stream::once(async move { text }))
}

/// 清理和规范化文本流中的文本块
///
/// 对文本流中的每个 chunk 执行以下处理：
/// - 去除首尾空白
/// - 过滤空文本（normalize 后为空的跳过）
///
/// 对应 TypeScript `normalizeTextStream` 处理 `AsyncIterable<string>` 的场景。
///
/// # 参数
/// - `stream`: 输入的文本流
///
/// # 返回值
/// - 规范化后的文本流
///
/// # 示例
/// ```rust,ignore
/// use futures_util::stream;
/// use univoice::tts::utils::normalize_text_stream;
///
/// let input: TextStream = Box::pin(stream::iter(
///     vec![" 你好 ".to_string(), "世界".to_string()]
/// ));
/// let stream = normalize_text_stream(input);
/// ```
pub fn normalize_text_stream(stream: TextStream) -> TextStream {
    Box::pin(stream.filter_map(|chunk| {
        let trimmed = chunk.trim().to_string();
        if trimmed.is_empty() {
            futures_util::future::ready(None)
        } else {
            futures_util::future::ready(Some(trimmed))
        }
    }))
}

/// 创建带有可选 OpenAI 格式 chunk 解析的文本流
///
/// 在 Rust 中，OpenAI 流式文本常用于 LLM 流式场景。
/// 此函数接受一个 JSON Value 流（如 OpenAI /chat/completions 的 SSE 解析结果），
/// 自动提取 `choices[0].delta.content` 字段作为文本。
///
/// # 参数
/// - `json_stream`: JSON value 流
///
/// # 返回值
/// - 提取的文本流
pub fn json_stream_to_text(
    json_stream: impl futures_util::Stream<Item = serde_json::Value> + Send + 'static,
) -> TextStream {
    Box::pin(json_stream.filter_map(|value| {
        let content = value
            .get("choices")
            .and_then(|choices| choices.as_array())
            .and_then(|choices| choices.first())
            .and_then(|choice| choice.get("delta"))
            .and_then(|delta| delta.get("content"))
            .and_then(|c| c.as_str())
            .map(|s| s.to_string())
            .filter(|s| !s.is_empty());
        futures_util::future::ready(content)
    }))
}

#[cfg(test)]
mod tests {
    use super::*;
    use futures_util::StreamExt;
    use futures_util::stream;

    #[tokio::test]
    async fn test_text_to_stream() {
        let stream = text_to_stream("hello".to_string());
        tokio::pin!(stream);
        let text = stream.next().await.unwrap();
        assert_eq!(text, "hello");
        assert!(stream.next().await.is_none());
    }

    #[tokio::test]
    async fn test_text_to_stream_empty() {
        let stream = text_to_stream(String::new());
        tokio::pin!(stream);
        let text = stream.next().await.unwrap();
        assert!(text.is_empty());
    }

    #[tokio::test]
    async fn test_normalize_stream() {
        let input: TextStream = Box::pin(stream::iter(vec![
            "  hello  ".to_string(),
            "world".to_string(),
            "  ".to_string(),
            "!  ".to_string(),
        ]));
        let mut normalized = normalize_text_stream(input);
        let results: Vec<String> = normalized.by_ref().collect().await;
        assert_eq!(results, vec!["hello", "world", "!"]);
    }

    #[tokio::test]
    async fn test_normalize_stream_all_whitespace() {
        let input: TextStream = Box::pin(stream::iter(vec!["   ".to_string(), "\t\n".to_string()]));
        let mut normalized = normalize_text_stream(input);
        let results: Vec<String> = normalized.by_ref().collect().await;
        assert!(results.is_empty());
    }

    #[tokio::test]
    async fn test_json_stream_to_text() {
        let chunks = vec![
            serde_json::json!({"choices": [{"delta": {"content": "你好"}}]}),
            serde_json::json!({"choices": [{"delta": {"content": "世界"}}]}),
            serde_json::json!({"choices": [{"delta": {}}]}),
            serde_json::json!({"choices": [{"delta": {"content": "!"}}]}),
        ];
        let stream = json_stream_to_text(stream::iter(chunks));
        tokio::pin!(stream);
        let results: Vec<String> = stream.by_ref().collect().await;
        assert_eq!(results, vec!["你好", "世界", "!"]);
    }

    #[tokio::test]
    async fn test_normalize_stream_no_whitespace() {
        let input: TextStream = Box::pin(stream::iter(vec![
            "hello".to_string(),
            " ".to_string(),
            "world".to_string(),
        ]));
        let mut normalized = normalize_text_stream(input);
        let results: Vec<String> = normalized.by_ref().collect().await;
        assert_eq!(results, vec!["hello", "world"]);
    }

    #[tokio::test]
    async fn test_normalize_stream_multibyte() {
        let input: TextStream = Box::pin(stream::iter(vec![
            "  你好 ".to_string(),
            "世界  ".to_string(),
        ]));
        let mut normalized = normalize_text_stream(input);
        let results: Vec<String> = normalized.by_ref().collect().await;
        assert_eq!(results, vec!["你好", "世界"]);
    }

    #[tokio::test]
    async fn test_json_stream_reasoning_content() {
        // OpenAI 可能同时包含 content 和 reasoning_content
        let chunks = vec![
            serde_json::json!({"choices": [{"delta": {"content": "你好"}}]}),
            // reasoning_content 应该被忽略，只提取 content
            serde_json::json!({"choices": [{"delta": {"reasoning_content": "思考中...", "content": "世界"}}]}),
            serde_json::json!({"choices": [{"delta": {"content": "!"}}]}),
        ];
        let stream = json_stream_to_text(stream::iter(chunks));
        tokio::pin!(stream);
        let results: Vec<String> = stream.by_ref().collect().await;
        assert_eq!(results, vec!["你好", "世界", "!"]);
    }

    #[tokio::test]
    async fn test_json_stream_only_reasoning() {
        // 只有 reasoning_content 没有 content 的情况应跳过
        let chunks =
            vec![serde_json::json!({"choices": [{"delta": {"reasoning_content": "思考过程"}}]})];
        let stream = json_stream_to_text(stream::iter(chunks));
        tokio::pin!(stream);
        let results: Vec<String> = stream.collect().await;
        assert!(results.is_empty());
    }

    #[tokio::test]
    async fn test_json_stream_empty_choices() {
        let chunks = vec![serde_json::json!({}), serde_json::json!({"choices": []})];
        let stream = json_stream_to_text(stream::iter(chunks));
        tokio::pin!(stream);
        let results: Vec<String> = stream.by_ref().collect().await;
        assert!(results.is_empty());
    }
}
