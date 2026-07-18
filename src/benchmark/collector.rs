//! 指标收集器
//!
//! 使用 `tokio::time::Instant` 进行纳秒级精度计时。
//! 记录每个数据块的到达时间和大小，用于计算首包延迟、吞吐量等指标。

use std::time::SystemTime;

use tokio::time::Instant;

use crate::benchmark::types::{ChunkDetail, QualityMetrics, ThroughputMetrics};

// ============================== Timer ==============================

/// 高精度计时器
#[derive(Debug, Default)]
pub struct Timer {
    /// 开始时间（单调时钟，用于计算相对时间）
    start_instant: Option<Instant>,
    /// 首块到达时间
    first_chunk_instant: Option<Instant>,
    /// 结束时间
    end_instant: Option<Instant>,
}

impl Timer {
    pub fn new() -> Self {
        Self::default()
    }

    /// 开始计时
    pub fn start(&mut self) {
        self.start_instant = Some(Instant::now());
        self.first_chunk_instant = None;
        self.end_instant = None;
    }

    /// 记录首块到达（仅首次调用生效）
    pub fn record_first_chunk(&mut self) {
        if self.first_chunk_instant.is_none() {
            self.first_chunk_instant = Some(Instant::now());
        }
    }

    /// 停止计时
    pub fn stop(&mut self) {
        self.end_instant = Some(Instant::now());
    }

    /// 获取首包延迟（毫秒）
    pub fn first_chunk_latency_ms(&self) -> Option<f64> {
        let start = self.start_instant?;
        let first = self.first_chunk_instant?;
        Some(first.duration_since(start).as_secs_f64() * 1000.0)
    }

    /// 获取总延迟（毫秒）
    pub fn total_latency_ms(&self) -> Option<f64> {
        let start = self.start_instant?;
        let end = self.end_instant?;
        Some(end.duration_since(start).as_secs_f64() * 1000.0)
    }

    /// 获取从开始到现在的相对时间（毫秒）
    pub fn relative_time_ms(&self) -> Option<f64> {
        let start = self.start_instant?;
        Some(Instant::now().duration_since(start).as_secs_f64() * 1000.0)
    }
}

// ============================== MetricsCollector ==============================

/// 指标收集器
///
/// 管理计时器和数据块记录，最终生成指标报告。
#[derive(Debug)]
pub struct MetricsCollector {
    /// 计时器
    timer: Timer,
    /// 开始时的墙钟时间（用于生成绝对时间戳）
    start_wall: Option<SystemTime>,
    /// 数据块详情列表
    chunks: Vec<ChunkDetail>,
    /// 总数据大小（bytes）
    total_size: usize,
    /// 文本长度
    text_length: Option<usize>,
}

impl MetricsCollector {
    pub fn new() -> Self {
        Self {
            timer: Timer::new(),
            start_wall: None,
            chunks: Vec::new(),
            total_size: 0,
            text_length: None,
        }
    }

    /// 设置文本长度（用于 perChar 延迟计算）
    pub fn set_text_length(&mut self, len: usize) {
        self.text_length = Some(len);
    }

    /// 开始收集
    pub fn start(&mut self) {
        self.timer.start();
        self.start_wall = Some(SystemTime::now());
        self.chunks.clear();
        self.total_size = 0;
    }

    /// 记录一个数据块
    pub fn add_chunk(&mut self, data: &[u8]) {
        self.timer.record_first_chunk();

        let relative_time = self.timer.relative_time_ms().unwrap_or(0.0);

        let _timestamp = self
            .start_wall
            .map(|sw| {
                sw.elapsed()
                    .map(|d| d.as_secs_f64() * 1000.0)
                    .unwrap_or(relative_time)
            })
            .unwrap_or(relative_time);

        // 计算绝对时间戳（毫秒）
        let absolute_ts = self
            .start_wall
            .and_then(|sw| sw.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|d| d.as_secs_f64() * 1000.0 + relative_time)
            .unwrap_or(0.0);

        self.chunks.push(ChunkDetail {
            timestamp: absolute_ts,
            relative_time,
            size: data.len(),
        });
        self.total_size += data.len();
    }

    /// 停止收集
    pub fn stop(&mut self) {
        self.timer.stop();
    }

    /// 计算吞吐量指标
    pub fn throughput_metrics(&self) -> ThroughputMetrics {
        let total_ms = self.timer.total_latency_ms().unwrap_or(1.0);
        let chunk_count = self.chunks.len() as u32;

        ThroughputMetrics {
            data_rate: if total_ms > 0.0 {
                self.total_size as f64 / total_ms
            } else {
                0.0
            },
            chunk_count,
            avg_chunk_size: if chunk_count > 0 {
                self.total_size as f64 / chunk_count as f64
            } else {
                0.0
            },
            chunks: Some(self.chunks.clone()),
        }
    }

    /// 计算质量指标
    pub fn quality_metrics(&self, data_size: usize, format: &str) -> QualityMetrics {
        let audio_duration = crate::benchmark::types::estimate_audio_duration(data_size, format);
        let bitrate = if audio_duration > 0.0 {
            Some((data_size as f64 * 8.0) / (audio_duration * 1000.0))
        } else {
            None
        };

        QualityMetrics {
            data_size,
            text_length: self.text_length,
            audio_duration: Some(audio_duration),
            bitrate,
        }
    }

    /// 获取开始时间的墙钟时间戳（ms since epoch）
    pub fn start_time_ms(&self) -> f64 {
        self.start_wall
            .and_then(|sw| sw.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|d| d.as_secs_f64() * 1000.0)
            .unwrap_or(0.0)
    }

    /// 获取首包延迟
    pub fn first_chunk_latency_ms(&self) -> Option<f64> {
        self.timer.first_chunk_latency_ms()
    }

    /// 获取总延迟
    pub fn total_latency_ms(&self) -> Option<f64> {
        self.timer.total_latency_ms()
    }
}

impl Default for MetricsCollector {
    fn default() -> Self {
        Self::new()
    }
}

// ============================== 统计工具函数 ==============================

/// 计算百分位数
pub fn percentile(values: &[f64], p: f64) -> f64 {
    if values.is_empty() {
        return 0.0;
    }
    let mut sorted = values.to_vec();
    sorted.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
    let index = ((sorted.len() - 1) as f64 * p / 100.0).round() as usize;
    sorted[index.min(sorted.len() - 1)]
}

/// 计算平均值
pub fn average(values: &[f64]) -> f64 {
    if values.is_empty() {
        return 0.0;
    }
    values.iter().sum::<f64>() / values.len() as f64
}

/// 计算标准差
pub fn std_dev(values: &[f64], mean: f64) -> f64 {
    if values.len() < 2 {
        return 0.0;
    }
    let variance = values
        .iter()
        .map(|v| {
            let diff = v - mean;
            diff * diff
        })
        .sum::<f64>()
        / (values.len() - 1) as f64;
    variance.sqrt()
}
