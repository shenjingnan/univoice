/// Doubao ASR - 非流式识别示例
///
/// 从 PCM 文件读取完整音频数据，发送到火山引擎 Doubao ASR 服务，
/// 一次性返回完整识别结果和分段信息。
///
/// 使用方法:
/// ```bash
/// cargo run --example asr-doubao-non-stream -- \
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
#[command(name = "asr-doubao-non-stream", about = "Doubao ASR 非流式识别示例")]
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

    println!("\n=== Doubao ASR - 非流式识别 ===");
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

    // 执行流式识别并收集完整结果
    let start = Instant::now();
    let mut text_parts: Vec<String> = Vec::new();
    let mut segments: Vec<String> = Vec::new();

    println!("正在识别...\n");

    match asr.listen_stream(audio_stream).await {
        Ok(mut stream) => {
            while let Some(chunk) = stream.next().await {
                match chunk {
                    Ok(chunk) => {
                        if chunk.is_final && !chunk.text.is_empty() {
                            text_parts.push(chunk.text);
                        }
                        if let Some(seg) = chunk.segment {
                            segments
                                .push(format!("  [{}ms - {}ms] {}", seg.start, seg.end, seg.text));
                        }
                    }
                    Err(e) => {
                        eprintln!("识别错误: {}", e);
                        std::process::exit(1);
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
    let full_text = text_parts.join("");

    println!("=== 识别结果 ===");
    println!("耗时: {} ms", elapsed.as_millis());

    if full_text.is_empty() {
        println!("\n识别结果: (无识别结果)");
    } else {
        println!("\n识别结果: {}", full_text);
    }

    if !segments.is_empty() {
        println!("\n分段信息:");
        for seg in segments {
            println!("{}", seg);
        }
    }
}
