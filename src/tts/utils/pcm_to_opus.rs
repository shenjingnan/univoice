/// PCM → Opus 流式编码器
///
/// 将 PCM 音频流流式编码为 Opus 数据包流（可选 OGG 容器封装）。
/// 依赖 `opus2` crate，编译时自动构建 libopus。
///
/// 对应 TypeScript 的 `pcmToOpus` 函数。
///
/// # Feature Gate
///
/// 本模块仅在 `opus-encoder` feature 启用时可用：
/// ```toml
/// univoice = { features = ["opus-encoder"] }
/// ```
use std::pin::Pin;

use futures_util::Stream;
use futures_util::StreamExt;
use opus2::{self, Application, Channels};

use crate::asr::utils::OggMuxer;
use crate::asr::utils::OggMuxerOptions;
use crate::tts::error::TtsError;
use crate::tts::types::TtsAudioStream;
#[cfg(test)]
use crate::tts::types::TtsStreamChunk;

/// PCM → Opus 编码后的流类型
type OpusStream = Pin<Box<dyn Stream<Item = Result<Vec<u8>, TtsError>> + Send>>;

/// Opus 支持的帧时长（毫秒）
const VALID_FRAME_DURATIONS_MS: &[u32] = &[2, 5, 10, 20, 40, 60, 120];

/// PCM → Opus 流式编码选项
#[derive(Debug, Clone)]
pub struct PcmToOpusOptions {
    /// PCM 采样率（Hz，默认 24000）
    pub sample_rate: u32,
    /// 声道数（默认 1）
    pub channels: u8,
    /// Opus 帧时长（毫秒，默认 60）
    ///
    /// 可选值: 2, 5, 10, 20, 40, 60, 120
    /// - 20ms: 标准值，延迟与压缩率平衡
    /// - 60ms: 高压缩率，适合 TTS 离线场景
    pub frame_duration_ms: u32,
    /// PCM 采样位深（bytes per sample，默认 2，即 16-bit）
    pub bytes_per_sample: usize,
    /// 是否封装为 OGG 容器格式（默认 false）
    pub ogg: bool,
    /// OGG 编码器名称（ogg=true 时有效）
    pub ogg_encoder: Option<String>,
    /// Opus 编码复杂度（0-10，默认 10）
    pub complexity: Option<i32>,
}

impl Default for PcmToOpusOptions {
    fn default() -> Self {
        Self {
            sample_rate: 24000,
            channels: 1,
            frame_duration_ms: 60,
            bytes_per_sample: 2,
            ogg: false,
            ogg_encoder: None,
            complexity: Some(10),
        }
    }
}

