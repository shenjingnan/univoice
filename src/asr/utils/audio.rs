/// 音频处理工具
///
/// 用于音频格式判断、WAV 解析、格式转换和音频分割。
/// 对应 TypeScript `src/asr/utils/audio.ts`。
use crate::asr::error::AsrError;
use crate::asr::types::DEFAULT_SAMPLE_RATE;

/// WAV 文件信息
#[derive(Debug, Clone)]
pub struct WavInfo {
    /// 声道数
    pub channels: u16,
    /// 采样位宽（bytes per sample，如 2 表示 16-bit）
    pub sample_width: u16,
    /// 采样率（Hz）
    pub sample_rate: u32,
    /// 帧数（总采样数 / 声道数）
    pub frame_count: u32,
    /// 裸 PCM 数据
    pub data: Vec<u8>,
}

/// 判断是否为 WAV 格式
///
/// 检查数据是否以 RIFF + WAVE 标记开头。
#[must_use]
pub fn is_wav(data: &[u8]) -> bool {
    if data.len() < 44 {
        return false;
    }
    &data[0..4] == b"RIFF" && &data[8..12] == b"WAVE"
}

/// 检测是否为压缩音频格式（MP3、OGG、FLAC 等）
#[must_use]
pub fn is_compressed_audio(data: &[u8]) -> bool {
    if data.len() < 4 {
        return false;
    }
    // MP3: ID3v2 标签
    if data[0] == 0x49 && data[1] == 0x44 && data[2] == 0x33 {
        return true;
    }
    // MP3: 帧同步标记
    if data[0] == 0xFF && (data[1] & 0xE0) == 0xE0 {
        return true;
    }
    // OGG
    if &data[0..4] == b"OggS" {
        return true;
    }
    // FLAC
    if &data[0..4] == b"fLaC" {
        return true;
    }
    false
}

/// 创建 WAV 文件头
///
/// 将裸 PCM 数据封装为 WAV 格式。
///
/// # 参数
/// - `pcm_data`: 裸 PCM 数据
/// - `sample_rate`: 采样率（默认 16000）
/// - `channels`: 声道数（默认 1）
/// - `bit_depth`: 位深（默认 16）
#[must_use]
pub fn create_wav_from_pcm(
    pcm_data: &[u8],
    sample_rate: u32,
    channels: u16,
    bit_depth: u16,
) -> Vec<u8> {
    let byte_rate = sample_rate * u32::from(channels) * u32::from(bit_depth / 8);
    let block_align = channels * (bit_depth / 8);
    let data_size = pcm_data.len() as u32;

    let mut wav = Vec::with_capacity(44 + pcm_data.len());

    // RIFF chunk descriptor
    wav.extend_from_slice(b"RIFF");
    wav.extend_from_slice(&(36 + data_size).to_le_bytes());
    wav.extend_from_slice(b"WAVE");

    // fmt sub-chunk
    wav.extend_from_slice(b"fmt ");
    wav.extend_from_slice(&16u32.to_le_bytes()); // sub-chunk size
    wav.extend_from_slice(&1u16.to_le_bytes()); // audio format (PCM)
    wav.extend_from_slice(&channels.to_le_bytes());
    wav.extend_from_slice(&sample_rate.to_le_bytes());
    wav.extend_from_slice(&byte_rate.to_le_bytes());
    wav.extend_from_slice(&block_align.to_le_bytes());
    wav.extend_from_slice(&bit_depth.to_le_bytes());

    // data sub-chunk
    wav.extend_from_slice(b"data");
    wav.extend_from_slice(&data_size.to_le_bytes());

    // PCM data
    wav.extend_from_slice(pcm_data);

    wav
}

