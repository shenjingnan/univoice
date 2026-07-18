//! 聚合分析
//!
//! 按 testType/provider/scenario 分组聚合测试结果，计算统计指标。

use std::collections::HashMap;

use crate::benchmark::collector::{average, percentile, std_dev};
use crate::benchmark::types::{ScenarioSummary, SingleTestResult};

/// 按 testType/provider/scenario 三字段分组聚合
pub fn aggregate_by_scenario(results: &[SingleTestResult]) -> Vec<ScenarioSummary> {
    let mut grouped: HashMap<String, Vec<&SingleTestResult>> = HashMap::new();

    for result in results {
        let key = format!(
            "{}/{}/{}",
            result.test_type, result.provider, result.scenario
        );
        grouped.entry(key).or_default().push(result);
    }

    let mut summaries: Vec<ScenarioSummary> = grouped
        .into_values()
        .map(|group| {
            let first = group[0];
            let sample_count = group.len() as u32;
            let success_count = group.iter().filter(|r| r.status == "success").count() as u32;

            // 收集首包延迟和总延迟
            let first_chunks: Vec<f64> = group
                .iter()
                .filter(|r| r.status == "success")
                .filter_map(|r| {
                    r.throughput
                        .chunks
                        .as_ref()
                        .and_then(|c| c.first())
                        .map(|c| c.relative_time)
                })
                .collect();

            let totals: Vec<f64> = group
                .iter()
                .filter(|r| r.status == "success")
                .filter_map(|r| {
                    r.throughput
                        .chunks
                        .as_ref()
                        .and_then(|c| c.last())
                        .map(|c| c.relative_time)
                })
                .collect();

            let avg_first = average(&first_chunks);
            let median_first = percentile(&first_chunks, 50.0);
            let p95_first = percentile(&first_chunks, 95.0);
            let avg_total = average(&totals);
            let median_total = percentile(&totals, 50.0);
            let p50_total = percentile(&totals, 50.0);
            let p95_total = percentile(&totals, 95.0);
            let sd_total = std_dev(&totals, avg_total);
            let min_total = totals.iter().cloned().fold(f64::MAX, f64::min);
            let max_total = totals.iter().cloned().fold(f64::MIN, f64::max);

            // TTS 特有指标
            let avg_per_char = first
                .config
                .text_length
                .filter(|_| !totals.is_empty())
                .map(|len| avg_total / len as f64);

            let throughput = first
                .config
                .text_length
                .filter(|_| !totals.is_empty())
                .filter(|_| avg_total > 0.0)
                .map(|len| len as f64 / (avg_total / 1000.0));

            // ASR 特有指标（从 accuracy 字段计算）
            let avg_accuracy = first.accuracy.as_ref().and_then(|acc| {
                let expected = acc.expected_text.as_ref()?;
                let actual = acc.actual_text.as_ref()?;
                Some(crate::benchmark::accuracy::calculate_accuracy(
                    expected, actual,
                ))
            });

            let avg_cer = first.accuracy.as_ref().and_then(|acc| {
                let expected = acc.expected_text.as_ref()?;
                let actual = acc.actual_text.as_ref()?;
                Some(crate::benchmark::accuracy::calculate_cer(expected, actual))
            });

            // RTF: 总延迟(ms) / (音频时长(秒) * 1000)
            let avg_rtf = first
                .config
                .audio_duration
                .filter(|_| !totals.is_empty())
                .map(|dur| avg_total / (dur * 1000.0));

            ScenarioSummary {
                provider: first.provider.clone(),
                scenario: first.scenario.clone(),
                test_type: first.test_type.clone(),
                sample_count,
                success_count,
                success_rate: if sample_count > 0 {
                    success_count as f64 / sample_count as f64
                } else {
                    0.0
                },
                avg_first_chunk_latency: avg_first,
                median_first_chunk_latency: median_first,
                p95_first_chunk_latency: p95_first,
                avg_total_latency: avg_total,
                median_total_latency: median_total,
                p50_total_latency: p50_total,
                p95_total_latency: p95_total,
                std_dev_total_latency: sd_total,
                min_total_latency: if min_total == f64::MAX {
                    0.0
                } else {
                    min_total
                },
                max_total_latency: if max_total == f64::MIN {
                    0.0
                } else {
                    max_total
                },
                avg_per_char_latency: avg_per_char,
                throughput,
                avg_accuracy,
                avg_cer,
                avg_rtf,
            }
        })
        .collect();

    summaries.sort_by(|a, b| {
        a.provider
            .cmp(&b.provider)
            .then(a.scenario.cmp(&b.scenario))
    });
    summaries
}

