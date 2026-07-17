/// OpenAI TTS - 非流式语音合成示例
///
/// 将文本合成为完整音频并保存到文件。
/// 支持 Speech 模式（tts-1）和 Chat 模式（gpt-4o-audio-preview）。
///
/// ## 使用方法
///
/// ```bash
/// # 使用 OPENAI_API_KEY 环境变量
/// cargo run --example tts_openai_synthesize -- \
///   --text "Hello, welcome to OpenAI TTS!" \
///   --output output.mp3
///
/// # 指定音色和模型
/// cargo run --example tts_openai_synthesize -- \
///   --voice echo --model tts-1-hd \
///   --text "Welcome to the future of voice synthesis." \
///   --output output.wav
///
/// # 使用 Chat 模式（需支持音频输出的模型）
/// cargo run --example tts_openai_synthesize -- \
///   --model gpt-4o-audio-preview \
///   --text "Hello from chat mode!" \
///   --output output.wav
/// ```
use std::path::PathBuf;

use clap::Parser;

use univoice::tts::protocol::openai::OpenaiApiMode;
use univoice::tts::provider::{OpenaiTts, OpenaiTtsOption};
use univoice::tts::{BaseTtsOption, TtsProvider, TtsRequest};

#[derive(Parser)]
#[command(name = "tts-openai-synthesize", about = "OpenAI TTS 非流式合成示例")]
struct Args {
    /// OpenAI API Key（也支持 OPENAI_API_KEY 环境变量）
    #[arg(long, env = "OPENAI_API_KEY")]
    api_key: String,

    /// 待合成的文本
    #[arg(short, long, default_value = "Hello, welcome to OpenAI TTS!")]
    text: String,

    /// 输出音频文件路径
    #[arg(short, long, default_value = "output_openai.mp3")]
    output: PathBuf,

    /// 音色名称（默认 alloy；可选 alloy/echo/fable/nova/shimmer 等）
    #[arg(long)]
    voice: Option<String>,

    /// 模型名称（默认 tts-1；可选 tts-1-hd/gpt-4o-mini-tts 等）
    #[arg(long)]
    model: Option<String>,

    /// 音频格式（默认 mp3；可选 mp3/opus/aac/flac/wav/pcm）
    #[arg(long)]
    format: Option<String>,

    /// 语速倍率（0.25~4.0）
    #[arg(long)]
    speed: Option<f32>,

    /// 强制使用 Chat 模式
    #[arg(long)]
    chat_mode: bool,
}

#[tokio::main]
async fn main() {
    dotenvy::dotenv().ok();
    let args = Args::parse();

    if args.api_key.is_empty() {
        eprintln!("错误: 请提供 --api-key 或设置 OPENAI_API_KEY 环境变量");
        std::process::exit(1);
    }

    println!("\n=== OpenAI TTS - 非流式合成 ===");
    println!("文本: {}", args.text);
    println!("输出: {}", args.output.display());

    // 根据参数推断 API 模式
    let model = args.model.clone().unwrap_or_else(|| "tts-1".into());
    let api_mode = if args.chat_mode {
        Some(OpenaiApiMode::Chat)
    } else {
        None // 由 model 自动推断
    };

    // 创建 OpenAI TTS 实例
    let tts = OpenaiTts::new(OpenaiTtsOption {
        base: BaseTtsOption {
            api_key: Some(args.api_key),
            model: Some(model),
            voice: args.voice.map(Into::into),
            speed: args.speed,
            format: args.format,
            ..Default::default()
        },
        api_mode,
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
            println!(
                "音频大小: {} bytes ({:.1} KB)",
                response.audio.len(),
                response.audio.len() as f64 / 1024.0
            );
            println!("音频格式: {}", response.format);
            println!("合成耗时: {} ms", elapsed.as_millis());

            // 保存到文件
            match std::fs::write(&args.output, &response.audio) {
                Ok(_) => println!("\n文件已保存: {}", args.output.display()),
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
