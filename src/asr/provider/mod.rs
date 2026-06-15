pub mod doubao;
pub mod glm;
pub mod minimax;
pub mod qwen;

pub use doubao::{DoubaoAsr, DoubaoAsrConnection, DoubaoAsrMode, DoubaoAsrOption};
pub use glm::{GlmAsr, GlmAsrOption};
pub use minimax::{MinimaxAsr, MinimaxAsrOption};
pub use qwen::{QwenAsr, QwenAsrConnection, QwenAsrOption};

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