/// 解析 WAV 文件信息
///
/// # 参数
/// - `data`: WAV 文件数据
///
/// # 返回值
/// - `Ok(WavInfo)`: WAV 文件信息
///
/// # 错误
/// - 数据过短或格式不正确
pub fn parse_wav_info(data: &[u8]) -> Result<WavInfo, AsrError> {
    if data.len() < 44 {
        return Err(AsrError::InvalidParameter(
            "Invalid WAV file: too short".into(),
        ));
    }

    if &data[0..4] != b"RIFF" {
        return Err(AsrError::InvalidParameter(
            "Invalid WAV file: not RIFF format".into(),
        ));
    }

    if &data[8..12] != b"WAVE" {
        return Err(AsrError::InvalidParameter(
            "Invalid WAV file: not WAVE format".into(),
        ));
    }

    let audio_format = u16::from_le_bytes([data[20], data[21]]);
    if audio_format != 1 {
        return Err(AsrError::InvalidParameter(format!(
            "Unsupported WAV format: {audio_format}, only PCM (1) is supported"
        )));
    }

    let channels = u16::from_le_bytes([data[22], data[23]]);
    let sample_rate = u32::from_le_bytes([data[24], data[25], data[26], data[27]]);
    let bits_per_sample = u16::from_le_bytes([data[34], data[35]]);

    // 扫描子块查找 data 子块
    let mut pos = 36;
    while pos + 8 <= data.len() {
        let subchunk_id = &data[pos..pos + 4];
        let subchunk_size =
            u32::from_le_bytes([data[pos + 4], data[pos + 5], data[pos + 6], data[pos + 7]])
                as usize;

        if subchunk_id == b"data" {
            let wave_data_start = pos + 8;
            let wave_data_end = (wave_data_start + subchunk_size).min(data.len());
            let wave_data = data[wave_data_start..wave_data_end].to_vec();

            let bytes_per_frame = usize::from(channels) * usize::from(bits_per_sample / 8);
            let frame_count = wave_data.len().checked_div(bytes_per_frame).unwrap_or(0) as u32;

            return Ok(WavInfo {
                channels,
                sample_width: bits_per_sample / 8,
                sample_rate,
                frame_count,
                data: wave_data,
            });
        }

        pos += 8 + subchunk_size;
    }

    Err(AsrError::InvalidParameter(
        "Invalid WAV file: no data subchunk found".into(),
    ))
}

/// 检查系统中的 ffmpeg 是否可用
#[must_use]
pub fn check_ffmpeg() -> bool {
    std::process::Command::new("ffmpeg")
        .arg("-version")
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .status()
        .map(|s| s.success())
        .unwrap_or(false)
}

/// 使用 ffmpeg 转换音频为 WAV 格式
///
/// 需要系统中已安装 ffmpeg。
///
/// # 参数
/// - `input`: 音频文件路径或字节数据
/// - `target_sample_rate`: 目标采样率（默认 16000）
///
/// # 返回值
/// - `Ok(Vec<u8>)`: WAV 格式的音频数据
///
/// # 错误
/// - ffmpeg 未安装
/// - 转换失败
pub fn convert_to_wav(input: &[u8], target_sample_rate: u32) -> Result<Vec<u8>, AsrError> {
    if !check_ffmpeg() {
        return Err(AsrError::Other(
            "ffmpeg is not installed or not in PATH".into(),
        ));
    }

    let mut child = std::process::Command::new("ffmpeg")
        .args([
            "-v",
            "quiet",
            "-y",
            "-i",
            "-", // read from stdin
            "-acodec",
            "pcm_s16le",
            "-ac",
            "1",
            "-ar",
            &target_sample_rate.to_string(),
            "-f",
            "wav",
            "-", // output to stdout
        ])
        .stdin(std::process::Stdio::piped())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .map_err(|e| AsrError::Other(format!("Failed to spawn ffmpeg: {e}")))?;

    // 写入输入数据到 stdin
    if let Some(mut stdin) = child.stdin.take() {
        use std::io::Write;
        stdin
            .write_all(input)
            .map_err(|e| AsrError::Other(format!("Failed to write ffmpeg input: {e}")))?;
    }

    let output = child
        .wait_with_output()
        .map_err(|e| AsrError::Other(format!("Failed to wait for ffmpeg: {e}")))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(AsrError::Other(format!(
            "ffmpeg conversion failed: {stderr}"
        )));
    }

    Ok(output.stdout)
}

/// 根据时长计算分段大小（字节数）
#[must_use]
pub fn calculate_segment_size(
    channels: u16,
    sample_width: u16,
    sample_rate: u32,
    duration_ms: u32,
) -> usize {
    let bytes_per_second = usize::from(channels) * usize::from(sample_width) * sample_rate as usize;
    (bytes_per_second * duration_ms as usize) / 1000
}