/// 计算矩阵覆盖率
pub fn calculate_matrix_coverage(
    summaries: &[ScenarioSummary],
    expected_scenarios: &[String],
) -> MatrixCoverage {
    let tested: std::collections::HashSet<String> = summaries
        .iter()
        .map(|s| format!("{}/{}", s.provider, s.scenario))
        .collect();

    let tested_count = tested.len() as u32;
    let total_count = expected_scenarios.len() as u32;
    let pending_count = total_count.saturating_sub(tested_count);

    MatrixCoverage {
        total_scenarios: total_count,
        tested_scenarios: tested_count,
        pending_scenarios: pending_count,
        coverage_rate: if total_count > 0 {
            tested_count as f64 / total_count as f64
        } else {
            0.0
        },
    }
}

/// 矩阵覆盖率
#[derive(Debug, Clone)]
pub struct MatrixCoverage {
    pub total_scenarios: u32,
    pub tested_scenarios: u32,
    pub pending_scenarios: u32,
    pub coverage_rate: f64,
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::benchmark::types::*;
    use uuid::Uuid;

    fn make_result(
        provider: &str,
        scenario: &str,
        test_type: &str,
        status: &str,
        latency: f64,
    ) -> SingleTestResult {
        SingleTestResult {
            id: Uuid::new_v4().to_string(),
            timestamp: "2026-01-01T00:00:00Z".to_string(),
            provider: provider.to_string(),
            model: "test".to_string(),
            test_type: test_type.to_string(),
            scenario: scenario.to_string(),
            iteration: 1,
            config: BenchmarkConfig {
                input_mode: "non-stream".to_string(),
                output_mode: "non-stream".to_string(),
                format: "mp3".to_string(),
                text_length: Some(100),
                audio_duration: Some(2.0),
                voice: Some("test".to_string()),
                sample_rate: Some(16000),
            },
            start_time: 0.0,
            throughput: ThroughputMetrics {
                data_rate: 100.0,
                chunk_count: 1,
                avg_chunk_size: 100.0,
                chunks: Some(vec![ChunkDetail {
                    timestamp: latency,
                    relative_time: latency,
                    size: 100,
                }]),
            },
            quality: QualityMetrics {
                data_size: 100,
                text_length: Some(100),
                audio_duration: Some(2.0),
                bitrate: None,
            },
            accuracy: None,
            status: status.to_string(),
            error: None,
        }
    }

    #[test]
    fn test_aggregate_empty() {
        let results: Vec<SingleTestResult> = vec![];
        let summaries = aggregate_by_scenario(&results);
        assert!(summaries.is_empty());
    }

    #[test]
    fn test_aggregate_single() {
        let results = vec![make_result("qwen", "synthesize", "tts", "success", 200.0)];
        let summaries = aggregate_by_scenario(&results);
        assert_eq!(summaries.len(), 1);
        assert_eq!(summaries[0].provider, "qwen");
        assert_eq!(summaries[0].sample_count, 1);
        assert_eq!(summaries[0].success_count, 1);
    }

    #[test]
    fn test_aggregate_multiple() {
        let results = vec![
            make_result("qwen", "synthesize", "tts", "success", 100.0),
            make_result("qwen", "synthesize", "tts", "success", 200.0),
            make_result("qwen", "synthesize", "tts", "success", 300.0),
        ];
        let summaries = aggregate_by_scenario(&results);
        assert_eq!(summaries.len(), 1);
        assert!((summaries[0].avg_total_latency - 200.0).abs() < 1.0);
    }

    #[test]
    fn test_aggregate_with_failure() {
        let results = vec![
            make_result("qwen", "synthesize", "tts", "success", 100.0),
            make_result("qwen", "synthesize", "tts", "error", 0.0),
        ];
        let summaries = aggregate_by_scenario(&results);
        assert_eq!(summaries.len(), 1);
        assert_eq!(summaries[0].success_count, 1);
        assert_eq!(summaries[0].sample_count, 2);
    }
}
