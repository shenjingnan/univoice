use std::path::Path;

use tokio::fs;

use crate::tts::error::TtsError;

/// 保存音频选项
#[derive(Debug, Clone)]
pub struct SaveAudioOptions {
    /// 采样率（用于 WAV 头生成，默认 24000）
    pub sample_rate: u32,
    /// 声道数（默认 1）
    pub channels: u16,
    /// 位深（默认 16）
    pub bits_per_sample: u16,
}

impl Default for SaveAudioOptions {
    fn default() -> Self {
        Self {
            sample_rate: 24000,
            channels: 1,
            bits_per_sample: 16,
        }
    }
}

/// 判断数据是否已有 WAV 头（RIFF 标记）
fn has_wav_header(data: &[u8]) -> bool {
    data.len() >= 4 && data[0] == 0x52 && data[1] == 0x49 && data[2] == 0x46 && data[3] == 0x46
}

/// 创建一个 WAV 文件头
///
/// 对应 TypeScript `createWavHeader` 函数。
/// 生成标准的 44 字节 PCM WAV 文件头。
fn create_wav_header(data_length: u32, options: &SaveAudioOptions) -> Vec<u8> {
    let header_length: u32 = 44;
    let byte_rate =
        options.sample_rate * u32::from(options.channels) * u32::from(options.bits_per_sample / 16);
    let block_align = options.channels * (options.bits_per_sample / 8);
    let data_size = data_length;

    let mut header = Vec::with_capacity(header_length as usize);

    // RIFF chunk descriptor
    header.extend_from_slice(b"RIFF");
    header.extend_from_slice(&(36 + data_size).to_le_bytes()); // file size - 8
    header.extend_from_slice(b"WAVE");

    // fmt sub-chunk
    header.extend_from_slice(b"fmt ");
    header.extend_from_slice(&16u32.to_le_bytes()); // sub-chunk size
    header.extend_from_slice(&1u16.to_le_bytes()); // audio format (PCM)
    header.extend_from_slice(&options.channels.to_le_bytes());
    header.extend_from_slice(&options.sample_rate.to_le_bytes());
    header.extend_from_slice(&byte_rate.to_le_bytes());
    header.extend_from_slice(&block_align.to_le_bytes());
    header.extend_from_slice(&options.bits_per_sample.to_le_bytes());

    // data sub-chunk
    header.extend_from_slice(b"data");
    header.extend_from_slice(&data_size.to_le_bytes());

    header
}

