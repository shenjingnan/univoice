//! ASR Matrix Runner
//!
//! ASR 矩阵测试运行器：遍历 ASRMatrixItem，对每项执行 ASR 识别测试。

use std::path::Path;

use uuid::Uuid;

use crate::asr::{AudioContainerFormat, AudioInput, DEFAULT_CHUNK_SIZE, adapt_audio_input};
use crate::benchmark::collector::MetricsCollector;
use crate::benchmark::fixtures::AudioFixtureOwned;
use crate::benchmark::matrix::filter::{
    filter_asr_matrix_items, generate_asr_matrix_scenario_name,
};
use crate::benchmark::matrix::providers::get_asr_provider_matrix_config;
use crate::benchmark::matrix::types::{
    ASRMatrixItem, ASRMatrixRunOptions, ASRProviderMatrixConfig,
};
use crate::benchmark::provider_factory::create_asr_provider;
use crate::benchmark::types::{BenchmarkConfig, RawAccuracyData, SingleTestResult};
use futures_util::StreamExt;

/// 运行单个 ASR Matrix 测试
#[allow(clippy::too_many_arguments)]
pub async fn run_single_asr_matrix_test(
    config: &ASRProviderMatrixConfig,
    item: &ASRMatrixItem,
    audio_path: &Path,
    audio_duration: f64,
    audio_format: &str,
    expected_text: Option<&str>,
    iteration: u32,
    timeout_secs: u64,
) -> SingleTestResult {
    let _ = config;
    let scenario = generate_asr_matrix_scenario_name(item);

    let container_format = match audio_format {
        "pcm" => Some(AudioContainerFormat::Pcm),
        "wav" => Some(AudioContainerFormat::Wav),
        "mp3" => Some(AudioContainerFormat::Mp3),
        _ => None,
    };

    let asr = match create_asr_provider(
        &item.provider,
        &item.model,
        container_format,
        item.sample_rate,
    ) {
        Ok(a) => a,
        Err(e) => {
            return asr_error_result(
                &item.provider,
                &item.model,
                &scenario,
                iteration,
                &e.to_string(),
            );
        }
    };

    // 读取音频文件
    let audio_data = match tokio::fs::read(audio_path).await {
        Ok(d) => d,
        Err(e) => {
            return asr_error_result(
                &item.provider,
                &item.model,
                &scenario,
                iteration,
                &format!("读取音频失败: {}", e),
            );
        }
    };

    let mut collector = MetricsCollector::new();
    collector.start();

    let audio_stream = adapt_audio_input(AudioInput::Data(audio_data), DEFAULT_CHUNK_SIZE);

    let listen_result = tokio::time::timeout(
        std::time::Duration::from_secs(timeout_secs),
        asr.listen_stream(audio_stream),
    )
    .await;

    match listen_result {
        Ok(Ok(mut result_stream)) => {
            let mut recognized_text = String::new();
            let mut error_msg: Option<String> = None;

            while let Some(chunk_result) = result_stream.next().await {
                match chunk_result {
                    Ok(chunk) => {
                        collector.add_chunk(chunk.text.as_bytes());
                        if chunk.is_final && !chunk.text.is_empty() {
                            recognized_text.push_str(&chunk.text);
                        }
                    }
                    Err(e) => {
                        error_msg = Some(e.to_string());
                        break;
                    }
                }
            }

            if collector.total_latency_ms().is_none() {
                collector.stop();
            }

            if let Some(err) = error_msg {
                return asr_error_result(&item.provider, &item.model, &scenario, iteration, &err);
            }

            let start_time = collector.start_time_ms();
            let throughput = collector.throughput_metrics();
            let accuracy = expected_text.map(|expected| RawAccuracyData {
                expected_text: Some(expected.to_string()),
                actual_text: Some(recognized_text.clone()),
            });

            SingleTestResult {
                id: Uuid::new_v4().to_string(),
                timestamp: chrono::Utc::now().to_rfc3339(),
                provider: item.provider.clone(),
                model: item.model.clone(),
                test_type: "asr".to_string(),
                scenario,
                iteration,
                config: BenchmarkConfig {
                    input_mode: "stream".to_string(),
                    output_mode: "stream".to_string(),
                    format: audio_format.to_string(),
                    text_length: None,
                    audio_duration: Some(audio_duration),
                    voice: None,
                    sample_rate: item.sample_rate,
                },
                start_time,
                throughput,
                quality: crate::benchmark::types::QualityMetrics {
                    data_size: 0,
                    text_length: Some(recognized_text.len()),
                    audio_duration: Some(audio_duration),
                    bitrate: None,
                },
                accuracy,
                status: "success".to_string(),
                error: None,
            }
        }
        Ok(Err(e)) => asr_error_result(
            &item.provider,
            &item.model,
            &scenario,
            iteration,
            &e.to_string(),
        ),
        Err(_) => asr_error_result(&item.provider, &item.model, &scenario, iteration, "timeout"),
    }
}

