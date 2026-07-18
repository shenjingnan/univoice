/// Qwen Realtime TTS - 非流式语音合成示例
///
/// 将文本合成为音频并保存到文件。
///
/// ## 使用方法
///
/// ```bash
/// # 使用 .env 中的 API Key（推荐）
/// cargo run --example tts_qwen_realtime_synthesize -- \
///   --text "你好世界，欢迎使用语音合成服务" \
///   --output output.pcm
///
/// # 指定音色和模型
/// cargo run --example tts_qwen_realtime_synthesize -- \
///   --text "欢迎使用语音合成服务" \
///   --output hello.pcm \
///   --voice Cherry
///
/// # 显式指定 API Key
/// cargo run --example tts_qwen_realtime_synthesize -- \
///   --api-key sk-xxx \
///   --text "你好" \
///   --output output.pcm
/// ```
use std::path::PathBuf;

use clap::Parser;

use univoice::tts::provider::{QwenRealtimeTts, QwenRealtimeTtsOption};
use univoice::tts::voice_id;
use univoice::tts::{BaseTtsOption, TtsProvider, TtsRequest};

#[derive(Parser)]
#[command(
    name = "tts-qwen-realtime-synthesize",
    about = "Qwen Realtime TTS 非流式合成示例"
)]
struct Args {
    /// DashScope API Key（也支持 QWEN_API_KEY 环境变量）
    #[arg(long, env = "QWEN_API_KEY")]
    api_key: String,

    /// 待合成的文本
    #[arg(
        short,
        long,
        default_value = "你好，欢迎使用语音合成服务，今天天气真不错。"
    )]
    text: String,

    /// 输出音频文件路径
    #[arg(short, long, default_value = "output.pcm")]
    output: PathBuf,

    /// 音色名称（默认 Cherry。可选值见 `voice_id::qwen_realtime::*` 常量，如 SERENA/ETHAN/MOMO/STELLA 等）
    #[arg(long)]
    voice: Option<String>,

    /// 模型名称（默认 qwen3-tts-instruct-flash-realtime）
    #[arg(long)]
    model: Option<String>,

    /// 音频格式: pcm, mp3, wav, opus（默认 pcm）
    #[arg(long)]
    format: Option<String>,

    /// 采样率（默认 24000）
    #[arg(long)]
    sample_rate: Option<u32>,

    /// 情感控制指令（仅 instruct 模型支持）
    #[arg(long)]
    instruction: Option<String>,

    /// 语速倍率 (0.5~2.0)
    #[arg(long)]
    speech_rate: Option<f32>,
}

#[tokio::main]
async fn main() {
    dotenvy::dotenv().ok();
    let args = Args::parse();

    if args.api_key.is_empty() {
        eprintln!("错误: 请提供 --api-key");
        eprintln!("也可以设置 QWEN_API_KEY 环境变量");
        std::process::exit(1);
    }

    println!("\n=== Qwen Realtime TTS - 非流式合成 ===");
    println!("文本: {}", args.text);
    println!("输出: {}", args.output.display());

    // 创建 Qwen Realtime TTS 实例
    // 提示: 可用 `voice_id::qwen_realtime::SERENA.into()` 等常量代替字符串
    let tts = QwenRealtimeTts::new(QwenRealtimeTtsOption {
        base: BaseTtsOption {
            api_key: Some(args.api_key),
            model: args.model,
            voice: args.voice.map(Into::into),
            format: args.format,
            ..Default::default()
        },
        sample_rate: args.sample_rate,
        instruction: args.instruction,
        speech_rate: args.speech_rate,
        ..Default::default()
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
                        let size_kb = m.len() as f64 / 1024.0;
                        if size_kb > 1024.0 {
                            println!("文件大小: {:.2} MB", size_kb / 1024.0);
                        } else {
                            println!("文件大小: {:.1} KB", size_kb);
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
