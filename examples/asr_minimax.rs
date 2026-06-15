/// MiniMax ASR - 语音识别示例
///
/// 从音频文件读取数据，发送到 MiniMax ASR HTTP API，
/// 获取识别结果。
///
/// 使用方法:
/// ```bash
/// cargo run --example asr_minimax -- \
///   --api-key YOUR_API_KEY \
///   --file speech.mp3
/// ```
use std::path::PathBuf;
use std::time::Instant;

use clap::Parser;
use futures_util::StreamExt;

use univoice::asr::provider::{AudioInput, adapt_audio_input};
use univoice::asr::provider::{MinimaxAsr, MinimaxAsrOption};
use univoice::asr::traits::AsrProvider;
use univoice::asr::types::BaseProviderOption;
use univoice::asr::types::DEFAULT_CHUNK_SIZE;

#[derive(Parser)]
#[command(name = "asr-minimax", about = "MiniMax ASR 语音识别示例")]
struct Cli {
    /// MiniMax API Key
    #[arg(short, long, env = "MINIMAX_API_KEY")]
    api_key: String,

    /// 音频文件路径
    #[arg(short, long)]
    file: PathBuf,

    /// 模型名称（默认 speech-01）
    #[arg(short, long)]
    model: Option<String>,

    /// 语言代码
    #[arg(short = 'L', long)]
    language: Option<String>,
}

#[tokio::main]
async fn main() {
    dotenvy::dotenv().ok();

    // 初始化 tracing
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::from_default_env()
                .add_directive(tracing::Level::INFO.into()),
        )
        .init();

    let cli = Cli::parse();

    // 验证 api_key
    if cli.api_key.is_empty() {
        eprintln!("错误: 请提供 --api-key");
        eprintln!("也可以设置 MINIMAX_API_KEY 环境变量");
        std::process::exit(1);
    }

    // 验证文件存在
    if !cli.file.exists() {
        eprintln!("错误: 音频文件不存在: {}", cli.file.display());
        std::process::exit(1);
    }

    // 读取音频文件
    let audio_data = match std::fs::read(&cli.file) {
        Ok(data) => data,
        Err(e) => {
            eprintln!("错误: 读取文件失败: {}", e);
            std::process::exit(1);
        }
    };
    let file_size = audio_data.len();

    println!("\n=== MiniMax ASR - 语音识别 ===");
    println!("音频文件: {}", cli.file.display());
    println!("音频大小: {} 字节\n", file_size);

    // 构造 Provider
    let asr = MinimaxAsr::new(MinimaxAsrOption {
        base: BaseProviderOption {
            api_key: Some(cli.api_key),
            model: cli.model,
            language: cli.language,
            ..Default::default()
        },
        timeout: Some(std::time::Duration::from_secs(30)),
    });

    // 将音频数据切分为流
    let audio_stream = adapt_audio_input(AudioInput::Data(audio_data), DEFAULT_CHUNK_SIZE);

    // 计时
    let start = Instant::now();
    let mut first_chunk_time = None;
    let mut final_text = String::new();

    println!("开始识别...\n");

    // 调用 listen_stream（MiniMax 为同步 API，返回单个 final chunk）
    match asr.listen_stream(audio_stream).await {
        Ok(mut stream) => {
            while let Some(chunk) = stream.next().await {
                match chunk {
                    Ok(chunk) => {
                        if first_chunk_time.is_none() {
                            first_chunk_time = Some(start.elapsed());
                            println!("[首字延迟] {} ms\n", first_chunk_time.unwrap().as_millis());
                        }

                        let text = if chunk.text.is_empty() {
                            "(空)"
                        } else {
                            &chunk.text
                        };

                        if chunk.is_final {
                            println!("[最终] {}", text);
                            final_text.push_str(&chunk.text);
                        } else {
                            println!("[中间] {}", text);
                        }
                    }
                    Err(e) => {
                        eprintln!("识别错误: {}", e);
                    }
                }
            }
        }
        Err(e) => {
            eprintln!("启动识别失败: {}", e);
            std::process::exit(1);
        }
    }

    let elapsed = start.elapsed();

    println!("\n=== 统计信息 ===");
    println!("总耗时: {} ms", elapsed.as_millis());
    if let Some(first) = first_chunk_time {
        println!("首字延迟: {} ms", first.as_millis());
    }
    println!("\n完整识别结果: {}", final_text);
}
