/// Qwen TTS - 非流式语音合成示例
///
/// 将文本合成为音频并保存到文件。
///
/// ## 使用方法
///
/// ```bash
/// # 使用 .env 中的 API Key（推荐）
/// cargo run --example tts_qwen_synthesize -- \
///   --text "你好世界，欢迎使用语音合成服务" \
///   --output output.mp3
///
/// # 指定音色和语速
/// cargo run --example tts_qwen_synthesize -- \
///   --text "欢迎使用语音合成服务" \
///   --output hello.mp3 \
///   --voice longxiaochun_v3 \
///   --speed 1.2
///
/// # 显式指定 API Key
/// cargo run --example tts_qwen_synthesize -- \
///   --api-key sk-xxx \
///   --text "你好" \
///   --output hello.mp3
/// ```
use std::path::PathBuf;

use clap::Parser;

use univoice::tts::provider::{QwenTts, QwenTtsOption};
use univoice::tts::{BaseTtsOption, TtsProvider, TtsRequest};

#[derive(Parser)]
#[command(name = "tts-qwen-synthesize", about = "Qwen TTS 非流式合成示例")]
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
    #[arg(short, long, default_value = "output.mp3")]
    output: PathBuf,

    /// 音色名称（默认 longxiaochun_v3）
    #[arg(long)]
    voice: Option<String>,

    /// 模型名称（默认 cosyvoice-v3-flash）
    #[arg(long)]
    model: Option<String>,

    /// 音频格式: mp3, wav, pcm, ogg_opus（默认 mp3）
    #[arg(long)]
    format: Option<String>,

    /// 语速倍率 (0.5~2.0，默认 1.0)
    #[arg(long)]
    speed: Option<f32>,

    /// 音量倍率 (0.0~1.0，默认 1.0)
    #[arg(long)]
    volume: Option<f32>,

    /// 音调倍率 (0.5~2.0，默认 1.0)
    #[arg(long)]
    pitch: Option<f32>,

    /// 采样率（可选，如 24000）
    #[arg(long)]
    sample_rate: Option<u32>,
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

    println!("\n=== Qwen TTS - 非流式合成 ===");
    println!("文本: {}", args.text);
    println!("输出: {}", args.output.display());

    // 创建 Qwen TTS 实例
    let tts = QwenTts::new(QwenTtsOption {
        base: BaseTtsOption {
            api_key: Some(args.api_key),
            model: args.model,
            voice: args.voice.map(Into::into),
            speed: args.speed,
            volume: args.volume,
            pitch: args.pitch,
            format: args.format,
            ..Default::default()
        },
        sample_rate: args.sample_rate,
        instruction: None,
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

                    // 如果文件超过 1MB，显示文件大小
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
