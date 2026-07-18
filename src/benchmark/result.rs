//! 结果保存
//!
//! 将测试结果保存为 JSON 文件，目录结构与 TypeScript 版兼容。

use std::path::{Path, PathBuf};

use crate::benchmark::types::SingleTestResult;

/// 保存单个测试结果到 JSON 文件
///
/// 目录结构: `{output_dir}/runs/{test_type}/{provider}/{scenario}/{filename}.json`
/// 文件名格式: `{provider}-{test_type}-{scenario}-{YYYYMMDD}-{HHmmss}-{iteration}.json`
pub async fn save_result(
    result: &SingleTestResult,
    output_dir: &Path,
) -> Result<PathBuf, Box<dyn std::error::Error>> {
    let dir = output_dir
        .join("runs")
        .join(&result.test_type)
        .join(&result.provider)
        .join(&result.scenario);

    tokio::fs::create_dir_all(&dir).await?;

    let now = chrono::Local::now();
    let filename = format!(
        "{}-{}-{}-{}-{}-{}.json",
        result.provider,
        result.test_type,
        result.scenario,
        now.format("%Y%m%d"),
        now.format("%H%M%S"),
        result.iteration,
    );

    let path = dir.join(&filename);
    let json = serde_json::to_string_pretty(result)?;
    tokio::fs::write(&path, json).await?;

    Ok(path)
}

/// 生成模拟测试结果（dry-run 使用）
pub fn generate_mock_result(provider: &str, test_type: &str, iteration: u32) -> SingleTestResult {
    use uuid::Uuid;

    let start_time = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs_f64()
        * 1000.0;

    let _mock_latency = 500.0 + (iteration as f64 * 50.0); // 模拟首包延迟递增
    let mock_total = 2000.0 + (iteration as f64 * 100.0);
    let mock_size = 25000;

    SingleTestResult {
        id: Uuid::new_v4().to_string(),
        timestamp: chrono::Utc::now().to_rfc3339(),
        provider: provider.to_string(),
        model: format!("mock-{}-model", provider),
        test_type: test_type.to_string(),
        scenario: "mock-scenario".to_string(),
        iteration,
        config: crate::benchmark::types::BenchmarkConfig {
            input_mode: "non-stream".to_string(),
            output_mode: "non-stream".to_string(),
            format: "mp3".to_string(),
            text_length: Some(100),
            audio_duration: Some(2.0),
            voice: Some("mock-voice".to_string()),
            sample_rate: None,
        },
        start_time,
        throughput: crate::benchmark::types::ThroughputMetrics {
            data_rate: mock_size as f64 / mock_total,
            chunk_count: 1,
            avg_chunk_size: mock_size as f64,
            chunks: Some(vec![crate::benchmark::types::ChunkDetail {
                timestamp: start_time + mock_total,
                relative_time: mock_total,
                size: mock_size,
            }]),
        },
        quality: crate::benchmark::types::QualityMetrics {
            data_size: mock_size,
            text_length: Some(100),
            audio_duration: Some(mock_size as f64 / 16000.0),
            bitrate: Some(128.0),
        },
        accuracy: None,
        status: "success".to_string(),
        error: None,
    }
}
