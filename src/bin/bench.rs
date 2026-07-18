//! Univoice Benchmark CLI 入口
//!
//! 性能测试工具，用于测试 TTS/ASR Provider 的 API 性能。
//!
//! # 使用
//!
//! ```bash
//! # 查看帮助
//! cargo run --bin univoice-bench -- --help
//!
//! # dry-run 模式
//! cargo run --bin univoice-bench -- -d
//!
//! # 测试 qwen TTS
//! cargo run --bin univoice-bench -- -p qwen -t tts -i 3
//!
//! # 测试 qwen 和 doubao 的 TTS + ASR
//! cargo run --bin univoice-bench -- -p qwen,doubao -t all -i 3
//! ```

use clap::Parser;

use univoice::benchmark::cli::CliArgs;
use univoice::benchmark::runner::run_benchmark;

#[tokio::main]
async fn main() {
    // 加载 .env 文件（如存在）
    dotenvy::dotenv().ok();

    let args = CliArgs::parse();

    println!("🚀 Univoice Benchmark v{}", env!("CARGO_PKG_VERSION"));
    println!("================================\n");

    if let Err(e) = run_benchmark(&args).await {
        eprintln!("\n❌ Benchmark 执行失败: {}", e);
        std::process::exit(1);
    }
}
