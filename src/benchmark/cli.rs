//! CLI 命令行参数解析
//!
//! 使用 clap 的 derive 宏定义命令行接口。

use clap::Parser;

use crate::benchmark::matrix::types::{ASRMatrixFilter, MatrixFilter};

/// Univoice 性能基准测试工具
///
/// 测试 TTS 和 ASR 提供商 API 的性能指标（首包延迟、总延迟、吞吐量等）。
#[derive(Debug, Parser)]
#[command(
    name = "univoice-bench",
    about = "Univoice Benchmark Tool",
    version,
    arg_required_else_help = true
)]
pub struct CliArgs {
    /// Provider 过滤（可重复，如 -p qwen -p doubao）
    #[arg(short, long, help = "Provider(s) to test (e.g. qwen, doubao, openai)")]
    pub provider: Vec<String>,

    /// 测试类型
    #[arg(
        short = 't',
        long = "type",
        default_value = "all",
        value_parser = ["tts", "asr", "all"],
        help = "Test type: tts, asr, or all"
    )]
    pub test_type: String,

    /// 迭代次数
    #[arg(short, long, default_value_t = 3, help = "Iterations per test")]
    pub iterations: u32,

    /// 模拟运行模式（不调用真实 API）
    #[arg(short = 'd', long, help = "Dry run with mock data (no API calls)")]
    pub dry_run: bool,

    /// 输出目录
    #[arg(
        short,
        long,
        default_value = "benchmark/results",
        help = "Output directory for results"
    )]
    pub output: String,

    /// 超时时间（秒）
    #[arg(long, default_value_t = 30, help = "Timeout in seconds per test")]
    pub timeout: u64,

    /// 矩阵场景名称（如 qwen-matrix, doubao-matrix, all-matrix）
    #[arg(
        short = 's',
        long,
        help = "Matrix scenario name (e.g. qwen-matrix, all-matrix)"
    )]
    pub scenario: Option<String>,

    /// 矩阵过滤：模型名（逗号分隔）
    #[arg(long, help = "Filter matrix by model (comma-separated)")]
    pub model: Option<String>,

    /// 矩阵过滤：音色名（逗号分隔）
    #[arg(long, help = "Filter matrix by voice (comma-separated)")]
    pub voice: Option<String>,

    /// 矩阵过滤：编码格式（逗号分隔）
    #[arg(long, help = "Filter matrix by format (comma-separated)")]
    pub format: Option<String>,

    /// 矩阵过滤：采样率（逗号分隔）
    #[arg(
        long = "sample-rate",
        help = "Filter matrix by sample rate (comma-separated)"
    )]
    pub sample_rate: Option<String>,
}

impl CliArgs {
    /// 解析矩阵过滤条件为 MatrixFilter
    pub fn parse_matrix_filter(&self) -> Option<MatrixFilter> {
        if self.model.is_none()
            && self.voice.is_none()
            && self.format.is_none()
            && self.sample_rate.is_none()
        {
            return None;
        }
        Some(MatrixFilter {
            model: self.model.as_ref().map(|s| {
                s.split(',')
                    .map(|s| s.trim().to_string())
                    .filter(|s| !s.is_empty())
                    .collect()
            }),
            voice: self.voice.as_ref().map(|s| {
                s.split(',')
                    .map(|s| s.trim().to_string())
                    .filter(|s| !s.is_empty())
                    .collect()
            }),
            format: self.format.as_ref().map(|s| {
                s.split(',')
                    .map(|s| s.trim().to_string())
                    .filter(|s| !s.is_empty())
                    .collect()
            }),
            sample_rate: self
                .sample_rate
                .as_ref()
                .map(|s| s.split(',').filter_map(|s| s.trim().parse().ok()).collect()),
        })
    }

    /// 解析矩阵过滤条件为 ASRMatrixFilter
    pub fn parse_asr_matrix_filter(&self) -> Option<ASRMatrixFilter> {
        if self.model.is_none() && self.format.is_none() && self.sample_rate.is_none() {
            return None;
        }
        Some(ASRMatrixFilter {
            model: self.model.as_ref().map(|s| {
                s.split(',')
                    .map(|s| s.trim().to_string())
                    .filter(|s| !s.is_empty())
                    .collect()
            }),
            language: None, // ASR language filter not exposed via CLI for now
            format: self.format.as_ref().map(|s| {
                s.split(',')
                    .map(|s| s.trim().to_string())
                    .filter(|s| !s.is_empty())
                    .collect()
            }),
            sample_rate: self
                .sample_rate
                .as_ref()
                .map(|s| s.split(',').filter_map(|s| s.trim().parse().ok()).collect()),
        })
    }

    /// 是否为矩阵场景
    pub fn is_matrix_scenario(&self) -> bool {
        self.scenario.is_some()
    }
}
