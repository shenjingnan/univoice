/// Gemini (Google) TTS - 非流式语音合成示例
///
/// 将文本合成为完整音频并保存到 WAV 文件。
/// Gemini TTS 输出 PCM（24kHz mono 16-bit），
/// 示例中自动添加 WAV 头以便直接播放。
///
/// ## 使用方法
///
/// ```bash
/// # 使用 GEMINI_API_KEY 环境变量
/// cargo run --example tts_gemini_synthesize -- \
///   --text "Say cheerfully: Have a wonderful day!" \
///   --output output_gemini.wav
///
/// # 指定音色和模型
/// cargo run --example tts_gemini_synthesize -- \
///   --voice Puck --model gemini-3.1-flash-tts-preview \
///   --text "Hello, how can I help you?" --output hello.wav
///
/// # 显式指定 API Key
/// cargo run --example tts_gemini_synthesize -- \
///   --api-key xxx --text "Hello world" --output hello.wav
/// ```
use std::path::PathBuf;

use clap::Parser;

use univoice::tts::provider::{GeminiTts, GeminiTtsOption};
use univoice::tts::{BaseTtsOption, TtsProvider, TtsRequest};

#[derive(Parser)]
#[command(
    name = "tts-gemini-synthesize",
    about = "Gemini (Google) TTS 非流式合成示例"
)]
struct Args {
    /// Gemini API Key（也支持 GEMINI_API_KEY 环境变量）
    #[arg(long, env = "GEMINI_API_KEY")]
    api_key: String,

    /// 待合成的文本
    #[arg(short, long, default_value = "Say cheerfully: Have a wonderful day!")]
    text: String,

    /// 输出音频文件路径（自动添加 WAV 头）
    #[arg(short, long, default_value = "output_gemini.wav")]
    output: PathBuf,

    /// 音色名称（默认 Kore；可选 Puck/Charon/Zephyr 等 30 种）
    #[arg(long)]
    voice: Option<String>,

    /// 模型名称（默认 gemini-3.1-flash-tts-preview）
    #[arg(long)]
    model: Option<String>,
}

#[tokio::main]
async fn main() {
    dotenvy::dotenv().ok();
    let args = Args::parse();

    if args.api_key.is_empty() {
        eprintln!("错误: 请提供 --api-key 或设置 GEMINI_API_KEY 环境变量");
        std::process::exit(1);
    }

    println!("\n=== Gemini (Google) TTS - 非流式合成 ===");
    println!("文本: {}", args.text);
    println!("输出: {}", args.output.display());

    // 创建 Gemini TTS 实例
    let tts = GeminiTts::new(GeminiTtsOption {
        base: BaseTtsOption {
            api_key: Some(args.api_key),
            model: args.model,
            voice: args.voice.map(Into::into),
            ..Default::default()
        },
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
            println!("音频格式: {}（采样率固定 24000 Hz）", response.format);
            println!("合成耗时: {} ms", elapsed.as_millis());

            // Gemini 返回裸 PCM，添加 WAV 头以便直接播放
            let wav_data = add_wav_header(&response.audio, 24000);

            // 保存到文件
            match std::fs::write(&args.output, &wav_data) {
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

/// 为裸 PCM 数据添加 WAV 文件头
fn add_wav_header(pcm_data: &[u8], sample_rate: u32) -> Vec<u8> {
    let channels: u16 = 1;
    let bits_per_sample: u16 = 16;
    let byte_rate = sample_rate * channels as u32 * (bits_per_sample / 8) as u32;
    let block_align = channels * (bits_per_sample / 8);
    let data_size = pcm_data.len() as u32;
    let file_size = 36 + data_size;

    let mut wav = Vec::with_capacity(44 + pcm_data.len());

    // RIFF header
    wav.extend_from_slice(b"RIFF");
    wav.extend_from_slice(&file_size.to_le_bytes());
    wav.extend_from_slice(b"WAVE");

    // fmt chunk
    wav.extend_from_slice(b"fmt ");
    wav.extend_from_slice(&16u32.to_le_bytes()); // chunk size
    wav.extend_from_slice(&1u16.to_le_bytes()); // PCM format
    wav.extend_from_slice(&channels.to_le_bytes());
    wav.extend_from_slice(&sample_rate.to_le_bytes());
    wav.extend_from_slice(&byte_rate.to_le_bytes());
    wav.extend_from_slice(&block_align.to_le_bytes());
    wav.extend_from_slice(&bits_per_sample.to_le_bytes());

    // data chunk
    wav.extend_from_slice(b"data");
    wav.extend_from_slice(&data_size.to_le_bytes());
    wav.extend_from_slice(pcm_data);

    wav
}
