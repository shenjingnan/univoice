//! TTS 性能测试执行器
//!
//! 负责创建 TTS Provider、执行 synthesize/speak_stream、收集指标。

use uuid::Uuid;

use crate::benchmark::collector::MetricsCollector;
use crate::benchmark::provider_factory::{ProviderError, create_tts_provider};
use crate::benchmark::types::{BenchmarkConfig, QualityMetrics, SingleTestResult};
use crate::tts::TtsRequest;

/// 运行 TTS 非流式合成测试
///
/// 对指定 Provider 执行多次迭代，每次测量首包延迟和总延迟。
pub async fn run_tts_synthesize(
    provider: &str,
    model: &str,
    voice: &str,
    format: &str,
    text: &str,
    iterations: u32,
    timeout_secs: u64,
) -> Result<Vec<SingleTestResult>, ProviderError> {
    let tts = create_tts_provider(provider, model, voice, format, None)?;

    let mut results = Vec::with_capacity(iterations as usize);

    for i in 1..=iterations {
        let mut collector = MetricsCollector::new();
        collector.set_text_length(text.len());
        collector.start();

        let result = tokio::time::timeout(
            std::time::Duration::from_secs(timeout_secs),
            tts.synthesize(TtsRequest {
                text: text.to_string(),
                options: None,
            }),
        )
        .await;

        match result {
            Ok(Ok(response)) => {
                collector.add_chunk(&response.audio);
                collector.stop();

                let start_time = collector.start_time_ms();
                let throughput = collector.throughput_metrics();
                let quality = collector.quality_metrics(response.audio.len(), &response.format);

                results.push(SingleTestResult {
                    id: Uuid::new_v4().to_string(),
                    timestamp: chrono::Utc::now().to_rfc3339(),
                    provider: provider.to_string(),
                    model: model.to_string(),
                    test_type: "tts".to_string(),
                    scenario: "synthesize".to_string(),
                    iteration: i,
                    config: BenchmarkConfig {
                        input_mode: "non-stream".to_string(),
                        output_mode: "non-stream".to_string(),
                        format: format.to_string(),
                        text_length: Some(text.len()),
                        audio_duration: None,
                        voice: Some(voice.to_string()),
                        sample_rate: None,
                    },
                    start_time,
                    throughput,
                    quality,
                    accuracy: None,
                    status: "success".to_string(),
                    error: None,
                });
            }
            Ok(Err(e)) => {
                let start_time = collector.start_time_ms();
                results.push(error_result(
                    provider,
                    model,
                    format,
                    text,
                    voice,
                    i,
                    start_time,
                    &e.to_string(),
                ));
            }
            Err(_) => {
                let start_time = collector.start_time_ms();
                results.push(error_result(
                    provider, model, format, text, voice, i, start_time, "timeout",
                ));
            }
        }
    }

    Ok(results)
}