/// 将 PCM 音频流流式编码为 Opus 数据包流
///
/// 对应 TypeScript 的 `pcmToOpus` 函数。
///
/// # 参数
/// - `pcm_stream`: TTS 流式音频输出（包含 PCM 数据块）
/// - `options`: 编码选项
///
/// # 返回值
/// - Opus 数据包流（每个元素是一个 Opus 编码帧或 OGG 页面）
///
/// # 错误
/// - 如果参数不合法
/// - 如果 Opus 编码失败
///
/// # 示例
/// ```rust,ignore
/// use univoice::tts::utils::pcm_to_opus;
///
/// let opus_stream = pcm_to_opus(tts_stream, Default::default()).await?;
/// ```
pub fn pcm_to_opus(
    pcm_stream: TtsAudioStream,
    options: PcmToOpusOptions,
) -> Result<OpusStream, TtsError> {
    // ====== 参数校验 ======
    validate_options(&options)?;

    let frame_size_samples =
        ((options.sample_rate as u64 * options.frame_duration_ms as u64) / 1000) as usize;
    let frame_size_bytes = frame_size_samples * options.bytes_per_sample;

    // ====== 创建 Opus 编码器 ======
    let channels_enum = match options.channels {
        1 => Channels::Mono,
        2 => Channels::Stereo,
        n => {
            return Err(TtsError::InvalidParameter(format!(
                "Unsupported channels: {n} (only 1 or 2)"
            )));
        }
    };

    let mut encoder =
        opus2::Encoder::new(options.sample_rate, channels_enum, Application::Audio)
            .map_err(|e| TtsError::Other(format!("Failed to create Opus encoder: {e}")))?;

    // 设置编码复杂度
    if let Some(complexity) = options.complexity {
        if let Err(e) = encoder.set_complexity(complexity) {
            return Err(TtsError::Other(format!(
                "Failed to set Opus complexity: {e}"
            )));
        }
    }

    // ====== 准备 OGG Muxer（如果启用）======
    let use_ogg = options.ogg;
    let _ogg_encoder_name = options
        .ogg_encoder
        .clone()
        .unwrap_or_else(|| "univoice-rs".to_string());

    Ok(Box::pin(async_stream::try_stream! {
        let mut pcm_buffer: Vec<u8> = Vec::new();
        let mut ogg_muxer: Option<OggMuxer> = None;

        if use_ogg {
            ogg_muxer = Some(OggMuxer::new(OggMuxerOptions {
                sample_rate: options.sample_rate,
                channels: options.channels,
                frame_size_ms: options.frame_duration_ms,
            }));
        }

        tokio::pin!(pcm_stream);

        while let Some(chunk_result) = pcm_stream.next().await {
            let chunk = chunk_result?;
            // 累积 PCM 数据
            pcm_buffer.extend_from_slice(&chunk.audio_chunk);

            // 当缓冲区有足够数据构成一帧时，循环编码
            while pcm_buffer.len() >= frame_size_bytes {
                let frame = pcm_buffer[..frame_size_bytes].to_vec();
                pcm_buffer = pcm_buffer[frame_size_bytes..].to_vec();

                // PCM i16le 转 Opus 期望的 &[i16]
                let pcm_i16: Vec<i16> = frame
                    .chunks_exact(2)
                    .map(|b| i16::from_le_bytes([b[0], b[1]]))
                    .collect();

                let mut opus_packet = vec![0u8; 4000]; // Opus 最大包大小
                let encoded_len = encoder
                    .encode(&pcm_i16, &mut opus_packet)
                    .map_err(|e| TtsError::Other(format!("Opus encode error: {e}")))?;

                opus_packet.truncate(encoded_len);

                // OGG 封装或裸 Opus
                if let Some(ref mut muxer) = ogg_muxer {
                    let pages = muxer.push_packet(&opus_packet);
                    for page in pages {
                        yield page;
                    }
                } else {
                    yield opus_packet;
                }
            }
        }

        // 尾部不足一帧的数据用零填充
        if !pcm_buffer.is_empty() {
            let mut padded = vec![0u8; frame_size_bytes];
            let copy_len = pcm_buffer.len().min(frame_size_bytes);
            padded[..copy_len].copy_from_slice(&pcm_buffer[..copy_len]);

            let pcm_i16: Vec<i16> = padded
                .chunks_exact(2)
                .map(|b| i16::from_le_bytes([b[0], b[1]]))
                .collect();

            let mut opus_packet = vec![0u8; 4000];
            let encoded_len = encoder
                .encode(&pcm_i16, &mut opus_packet)
                .map_err(|e| TtsError::Other(format!("Opus encode error: {e}")))?;

            opus_packet.truncate(encoded_len);

            if let Some(ref mut muxer) = ogg_muxer {
                let pages = muxer.push_packet(&opus_packet);
                for page in pages {
                    yield page;
                }
            } else {
                yield opus_packet;
            }
        }

        // OGG 结束
        if let Some(ref mut muxer) = ogg_muxer {
            if let Some(eos_page) = muxer.finish() {
                yield eos_page;
            }
        }
    }))
}