/// 保存音频数据到文件
///
/// 对应 TypeScript `saveAudio` 函数。
/// 支持自动添加 WAV 头（当文件扩展名为 `.wav` 且数据不含 RIFF 头时）。
///
/// # 参数
/// - `file_path`: 目标文件路径
/// - `source`: 音频数据
/// - `options`: 保存选项（采样率等）
///
/// # 返回值
/// - `Ok(())`: 保存成功
///
/// # 错误
/// - 文件写入失败
///
/// # 示例
/// ```rust,ignore
/// use univoice::tts::utils::save_audio;
///
/// save_audio("output.wav", &audio_data, Default::default()).await?;
/// ```
pub async fn save_audio(
    file_path: &str,
    source: &[u8],
    options: SaveAudioOptions,
) -> Result<(), TtsError> {
    let ext = Path::new(file_path)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();

    let data = if ext == "wav" && !has_wav_header(source) {
        // 自动添加 WAV 头
        let wav_header = create_wav_header(source.len() as u32, &options);
        let mut wav_data = Vec::with_capacity(wav_header.len() + source.len());
        wav_data.extend_from_slice(&wav_header);
        wav_data.extend_from_slice(source);
        wav_data
    } else {
        source.to_vec()
    };

    fs::write(file_path, &data)
        .await
        .map_err(|e| TtsError::Other(format!("Failed to save audio file '{file_path}': {e}")))?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_has_wav_header_true() {
        let data = b"RIFF....WAVE...";
        assert!(has_wav_header(data));
    }

    #[test]
    fn test_has_wav_header_false_too_short() {
        let data = b"RIF";
        assert!(!has_wav_header(data));
    }

    #[test]
    fn test_has_wav_header_false_no_header() {
        let data = b"not a wav file...";
        assert!(!has_wav_header(data));
    }

    #[test]
    fn test_create_wav_header() {
        let audio_data = vec![0u8; 100];
        let options = SaveAudioOptions::default();
        let header = create_wav_header(audio_data.len() as u32, &options);

        // 44 bytes header
        assert_eq!(header.len(), 44);

        // RIFF marker
        assert_eq!(&header[0..4], b"RIFF");
        // WAVE format
        assert_eq!(&header[8..12], b"WAVE");
        // 36 + data_size
        let file_size = u32::from_le_bytes([header[4], header[5], header[6], header[7]]);
        assert_eq!(file_size, 36 + 100);

        // PCM format (1)
        let audio_format = u16::from_le_bytes([header[20], header[21]]);
        assert_eq!(audio_format, 1);

        // Mono
        let channels = u16::from_le_bytes([header[22], header[23]]);
        assert_eq!(channels, 1);

        // 24000 Hz
        let sample_rate = u32::from_le_bytes([header[24], header[25], header[26], header[27]]);
        assert_eq!(sample_rate, 24000);

        // 16-bit
        let bits_per = u16::from_le_bytes([header[34], header[35]]);
        assert_eq!(bits_per, 16);
    }

    #[test]
    fn test_create_wav_header_different_params() {
        let options = SaveAudioOptions {
            sample_rate: 16000,
            channels: 2,
            bits_per_sample: 16,
        };
        let header = create_wav_header(200, &options);

        let channels = u16::from_le_bytes([header[22], header[23]]);
        assert_eq!(channels, 2);

        let sample_rate = u32::from_le_bytes([header[24], header[25], header[26], header[27]]);
        assert_eq!(sample_rate, 16000);
    }

    #[tokio::test]
    async fn test_save_audio_pcm() {
        let dir = tempfile::tempdir().unwrap();
        let file_path = dir.path().join("audio.pcm");
        let path_str = file_path.to_str().unwrap().to_string();

        let audio_data = vec![0u8; 100];
        save_audio(&path_str, &audio_data, SaveAudioOptions::default())
            .await
            .unwrap();

        let saved = fs::read(&path_str).await.unwrap();
        // PCM 文件直接保存，不添加头
        assert_eq!(saved, audio_data);
    }

    #[tokio::test]
    async fn test_save_audio_wav_without_header() {
        let dir = tempfile::tempdir().unwrap();
        let file_path = dir.path().join("audio.wav");
        let path_str = file_path.to_str().unwrap().to_string();

        let audio_data = vec![0u8; 100];
        save_audio(&path_str, &audio_data, SaveAudioOptions::default())
            .await
            .unwrap();

        let saved = fs::read(&path_str).await.unwrap();
        // 应该有 WAV 头 (44 bytes) + 数据 (100 bytes)
        assert_eq!(saved.len(), 144);
        assert_eq!(&saved[0..4], b"RIFF");
        assert_eq!(&saved[8..12], b"WAVE");
    }

    #[test]
    fn test_has_wav_header_exact_minimal() {
        // 正好 4 字节匹配 RIFF 但不够完整 WAV 头
        assert!(has_wav_header(b"RIFF")); // 4 bytes matches
    }

    #[test]
    fn test_has_wav_header_not_riff() {
        let data = b"ABCD....WAVE...";
        assert!(!has_wav_header(data));
    }

    #[test]
    fn test_create_wav_header_8bit() {
        let options = SaveAudioOptions {
            sample_rate: 8000,
            channels: 1,
            bits_per_sample: 8,
        };
        let header = create_wav_header(50, &options);
        assert_eq!(header.len(), 44);
        let bits_per = u16::from_le_bytes([header[34], header[35]]);
        assert_eq!(bits_per, 8);
        let sample_rate = u32::from_le_bytes([header[24], header[25], header[26], header[27]]);
        assert_eq!(sample_rate, 8000);
    }

    #[tokio::test]
    async fn test_save_audio_no_extension() {
        let dir = tempfile::tempdir().unwrap();
        let file_path = dir.path().join("audio_no_ext");
        let path_str = file_path.to_str().unwrap().to_string();

        let audio_data = vec![0u8; 64];
        save_audio(&path_str, &audio_data, SaveAudioOptions::default())
            .await
            .unwrap();

        let saved = tokio::fs::read(&path_str).await.unwrap();
        // 无扩展名按裸数据处理
        assert_eq!(saved, audio_data);
    }

    #[tokio::test]
    async fn test_save_audio_zero_length() {
        let dir = tempfile::tempdir().unwrap();
        let file_path = dir.path().join("empty.wav");
        let path_str = file_path.to_str().unwrap().to_string();

        let result = save_audio(&path_str, &[], SaveAudioOptions::default()).await;
        assert!(result.is_ok());
        let saved = tokio::fs::read(&path_str).await.unwrap();
        // 空数据 + WAV 头 = 44 bytes
        assert_eq!(saved.len(), 44);
    }

    #[tokio::test]
    async fn test_save_audio_wav_already_has_header() {
        let dir = tempfile::tempdir().unwrap();
        let file_path = dir.path().join("audio.wav");
        let path_str = file_path.to_str().unwrap().to_string();

        let header = create_wav_header(50, &SaveAudioOptions::default());
        let mut audio_with_header = header.clone();
        audio_with_header.extend_from_slice(&[0u8; 50]);

        save_audio(&path_str, &audio_with_header, SaveAudioOptions::default())
            .await
            .unwrap();

        let saved = fs::read(&path_str).await.unwrap();
        // 已有头，不应重复添加
        assert_eq!(saved.len(), audio_with_header.len());
    }
}