/// 运行 TTS 流式输出测试
///
/// 使用 speak_stream 流式接收音频，逐块记录时间。
pub async fn run_tts_stream(
    provider: &str,
    model: &str,
    voice: &str,
    format: &str,
    text: &str,
    iterations: u32,
    timeout_secs: u64,
) -> Result<Vec<SingleTestResult>, ProviderError> {
    use futures_util::StreamExt;

    let tts = create_tts_provider(provider, model, voice, format, None)?;

    let mut results = Vec::with_capacity(iterations as usize);

    for i in 1..=iterations {
        let mut collector = MetricsCollector::new();
        collector.set_text_length(text.len());
        collector.start();

        // 创建文本流（单次发送全部文本）
        let owned_text = text.to_string();
        let text_stream: crate::tts::TextStream =
            Box::pin(futures_util::stream::once(async move { owned_text }));

        let stream_result = tokio::time::timeout(
            std::time::Duration::from_secs(timeout_secs),
            tts.speak_stream(text_stream),
        )
        .await;

        match stream_result {
            Ok(Ok(mut audio_stream)) => {
                let mut total_size = 0usize;
                let mut stream_error: Option<String> = None;

                // 逐块消费音频流
                while let Some(chunk_result) = audio_stream.next().await {
                    match chunk_result {
                        Ok(chunk) => {
                            collector.add_chunk(&chunk.audio_chunk);
                            total_size += chunk.audio_chunk.len();
                        }
                        Err(e) => {
                            stream_error = Some(e.to_string());
                            break;
                        }
                    }
                }

                collector.stop();

                if stream_error.is_none() {
                    let start_time = collector.start_time_ms();
                    let throughput = collector.throughput_metrics();
                    let quality = QualityMetrics {
                        data_size: total_size,
                        text_length: Some(text.len()),
                        audio_duration: None,
                        bitrate: None,
                    };

                    results.push(SingleTestResult {
                        id: Uuid::new_v4().to_string(),
                        timestamp: chrono::Utc::now().to_rfc3339(),
                        provider: provider.to_string(),
                        model: model.to_string(),
                        test_type: "tts".to_string(),
                        scenario: "speak_stream".to_string(),
                        iteration: i,
                        config: BenchmarkConfig {
                            input_mode: "non-stream".to_string(),
                            output_mode: "stream".to_string(),
                            format: format.to_string(),
                            text_length: Some(text.len()),
                            audio_duration: None,
                            voice: Some(voice.to_string()),
                            sample_rate: None,
                        },
                        start_time,
                        throughput,
                        quality,
                        accuracy: None,
                        status: "success".to_string(),
                        error: None,
                    });
                }
            }
            Ok(Err(e)) => {
                let start_time = collector.start_time_ms();
                results.push(error_result(
                    provider,
                    model,
                    format,
                    text,
                    voice,
                    i,
                    start_time,
                    &e.to_string(),
                ));
            }
            Err(_) => {
                let start_time = collector.start_time_ms();
                results.push(error_result(
                    provider, model, format, text, voice, i, start_time, "timeout",
                ));
            }
        }
    }

    Ok(results)
}

// ============================== 流式输入 ==============================

/// 分块文本流：按指定字符数分块，间隔指定毫秒发送
///
/// 模拟 TS 版 `createTextStream(text, 5, 50)` 的行为。
pub struct ChunkedTextStream {
    text: String,
    chunk_size: usize,
    interval: std::time::Duration,
    pos: usize,
    next_tick: Option<tokio::time::Instant>,
}

impl ChunkedTextStream {
    pub fn new(text: String, chunk_size: usize, interval_ms: u64) -> Self {
        Self {
            text,
            chunk_size,
            interval: std::time::Duration::from_millis(interval_ms),
            pos: 0,
            next_tick: None,
        }
    }
}

impl futures_util::Stream for ChunkedTextStream {
    type Item = String;

    fn poll_next(
        mut self: std::pin::Pin<&mut Self>,
        cx: &mut std::task::Context<'_>,
    ) -> std::task::Poll<Option<Self::Item>> {
        if self.pos >= self.text.len() {
            return std::task::Poll::Ready(None);
        }

        let now = tokio::time::Instant::now();
        if let Some(tick) = self.next_tick {
            if now < tick {
                let waker = cx.waker().clone();
                let delay = tick - now;
                tokio::spawn(async move {
                    tokio::time::sleep(delay).await;
                    waker.wake();
                });
                return std::task::Poll::Pending;
            }
        }

        let end = (self.pos + self.chunk_size).min(self.text.len());
        let chunk = self.text[self.pos..end].to_string();
        self.pos = end;
        self.next_tick = Some(now + self.interval);
        std::task::Poll::Ready(Some(chunk))
    }
}

