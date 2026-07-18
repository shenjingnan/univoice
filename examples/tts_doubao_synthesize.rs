/// Doubao (火山引擎) TTS - 非流式语音合成示例
///
/// 将文本合成为音频并保存到文件。
///
/// ## 使用方法
///
/// ```bash
/// # 使用 .env 中的凭据（推荐）
/// cargo run --example tts_doubao_synthesize -- \
///   --text "你好世界，欢迎使用语音合成服务" \
///   --output output.mp3
///
/// # 指定音色
/// cargo run --example tts_doubao_synthesize -- \
///   --text "欢迎使用语音合成服务" \
///   --output hello.mp3 \
///   --voice zh_female_tianmeixiaoyuan_moon_bigtts
/// ```
use std::path::PathBuf;

use clap::Parser;

use univoice::tts::provider::{DoubaoTts, DoubaoTtsOption};
use univoice::tts::{BaseTtsOption, TtsProvider, TtsRequest};

#[derive(Parser)]
#[command(name = "tts-doubao-synthesize", about = "Doubao TTS 非流式合成示例")]
struct Args {
    /// 火山引擎 App Key（也支持 DOUBAO_APP_KEY 环境变量）
    #[arg(long, env = "DOUBAO_APP_KEY")]
    app_key: String,

    /// 火山引擎 Access Token（也支持 DOUBAO_ACCESS_TOKEN 环境变量）
    #[arg(long, env = "DOUBAO_ACCESS_TOKEN")]
    access_token: String,

    /// 待合成的文本
    #[arg(
        short,
        long,
        default_value = "你好，欢迎使用语音合成服务，今天天气真不错。"
    )]
    text: String,

    /// 输出音频文件路径
    #[arg(short, long, default_value = "output.mp3")]
    output: PathBuf,

    /// 音色名称（也支持 DOUBAO_VOICE_TYPE 环境变量）
    #[arg(long, env = "DOUBAO_VOICE_TYPE")]
    voice: Option<String>,

    /// Resource ID（默认 seed-tts-2.0）
    #[arg(long)]
    cluster: Option<String>,

    /// 音频格式: mp3, wav, pcm, ogg_opus（默认 mp3）
    #[arg(long)]
    format: Option<String>,

    /// 采样率（如 24000）
    #[arg(long)]
    sample_rate: Option<u32>,
}

#[tokio::main]
async fn main() {
    dotenvy::dotenv().ok();
    let args = Args::parse();

    if args.app_key.is_empty() {
        eprintln!("错误: 请提供 --app-key 或设置 DOUBAO_APP_KEY 环境变量");
        std::process::exit(1);
    }
    if args.access_token.is_empty() {
        eprintln!("错误: 请提供 --access-token 或设置 DOUBAO_ACCESS_TOKEN 环境变量");
        std::process::exit(1);
    }

    println!("\n=== Doubao TTS - 非流式合成 ===");
    println!("文本: {}", args.text);
    println!("输出: {}", args.output.display());

    // 创建 Doubao TTS 实例
    let tts = DoubaoTts::new(DoubaoTtsOption {
        base: BaseTtsOption {
            voice: args.voice.map(Into::into),
            format: args.format,
            ..Default::default()
        },
        app_id: Some(args.app_key),
        access_token: Some(args.access_token),
        resource_id: args.cluster,
        sample_rate: args.sample_rate,
        enable_timestamp: None,
    });

    // 执行合成
    let start = std::time::Instant::now();

    match tts
        .synthesize(TtsRequest {
            text: args.text,
            options: None,
        })
        .await
    {
        Ok(response) => {
            let elapsed = start.elapsed();

            println!("\n合成成功!");
            println!("音频大小: {} bytes", response.audio.len());
            println!("音频格式: {}", response.format);
            println!("合成耗时: {} ms", elapsed.as_millis());

            // 保存到文件
            match std::fs::write(&args.output, &response.audio) {
                Ok(_) => {
                    println!("\n文件已保存: {}", args.output.display());

                    let meta = std::fs::metadata(&args.output);
                    if let Ok(m) = meta {
                        let size_mb = m.len() as f64 / 1_048_576.0;
                        if size_mb > 1.0 {
                            println!("文件大小: {:.2} MB", size_mb);
                        } else {
                            println!("文件大小: {} KB", m.len() / 1024);
                        }
                    }
                }
                Err(e) => {
                    eprintln!("错误: 写入文件失败: {}", e);
                    std::process::exit(1);
                }
            }
        }
        Err(e) => {
            eprintln!("合成失败: {}", e);
            std::process::exit(1);
        }
    }
}
