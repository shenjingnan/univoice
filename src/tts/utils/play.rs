use std::process::Stdio;

use tokio::io::AsyncWriteExt;
use tokio::process::Command;

use crate::tts::error::TtsError;
use crate::tts::types::TtsResponse;

/// 音频播放选项
#[derive(Debug, Clone)]
pub struct PlayOptions {
    /// 播放器命令（默认 macOS: afplay, Linux: aplay, Windows: 暂不支持）
    pub player: String,
}

impl Default for PlayOptions {
    fn default() -> Self {
        Self {
            // macOS 内置播放器
            player: "afplay".to_string(),
        }
    }
}

/// 播放 TTS 音频
///
/// 将 TTSResponse 中的音频数据通过系统播放器播放。
/// 对应 TypeScript 的 `playAudio`。
///
/// # 参数
/// - `response`: TTS 响应对象
/// - `options`: 播放选项（可指定播放器）
///
/// # 返回值
/// - `Ok(())`: 播放成功
///
/// # 错误
/// - 如果播放器未安装或启动失败
/// - 如果播放器退出码非零
///
/// # 平台支持
/// - macOS: 默认使用 `afplay`
/// - Linux: 可指定 `aplay`、`paplay`、`ffplay` 等
///
/// # 示例
/// ```rust,ignore
/// use univoice::tts::utils::play_audio;
///
/// play_audio(&response, Default::default()).await?;
/// ```
pub async fn play_audio(response: &TtsResponse, options: PlayOptions) -> Result<(), TtsError> {
    let mut child = Command::new(&options.player)
        .stdin(Stdio::piped())
        .stdout(Stdio::inherit())
        .stderr(Stdio::inherit())
        .spawn()
        .map_err(|e| {
            TtsError::Other(format!("Failed to spawn player '{}': {e}", options.player))
        })?;

    // 写入音频数据到播放器的 stdin
    if let Some(mut stdin) = child.stdin.take() {
        stdin
            .write_all(&response.audio)
            .await
            .map_err(|e| TtsError::Other(format!("Failed to write audio to player: {e}")))?;
        stdin
            .shutdown()
            .await
            .map_err(|e| TtsError::Other(format!("Failed to close player stdin: {e}")))?;
    }

    // 等待播放器退出
    let status = child
        .wait()
        .await
        .map_err(|e| TtsError::Other(format!("Failed to wait for player: {e}")))?;

    if !status.success() {
        return Err(TtsError::Other(format!(
            "Player exited with code {:?}",
            status.code()
        )));
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_play_options_default() {
        let options = PlayOptions::default();
        assert_eq!(options.player, "afplay");
    }

    #[test]
    fn test_play_options_custom() {
        let options = PlayOptions {
            player: "ffplay".to_string(),
        };
        assert_eq!(options.player, "ffplay");
    }
}
