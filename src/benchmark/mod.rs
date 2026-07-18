//! Benchmark 性能基准测试模块（阶段一）
//!
//! 测试 TTS/ASR Provider 的 API 性能指标，包括首包延迟、总延迟、吞吐量等。
//!
//! ## 使用
//!
//! ```bash
//! cargo run --bin univoice-bench -- --help
//! cargo run --bin univoice-bench -- -p qwen -t tts -i 3
//! cargo run --bin univoice-bench -- -d (dry-run)
//! ```
#![allow(clippy::result_large_err)]

pub mod accuracy;
pub mod aggregator;
pub mod asr;
pub mod cli;
pub mod collector;
pub mod fixtures;
pub mod matrix;
pub mod provider_factory;
pub mod report;
pub mod result;
pub mod runner;
pub mod tts;
pub mod types;
