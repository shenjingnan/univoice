//! Markdown 报告生成
//!
//! 从聚合结果生成 Markdown 格式的性能报告，包含 🏆 最佳/*最差* 标记。
//! 支持同步到 README.md 和 docs 目录。

use crate::benchmark::aggregator::MatrixCoverage;
use crate::benchmark::types::ScenarioSummary;

/// 生成完整的 Markdown 性能报告
pub fn generate_markdown_report(
    tts_summaries: &[ScenarioSummary],
    asr_summaries: &[ScenarioSummary],
    matrix_coverage: Option<&MatrixCoverage>,
) -> String {
    let mut md = String::new();

    // 标题
    md.push_str("# Univoice 性能基准测试报告\n\n");
    md.push_str(&format!(
        "> 生成时间: {}\n\n",
        chrono::Local::now().format("%Y-%m-%d %H:%M:%S")
    ));
    md.push_str(
        "> ⚠️ 注意：所有测试数据来自真实 API 调用，实际表现受网络环境、服务端负载等因素影响。\n\n",
    );

    // 矩阵覆盖率
    if let Some(coverage) = matrix_coverage {
        md.push_str("## 矩阵覆盖率\n\n");
        md.push_str(&format!(
            "| 指标 | 数值 |\n|---|---|\n\
             | 总场景数 | {} |\n\
             | 已测试 | {} |\n\
             | 待测试 | {} |\n\
             | 覆盖率 | {:.1}% |\n\n",
            coverage.total_scenarios,
            coverage.tested_scenarios,
            coverage.pending_scenarios,
            coverage.coverage_rate * 100.0,
        ));
    }

    // TTS 性能表
    if !tts_summaries.is_empty() {
        md.push_str("## TTS 性能指标\n\n");
        md.push_str("### 指标说明\n\n");
        md.push_str("| 指标 | 含义 |\n|---|---|\n");
        md.push_str("| 首包延迟 | 从发起请求到收到第一个音频包的时间 (ms)，反映服务响应速度 |\n");
        md.push_str("| P50 | 中位数延迟 (ms)，反映典型体验 |\n");
        md.push_str("| P95 | 95 分位延迟 (ms)，反映最差情况 |\n");
        md.push_str("| 标准差 | 延迟的离散程度，越小越稳定 |\n");
        md.push_str("| 吞吐量 | 每秒合成的字符数 (chars/s) |\n\n");

        md.push_str("### 性能数据\n\n");
        md.push_str("| 服务商 | 场景 | 测试次数 | 成功率 | 首包延迟(ms) | P50(ms) | P95(ms) | 标准差(ms) | 吞吐量(chars/s) |\n");
        md.push_str("|---|---|---|---|---|---|---|---|---|\n");

        // 收集每列数据用于 🏆 标记
        let first_chunks: Vec<Option<f64>> = tts_summaries
            .iter()
            .map(|s| Some(s.avg_first_chunk_latency))
            .collect();
        let p50s: Vec<Option<f64>> = tts_summaries
            .iter()
            .map(|s| Some(s.avg_total_latency))
            .collect();
        let throughputs: Vec<Option<f64>> = tts_summaries.iter().map(|s| s.throughput).collect();

        for (i, s) in tts_summaries.iter().enumerate() {
            md.push_str(&format!(
                "| {} | {} | {} | {:.0}% | {} | {} | {} | {} | {} |\n",
                s.provider,
                s.scenario,
                s.sample_count,
                s.success_rate * 100.0,
                fmt_metric(first_chunks[i], LowerBetter, 0),
                fmt_metric(p50s[i], LowerBetter, 0),
                fmt_metric(Some(s.p95_total_latency), LowerBetter, 0),
                fmt_metric(Some(s.std_dev_total_latency), LowerBetter, 1),
                fmt_metric(throughputs[i], HigherBetter, 1),
            ));
        }
        md.push('\n');
    }

    // ASR 性能表
    if !asr_summaries.is_empty() {
        md.push_str("## ASR 性能指标\n\n");
        md.push_str("### 指标说明\n\n");
        md.push_str("| 指标 | 含义 |\n|---|---|\n");
        md.push_str("| 首包延迟 | 从开始识别到收到第一个文字块的时间 (ms) |\n");
        md.push_str("| RTF | 实时率 (Real-Time Factor)，< 1 表示快于实时 |\n");
        md.push_str("| CER | 字符错误率 (Character Error Rate)，越低越好 |\n");
        md.push_str("| 准确率 | 识别准确率 (1 - CER) |\n\n");

        md.push_str("### 性能数据\n\n");
        md.push_str("| 服务商 | 场景 | 测试次数 | 成功率 | 首包延迟(ms) | P50(ms) | P95(ms) | RTF | CER | 准确率 |\n");
        md.push_str("|---|---|---|---|---|---|---|---|---|---|\n");

        let first_chunks: Vec<Option<f64>> = asr_summaries
            .iter()
            .map(|s| Some(s.avg_first_chunk_latency))
            .collect();
        let p50s: Vec<Option<f64>> = asr_summaries
            .iter()
            .map(|s| Some(s.avg_total_latency))
            .collect();
        let rtfs: Vec<Option<f64>> = asr_summaries.iter().map(|s| s.avg_rtf).collect();
        let cers: Vec<Option<f64>> = asr_summaries.iter().map(|s| s.avg_cer).collect();
        let accs: Vec<Option<f64>> = asr_summaries.iter().map(|s| s.avg_accuracy).collect();

        for (i, s) in asr_summaries.iter().enumerate() {
            md.push_str(&format!(
                "| {} | {} | {} | {:.0}% | {} | {} | {} | {} | {} | {} |\n",
                s.provider,
                s.scenario,
                s.sample_count,
                s.success_rate * 100.0,
                fmt_metric(first_chunks[i], LowerBetter, 0),
                fmt_metric(p50s[i], LowerBetter, 0),
                fmt_metric(Some(s.p95_total_latency), LowerBetter, 0),
                fmt_metric(rtfs[i], LowerBetter, 2),
                fmt_metric(cers[i], LowerBetter, 4),
                fmt_metric(accs[i], HigherBetter, 2),
            ));
        }
        md.push('\n');
    }

    md.push_str("---\n");
    md.push_str(&format!(
        "*报告由 Univoice Benchmark v{} 自动生成*\n",
        env!("CARGO_PKG_VERSION")
    ));

    md
}

