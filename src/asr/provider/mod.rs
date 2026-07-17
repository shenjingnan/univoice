pub mod doubao;
pub mod glm;
pub mod mimo;
pub mod qwen;
pub mod xfyun;

pub use doubao::{DoubaoAsr, DoubaoAsrConnection, DoubaoAsrMode, DoubaoAsrOption};
pub use glm::{GlmAsr, GlmAsrOption};
pub use mimo::{MimoAsr, MimoAsrOption};
pub use qwen::{QwenAsr, QwenAsrConnection, QwenAsrOption};
pub use xfyun::{XfyunAsr, XfyunAsrOption};

use crate::asr::types::AudioStream;

/// 音频输入类型
pub enum AudioInput {
    Stream(AudioStream),
    Data(Vec<u8>),
}

impl From<AudioStream> for AudioInput {
    fn from(stream: AudioStream) -> Self {
        AudioInput::Stream(stream)
    }
}

impl From<Vec<u8>> for AudioInput {
    fn from(data: Vec<u8>) -> Self {
        AudioInput::Data(data)
    }
}

/// 将 AudioInput 适配为标准 AudioStream
pub fn adapt_audio_input(input: AudioInput, chunk_size: usize) -> AudioStream {
    match input {
        AudioInput::Stream(stream) => stream,
        AudioInput::Data(data) => {
            let chunks: Vec<Vec<u8>> = data.chunks(chunk_size).map(|c| c.to_vec()).collect();
            Box::pin(futures_util::stream::iter(chunks))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // ---- AudioInput 转换 ----

    #[test]
    fn test_i1_from_stream() {
        let stream: AudioStream = Box::pin(futures_util::stream::empty());
        let input = AudioInput::from(stream);
        assert!(matches!(input, AudioInput::Stream(_)));
    }

    #[test]
    fn test_i2_from_data() {
        let data = vec![1u8, 2, 3];
        let input = AudioInput::from(data);
        assert!(matches!(input, AudioInput::Data(_)));
    }

    // ---- adapt_audio_input ----

    #[tokio::test]
    async fn test_i3_adapt_stream_passthrough() {
        use futures_util::StreamExt;
        let chunks = vec![vec![1u8], vec![2u8]];
        let stream: AudioStream = Box::pin(futures_util::stream::iter(chunks.clone()));
        let adapted = adapt_audio_input(AudioInput::Stream(stream), 1);
        tokio::pin!(adapted);
        let result: Vec<Vec<u8>> = adapted.collect().await;
        assert_eq!(result, chunks);
    }

    #[tokio::test]
    async fn test_i4_adapt_data_chunked() {
        use futures_util::StreamExt;
        let data = vec![1u8, 2, 3, 4, 5];
        let adapted = adapt_audio_input(AudioInput::Data(data), 2);
        tokio::pin!(adapted);
        let result: Vec<Vec<u8>> = adapted.collect().await;
        assert_eq!(result.len(), 3);
        assert_eq!(result[0], vec![1, 2]);
        assert_eq!(result[1], vec![3, 4]);
        assert_eq!(result[2], vec![5]);
    }

    #[tokio::test]
    async fn test_i5_adapt_data_empty() {
        use futures_util::StreamExt;
        let adapted = adapt_audio_input(AudioInput::Data(vec![]), 10);
        tokio::pin!(adapted);
        let result: Vec<Vec<u8>> = adapted.collect().await;
        assert!(result.is_empty());
    }

    #[tokio::test]
    async fn test_i6_adapt_data_exact_chunk() {
        use futures_util::StreamExt;
        let data = vec![1u8, 2, 3, 4];
        let adapted = adapt_audio_input(AudioInput::Data(data), 2);
        tokio::pin!(adapted);
        let result: Vec<Vec<u8>> = adapted.collect().await;
        assert_eq!(result.len(), 2);
        assert_eq!(result[0], vec![1, 2]);
        assert_eq!(result[1], vec![3, 4]);
    }
}
