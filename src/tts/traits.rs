use async_trait::async_trait;

use crate::asr::traits::ConnectionState;
use crate::tts::error::TtsError;
use crate::tts::types::{
    TextStream, TtsAudioStream, TtsConnectOption, TtsRequest, TtsResponse, TtsVoice,
};

/// TTS Provider 核心 trait
#[async_trait]
pub trait TtsProvider: Send + Sync {
    /// 返回 provider 名称（如 "qwen"）
    fn name(&self) -> &'static str;

    /// 非流式合成：完整文本 → 完整音频
    async fn synthesize(&self, request: TtsRequest) -> Result<TtsResponse, TtsError>;

    /// 流式合成：流式文本 → 流式音频（可选覆盖，默认返回 Unsupported）
    async fn speak_stream(&self, _input: TextStream) -> Result<TtsAudioStream, TtsError> {
        Err(TtsError::Unsupported("speak_stream"))
    }

    /// 预建立 WebSocket 连接（可选覆盖，默认返回 Unsupported）
    async fn connect(
        &self,
        _options: TtsConnectOption,
    ) -> Result<Box<dyn TtsConnection>, TtsError> {
        Err(TtsError::Unsupported("connect"))
    }

    /// 获取支持的音色列表（可选覆盖，默认返回空列表）
    async fn list_voices(&self) -> Result<Vec<TtsVoice>, TtsError> {
        Ok(Vec::new())
    }
}

/// TTS 连接实例：在已建立的连接上进行多次合成
#[async_trait]
pub trait TtsConnection: Send {
    /// 当前连接状态
    fn state(&self) -> ConnectionState;

    /// 在已建立的连接上执行流式合成
    ///
    /// 注意：流式合成会消耗 WebSocket（需要 split），调用后连接状态变为 Closed
    async fn speak_stream(&mut self, input: TextStream) -> Result<TtsAudioStream, TtsError>;

    /// 在已建立的连接上执行非流式合成
    ///
    /// 非流式使用 &mut 引用操作 WS，不会消耗连接，调用后可继续使用
    async fn synthesize(&mut self, text: String) -> Result<TtsResponse, TtsError>;

    /// 关闭连接（幂等）
    async fn close(&mut self) -> Result<(), TtsError>;
}
