/// Doubao ASR - 连接预建立 + 流式识别示例
///
/// 演示三步流程：
/// 1. asr.connect() —— 预建立 WebSocket 连接
/// 2. connection.listen() —— 在已建立的连接上执行流式识别
/// 3. connection.close() —— 显式关闭连接
///
/// 使用方法:
/// ```bash
/// cargo run --example asr_doubao_connect -- \
///   --app-key YOUR_APP_KEY \
///   --access-key YOUR_ACCESS_KEY \
///   --file speech.pcm
/// ```
use std::path::PathBuf;
use std::time::Instant;

use clap::Parser;
use futures_util::StreamExt;

use univoice::asr::{
    AsrConnectOption, AsrProvider, AudioInput, BaseProviderOption, DEFAULT_CHUNK_SIZE, DoubaoAsr,
    DoubaoAsrMode, DoubaoAsrOption, adapt_audio_input,
};

#[derive(Parser)]
#[command(
    name = "asr-doubao-connect",
    about = "Doubao ASR 连接预建立 + 流式识别示例"
)]
struct Args {
    #[arg(long, env = "DOUBAO_APP_KEY")]
    app_key: String,

    #[arg(long, env = "DOUBAO_ACCESS_TOKEN")]
    access_key: String,

    #[arg(short, long)]
    file: PathBuf,

    #[arg(long, default_value_t = 16000)]
    sample_rate: u32,

    #[arg(long, default_value_t = 16)]
    bits: u8,

    #[arg(long, default_value_t = 1)]
    channel: u8,
}

#[tokio::main]
async fn main() {
    dotenvy::dotenv().ok();
    let args = Args::parse();

    if args.app_key.is_empty() || args.access_key.is_empty() {
        eprintln!("错误: 请提供 --app-key 和 --access-key");
        eprintln!("也可以设置 DOUBAO_APP_KEY 和 DOUBAO_ACCESS_TOKEN 环境变量");
        std::process::exit(1);
    }

    if !args.file.exists() {
        eprintln!("错误: 音频文件不存在: {}", args.file.display());
        std::process::exit(1);
    }

    let audio_data = match std::fs::read(&args.file) {
        Ok(data) => data,
        Err(e) => {
            eprintln!("错误: 读取文件失败: {}", e);
            std::process::exit(1);
        }
    };

    println!("\n=== Doubao ASR - 连接预建立 + 流式识别 ===");
    println!("音频文件: {}", args.file.display());
    println!("音频大小: {} 字节\n", audio_data.len());

    // 创建 Doubao ASR 实例
    let asr = DoubaoAsr::new(DoubaoAsrOption {
        base: BaseProviderOption {
            language: Some("zh-CN".into()),
            ..Default::default()
        },
        app_key: Some(args.app_key),
        access_key: Some(args.access_key),
        mode: DoubaoAsrMode::Streaming,
        sample_rate: args.sample_rate,
        bits: args.bits,
        channel: args.channel,
        ..Default::default()
    });

    // Step 1: 预建立 WebSocket 连接
    println!("正在建立 WebSocket 连接...");
    let connect_start = Instant::now();

    let mut connection = match asr.connect(AsrConnectOption::default()).await {
        Ok(conn) => {
            let connect_time = connect_start.elapsed();
            println!("连接已建立 (耗时: {} ms)\n", connect_time.as_millis());
            conn
        }
        Err(e) => {
            eprintln!("连接失败: {}", e);
            std::process::exit(1);
        }
    };

    // Step 2: 在已建立的连接上执行流式识别
    let audio_stream = adapt_audio_input(AudioInput::Data(audio_data), DEFAULT_CHUNK_SIZE);

    let start = Instant::now();
    let mut chunk_count = 0;
    let mut results: Vec<String> = Vec::new();

    println!("开始流式识别...\n");

    match connection.listen_stream(audio_stream).await {
        Ok(mut stream) => {
            while let Some(chunk) = stream.next().await {
                match chunk {
                    Ok(chunk) => {
                        chunk_count += 1;
                        let status = if chunk.is_final { "最终" } else { "中间" };
                        let text = if chunk.text.is_empty() {
                            "(空)"
                        } else {
                            &chunk.text
                        };
                        println!("[{}] {}: {}", status, chunk_count, text);

                        if chunk.is_final && !chunk.text.is_empty() {
                            results.push(chunk.text);
                        }
                    }
                    Err(e) => eprintln!("识别错误: {}", e),
                }
            }
        }
        Err(e) => {
            eprintln!("识别失败: {}", e);
            std::process::exit(1);
        }
    }

    let elapsed = start.elapsed();

    println!("\n=== 统计信息 ===");
    println!("识别耗时: {} ms", elapsed.as_millis());
    println!("结果块数: {}", chunk_count);

    // Step 3: 显式关闭连接
    if let Err(e) = connection.close().await {
        eprintln!("关闭连接时出现警告: {}", e);
    } else {
        println!("连接已关闭");
    }

    println!("\n完整识别结果: {}", results.join(""));
}