/// 分割音频数据为指定大小的分段
///
/// # 参数
/// - `data`: 音频数据
/// - `segment_size`: 每段大小（字节数）
///
/// # 返回值
/// - 分段后的音频数据列表
#[must_use]
pub fn split_audio(data: &[u8], segment_size: usize) -> Vec<Vec<u8>> {
    if segment_size == 0 {
        return Vec::new();
    }

    let mut segments = Vec::new();
    let mut offset = 0;
    while offset < data.len() {
        let end = (offset + segment_size).min(data.len());
        segments.push(data[offset..end].to_vec());
        offset = end;
    }
    segments
}

/// 读取音频数据
///
/// 支持多种输入类型：字节数据或文件路径。
///
/// # 参数
/// - `input`: 音频源（字节切片或文件路径字符串）
///
/// # 返回值
/// - `Ok(Vec<u8>)`: 音频字节数据
///
/// # 错误
/// - 文件读取失败
pub async fn read_audio(input: &[u8]) -> Result<Vec<u8>, AsrError> {
    Ok(input.to_vec())
}

/// 从文件路径读取音频数据
///
/// # 参数
/// - `path`: 音频文件路径
///
/// # 返回值
/// - `Ok(Vec<u8>)`: 音频字节数据
///
/// # 错误
/// - 文件读取失败
pub async fn read_audio_from_file(path: &str) -> Result<Vec<u8>, AsrError> {
    tokio::fs::read(path)
        .await
        .map_err(|e| AsrError::Other(format!("Failed to read audio file '{path}': {e}")))
}

/// 处理音频数据
///
/// 包括格式自动检测、WAV 解析和分段大小计算。
///
/// # 参数
/// - `input`: 音频数据
/// - `segment_duration_ms`: 每段时长（毫秒，默认 200）
///
/// # 返回值
/// - `Ok(AudioProcessingResult)`: 处理结果
///
/// # 错误
/// - 音频解析失败
/// - ffmpeg 转换失败（压缩格式需要 ffmpeg）
pub async fn process_audio(
    input: &[u8],
    segment_duration_ms: u32,
) -> Result<AudioProcessingResult, AsrError> {
    let wav_data = if is_wav(input) {
        input.to_vec()
    } else if is_compressed_audio(input) {
        convert_to_wav(input, DEFAULT_SAMPLE_RATE)?
    } else {
        create_wav_from_pcm(input, DEFAULT_SAMPLE_RATE, 1, 16)
    };

    let wav_info = parse_wav_info(&wav_data)?;

    let segment_size = calculate_segment_size(
        wav_info.channels,
        wav_info.sample_width,
        wav_info.sample_rate,
        segment_duration_ms,
    );

    let audio_data = wav_info.data.clone();

    Ok(AudioProcessingResult {
        wav_data,
        wav_info,
        segment_size,
        audio_data,
    })
}

/// 音频处理结果
#[derive(Debug, Clone)]
pub struct AudioProcessingResult {
    /// 完整的 WAV 数据
    pub wav_data: Vec<u8>,
    /// WAV 文件信息
    pub wav_info: WavInfo,
    /// 分段大小（字节数）
    pub segment_size: usize,
    /// 裸 PCM 数据
    pub audio_data: Vec<u8>,
}

