use crate::tts::error::TtsError;
use crate::tts::types::TtsResponse;
use crate::tts::utils::collect::collect_audio;
use crate::tts::utils::play::{PlayOptions, play_audio};
use crate::tts::utils::save::{SaveOptions, save_tts_response};

/// TEE（分流）选项：同时保存和/或播放音频
///
/// 对应 TypeScript 的 `TeeOptions`。
#[derive(Debug, Default)]
pub struct TeeOptions {
    /// 是否保存音频到文件
    pub save: Option<SaveOptions>,
    /// 是否播放音频
    pub play: Option<PlayOptions>,
}

/// 分流处理 TTS 音频：收集音频并可选择同时保存和/或播放
///
/// 对应 TypeScript 的 `teeAudio` 函数。
///
/// 典型用法: 从 TTS 合成获得音频后，同时保存到文件并播放。
///
/// # 参数
/// - `response`: TTS 响应对象
/// - `options`: TEE 选项（可选保存和/或播放设置）
///
/// # 返回值
/// - `Ok(Vec<u8>)`: 音频数据
///
/// # 示例
/// ```rust,ignore
/// use univoice::tts::utils::{tee_audio, SaveOptions, PlayOptions};
///
/// // 同时保存和播放
/// let audio = tee_audio(&response, TeeOptions {
///     save: Some(SaveOptions {
///         filename: Some("output.pcm".into()),
///         ..Default::default()
///     }),
///     play: Some(Default::default()),
/// }).await?;
/// ```
pub async fn tee_audio(response: &TtsResponse, options: TeeOptions) -> Result<Vec<u8>, TtsError> {
    let audio = collect_audio(response);

    // 保存音频
    if let Some(save_opts) = &options.save {
        let save_response = TtsResponse {
            audio: audio.clone(),
            format: response.format.clone(),
            duration: response.duration,
        };
        save_tts_response(&save_response, save_opts.clone()).await?;
    }

    // 播放音频
    if let Some(play_opts) = &options.play {
        let play_response = TtsResponse {
            audio: audio.clone(),
            format: response.format.clone(),
            duration: response.duration,
        };
        play_audio(&play_response, play_opts.clone()).await?;
    }

    Ok(audio)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::tts::types::TtsResponse;

    #[tokio::test]
    async fn test_tee_audio_no_options() {
        let response = TtsResponse {
            audio: vec![1, 2, 3],
            format: "pcm".to_string(),
            duration: None,
        };

        let result = tee_audio(&response, TeeOptions::default()).await.unwrap();
        assert_eq!(result, vec![1, 2, 3]);
    }

    #[tokio::test]
    async fn test_tee_audio_save_only() {
        let dir = tempfile::tempdir().unwrap();
        let response = TtsResponse {
            audio: vec![10, 20, 30],
            format: "pcm".to_string(),
            duration: None,
        };

        let result = tee_audio(
            &response,
            TeeOptions {
                save: Some(SaveOptions {
                    filename: Some("tee_test.pcm".to_string()),
                    directory: Some(dir.path().to_str().unwrap().to_string()),
                }),
                play: None,
            },
        )
        .await
        .unwrap();

        assert_eq!(result, vec![10, 20, 30]);

        // 验证文件已保存
        let path = dir.path().join("tee_test.pcm");
        let content = tokio::fs::read(&path).await.unwrap();
        assert_eq!(content, vec![10, 20, 30]);
    }

    #[tokio::test]
    async fn test_tee_audio_empty_audio() {
        let response = TtsResponse {
            audio: vec![],
            format: "pcm".to_string(),
            duration: None,
        };

        let result = tee_audio(&response, TeeOptions::default()).await.unwrap();
        assert!(result.is_empty());
    }

    #[tokio::test]
    async fn test_tee_audio_save_fails_no_dir() {
        let response = TtsResponse {
            audio: vec![1, 2, 3],
            format: "pcm".to_string(),
            duration: None,
        };

        // 不存在的目录应该失败
        let result = tee_audio(
            &response,
            TeeOptions {
                save: Some(SaveOptions {
                    filename: Some("test.pcm".to_string()),
                    directory: Some("/nonexistent/path".to_string()),
                }),
                play: None,
            },
        )
        .await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_tee_audio_original_unchanged() {
        let response = TtsResponse {
            audio: vec![0xAB, 0xCD],
            format: "raw".to_string(),
            duration: Some(100),
        };

        let _ = tee_audio(&response, TeeOptions::default()).await.unwrap();
        // 验证原 response 未被修改
        assert_eq!(response.audio, vec![0xAB, 0xCD]);
    }

    #[tokio::test]
    async fn test_tee_audio_returns_cloned_audio() {
        let response = TtsResponse {
            audio: vec![0xAB, 0xCD],
            format: "raw".to_string(),
            duration: Some(100),
        };

        let result = tee_audio(&response, TeeOptions::default()).await.unwrap();
        assert_eq!(result, vec![0xAB, 0xCD]);
    }
}
