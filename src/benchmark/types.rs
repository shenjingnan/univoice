//! Benchmark 类型定义
//!
//! 定义测试结果的结构体，使用 serde 序列化为 JSON。
//! 字段命名采用 camelCase 以兼容现有的 TypeScript 分析工具。

use serde::{Deserialize, Serialize};

// ============================== 核心结果类型 ==============================

/// 单次测试结果（兼容 TypeScript SingleTestResult）
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SingleTestResult {
    /// 唯一标识符 (UUID v4)
    pub id: String,
    /// ISO 8601 时间戳
    pub timestamp: String,
    /// 提供商标识
    pub provider: String,
    /// 模型名称
    pub model: String,
    /// 测试类型: "tts" | "asr"
    pub test_type: String,
    /// 测试场景
    pub scenario: String,
    /// 迭代序号
    pub iteration: u32,
    /// 测试配置
    pub config: BenchmarkConfig,
    /// 测试开始时间戳（毫秒，UNIX 时间戳）
    pub start_time: f64,
    /// 吞吐量指标
    pub throughput: ThroughputMetrics,
    /// 质量指标
    pub quality: QualityMetrics,
    /// ASR 准确率数据（可选）
    pub accuracy: Option<RawAccuracyData>,
    /// 测试状态: "success" | "error" | "timeout"
    pub status: String,
    /// 错误信息
    pub error: Option<String>,
}

// ============================== 配置类型 ==============================

/// 测试配置
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BenchmarkConfig {
    /// 输入模式: "stream" | "non-stream"
    pub input_mode: String,
    /// 输出模式: "stream" | "non-stream"
    pub output_mode: String,
    /// 音频格式: "mp3" | "pcm" | "wav" | "ogg"
    pub format: String,
    /// 文本长度（TTS 专用）
    pub text_length: Option<usize>,
    /// 音频时长（ASR 专用，秒）
    pub audio_duration: Option<f64>,
    /// 音色
    pub voice: Option<String>,
    /// 采样率
    pub sample_rate: Option<u32>,
}

// ============================== 指标类型 ==============================

/// 吞吐量指标
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ThroughputMetrics {
    /// 数据速率（bytes/ms）
    pub data_rate: f64,
    /// 数据块数量
    pub chunk_count: u32,
    /// 平均数据块大小（bytes）
    pub avg_chunk_size: f64,
    /// 每个数据块的详细信息
    pub chunks: Option<Vec<ChunkDetail>>,
}

/// 单个数据块详情
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChunkDetail {
    /// 绝对时间戳（毫秒）
    pub timestamp: f64,
    /// 相对于测试开始时间（毫秒）
    pub relative_time: f64,
    /// 块大小（bytes）
    pub size: usize,
}

/// 质量指标
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QualityMetrics {
    /// 数据总大小（bytes）
    pub data_size: usize,
    /// 文本长度（ASR 专用）
    pub text_length: Option<usize>,
    /// 音频时长（TTS 专用，秒，估算值）
    pub audio_duration: Option<f64>,
    /// 音频码率（TTS 专用，kbps）
    pub bitrate: Option<f64>,
}

/// 原始准确率数据（ASR 专用，分析阶段计算 CER）
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RawAccuracyData {
    /// 预期文本
    pub expected_text: Option<String>,
    /// 实际识别结果
    pub actual_text: Option<String>,
}

// ============================== 夹具类型 ==============================

/// 文本测试数据
#[derive(Debug, Clone)]
pub struct TextFixture {
    pub name: &'static str,
    pub text: &'static str,
    pub category: &'static str,
}

// ============================== 场景统计汇总 ==============================

/// 场景统计汇总
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScenarioSummary {
    pub provider: String,
    pub scenario: String,
    pub test_type: String,
    pub sample_count: u32,
    pub success_count: u32,
    pub success_rate: f64,
    pub avg_first_chunk_latency: f64,
    pub median_first_chunk_latency: f64,
    pub p95_first_chunk_latency: f64,
    pub avg_total_latency: f64,
    pub median_total_latency: f64,
    pub p50_total_latency: f64,
    pub p95_total_latency: f64,
    pub std_dev_total_latency: f64,
    pub min_total_latency: f64,
    pub max_total_latency: f64,
    pub avg_per_char_latency: Option<f64>,
    pub throughput: Option<f64>,
    pub avg_accuracy: Option<f64>,
    pub avg_cer: Option<f64>,
    pub avg_rtf: Option<f64>,
}

// ============================== 帮助函数 ==============================

/// 根据音频大小和格式估算音频时长（秒）
pub fn estimate_audio_duration(size: usize, format: &str) -> f64 {
    // 基于平均比特率估算（kbps）
    let bitrate_kbps = match format {
        "mp3" => 128.0,
        "wav" => 256.0,
        "pcm" => 256.0,
        "ogg" | "ogg_opus" => 64.0,
        "opus" => 64.0,
        _ => 128.0,
    };

    // duration = (size_in_bytes * 8) / (bitrate_kbps * 1000)
    let size_kb = size as f64 / 1024.0;
    (size_kb * 8.0) / bitrate_kbps
}
