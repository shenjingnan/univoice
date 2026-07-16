use std::time::{SystemTime, UNIX_EPOCH};

use tokio::fs;

use crate::asr::error::AsrError;
use crate::asr::types::AsrResponse;

/// ASR 保存选项
#[derive(Debug, Default, Clone)]
pub struct SaveOptions {
    /// 文件名（不指定则自动生成）
    pub filename: Option<String>,
    /// 保存目录
    pub directory: Option<String>,
    /// 保存格式（txt 或 json，默认 txt）
    pub format: AsrSaveFormat,
}

/// ASR 保存格式
#[derive(Debug, Default, Clone, PartialEq)]
pub enum AsrSaveFormat {
    #[default]
    Txt,
    Json,
}

impl AsrSaveFormat {
    fn as_ext(&self) -> &'static str {
        match self {
            Self::Txt => "txt",
            Self::Json => "json",
        }
    }
}

/// 保存 ASR 识别结果到文件
///
/// 对应 TypeScript 的 `saveText` 函数。
///
/// # 参数
/// - `response`: ASR 识别响应
/// - `options`: 保存选项
///
/// # 返回值
/// - `Ok(String)`: 保存的文件路径
///
/// # 错误
/// - 文件写入失败
///
/// # 示例
/// ```rust,ignore
/// use univoice::asr::utils::{save_text, SaveOptions, AsrSaveFormat};
///
/// let path = save_text(&response, Default::default()).await?;
/// println!("Saved to: {path}");
/// ```
pub async fn save_text(response: &AsrResponse, options: SaveOptions) -> Result<String, AsrError> {
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);

    let ext = options.format.as_ext();
    let filename = options
        .filename
        .unwrap_or_else(|| format!("asr_{timestamp}.{ext}"));

    let filepath = match &options.directory {
        Some(dir) => format!("{dir}/{filename}"),
        None => filename,
    };

    let content = match options.format {
        AsrSaveFormat::Json => serde_json::to_string_pretty(response)
            .map_err(|e| AsrError::Other(format!("Failed to serialize ASR response: {e}")))?,
        AsrSaveFormat::Txt => response.text.clone(),
    };

    fs::write(&filepath, &content)
        .await
        .map_err(|e| AsrError::Other(format!("Failed to save ASR result to '{filepath}': {e}")))?;

    Ok(filepath)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::asr::types::AsrSegment;

    #[tokio::test]
    async fn test_save_text_default() {
        let dir = tempfile::tempdir().unwrap();
        let response = AsrResponse {
            text: "你好世界".into(),
            language: Some("zh-CN".into()),
            duration: Some(1000),
            segments: None,
        };

        let path = save_text(
            &response,
            SaveOptions {
                directory: Some(dir.path().to_str().unwrap().to_string()),
                ..Default::default()
            },
        )
        .await
        .unwrap();

        assert!(path.ends_with(".txt"));
        assert!(path.contains("asr_"));

        let content = tokio::fs::read_to_string(&path).await.unwrap();
        assert_eq!(content, "你好世界");
    }

    #[tokio::test]
    async fn test_save_text_json() {
        let dir = tempfile::tempdir().unwrap();
        let response = AsrResponse {
            text: "hello".into(),
            language: Some("en".into()),
            duration: Some(500),
            segments: Some(vec![AsrSegment {
                id: 0,
                start: 0,
                end: 500,
                text: "hello".into(),
                speaker: None,
                confidence: Some(0.99),
            }]),
        };

        let path = save_text(
            &response,
            SaveOptions {
                directory: Some(dir.path().to_str().unwrap().to_string()),
                format: AsrSaveFormat::Json,
                ..Default::default()
            },
        )
        .await
        .unwrap();

        assert!(path.ends_with(".json"));

        let content = tokio::fs::read_to_string(&path).await.unwrap();
        let parsed: serde_json::Value = serde_json::from_str(&content).unwrap();
        assert_eq!(parsed["text"], "hello");
        assert!(parsed["segments"].is_array());
    }

    #[tokio::test]
    async fn test_save_text_custom_filename() {
        let dir = tempfile::tempdir().unwrap();
        let response = AsrResponse {
            text: "test".into(),
            language: None,
            duration: None,
            segments: None,
        };

        let path = save_text(
            &response,
            SaveOptions {
                filename: Some("my_result.txt".to_string()),
                directory: Some(dir.path().to_str().unwrap().to_string()),
                ..Default::default()
            },
        )
        .await
        .unwrap();

        assert!(path.ends_with("my_result.txt"));

        let content = tokio::fs::read_to_string(&path).await.unwrap();
        assert_eq!(content, "test");
    }

    #[tokio::test]
    async fn test_save_text_empty() {
        let dir = tempfile::tempdir().unwrap();
        let response = AsrResponse {
            text: String::new(),
            language: None,
            duration: None,
            segments: None,
        };

        let path = save_text(
            &response,
            SaveOptions {
                directory: Some(dir.path().to_str().unwrap().to_string()),
                ..Default::default()
            },
        )
        .await
        .unwrap();

        let content = tokio::fs::read_to_string(&path).await.unwrap();
        assert!(content.is_empty());
    }
}
