//! ASR 性能测试执行器
//!
//! 负责创建 ASR Provider、读取音频文件、执行 listen_stream、收集指标。

use std::path::Path;

use futures_util::StreamExt;
use uuid::Uuid;

use crate::asr::{AudioContainerFormat, AudioInput, DEFAULT_CHUNK_SIZE, adapt_audio_input};
use crate::benchmark::collector::MetricsCollector;
use crate::benchmark::provider_factory::{ProviderError, create_asr_provider};
use crate::benchmark::types::{BenchmarkConfig, RawAccuracyData, SingleTestResult};

/// 运行 ASR 流式识别测试
///
/// 读取音频文件，流式发送给 Provider，收集文本块并计时。
#[allow(clippy::too_many_arguments)]
pub async fn run_asr_test(
    provider: &str,
    model: &str,
    audio_path: &Path,
    audio_duration: f64,
    audio_format: &str,
    expected_text: Option<&str>,
    iterations: u32,
    timeout_secs: u64,
) -> Result<Vec<SingleTestResult>, ProviderError> {
    // 检测音频格式
    let container_format = match audio_format {
        "pcm" => Some(AudioContainerFormat::Pcm),
        "wav" => Some(AudioContainerFormat::Wav),
        "mp3" => Some(AudioContainerFormat::Mp3),
        _ => None,
    };

    let asr = create_asr_provider(
        provider,
        model,
        container_format,
        Some(DEFAULT_CHUNK_SIZE as u32),
    )?;

    let mut results = Vec::with_capacity(iterations as usize);

    for i in 1..=iterations {
        // 每次迭代重新读取音频文件（避免流被消费完）
        let audio_data = match tokio::fs::read(audio_path).await {
            Ok(data) => data,
            Err(e) => {
                let result = SingleTestResult {
                    id: Uuid::new_v4().to_string(),
                    timestamp: chrono::Utc::now().to_rfc3339(),
                    provider: provider.to_string(),
                    model: model.to_string(),
                    test_type: "asr".to_string(),
                    scenario: "listen_stream".to_string(),
                    iteration: i,
                    config: BenchmarkConfig {
                        input_mode: "stream".to_string(),
                        output_mode: "stream".to_string(),
                        format: audio_format.to_string(),
                        text_length: None,
                        audio_duration: Some(audio_duration),
                        voice: None,
                        sample_rate: None,
                    },
                    start_time: 0.0,
                    throughput: crate::benchmark::types::ThroughputMetrics {
                        data_rate: 0.0,
                        chunk_count: 0,
                        avg_chunk_size: 0.0,
                        chunks: None,
                    },
                    quality: crate::benchmark::types::QualityMetrics {
                        data_size: 0,
                        text_length: None,
                        audio_duration: Some(audio_duration),
                        bitrate: None,
                    },
                    accuracy: None,
                    status: "error".to_string(),
                    error: Some(format!("读取音频文件失败: {}", e)),
                };
                results.push(result);
                continue;
            }
        };

        let mut collector = MetricsCollector::new();
        collector.start();

        // 创建音频流
        let audio_stream = adapt_audio_input(AudioInput::Data(audio_data), DEFAULT_CHUNK_SIZE);

        // 执行流式识别
        let listen_result = tokio::time::timeout(
            std::time::Duration::from_secs(timeout_secs),
            asr.listen_stream(audio_stream),
        )
        .await;

        match listen_result {
            Ok(Ok(mut result_stream)) => {
                let mut recognized_text = String::new();
                let mut stream_error: Option<String> = None;

                while let Some(chunk_result) = result_stream.next().await {
                    match chunk_result {
                        Ok(chunk) => {
                            collector.add_chunk(chunk.text.as_bytes());
                            if chunk.is_final && !chunk.text.is_empty() {
                                recognized_text.push_str(&chunk.text);
                            }
                        }
                        Err(e) => {
                            stream_error = Some(e.to_string());
                            break;
                        }
                    }
                }

                if collector.total_latency_ms().is_none() {
                    collector.stop();
                }

                if stream_error.is_none() {
                    let start_time = collector.start_time_ms();
                    let throughput = collector.throughput_metrics();

                    let recognized_len = recognized_text.len();
                    let accuracy = expected_text.map(|expected| RawAccuracyData {
                        expected_text: Some(expected.to_string()),
                        actual_text: if recognized_text.is_empty() {
                            None
                        } else {
                            Some(recognized_text.clone())
                        },
                    });

                    results.push(SingleTestResult {
                        id: Uuid::new_v4().to_string(),
                        timestamp: chrono::Utc::now().to_rfc3339(),
                        provider: provider.to_string(),
                        model: model.to_string(),
                        test_type: "asr".to_string(),
                        scenario: "listen_stream".to_string(),
                        iteration: i,
                        config: BenchmarkConfig {
                            input_mode: "stream".to_string(),
                            output_mode: "stream".to_string(),
                            format: audio_format.to_string(),
                            text_length: None,
                            audio_duration: Some(audio_duration),
                            voice: None,
                            sample_rate: None,
                        },
                        start_time,
                        throughput,
                        quality: crate::benchmark::types::QualityMetrics {
                            data_size: 0,
                            text_length: Some(recognized_len),
                            audio_duration: Some(audio_duration),
                            bitrate: None,
                        },
                        accuracy,
                        status: "success".to_string(),
                        error: None,
                    });
                } else {
                    let start_time = collector.start_time_ms();
                    results.push(SingleTestResult {
                        id: Uuid::new_v4().to_string(),
                        timestamp: chrono::Utc::now().to_rfc3339(),
                        provider: provider.to_string(),
                        model: model.to_string(),
                        test_type: "asr".to_string(),
                        scenario: "listen_stream".to_string(),
                        iteration: i,
                        config: BenchmarkConfig {
                            input_mode: "stream".to_string(),
                            output_mode: "stream".to_string(),
                            format: audio_format.to_string(),
                            text_length: None,
                            audio_duration: Some(audio_duration),
                            voice: None,
                            sample_rate: None,
                        },
                        start_time,
                        throughput: crate::benchmark::types::ThroughputMetrics {
                            data_rate: 0.0,
                            chunk_count: 0,
                            avg_chunk_size: 0.0,
                            chunks: None,
                        },
                        quality: crate::benchmark::types::QualityMetrics {
                            data_size: 0,
                            text_length: None,
                            audio_duration: Some(audio_duration),
                            bitrate: None,
                        },
                        accuracy: None,
                        status: "error".to_string(),
                        error: stream_error,
                    });
                }
            }
            Ok(Err(e)) => {
                let start_time = collector.start_time_ms();
                results.push(SingleTestResult {
                    id: Uuid::new_v4().to_string(),
                    timestamp: chrono::Utc::now().to_rfc3339(),
                    provider: provider.to_string(),
                    model: model.to_string(),
                    test_type: "asr".to_string(),
                    scenario: "listen_stream".to_string(),
                    iteration: i,
                    config: BenchmarkConfig {
                        input_mode: "stream".to_string(),
                        output_mode: "stream".to_string(),
                        format: audio_format.to_string(),
                        text_length: None,
                        audio_duration: Some(audio_duration),
                        voice: None,
                        sample_rate: None,
                    },
                    start_time,
                    throughput: crate::benchmark::types::ThroughputMetrics {
                        data_rate: 0.0,
                        chunk_count: 0,
                        avg_chunk_size: 0.0,
                        chunks: None,
                    },
                    quality: crate::benchmark::types::QualityMetrics {
                        data_size: 0,
                        text_length: None,
                        audio_duration: Some(audio_duration),
                        bitrate: None,
                    },
                    accuracy: None,
                    status: "error".to_string(),
                    error: Some(e.to_string()),
                });
            }
            Err(_) => {
                let start_time = collector.start_time_ms();
                results.push(SingleTestResult {
                    id: Uuid::new_v4().to_string(),
                    timestamp: chrono::Utc::now().to_rfc3339(),
                    provider: provider.to_string(),
                    model: model.to_string(),
                    test_type: "asr".to_string(),
                    scenario: "listen_stream".to_string(),
                    iteration: i,
                    config: BenchmarkConfig {
                        input_mode: "stream".to_string(),
                        output_mode: "stream".to_string(),
                        format: audio_format.to_string(),
                        text_length: None,
                        audio_duration: Some(audio_duration),
                        voice: None,
                        sample_rate: None,
                    },
                    start_time,
                    throughput: crate::benchmark::types::ThroughputMetrics {
                        data_rate: 0.0,
                        chunk_count: 0,
                        avg_chunk_size: 0.0,
                        chunks: None,
                    },
                    quality: crate::benchmark::types::QualityMetrics {
                        data_size: 0,
                        text_length: None,
                        audio_duration: Some(audio_duration),
                        bitrate: None,
                    },
                    accuracy: None,
                    status: "timeout".to_string(),
                    error: Some(format!("ASR 识别超时 ({}s)", timeout_secs)),
                });
            }
        }
    }

    Ok(results)
}
