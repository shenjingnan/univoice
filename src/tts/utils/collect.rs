use futures_util::StreamExt;

use crate::tts::error::TtsError;
use crate::tts::types::{TtsAudioStream, TtsResponse};

/// 从 TTSResponse 中提取完整音频数据
///
/// 对应 TypeScript 的 `collectAudio`，TTSResponse.audio 已经是完整音频数据。
///
/// # 参数
/// - `response`: TTS 响应对象
///
/// # 返回值
/// - 完整音频字节数据
#[must_use]
pub fn collect_audio(response: &TtsResponse) -> Vec<u8> {
    response.audio.clone()
}

/// 从 TTS 音频流中收集所有音频块，合并为完整音频
///
/// 对应 TypeScript 中从流式 `speak()` 收集所有 chunk 的场景。
///
/// # 参数
/// - `stream`: TTS 流式音频输出
///
/// # 返回值
/// - `Ok(Vec<u8>)`: 完整的音频字节数据
///
/// # 错误
/// - 如果流中任一 chunk 返回错误，立即终止并返回该错误
pub async fn collect_stream(stream: TtsAudioStream) -> Result<Vec<u8>, TtsError> {
    let mut result = Vec::new();
    tokio::pin!(stream);
    while let Some(chunk) = stream.next().await {
        match chunk {
            Ok(chunk) => result.extend_from_slice(&chunk.audio_chunk),
            Err(e) => return Err(e),
        }
    }
    Ok(result)
}

/// 从 TTS 音频流中收集音频块，并附带进度回调
///
/// 在收集过程中通过 `on_chunk` 回调通知每块数据。
///
/// # 参数
/// - `stream`: TTS 流式音频输出
/// - `on_chunk`: 每收到一个 chunk 时调用的回调函数
///
/// # 返回值
/// - `Ok(Vec<u8>)`: 完整的音频字节数据
pub async fn collect_stream_with_callback<F>(
    stream: TtsAudioStream,
    on_chunk: F,
) -> Result<Vec<u8>, TtsError>
where
    F: FnMut(&[u8]),
{
    let mut result = Vec::new();
    let mut callback = on_chunk;
    tokio::pin!(stream);
    while let Some(chunk) = stream.next().await {
        match chunk {
            Ok(chunk) => {
                callback(&chunk.audio_chunk);
                result.extend_from_slice(&chunk.audio_chunk);
            }
            Err(e) => return Err(e),
        }
    }
    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::tts::types::TtsStreamChunk;
    use futures_util::stream;

    #[test]
    fn test_collect_audio() {
        let response = TtsResponse {
            audio: vec![1, 2, 3, 4],
            format: "pcm".into(),
            duration: None,
        };
        let audio = collect_audio(&response);
        assert_eq!(audio, vec![1, 2, 3, 4]);
    }

    #[tokio::test]
    async fn test_collect_stream() {
        let chunks: Vec<Result<TtsStreamChunk, TtsError>> = vec![
            Ok(TtsStreamChunk {
                audio_chunk: vec![1, 2],
            }),
            Ok(TtsStreamChunk {
                audio_chunk: vec![3, 4],
            }),
            Ok(TtsStreamChunk {
                audio_chunk: vec![5, 6],
            }),
        ];
        let stream: TtsAudioStream = Box::pin(stream::iter(chunks));
        let result = collect_stream(stream).await.unwrap();
        assert_eq!(result, vec![1, 2, 3, 4, 5, 6]);
    }

    #[tokio::test]
    async fn test_collect_stream_error() {
        let chunks: Vec<Result<TtsStreamChunk, TtsError>> = vec![
            Ok(TtsStreamChunk {
                audio_chunk: vec![1, 2],
            }),
            Err(TtsError::NoAudio),
        ];
        let stream: TtsAudioStream = Box::pin(stream::iter(chunks));
        let result = collect_stream(stream).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_collect_stream_empty() {
        let chunks: Vec<Result<TtsStreamChunk, TtsError>> = vec![];
        let stream: TtsAudioStream = Box::pin(stream::iter(chunks));
        let result = collect_stream(stream).await.unwrap();
        assert!(result.is_empty());
    }

    #[test]
    fn test_collect_audio_empty() {
        let response = TtsResponse {
            audio: vec![],
            format: "pcm".into(),
            duration: None,
        };
        let audio = collect_audio(&response);
        assert!(audio.is_empty());
    }

    #[test]
    fn test_collect_audio_large() {
        let large = vec![0xABu8; 65536];
        let response = TtsResponse {
            audio: large.clone(),
            format: "pcm".into(),
            duration: None,
        };
        let audio = collect_audio(&response);
        assert_eq!(audio.len(), 65536);
        assert_eq!(audio[0], 0xAB);
    }

    #[tokio::test]
    async fn test_collect_stream_single_chunk() {
        let chunks: Vec<Result<TtsStreamChunk, TtsError>> = vec![Ok(TtsStreamChunk {
            audio_chunk: vec![42; 128],
        })];
        let stream: TtsAudioStream = Box::pin(stream::iter(chunks));
        let result = collect_stream(stream).await.unwrap();
        assert_eq!(result.len(), 128);
        assert_eq!(result[0], 42);
    }

    #[tokio::test]
    async fn test_collect_stream_error_on_first_chunk() {
        let chunks: Vec<Result<TtsStreamChunk, TtsError>> = vec![Err(TtsError::NoAudio)];
        let stream: TtsAudioStream = Box::pin(stream::iter(chunks));
        let result = collect_stream(stream).await;
        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), TtsError::NoAudio));
    }

    #[tokio::test]
    async fn test_collect_stream_with_callback() {
        let chunks: Vec<Result<TtsStreamChunk, TtsError>> = vec![
            Ok(TtsStreamChunk {
                audio_chunk: vec![1, 2, 3],
            }),
            Ok(TtsStreamChunk {
                audio_chunk: vec![4, 5, 6],
            }),
        ];
        let stream: TtsAudioStream = Box::pin(stream::iter(chunks));

        let mut collected = Vec::new();
        let result = collect_stream_with_callback(stream, |chunk| {
            collected.push(chunk.len());
        })
        .await
        .unwrap();

        assert_eq!(result, vec![1, 2, 3, 4, 5, 6]);
        assert_eq!(collected, vec![3, 3]);
    }
}
