use std::time::{SystemTime, UNIX_EPOCH};

use tokio::fs;

use crate::tts::error::TtsError;
use crate::tts::types::TtsResponse;

/// TTS 保存选项
#[derive(Debug, Default, Clone)]
pub struct SaveOptions {
    /// 文件名（不指定则自动生成）
    pub filename: Option<String>,
    /// 保存目录
    pub directory: Option<String>,
}

/// 保存 TTSResponse 到文件
///
/// 对应 TypeScript 的 `saveTTSResponse` 函数。
/// 自动生成文件名（格式: `tts_{timestamp}.{format}`），
/// 适合快速保存 TTS 响应。
///
/// # 参数
/// - `response`: TTS 响应对象
/// - `options`: 保存选项（可选文件名和目录）
///
/// # 返回值
/// - `Ok(String)`: 保存的文件路径
///
/// # 错误
/// - 如果音频数据为空（长度为零），返回 `TtsError::NoAudio`
/// - 文件写入失败
///
/// # 示例
/// ```rust,ignore
/// use univoice::tts::utils::save_tts_response;
///
/// let path = save_tts_response(&response, Default::default()).await?;
/// println!("Saved to: {path}");
/// ```
pub async fn save_tts_response(
    response: &TtsResponse,
    options: SaveOptions,
) -> Result<String, TtsError> {
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);

    let filename = options
        .filename
        .unwrap_or_else(|| format!("tts_{}.{}", timestamp, response.format));

    let filepath = match &options.directory {
        Some(dir) => format!("{dir}/{filename}"),
        None => filename,
    };

    if response.audio.is_empty() {
        return Err(TtsError::NoAudio);
    }

    fs::write(&filepath, &response.audio).await.map_err(|e| {
        TtsError::Other(format!("Failed to save TTS response to '{filepath}': {e}"))
    })?;

    Ok(filepath)
}

/// 将音频字节数组保存到文件（底层工具函数）
///
/// 不依赖 TTSResponse 类型，直接写入裸字节。
/// 适合在需要自定义保存逻辑的场景使用。
///
/// # 参数
/// - `filepath`: 文件路径
/// - `data`: 音频数据
///
/// # 错误
/// - 文件写入失败
pub async fn save_audio_bytes(filepath: &str, data: &[u8]) -> Result<(), TtsError> {
    fs::write(filepath, data)
        .await
        .map_err(|e| TtsError::Other(format!("Failed to write audio to '{filepath}': {e}")))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::tts::types::TtsResponse;

    #[tokio::test]
    async fn test_save_tts_response_default() {
        let dir = tempfile::tempdir().unwrap();
        let response = TtsResponse {
            audio: vec![1, 2, 3, 4],
            format: "pcm".to_string(),
            duration: None,
        };

        let path = save_tts_response(
            &response,
            SaveOptions {
                directory: Some(dir.path().to_str().unwrap().to_string()),
                ..Default::default()
            },
        )
        .await
        .unwrap();

        // 验证文件名格式 tts_{timestamp}.pcm
        assert!(path.ends_with(".pcm"));
        assert!(path.contains("tts_"));

        // 验证文件内容
        let content = fs::read(&path).await.unwrap();
        assert_eq!(content, vec![1, 2, 3, 4]);
    }

    #[tokio::test]
    async fn test_save_tts_response_custom_filename() {
        let dir = tempfile::tempdir().unwrap();
        let response = TtsResponse {
            audio: vec![10, 20],
            format: "wav".to_string(),
            duration: None,
        };

        let path = save_tts_response(
            &response,
            SaveOptions {
                filename: Some("my_audio.wav".to_string()),
                directory: Some(dir.path().to_str().unwrap().to_string()),
            },
        )
        .await
        .unwrap();

        assert!(path.ends_with("my_audio.wav"));
        let content = fs::read(&path).await.unwrap();
        assert_eq!(content, vec![10, 20]);
    }

    #[tokio::test]
    async fn test_save_tts_response_no_audio() {
        let response = TtsResponse {
            audio: vec![],
            format: "pcm".to_string(),
            duration: None,
        };

        let result = save_tts_response(&response, Default::default()).await;
        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), TtsError::NoAudio));
    }

    #[tokio::test]
    async fn test_save_audio_bytes() {
        let dir = tempfile::tempdir().unwrap();
        let file_path = dir.path().join("raw.bin");
        let path_str = file_path.to_str().unwrap().to_string();

        save_audio_bytes(&path_str, &[0xFF, 0xEE, 0xDD])
            .await
            .unwrap();

        let content = fs::read(&path_str).await.unwrap();
        assert_eq!(content, vec![0xFF, 0xEE, 0xDD]);
    }

    #[tokio::test]
    async fn test_save_tts_response_respects_format() {
        let dir = tempfile::tempdir().unwrap();
        let response = TtsResponse {
            audio: vec![1, 2, 3],
            format: "ogg".to_string(),
            duration: None,
        };

        let path = save_tts_response(
            &response,
            SaveOptions {
                directory: Some(dir.path().to_str().unwrap().to_string()),
                ..Default::default()
            },
        )
        .await
        .unwrap();

        assert!(path.ends_with(".ogg"));
    }
}
