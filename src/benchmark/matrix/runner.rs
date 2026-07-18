//! TTS Matrix Runner
//!
//! 矩阵测试运行器：遍历 MatrixItem，对每项执行 TTS 合成测试。

use uuid::Uuid;

use crate::benchmark::collector::MetricsCollector;
use crate::benchmark::matrix::filter::{filter_matrix_items, generate_matrix_scenario_name};
use crate::benchmark::matrix::providers::get_tts_provider_matrix_config;
use crate::benchmark::matrix::types::{MatrixItem, MatrixRunOptions, ProviderMatrixConfig};
use crate::benchmark::provider_factory::create_tts_provider;
use crate::benchmark::types::{BenchmarkConfig, SingleTestResult};
use crate::tts::TtsRequest;

/// 运行单个 TTS Matrix 测试
#[allow(clippy::too_many_arguments)]
pub async fn run_single_matrix_test(
    config: &ProviderMatrixConfig,
    item: &MatrixItem,
    text: &str,
    iteration: u32,
    timeout_secs: u64,
) -> SingleTestResult {
    let _ = config; // config kept for future provider-level config use
    let scenario = generate_matrix_scenario_name(item);

    let tts = match create_tts_provider(
        &item.provider,
        &item.model,
        &item.voice,
        &item.format,
        Some(item.sample_rate),
    ) {
        Ok(t) => t,
        Err(e) => {
            return error_result(
                &item.provider,
                &item.model,
                &scenario,
                iteration,
                &e.to_string(),
            );
        }
    };

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

            SingleTestResult {
                id: Uuid::new_v4().to_string(),
                timestamp: chrono::Utc::now().to_rfc3339(),
                provider: item.provider.clone(),
                model: item.model.clone(),
                test_type: "tts".to_string(),
                scenario,
                iteration,
                config: BenchmarkConfig {
                    input_mode: "non-stream".to_string(),
                    output_mode: "non-stream".to_string(),
                    format: item.format.clone(),
                    text_length: Some(text.len()),
                    audio_duration: None,
                    voice: Some(item.voice.clone()),
                    sample_rate: Some(item.sample_rate),
                },
                start_time,
                throughput,
                quality,
                accuracy: None,
                status: "success".to_string(),
                error: None,
            }
        }
        Ok(Err(e)) => {
            let _start_time = collector.start_time_ms();
            error_result(
                &item.provider,
                &item.model,
                &scenario,
                iteration,
                &e.to_string(),
            )
        }
        Err(_) => {
            let _start_time = collector.start_time_ms();
            error_result(&item.provider, &item.model, &scenario, iteration, "timeout")
        }
    }
}

/// 运行单个 Provider 的矩阵场景
pub async fn run_provider_matrix_scenario(
    config: &ProviderMatrixConfig,
    text: &str,
    options: &MatrixRunOptions,
) -> Vec<SingleTestResult> {
    let items = match &options.filter {
        Some(filter) => filter_matrix_items(&config.items, filter),
        None => config.items.clone(),
    };

    let total = items.len() as u32 * options.iterations;
    let mut results = Vec::with_capacity(total as usize);
    let mut current = 0u32;

    for item in &items {
        for iter in 1..=options.iterations {
            current += 1;
            let scenario = generate_matrix_scenario_name(item);
            println!(
                "    [{}/{}] {} (iter {}/{})",
                current, total, scenario, iter, options.iterations
            );

            let result =
                run_single_matrix_test(config, item, text, iter, options.timeout_secs).await;

            let status = if result.status == "success" {
                "✓"
            } else {
                "✗"
            };
            let latency = result
                .throughput
                .chunks
                .as_ref()
                .and_then(|c| c.first())
                .map(|c| c.relative_time)
                .unwrap_or(0.0);
            println!(
                "      {} first_chunk={:.0}ms status={}",
                status, latency, result.status
            );

            results.push(result);
        }
    }

    results
}

/// 运行全量 TTS 矩阵测试
pub async fn run_matrix_scenario(
    provider_name: Option<&str>,
    text: &str,
    options: &MatrixRunOptions,
) -> Vec<SingleTestResult> {
    let configs = match provider_name {
        Some(name) => {
            vec![
                get_tts_provider_matrix_config(name)
                    .unwrap_or_else(|| panic!("Unknown matrix provider: {}", name)),
            ]
        }
        None => crate::benchmark::matrix::providers::all_tts_provider_matrix_configs(),
    };

    let mut all_results = Vec::new();
    for config in &configs {
        println!(
            "  📊 Provider: {} ({}) — {} items",
            config.display_name,
            config.provider,
            config.items.len()
        );
        let results = run_provider_matrix_scenario(config, text, options).await;
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

fn error_result(
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
        test_type: "tts".to_string(),
        scenario: scenario.to_string(),
        iteration,
        config: BenchmarkConfig {
            input_mode: "non-stream".to_string(),
            output_mode: "non-stream".to_string(),
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::benchmark::matrix::providers::qwen_provider_matrix_config;

    #[tokio::test]
    async fn test_run_single_matrix_error_unknown_provider() {
        let config = qwen_provider_matrix_config();
        let item = MatrixItem {
            provider: "unknown".into(),
            model: "test".into(),
            voice: "test".into(),
            format: "pcm".into(),
            sample_rate: 16000,
        };
        let result = run_single_matrix_test(&config, &item, "hello", 1, 10).await;
        assert_eq!(result.status, "error");
        assert!(result.error.is_some());
    }
}
