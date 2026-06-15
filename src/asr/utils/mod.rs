/// ASR 工具模块
pub mod ogg_muxer;

#[cfg(feature = "opus-decoder")]
pub mod opus;

pub use ogg_muxer::{OggMuxer, OggMuxerOptions};

#[cfg(feature = "opus-decoder")]
pub use opus::{OpusDecodeError, OpusDecodeOptions, OpusDecoder, decode_opus_stream};