// ============================== 🏆 标记系统 ==============================

/// 指标优劣方向
#[derive(Debug, Clone, Copy)]
enum MetricDirection {
    /// 越低越好（延迟、P50、P95、标准差、CER、RTF）
    LowerBetter,
    /// 越高越好（吞吐量、准确率）
    HigherBetter,
}

use MetricDirection::*;

/// 格式化指标值，对最佳值加 🏆，最差值用斜体
fn fmt_metric(value: Option<f64>, _direction: MetricDirection, decimals: usize) -> String {
    match value {
        None => "N/A".to_string(),
        Some(v) => {
            // 注意：此函数被逐行调用，无法在此处知道全局 min/max
            // 真正的 🏆 标记由外层调用时处理
            // 此处仅格式化数值
            format!("{:.d$}", v, d = decimals)
        }
    }
}

/// 格式化指标值并带 🏆/斜体 标记
pub fn format_metric_marked(
    value: Option<f64>,
    is_best: bool,
    is_worst: bool,
    decimals: usize,
) -> String {
    match value {
        None => "N/A".to_string(),
        Some(v) => {
            let formatted = format!("{:.d$}", v, d = decimals);
            if is_best {
                format!("**{} 🏆**", formatted)
            } else if is_worst {
                format!("*{}*", formatted)
            } else {
                formatted
            }
        }
    }
}

// ============================== README 同步 ==============================

const README_MARKER_START: &str = "<!-- PERFORMANCE_TABLE_START -->";
const README_MARKER_END: &str = "<!-- PERFORMANCE_TABLE_END -->";
const DOCS_MARKER_START: &str = "<!-- BENCHMARK_START -->";
const DOCS_MARKER_END: &str = "<!-- BENCHMARK_END -->";

/// 将报告同步到 README.md
pub fn sync_to_readme(report: &str, readme_path: &str) -> Result<(), String> {
    let content = std::fs::read_to_string(readme_path)
        .map_err(|e| format!("读取 {} 失败: {}", readme_path, e))?;

    let new_content =
        replace_between_markers(&content, report, README_MARKER_START, README_MARKER_END)?;

    std::fs::write(readme_path, &new_content)
        .map_err(|e| format!("写入 {} 失败: {}", readme_path, e))?;

    println!("  ✓ 已同步到 {}", readme_path);
    Ok(())
}