/// 运行单 Provider 的 ASR 矩阵场景
pub async fn run_provider_asr_matrix_scenario(
    config: &ASRProviderMatrixConfig,
    audio: &AudioFixtureOwned,
    options: &ASRMatrixRunOptions,
) -> Vec<SingleTestResult> {
    let items = match &options.filter {
        Some(filter) => filter_asr_matrix_items(&config.items, filter),
        None => config.items.clone(),
    };

    let total = items.len() as u32 * options.iterations;
    let mut results = Vec::with_capacity(total as usize);
    let mut current = 0u32;

    for item in &items {
        for iter in 1..=options.iterations {
            current += 1;
            let scenario = generate_asr_matrix_scenario_name(item);
            println!(
                "    [{}/{}] {} (iter {}/{})",
                current, total, scenario, iter, options.iterations
            );

            let result = run_single_asr_matrix_test(
                config,
                item,
                std::path::Path::new(&audio.path),
                audio.duration,
                &audio.format,
                audio.expected_text.as_deref(),
                iter,
                options.timeout_secs,
            )
            .await;

            let status = if result.status == "success" {
                "✓"
            } else {
                "✗"
            };
            println!("      {} status={}", status, result.status);
            results.push(result);
        }
    }

    results
}

/// 运行全量 ASR 矩阵测试
pub async fn run_asr_matrix_scenario(
    provider_name: Option<&str>,
    audio: &AudioFixtureOwned,
    options: &ASRMatrixRunOptions,
) -> Vec<SingleTestResult> {
    let configs = match provider_name {
        Some(name) => {
            vec![
                get_asr_provider_matrix_config(name)
                    .unwrap_or_else(|| panic!("Unknown ASR matrix provider: {}", name)),
            ]
        }
        None => crate::benchmark::matrix::providers::all_asr_provider_matrix_configs(),
    };

    let mut all_results = Vec::new();
    for config in &configs {
        println!(
            "  📊 ASR Provider: {} ({}) — {} items",
            config.display_name,
            config.provider,
            config.items.len()
        );
        let results = run_provider_asr_matrix_scenario(config, audio, options).await;
        let success = results.iter().filter(|r| r.status == "success").count();
        println!(
            "  ✓ {} 完成: {}/{} 成功\n",
            config.display_name,
            success,
            results.len()
        );
        all_results.extend(results);
    }
    all_results
}

fn asr_error_result(
    provider: &str,
    model: &str,
    scenario: &str,
    iteration: u32,
    error_msg: &str,
) -> SingleTestResult {
    SingleTestResult {
        id: Uuid::new_v4().to_string(),
        timestamp: chrono::Utc::now().to_rfc3339(),
        provider: provider.to_string(),
        model: model.to_string(),
        test_type: "asr".to_string(),
        scenario: scenario.to_string(),
        iteration,
        config: BenchmarkConfig {
            input_mode: "stream".to_string(),
            output_mode: "stream".to_string(),
            format: "unknown".to_string(),
            text_length: None,
            audio_duration: None,
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
            audio_duration: None,
            bitrate: None,
        },
        accuracy: None,
        status: "error".to_string(),
        error: Some(error_msg.to_string()),
    }
}
