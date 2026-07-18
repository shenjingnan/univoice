/// OpenAI TTS - 流式语音合成示例
///
/// 将文本合成为流式音频块并逐块输出。
/// 支持 Speech 模式（tts-1）和 Chat 模式（gpt-4o-audio-preview）。
///
/// ## 使用方法
///
/// ```bash
/// # 使用 OPENAI_API_KEY 环境变量
/// cargo run --example tts_openai_stream -- \
///   --text "Hello, welcome to streaming TTS!" \
///   --output output_stream.mp3
///
/// # 指定音色和模型
/// cargo run --example tts_openai_stream -- \
///   --voice nova --model tts-1-hd \
///   --text "Streaming audio output with OpenAI." \
///   --output output_stream.wav
///
/// # Chat 模式流式
/// cargo run --example tts_openai_stream -- \
///   --model gpt-4o-audio-preview --chat-mode \
///   --text "Hello from chat streaming mode!" \
///   --output output_chat.wav
/// ```
use std::path::PathBuf;

use clap::Parser;
use futures_util::StreamExt;

use univoice::tts::protocol::openai::OpenaiApiMode;
use univoice::tts::provider::{OpenaiTts, OpenaiTtsOption};
use univoice::tts::{BaseTtsOption, TtsProvider, utils::text_to_stream};

#[derive(Parser)]
#[command(name = "tts-openai-stream", about = "OpenAI TTS 流式合成示例")]
struct Args {
    /// OpenAI API Key（也支持 OPENAI_API_KEY 环境变量）
    #[arg(long, env = "OPENAI_API_KEY")]
    api_key: String,

    /// 待合成的文本（流式输入，单条文本）
    #[arg(short, long, default_value = "Hello, welcome to streaming TTS!")]
    text: String,

    /// 输出音频文件路径
    #[arg(short, long, default_value = "output_openai_stream.mp3")]
    output: PathBuf,

    /// 音色名称（默认 alloy）
    #[arg(long)]
    voice: Option<String>,

    /// 模型名称（默认 tts-1）
    #[arg(long)]
    model: Option<String>,

    /// 音频格式（默认 mp3）
    #[arg(long)]
    format: Option<String>,

    /// 语速倍率
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

    println!("\n=== OpenAI TTS - 流式合成 ===");
    println!("文本: {}", args.text);
    println!("输出: {}", args.output.display());

    let model = args.model.clone().unwrap_or_else(|| "tts-1".into());
    let api_mode = if args.chat_mode {
        Some(OpenaiApiMode::Chat)
    } else {
        None
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

    // 创建文本流
    let text_stream = text_to_stream(args.text);

    let start = std::time::Instant::now();
    let mut total_bytes = 0usize;
    let mut chunk_count = 0usize;

    match tts.speak_stream(text_stream).await {
        Ok(mut audio_stream) => {
            let mut all_audio = Vec::new();

            while let Some(chunk_result) = audio_stream.next().await {
                match chunk_result {
                    Ok(chunk) => {
                        total_bytes += chunk.audio_chunk.len();
                        chunk_count += 1;
                        println!(
                            "  收到音频块 #{}: {} bytes",
                            chunk_count,
                            chunk.audio_chunk.len()
                        );
                        all_audio.extend_from_slice(&chunk.audio_chunk);
                    }
                    Err(e) => {
                        eprintln!("流式合成错误: {}", e);
                        std::process::exit(1);
                    }
                }
            }

            let elapsed = start.elapsed();
            println!("\n流式合成完成!");
            println!("总音频块数: {}", chunk_count);
            println!(
                "总大小: {} bytes ({:.1} KB)",
                total_bytes,
                total_bytes as f64 / 1024.0
            );
            println!("合成耗时: {} ms", elapsed.as_millis());

            // 保存到文件
            match std::fs::write(&args.output, &all_audio) {
                Ok(_) => println!("文件已保存: {}", args.output.display()),
                Err(e) => {
                    eprintln!("错误: 写入文件失败: {}", e);
                    std::process::exit(1);
                }
            }
        }
        Err(e) => {
            eprintln!("启动流式合成失败: {}", e);
            std::process::exit(1);
        }
    }
}
