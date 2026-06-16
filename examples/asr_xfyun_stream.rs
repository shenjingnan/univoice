/// Xfyun ASR - 流式识别示例 (基于 PCM 文件)
///
/// 从 PCM 音频文件读取数据，流式发送到讯飞 IAT v2 WebSocket API，
/// 实时输出中间识别结果和最终识别结果。
///
/// 使用方法:
/// ```bash
/// cargo run --example asr_xfyun_stream -- \
///   --app-id YOUR_APP_ID \
///   --api-key YOUR_API_KEY \
///   --api-secret YOUR_API_SECRET \
///   --file speech.pcm
/// ```
///
/// 环境变量替代:
/// ```bash
/// XFYUN_APP_ID=xxx XFYUN_API_KEY=xxx XFYUN_API_SECRET=xxx \
///   cargo run --example asr_xfyun_stream -- --file speech.pcm
/// ```
use std::path::PathBuf;

use clap::Parser;
use futures_util::StreamExt;

use univoice::asr::{
    AsrProvider, AudioInput, BaseProviderOption, DEFAULT_CHUNK_SIZE, XfyunAsr, XfyunAsrOption,
    adapt_audio_input,
};

#[derive(Parser)]
#[command(name = "asr-xfyun-stream", about = "讯飞 Xfyun ASR 流式识别示例")]
struct Args {
    /// 讯飞 AppID
    #[arg(long, env = "XFYUN_APP_ID")]
    app_id: String,

    /// 讯飞 API Key
    #[arg(long, env = "XFYUN_API_KEY")]
    api_key: String,

    /// 讯飞 API Secret
    #[arg(long, env = "XFYUN_API_SECRET")]
    api_secret: String,

    /// PCM 音频文件路径
    #[arg(short, long)]
    file: PathBuf,

    /// 采样率（PCM 文件，默认 16000）
    #[arg(long, default_value_t = 16000)]
    sample_rate: u32,

    /// 识别领域（默认 iat）
    #[arg(long, default_value_t = String::from("iat"))]
    domain: String,

    /// 口音（默认 mandarin）
    #[arg(long, default_value_t = String::from("mandarin"))]
    accent: String,

    /// 静音超时毫秒（默认 2000）
    #[arg(long, default_value_t = 2000)]
    eos: u32,
}

#[tokio::main]
async fn main() {
    dotenvy::dotenv().ok();
    let args = Args::parse();

    // 验证参数
    if args.app_id.is_empty() {
        eprintln!("错误: 请提供 --app-id 或设置 XFYUN_APP_ID 环境变量");
        std::process::exit(1);
    }
    if args.api_key.is_empty() {
        eprintln!("错误: 请提供 --api-key 或设置 XFYUN_API_KEY 环境变量");
        std::process::exit(1);
    }
    if args.api_secret.is_empty() {
        eprintln!("错误: 请提供 --api-secret 或设置 XFYUN_API_SECRET 环境变量");
        std::process::exit(1);
    }
    if !args.file.exists() {
        eprintln!("错误: 音频文件不存在: {}", args.file.display());
        std::process::exit(1);
    }

    // 读取音频文件
    let audio_data = match std::fs::read(&args.file) {
        Ok(data) => data,
        Err(e) => {
            eprintln!("错误: 读取文件失败: {}", e);
            std::process::exit(1);
        }
    };

    println!("\n=== 讯飞 Xfyun ASR - 流式识别 ===");
    println!("音频文件: {}", args.file.display());
    println!("采样率: {} Hz", args.sample_rate);
    println!("音频大小: {} 字节\n", audio_data.len());

    // 创建 Xfyun ASR 实例
    let asr = XfyunAsr::new(XfyunAsrOption {
        base: BaseProviderOption {
            api_key: Some(args.api_key),
            ..Default::default()
        },
        app_id: Some(args.app_id),
        api_secret: Some(args.api_secret),
        sample_rate: Some(args.sample_rate),
        domain: Some(args.domain),
        accent: Some(args.accent),
        eos: Some(args.eos),
        ..Default::default()
    });

    // 将音频数据切分为流
    let audio_stream = adapt_audio_input(AudioInput::Data(audio_data), DEFAULT_CHUNK_SIZE);

    // 执行流式识别
    let start = std::time::Instant::now();
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
