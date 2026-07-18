/// MiniMax TTS - 非流式语音合成示例
///
/// 将文本合成为音频并保存到文件。
///
/// ## 使用方法
///
/// ```bash
/// # 使用 MINIMAX_API_KEY 环境变量
/// cargo run --example tts_minimax_synthesize -- \
///   --text "你好世界，欢迎使用语音合成服务" \
///   --output output.mp3
///
/// # 指定音色和语速
/// cargo run --example tts_minimax_synthesize -- \
///   --text "欢迎使用语音合成服务" \
///   --output hello.mp3 \
///   --voice female-shaonv \
///   --speed 1.2
///
/// # 显式指定 API Key
/// cargo run --example tts_minimax_synthesize -- \
///   --api-key msk-xxx \
///   --text "你好" \
///   --output hello.mp3
/// ```
use std::path::PathBuf;

use clap::Parser;

use univoice::tts::provider::{MinimaxTts, MinimaxTtsOption};
use univoice::tts::voice_id;
use univoice::tts::{BaseTtsOption, TtsProvider, TtsRequest};

#[derive(Parser)]
#[command(name = "tts-minimax-synthesize", about = "MiniMax TTS 非流式合成示例")]
struct Args {
    /// MiniMax API Key（也支持 MINIMAX_API_KEY 环境变量）
    #[arg(long, env = "MINIMAX_API_KEY")]
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

    /// 音色名称（默认 male-qn-qingse。可选值见 `voice_id::minimax::*` 常量）
    #[arg(long)]
    voice: Option<String>,

    /// 模型名称（默认 speech-2.8-hd，可选 speech-2.6-hd, speech-2.8-turbo 等）
    #[arg(long)]
    model: Option<String>,

    /// 音频格式: mp3, pcm, flac, wav（默认 mp3）
    #[arg(long)]
    format: Option<String>,

    /// 语速 (0.5~2.0，默认 1.0)
    #[arg(long)]
    speed: Option<f32>,

    /// 音量 (0~10，默认 1.0)
    #[arg(long)]
    volume: Option<f32>,

    /// 语调 (-12~12，默认 0)
    #[arg(long)]
    pitch: Option<f32>,

    /// 采样率（可选，如 24000, 32000, 44100）
    #[arg(long)]
    sample_rate: Option<u32>,

    /// 比特率（仅 mp3 生效，如 128000，默认 128000）
    #[arg(long)]
    bitrate: Option<u32>,

    /// 情绪控制: happy, sad, angry, fearful, disgusted, surprised, calm
    #[arg(long)]
    emotion: Option<String>,

    /// 语种增强（如 Chinese, English）
    #[arg(long)]
    language_boost: Option<String>,
}

#[tokio::main]
async fn main() {
    dotenvy::dotenv().ok();
    let args = Args::parse();

    if args.api_key.is_empty() {
        eprintln!("错误: 请提供 --api-key");
        eprintln!("也可以设置 MINIMAX_API_KEY 环境变量");
        std::process::exit(1);
    }

    println!("\n=== MiniMax TTS - 非流式合成 ===");
    println!("文本: {}", args.text);
    println!("输出: {}", args.output.display());

    // 创建 MiniMax TTS 实例
    // 提示: 可用 `voice_id::minimax::FEMALE_SHAONV.into()` 等常量代替字符串
    let tts = MinimaxTts::new(MinimaxTtsOption {
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
        bitrate: args.bitrate,
        emotion: args.emotion,
        language_boost: args.language_boost,
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

                    // 显示文件大小
                    if let Ok(m) = std::fs::metadata(&args.output) {
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
