/// Opus 解码工具 - 将裸 Opus 数据包解码为 PCM 音频流
///
/// 基于 `opus2` crate（bundled 模式），编译时自动构建 libopus，
/// 无需系统安装 libopus。
///
/// # Feature Gate
///
/// 本模块仅在 `opus-decoder` feature 启用时可用：
/// ```toml
/// univoice = { features = ["opus-decoder"] }
/// ```
use std::pin::Pin;

use futures_util::Stream;
use opus2::{self, Channels};

/// Opus 解码错误
#[derive(Debug, thiserror::Error)]
pub enum OpusDecodeError {
    /// Opus 库返回的错误
    #[error("Opus 解码错误: {0}")]
    OpusError(#[from] opus2::Error),

    /// 无效的声道数
    #[error("不支持的声道数: {0}（仅支持 1=单声道, 2=立体声）")]
    InvalidChannels(u8),
}

/// Opus 解码配置选项
#[derive(Debug, Clone)]
pub struct OpusDecodeOptions {
    /// 采样率（Hz，默认 16000）
    pub sample_rate: u32,
    /// 声道数（1=单声道, 2=立体声，默认 1）
    pub channels: u8,
    /// 每帧时长（毫秒，默认 60）
    pub frame_size_ms: u32,
}

impl Default for OpusDecodeOptions {
    fn default() -> Self {
        Self {
            sample_rate: 16000,
            channels: 1,
            frame_size_ms: 60,
        }
    }
}

/// Opus 解码器 - 将裸 Opus 数据包解码为 PCM i16 采样
pub struct OpusDecoder {
    decoder: opus2::Decoder,
    sample_rate: u32,
    channels: u8,
    /// 最大每帧采样数（per channel），用于输出缓冲区分配
    max_samples_per_frame: usize,
}

impl OpusDecoder {
    /// 创建新的 Opus 解码器
    pub fn new(options: OpusDecodeOptions) -> Result<Self, OpusDecodeError> {
        let channels_enum = match options.channels {
            1 => Channels::Mono,
            2 => Channels::Stereo,
            n => return Err(OpusDecodeError::InvalidChannels(n)),
        };

        let decoder = opus2::Decoder::new(options.sample_rate, channels_enum)?;

        // 最大帧为 120ms（Opus 规范上限），用于预分配输出缓冲区
        let max_samples_per_frame = (options.sample_rate as usize * 120) / 1000;

        Ok(Self {
            decoder,
            sample_rate: options.sample_rate,
            channels: options.channels,
            max_samples_per_frame,
        })
    }

    /// 获取采样率
    pub fn sample_rate(&self) -> u32 {
        self.sample_rate
    }

    /// 获取声道数
    pub fn channels(&self) -> u8 {
        self.channels
    }

    /// 解码单个 Opus 数据包为 PCM i16 采样
    ///
    /// 返回解码后的 PCM 数据（i16 格式，interleaved：L,R,L,R,...）
    ///
    /// # 参数
    /// - `opus_data`: 裸 Opus 数据包
    ///
    /// # 返回值
    /// - `Ok(Vec<i16>)`: 解码后的 PCM 采样数据
    pub fn decode_packet(&mut self, opus_data: &[u8]) -> Result<Vec<i16>, OpusDecodeError> {
        let buf_size = self.max_samples_per_frame * self.channels as usize;
        let mut pcm = vec![0i16; buf_size];
        let samples_per_channel = self.decoder.decode(opus_data, &mut pcm, false)?;
        let total_samples = samples_per_channel * self.channels as usize;
        pcm.truncate(total_samples);
        Ok(pcm)
    }
}

/// 将 Opus 数据包流转换为 PCM 流
///
/// 将输入的 Opus 数据包异步流解码为 PCM i16 采样流，
/// 每个输出元素是一个完整的帧的 PCM 数据（Vec<u8>，小端序 i16）。
///
/// # 参数
/// - `opus_packets`: Opus 数据包异步流
/// - `options`: 解码配置
///
/// # 返回值
/// - PCM 数据流（每个元素为 Vec<u8>，小端序 i16 字节）
pub fn decode_opus_stream(
    opus_packets: impl Stream<Item = Vec<u8>> + Send + 'static,
    options: OpusDecodeOptions,
) -> Pin<Box<dyn Stream<Item = Result<Vec<u8>, OpusDecodeError>> + Send>> {
    use futures_util::StreamExt;

    let mut decoder = match OpusDecoder::new(options) {
        Ok(d) => d,
        Err(e) => {
            return Box::pin(futures_util::stream::once(async move { Err(e) }));
        }
    };

    Box::pin(async_stream::try_stream! {
        tokio::pin!(opus_packets);
        while let Some(packet) = opus_packets.next().await {
            let pcm = decoder.decode_packet(&packet)?;
            // 将 i16 转为小端序字节
            let bytes: Vec<u8> = pcm
                .iter()
                .flat_map(|s| s.to_le_bytes())
                .collect();
            yield bytes;
        }
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 测试 OpusDecoder 创建
    #[test]
    fn test_opus_decoder_new() {
        let decoder = OpusDecoder::new(OpusDecodeOptions {
            sample_rate: 16000,
            channels: 1,
            frame_size_ms: 60,
        });
        assert!(decoder.is_ok(), "创建 Opus 解码器应成功");

        // 测试无效声道数
        let bad = OpusDecoder::new(OpusDecodeOptions {
            sample_rate: 16000,
            channels: 3,
            frame_size_ms: 60,
        });
        assert!(bad.is_err(), "3 声道应失败");
    }

    /// 测试 OpusDecoder 创建（立体声）
    #[test]
    fn test_opus_decoder_stereo() {
        let decoder = OpusDecoder::new(OpusDecodeOptions {
            sample_rate: 48000,
            channels: 2,
            frame_size_ms: 20,
        });
        assert!(decoder.is_ok(), "立体声创建应成功");
    }

    /// 测试解码默认属性
    #[test]
    fn test_opus_decoder_defaults() {
        let decoder = OpusDecoder::new(OpusDecodeOptions::default()).unwrap();
        assert_eq!(decoder.sample_rate(), 16000);
        assert_eq!(decoder.channels(), 1);
    }
}
