/// ASR 模块 - 语音识别
pub mod error;
pub mod protocol;
pub mod provider;
pub mod registry;
pub mod traits;
pub mod types;

pub use error::AsrError;
pub use provider::{
    AudioInput, DoubaoAsr, DoubaoAsrConnection, DoubaoAsrMode, DoubaoAsrOption, adapt_audio_input,
};
pub use traits::{AsrConnectOption, AsrConnection, AsrProvider, ConnectionState};
pub use types::{
    AsrResponse, AsrSegment, AsrStreamChunk, AudioCodecFormat, AudioContainerFormat, AudioStream,
    BaseProviderOption,
};