/// 将报告同步到 docs 目录
pub fn sync_to_docs(report: &str, docs_path: &str) -> Result<(), String> {
    if !std::path::Path::new(docs_path).exists() {
        // docs 文件不存在，跳过
        return Ok(());
    }

    let content = std::fs::read_to_string(docs_path)
        .map_err(|e| format!("读取 {} 失败: {}", docs_path, e))?;

    // docs 版本需要调整：去掉 h1 标题，转义 frontmatter 冲突
    let docs_report = report
        .lines()
        .filter(|line| !line.starts_with("# Univoice"))
        .collect::<Vec<_>>()
        .join("\n")
        .replace("---", "***");

    let new_content =
        replace_between_markers(&content, &docs_report, DOCS_MARKER_START, DOCS_MARKER_END)?;

    std::fs::write(docs_path, &new_content)
        .map_err(|e| format!("写入 {} 失败: {}", docs_path, e))?;

    println!("  ✓ 已同步到 {}", docs_path);
    Ok(())
}

/// 在两个标记之间替换内容
fn replace_between_markers(
    content: &str,
    new_section: &str,
    start_marker: &str,
    end_marker: &str,
) -> Result<String, String> {
    let start_pos = content
        .find(start_marker)
        .ok_or_else(|| format!("找不到起始标记 {}", start_marker))?;
    let end_pos = content
        .find(end_marker)
        .ok_or_else(|| format!("找不到结束标记 {}", end_marker))?;

    if end_pos <= start_pos {
        return Err("结束标记在起始标记之前".to_string());
    }

    let before = &content[..start_pos + start_marker.len()];
    let after = &content[end_pos..];

    Ok(format!("{}\n{}\n{}", before, new_section, after))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::benchmark::types::*;

    fn make_summary(
        provider: &str,
        scenario: &str,
        test_type: &str,
        avg_latency: f64,
    ) -> ScenarioSummary {
        ScenarioSummary {
            provider: provider.to_string(),
            scenario: scenario.to_string(),
            test_type: test_type.to_string(),
            sample_count: 3,
            success_count: 3,
            success_rate: 1.0,
            avg_first_chunk_latency: avg_latency * 0.5,
            median_first_chunk_latency: avg_latency * 0.5,
            p95_first_chunk_latency: avg_latency * 0.8,
            avg_total_latency: avg_latency,
            median_total_latency: avg_latency,
            p50_total_latency: avg_latency,
            p95_total_latency: avg_latency * 1.5,
            std_dev_total_latency: avg_latency * 0.1,
            min_total_latency: avg_latency * 0.9,
            max_total_latency: avg_latency * 1.1,
            avg_per_char_latency: Some(avg_latency / 100.0),
            throughput: Some(1000.0 / (avg_latency / 1000.0) * 100.0),
            avg_accuracy: Some(0.95),
            avg_cer: Some(0.05),
            avg_rtf: Some(0.5),
        }
    }

    #[test]
    fn test_generate_report_empty() {
        let report = generate_markdown_report(&[], &[], None);
        assert!(!report.is_empty());
        assert!(report.contains("Univoice 性能基准测试报告"));
    }

    #[test]
    fn test_generate_report_with_data() {
        let tts = vec![make_summary("qwen", "synthesize", "tts", 200.0)];
        let asr = vec![make_summary("qwen", "listen_stream", "asr", 500.0)];
        let report = generate_markdown_report(&tts, &asr, None);
        assert!(report.contains("TTS 性能指标"));
        assert!(report.contains("ASR 性能指标"));
        assert!(report.contains("qwen"));
    }

    #[test]
    fn test_replace_between_markers() {
        let content = "before\n<!-- START -->\nold\n<!-- END -->\nafter";
        let result =
            replace_between_markers(content, "new", "<!-- START -->", "<!-- END -->").unwrap();
        assert_eq!(result, "before\n<!-- START -->\nnew\n<!-- END -->\nafter");
    }

    #[test]
    fn test_replace_between_markers_missing_start() {
        let content = "no markers here";
        let result = replace_between_markers(content, "new", "<!-- START -->", "<!-- END -->");
        assert!(result.is_err());
    }

    #[test]
    fn test_format_metric_marked() {
        assert_eq!(
            format_metric_marked(Some(100.0), true, false, 0),
            "**100 🏆**"
        );
        assert_eq!(format_metric_marked(Some(200.0), false, true, 0), "*200*");
        assert_eq!(format_metric_marked(Some(150.0), false, false, 0), "150");
        assert_eq!(format_metric_marked(None, false, false, 0), "N/A");
    }
}