/// 运行 TTS 流式输入+流式输出测试
///
/// 文本分块（5字符/50ms间隔）流式发送，流式接收音频。
pub async fn run_tts_stream_input(
    provider: &str,
    model: &str,
    voice: &str,
    format: &str,
    text: &str,
    iterations: u32,
    timeout_secs: u64,
) -> Result<Vec<SingleTestResult>, ProviderError> {
    use futures_util::StreamExt;

    let tts = create_tts_provider(provider, model, voice, format, None)?;

    let mut results = Vec::with_capacity(iterations as usize);

    for i in 1..=iterations {
        let mut collector = MetricsCollector::new();
        collector.set_text_length(text.len());
        collector.start();

        let text_stream: crate::tts::TextStream =
            Box::pin(ChunkedTextStream::new(text.to_string(), 5, 50));

        let stream_result = tokio::time::timeout(
            std::time::Duration::from_secs(timeout_secs),
            tts.speak_stream(text_stream),
        )
        .await;

        match stream_result {
            Ok(Ok(mut audio_stream)) => {
                let mut total_size = 0usize;
                let mut stream_error: Option<String> = None;

                while let Some(chunk_result) = audio_stream.next().await {
                    match chunk_result {
                        Ok(chunk) => {
                            collector.add_chunk(&chunk.audio_chunk);
                            total_size += chunk.audio_chunk.len();
                        }
                        Err(e) => {
                            stream_error = Some(e.to_string());
                            break;
                        }
                    }
                }

                collector.stop();

                if stream_error.is_none() {
                    let start_time = collector.start_time_ms();
                    let throughput = collector.throughput_metrics();
                    let quality = QualityMetrics {
                        data_size: total_size,
                        text_length: Some(text.len()),
                        audio_duration: None,
                        bitrate: None,
                    };

                    results.push(SingleTestResult {
                        id: Uuid::new_v4().to_string(),
                        timestamp: chrono::Utc::now().to_rfc3339(),
                        provider: provider.to_string(),
                        model: model.to_string(),
                        test_type: "tts".to_string(),
                        scenario: "stream_input".to_string(),
                        iteration: i,
                        config: BenchmarkConfig {
                            input_mode: "stream".to_string(),
                            output_mode: "stream".to_string(),
                            format: format.to_string(),
                            text_length: Some(text.len()),
                            audio_duration: None,
                            voice: Some(voice.to_string()),
                            sample_rate: None,
                        },
                        start_time,
                        throughput,
                        quality,
                        accuracy: None,
                        status: "success".to_string(),
                        error: None,
                    });
                }
            }
            Ok(Err(e)) => {
                results.push(error_result(
                    provider,
                    model,
                    format,
                    text,
                    voice,
                    i,
                    0.0,
                    &e.to_string(),
                ));
            }
            Err(_) => {
                results.push(error_result(
                    provider, model, format, text, voice, i, 0.0, "timeout",
                ));
            }
        }
    }

    Ok(results)
}

/// 构造错误结果
#[allow(clippy::too_many_arguments)]
fn error_result(
    provider: &str,
    model: &str,
    format: &str,
    text: &str,
    voice: &str,
    iteration: u32,
    start_time: f64,
    error_msg: &str,
) -> SingleTestResult {
    SingleTestResult {
        id: Uuid::new_v4().to_string(),
        timestamp: chrono::Utc::now().to_rfc3339(),
        provider: provider.to_string(),
        model: model.to_string(),
        test_type: "tts".to_string(),
        scenario: "synthesize".to_string(),
        iteration,
        config: BenchmarkConfig {
            input_mode: "non-stream".to_string(),
            output_mode: "non-stream".to_string(),
            format: format.to_string(),
            text_length: Some(text.len()),
            audio_duration: None,
            voice: Some(voice.to_string()),
            sample_rate: None,
        },
        start_time,
        throughput: crate::benchmark::types::ThroughputMetrics {
            data_rate: 0.0,
            chunk_count: 0,
            avg_chunk_size: 0.0,
            chunks: None,
        },
        quality: QualityMetrics {
            data_size: 0,
            text_length: Some(text.len()),
            audio_duration: None,
            bitrate: None,
        },
        accuracy: None,
        status: "error".to_string(),
        error: Some(error_msg.to_string()),
    }
}
