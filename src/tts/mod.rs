/// TTS 模块 - 语音合成
pub mod error;
pub mod protocol;
pub mod provider;
pub mod registry;
pub mod traits;
pub mod types;
pub mod utils;
pub mod voice_id;
pub mod voices;

pub use error::TtsError;
pub use traits::{TtsConnection, TtsProvider};
pub use types::{
    BaseTtsOption, TextStream, TtsAudioStream, TtsConnectOption, TtsRequest, TtsResponse,
    TtsStreamChunk, TtsVoice,
};
pub use voice_id::VoiceId;
