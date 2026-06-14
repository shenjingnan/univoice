/// Doubao ASR - 流式识别示例
///
/// 从 PCM 文件读取音频数据，分块流式发送到火山引擎 Doubao ASR 服务，
/// 实时输出中间识别结果和最终识别结果。
///
/// 使用方法:
/// ```bash
/// cargo run --example asr-doubao-stream -- \
///   --app-key YOUR_APP_KEY \
///   --access-key YOUR_ACCESS_KEY \
///   --file speech.pcm
/// ```
use std::path::PathBuf;
use std::time::Instant;

use clap::Parser;
use futures_util::StreamExt;

use univoice::asr::{
    AsrProvider, AudioInput, BaseProviderOption, DEFAULT_CHUNK_SIZE, DoubaoAsr, DoubaoAsrMode,
    DoubaoAsrOption, adapt_audio_input,
};

#[derive(Parser)]
#[command(name = "asr-doubao-stream", about = "Doubao ASR 流式识别示例")]
struct Args {
    /// 火山引擎 App Key
    #[arg(long, env = "DOUBAO_APP_KEY")]
    app_key: String,

    /// 火山引擎 Access Key
    #[arg(long, env = "DOUBAO_ACCESS_TOKEN")]
    access_key: String,

    /// PCM 音频文件路径
    #[arg(short, long)]
    file: PathBuf,

    /// 采样率（默认 16000）
    #[arg(long, default_value_t = 16000)]
    sample_rate: u32,

    /// 位深度（默认 16）
    #[arg(long, default_value_t = 16)]
    bits: u8,

    /// 声道数（默认 1）
    #[arg(long, default_value_t = 1)]
    channel: u8,
}

#[tokio::main]
async fn main() {
    dotenvy::dotenv().ok();
    let args = Args::parse();

    // 验证参数
    if args.app_key.is_empty() || args.access_key.is_empty() {
        eprintln!("错误: 请提供 --app-key 和 --access-key");
        eprintln!("也可以设置 DOUBAO_APP_KEY 和 DOUBAO_ACCESS_TOKEN 环境变量");
        std::process::exit(1);
    }

    if !args.file.exists() {
        eprintln!("错误: 音频文件不存在: {}", args.file.display());
        std::process::exit(1);
    }

    // 读取 PCM 文件
    let audio_data = match std::fs::read(&args.file) {
        Ok(data) => data,
        Err(e) => {
            eprintln!("错误: 读取文件失败: {}", e);
            std::process::exit(1);
        }
    };

    println!("\n=== Doubao ASR - 流式识别 ===");
    println!("音频文件: {}", args.file.display());
    println!(
        "采样率: {} Hz, 位深: {} bit, 声道: {}",
        args.sample_rate, args.bits, args.channel
    );
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

    // 将音频数据切分为流
    let audio_stream = adapt_audio_input(AudioInput::Data(audio_data), DEFAULT_CHUNK_SIZE);

    // 执行流式识别
    let start = Instant::now();
    let mut first_result_time = None;
    let mut chunk_count = 0;
    let mut results: Vec<String> = Vec::new();

    println!("开始流式识别...\n");

    match asr.listen_stream(audio_stream).await {
        Ok(mut stream) => {
            while let Some(chunk) = stream.next().await {
                match chunk {
                    Ok(chunk) => {
                        chunk_count += 1;

                        if first_result_time.is_none() {
                            first_result_time = Some(start.elapsed());
                            println!("[首字延迟] {} ms\n", first_result_time.unwrap().as_millis());
                        }

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
    if let Some(first) = first_result_time {
        println!("首字延迟: {} ms", first.as_millis());
    }
    println!("结果块数: {}", chunk_count);
    println!("\n完整识别结果: {}", results.join(""));
}