/// 将字节数据转换为音频流（用于支持流式输入识别）
///
/// 对应 TypeScript 的 `bufferToAudioStream`。
///
/// # 参数
/// - `buffer`: 音频数据
/// - `chunk_size`: 分块大小（字节，默认 3200 = 100ms @ 16kHz 16bit mono）
///
/// # 返回值
/// - 音频流
pub fn buffer_to_audio_stream(
    buffer: Vec<u8>,
    chunk_size: usize,
) -> impl futures_util::Stream<Item = Vec<u8>> {
    let default_chunk = 3200;
    let actual_chunk = if chunk_size == 0 {
        default_chunk
    } else {
        chunk_size
    };

    futures_util::stream::unfold((buffer, 0usize), move |(data, pos)| async move {
        if pos >= data.len() {
            None
        } else {
            let end = (pos + actual_chunk).min(data.len());
            let chunk = data[pos..end].to_vec();
            Some((chunk, (data, end)))
        }
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    // ====== is_wav ======

    #[test]
    fn test_is_wav_true() {
        // 构造一个 44 字节的最小 WAV 头（RIFF + 填充 + WAVE）
        let mut data = vec![0u8; 44];
        data[0..4].copy_from_slice(b"RIFF");
        data[8..12].copy_from_slice(b"WAVE");
        assert!(is_wav(&data));
    }

    #[test]
    fn test_is_wav_false_too_short() {
        assert!(!is_wav(b"RIF"));
    }

    #[test]
    fn test_is_wav_false_not_wav() {
        assert!(!is_wav(b"RIFF\x00\x00\x00\x00XXXX"));
    }

    // ====== is_compressed_audio ======

    #[test]
    fn test_is_compressed_mp3_id3() {
        let data = b"ID3\x00\x00\x00\x00";
        assert!(is_compressed_audio(data));
    }

    #[test]
    fn test_is_compressed_mp3_sync() {
        let data = [0xFF, 0xFB, 0x00, 0x00];
        assert!(is_compressed_audio(&data));
    }

    #[test]
    fn test_is_compressed_ogg() {
        let data = b"OggS\x00\x00\x00";
        assert!(is_compressed_audio(data));
    }

    #[test]
    fn test_is_compressed_flac() {
        let data = b"fLaC\x00\x00\x00";
        assert!(is_compressed_audio(data));
    }

    #[test]
    fn test_is_compressed_raw_pcm() {
        let data = [0x00, 0x01, 0x02, 0x03];
        assert!(!is_compressed_audio(&data));
    }

    #[test]
    fn test_is_compressed_audio_empty() {
        assert!(!is_compressed_audio(&[]));
    }

    #[test]
    fn test_is_compressed_audio_too_short() {
        assert!(!is_compressed_audio(&[0xFF]));
    }

    // ====== create_wav_from_pcm / parse_wav_info ======

    #[test]
    fn test_create_and_parse_wav() {
        let pcm = vec![0u8; 100];
        let wav = create_wav_from_pcm(&pcm, 16000, 1, 16);
        assert_eq!(wav.len(), 144); // 44 header + 100 data

        let info = parse_wav_info(&wav).unwrap();
        assert_eq!(info.channels, 1);
        assert_eq!(info.sample_rate, 16000);
        assert_eq!(info.sample_width, 2);
        assert_eq!(info.data, pcm);
    }

    #[test]
    fn test_parse_wav_info_stereo() {
        let pcm = vec![0u8; 200];
        let wav = create_wav_from_pcm(&pcm, 48000, 2, 16);
        let info = parse_wav_info(&wav).unwrap();
        assert_eq!(info.channels, 2);
        assert_eq!(info.sample_rate, 48000);
        assert_eq!(info.frame_count, 50); // 200 bytes / (2 channels * 2 bytes) = 50
    }

    #[test]
    fn test_parse_wav_invalid() {
        assert!(parse_wav_info(b"too short").is_err());
        assert!(parse_wav_info(&[0u8; 44]).is_err()); // no RIFF
    }

    #[test]
    fn test_parse_wav_non_pcm_format() {
        // 构建一个非 PCM 格式的 WAV（audio_format = 3 = IEEE float）
        let mut wav = vec![0u8; 44];
        wav[0..4].copy_from_slice(b"RIFF");
        wav[8..12].copy_from_slice(b"WAVE");
        wav[12..16].copy_from_slice(b"fmt ");
        wav[20] = 3; // IEEE float format
        wav[21] = 0;
        wav[22] = 1; // mono
        wav[24] = 0x40; // 16kHz
        wav[25] = 0x3E;
        wav[26] = 0;
        wav[27] = 0;
        wav[34] = 16; // 16-bit
        // data chunk
        wav[36..40].copy_from_slice(b"data");
        wav[40] = 0;
        wav[41] = 0;
        wav[42] = 0;
        wav[43] = 0;
        assert!(parse_wav_info(&wav).is_err());
    }

    #[test]
    fn test_create_wav_from_pcm_zero_length() {
        let wav = create_wav_from_pcm(&[], 16000, 1, 16);
        assert_eq!(wav.len(), 44);
        let data_size = u32::from_le_bytes([wav[40], wav[41], wav[42], wav[43]]);
        assert_eq!(data_size, 0);
    }

    #[tokio::test]
    async fn test_read_audio_from_file_not_found() {
        let result = read_audio_from_file("/nonexistent/file.wav").await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_process_audio_pcm_input() {
        // 裸 PCM 数据应被自动封装为 WAV
        let pcm = vec![0u8; 3200]; // 100ms @ 16kHz 16bit mono
        let result = process_audio(&pcm, 200).await.unwrap();
        assert!(result.wav_data.len() > 3200); // 有 WAV 头
        assert_eq!(result.wav_info.sample_rate, 16000);
        assert_eq!(result.wav_info.channels, 1);
        assert_eq!(result.wav_info.data.len(), 3200);
        assert!(result.segment_size > 0);
    }

    #[tokio::test]
    async fn test_process_audio_wav_input() {
        // WAV 输入不应被二次封装
        let pcm = vec![0u8; 3200];
        let wav = create_wav_from_pcm(&pcm, 16000, 1, 16);
        let result = process_audio(&wav, 100).await.unwrap();
        // WAV 头透传，不新增
        assert_eq!(result.wav_data.len(), wav.len());
        assert_eq!(result.wav_info.sample_rate, 16000);
        assert_eq!(result.audio_data.len(), 3200);
    }

    #[tokio::test]
    async fn test_process_audio_different_segment_duration() {
        let pcm = vec![0u8; 6400]; // 200ms @ 16kHz 16bit mono
        let result = process_audio(&pcm, 50).await.unwrap();
        // 50ms @ 16kHz 16bit mono = 1600 bytes
        assert_eq!(result.segment_size, 1600);
    }

    // ====== split_audio ======

    #[test]
    fn test_split_audio_normal() {
        let data = vec![1u8; 100];
        let segments = split_audio(&data, 30);
        assert_eq!(segments.len(), 4);
        assert_eq!(segments[0].len(), 30);
        assert_eq!(segments[1].len(), 30);
        assert_eq!(segments[2].len(), 30);
        assert_eq!(segments[3].len(), 10);
    }

    #[test]
    fn test_split_audio_exact() {
        let data = vec![1u8; 60];
        let segments = split_audio(&data, 20);
        assert_eq!(segments.len(), 3);
        assert_eq!(segments[0].len(), 20);
        assert_eq!(segments[1].len(), 20);
        assert_eq!(segments[2].len(), 20);
    }

    #[test]
    fn test_split_audio_empty() {
        let segments = split_audio(&[], 100);
        assert!(segments.is_empty());
    }

    #[test]
    fn test_split_audio_zero_segment() {
        let data = vec![1u8; 10];
        let segments = split_audio(&data, 0);
        assert!(segments.is_empty());
    }

    // ====== calculate_segment_size ======

    #[test]
    fn test_calculate_segment_size() {
        // 16kHz, 16bit mono, 100ms = 16000 * 2 * 1 * 100 / 1000 = 3200
        let size = calculate_segment_size(1, 2, 16000, 100);
        assert_eq!(size, 3200);
    }

    #[test]
    fn test_calculate_segment_size_stereo() {
        // 48kHz, 16bit stereo, 20ms = 48000 * 2 * 2 * 20 / 1000 = 3840
        let size = calculate_segment_size(2, 2, 48000, 20);
        assert_eq!(size, 3840);
    }

    // ====== buffer_to_audio_stream ======

    #[tokio::test]
    async fn test_buffer_to_audio_stream() {
        use futures_util::StreamExt;
        use tokio::pin;

        let data = vec![1u8; 100];
        let stream = buffer_to_audio_stream(data, 30);
        pin!(stream);
        let chunks: Vec<Vec<u8>> = stream.collect().await;

        assert_eq!(chunks.len(), 4);
        assert_eq!(chunks[0].len(), 30);
        assert_eq!(chunks[1].len(), 30);
        assert_eq!(chunks[2].len(), 30);
        assert_eq!(chunks[3].len(), 10);
    }

    #[tokio::test]
    async fn test_buffer_to_audio_stream_empty() {
        use futures_util::StreamExt;
        use tokio::pin;

        let stream = buffer_to_audio_stream(vec![], 3200);
        pin!(stream);
        let chunks: Vec<Vec<u8>> = stream.collect().await;
        assert!(chunks.is_empty());
    }

    #[tokio::test]
    async fn test_buffer_to_audio_stream_default_chunk() {
        use futures_util::StreamExt;
        use tokio::pin;

        let data = vec![0u8; 6400];
        let stream = buffer_to_audio_stream(data, 0);
        pin!(stream);
        let chunks: Vec<Vec<u8>> = stream.collect().await;
        assert_eq!(chunks.len(), 2);
        assert_eq!(chunks[0].len(), 3200);
    }
}