/// 验证 PCM→Opus 编码选项
fn validate_options(options: &PcmToOpusOptions) -> Result<(), TtsError> {
    if options.sample_rate == 0 {
        return Err(TtsError::InvalidParameter(
            "sample_rate must be a positive number".into(),
        ));
    }
    if options.channels != 1 && options.channels != 2 {
        return Err(TtsError::InvalidParameter(
            "channels must be 1 (mono) or 2 (stereo)".into(),
        ));
    }
    if !VALID_FRAME_DURATIONS_MS.contains(&options.frame_duration_ms) {
        return Err(TtsError::InvalidParameter(format!(
            "frame_duration_ms must be one of: {:?}",
            VALID_FRAME_DURATIONS_MS
        )));
    }
    if options.bytes_per_sample != 1 && options.bytes_per_sample != 2 {
        return Err(TtsError::InvalidParameter(
            "bytes_per_sample must be 1 or 2".into(),
        ));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use futures_util::stream;

    #[test]
    fn test_validate_options_default() {
        let opts = PcmToOpusOptions::default();
        assert!(validate_options(&opts).is_ok());
    }

    #[test]
    fn test_validate_options_invalid_sample_rate() {
        let opts = PcmToOpusOptions {
            sample_rate: 0,
            ..Default::default()
        };
        assert!(validate_options(&opts).is_err());
    }

    #[test]
    fn test_validate_options_invalid_channels() {
        let opts = PcmToOpusOptions {
            channels: 3,
            ..Default::default()
        };
        assert!(validate_options(&opts).is_err());
    }

    #[test]
    fn test_validate_options_invalid_frame_duration() {
        let opts = PcmToOpusOptions {
            frame_duration_ms: 7,
            ..Default::default()
        };
        assert!(validate_options(&opts).is_err());
    }

    #[test]
    fn test_validate_options_invalid_bytes_per_sample() {
        let opts = PcmToOpusOptions {
            bytes_per_sample: 4,
            ..Default::default()
        };
        assert!(validate_options(&opts).is_err());
    }

    #[tokio::test]
    async fn test_pcm_to_opus_empty_stream() {
        let stream: TtsAudioStream = Box::pin(stream::iter(vec![]));
        let opts = PcmToOpusOptions::default();
        let mut opus_stream = pcm_to_opus(stream, opts).unwrap();

        use futures_util::StreamExt;
        let results: Vec<Result<Vec<u8>, TtsError>> = opus_stream.by_ref().collect().await;
        // 空流应该没有输出（无 PCM 数据送入编码器）
        assert!(results.is_empty());
    }

    #[tokio::test]
    async fn test_pcm_to_opus_with_audio_data() {
        // 产生 60ms @ 24kHz 16bit mono 的 PCM 数据
        // frame_size_samples = 24000 * 60 / 1000 = 1440 samples
        // frame_size_bytes = 1440 * 2 = 2880 bytes
        let frame_bytes = 2880;
        let pcm_data = vec![0u8; frame_bytes]; // 静音（全零）

        let chunks: Vec<Result<TtsStreamChunk, TtsError>> = vec![Ok(TtsStreamChunk {
            audio_chunk: pcm_data,
        })];

        let stream: TtsAudioStream = Box::pin(stream::iter(chunks));
        let opts = PcmToOpusOptions::default();
        let mut opus_stream = pcm_to_opus(stream, opts).unwrap();

        use futures_util::StreamExt;
        let results: Vec<Result<Vec<u8>, TtsError>> = opus_stream.by_ref().collect().await;

        // 应该有编码结果
        assert!(!results.is_empty(), "Should produce Opus packets");
        if let Ok(packet) = &results[0] {
            assert!(!packet.is_empty(), "Opus packet should not be empty");
            // 静音编码后的 Opus 包应该很小（约 10-20 bytes）
            assert!(
                packet.len() < 100,
                "Silence Opus packet should be small: {}",
                packet.len()
            );
        }
    }

    #[tokio::test]
    async fn test_pcm_to_opus_ogg_mode() {
        let frame_bytes = 2880; // 60ms @ 24kHz 16bit mono
        let pcm_data = vec![0u8; frame_bytes];

        let chunks: Vec<Result<TtsStreamChunk, TtsError>> = vec![Ok(TtsStreamChunk {
            audio_chunk: pcm_data,
        })];

        let stream: TtsAudioStream = Box::pin(stream::iter(chunks));
        let opts = PcmToOpusOptions {
            ogg: true,
            ..Default::default()
        };

        let mut opus_stream = pcm_to_opus(stream, opts).unwrap();

        use futures_util::StreamExt;
        let results: Vec<Result<Vec<u8>, TtsError>> = opus_stream.by_ref().collect().await;

        assert!(!results.is_empty(), "Should produce OGG pages");

        // OGG 模式下的第一页应该是 OpusHead（BOS）
        if let Ok(page) = &results[0] {
            assert_eq!(&page[0..4], b"OggS", "Should be OGG page");
            assert_eq!(page[5], 2, "First page should have BOS flag");
        }
    }

    #[tokio::test]
    async fn test_pcm_to_opus_multi_frame() {
        // 3 整帧 PCM 数据
        let frame_bytes = 2880;
        let pcm_data = vec![0u8; frame_bytes * 3];

        let chunks: Vec<Result<TtsStreamChunk, TtsError>> = vec![Ok(TtsStreamChunk {
            audio_chunk: pcm_data,
        })];

        let stream: TtsAudioStream = Box::pin(stream::iter(chunks));
        let mut opus_stream = pcm_to_opus(stream, PcmToOpusOptions::default()).unwrap();

        use futures_util::StreamExt;
        let results: Vec<Result<Vec<u8>, TtsError>> = opus_stream.by_ref().collect().await;

        // 3 帧应产生 3 个 Opus 包
        assert_eq!(results.len(), 3, "3 frames should produce 3 packets");
        for result in &results {
            assert!(result.is_ok());
            assert!(!result.as_ref().unwrap().is_empty());
        }
    }

    #[tokio::test]
    async fn test_pcm_to_opus_partial_last_frame() {
        // 2.5 帧 PCM 数据 - 尾部半帧应被零填充
        let frame_bytes = 2880;
        let pcm_data = vec![0xFFu8; frame_bytes * 2 + frame_bytes / 2];

        let chunks: Vec<Result<TtsStreamChunk, TtsError>> = vec![Ok(TtsStreamChunk {
            audio_chunk: pcm_data,
        })];

        let stream: TtsAudioStream = Box::pin(stream::iter(chunks));
        let mut opus_stream = pcm_to_opus(stream, PcmToOpusOptions::default()).unwrap();

        use futures_util::StreamExt;
        let results: Vec<Result<Vec<u8>, TtsError>> = opus_stream.by_ref().collect().await;

        // 2 整帧 + 1 填充帧 = 3 个包
        assert_eq!(results.len(), 3, "2.5 frames should produce 3 packets");
    }

    #[tokio::test]
    async fn test_pcm_to_opus_different_sample_rate() {
        // 20ms @ 16kHz 16bit mono = 16000 * 20 / 1000 * 2 = 640 bytes
        let frame_bytes = 640;
        let pcm_data = vec![0u8; frame_bytes];

        let chunks: Vec<Result<TtsStreamChunk, TtsError>> = vec![Ok(TtsStreamChunk {
            audio_chunk: pcm_data,
        })];

        let stream: TtsAudioStream = Box::pin(stream::iter(chunks));
        let opts = PcmToOpusOptions {
            sample_rate: 16000,
            frame_duration_ms: 20,
            ..Default::default()
        };

        let mut opus_stream = pcm_to_opus(stream, opts).unwrap();

        use futures_util::StreamExt;
        let results: Vec<Result<Vec<u8>, TtsError>> = opus_stream.by_ref().collect().await;

        assert!(!results.is_empty(), "16kHz 20ms should produce packets");
        for result in &results {
            assert!(result.is_ok());
        }
    }

    #[tokio::test]
    async fn test_pcm_to_opus_chunks_across_frames() {
        // 每个 chunk 小于一帧，需要累积
        let frame_bytes = 2880;
        let half_frame = frame_bytes / 2;

        let chunks: Vec<Result<TtsStreamChunk, TtsError>> = vec![
            Ok(TtsStreamChunk {
                audio_chunk: vec![0u8; half_frame],
            }),
            Ok(TtsStreamChunk {
                audio_chunk: vec![0u8; half_frame],
            }),
            Ok(TtsStreamChunk {
                audio_chunk: vec![0u8; half_frame],
            }),
            Ok(TtsStreamChunk {
                audio_chunk: vec![0u8; half_frame],
            }),
        ];

        let stream: TtsAudioStream = Box::pin(stream::iter(chunks));
        let mut opus_stream = pcm_to_opus(stream, PcmToOpusOptions::default()).unwrap();

        use futures_util::StreamExt;
        let results: Vec<Result<Vec<u8>, TtsError>> = opus_stream.by_ref().collect().await;

        // 4 x 1440 = 5760 bytes = 2 整帧，应产生 2 个包
        assert_eq!(
            results.len(),
            2,
            "Cross-chunk accumulation should produce 2 packets"
        );
    }
}
