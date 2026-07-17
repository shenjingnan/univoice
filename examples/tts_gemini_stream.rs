/// Gemini (Google) TTS - 流式语音合成示例
///
/// 通过 SSE 接收 base64 PCM 音频流并保存。
/// Gemini 流式固定输出 PCM（24kHz mono 16-bit），
/// 示例中自动添加 WAV 头以便直接播放。
///
/// 流式仅在模型 `gemini-3.1-flash-tts-preview` 中支持。
///
/// ## 使用方法
///
/// ```bash
/// # 使用 GEMINI_API_KEY 环境变量
/// cargo run --example tts_gemini_stream -- --output output_gemini_stream.wav
///
/// # 自定义文本分段
/// cargo run --example tts_gemini_stream -- \
///   --text "First part." --text "Second part." \
///   --output speech.wav
/// ```
use std::path::PathBuf;

use clap::Parser;
use futures_util::StreamExt;

use univoice::tts::provider::{GeminiTts, GeminiTtsOption};
use univoice::tts::{BaseTtsOption, TextStream, TtsProvider};

#[derive(Parser)]
#[command(name = "tts-gemini-stream", about = "Gemini (Google) TTS 流式合成示例")]
struct Args {
    /// Gemini API Key（也支持 GEMINI_API_KEY 环境变量）
    #[arg(long, env = "GEMINI_API_KEY")]
    api_key: String,

    /// 输出音频文件路径（自动添加 WAV 头）
    #[arg(short, long, default_value = "output_gemini_stream.wav")]
    output: PathBuf,

    /// 文本分段（可指定多个；Gemini 流式会在 provider 内部缓冲合并后一次性发送）
    #[arg(
        short,
        long,
        default_value = "Say cheerfully: Have a wonderful day!",
        default_value = "Hope you enjoy using the Gemini TTS system."
    )]
    text: Vec<String>,

    /// 音色名称（默认 Kore；可选 Puck/Charon/Zephyr 等 30 种）
    #[arg(long)]
    voice: Option<String>,

    /// 模型名称（默认 gemini-3.1-flash-tts-preview，流式仅此模型支持）
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

    println!("\n=== Gemini (Google) TTS - 流式合成（SSE / PCM 24000Hz）===");
    println!("文本分段数: {}", args.text.len());
    for (i, t) in args.text.iter().enumerate() {
        println!("  分段 {}: \"{}\" ({} 字)", i + 1, t, t.chars().count());
    }
    println!("输出: {}", args.output.display());

    // 创建 Gemini TTS 实例（流式固定 PCM）
    let tts = GeminiTts::new(GeminiTtsOption {
        base: BaseTtsOption {
            api_key: Some(args.api_key),
            model: args.model,
            voice: args.voice.map(Into::into),
            ..Default::default()
        },
    });

    // 构建文本流（Gemini 会在 provider 内部缓冲合并）
    let text_stream: TextStream = Box::pin(futures_util::stream::iter(args.text.clone()));

    // 执行流式合成
    let start = std::time::Instant::now();
    let mut audio_chunks: Vec<Vec<u8>> = Vec::new();
    let mut chunk_count = 0;
    let mut first_frame_latency: Option<u128> = None;

    println!("\n开始流式合成...\n");

    match tts.speak_stream(text_stream).await {
        Ok(mut stream) => {
            while let Some(result) = stream.next().await {
                match result {
                    Ok(chunk) => {
                        if first_frame_latency.is_none() {
                            first_frame_latency = Some(start.elapsed().as_millis());
                            println!("[首帧] 延迟 {} ms", first_frame_latency.unwrap());
                        }
                        chunk_count += 1;
                        audio_chunks.push(chunk.audio_chunk);

                        if chunk_count % 10 == 0 || chunk_count == 1 {
                            println!("[接收中] 已收到 {} 个音频块", chunk_count);
                        }
                    }
                    Err(e) => {
                        eprintln!("接收音频错误: {}", e);
                        std::process::exit(1);
                    }
                }
            }
        }
        Err(e) => {
            eprintln!("启动流式合成失败: {}", e);
            std::process::exit(1);
        }
    }

    if audio_chunks.is_empty() {
        eprintln!("错误: 未收到任何音频数据");
        std::process::exit(1);
    }

    // 合并所有音频块
    let total_len: usize = audio_chunks.iter().map(|c| c.len()).sum();
    let mut audio = Vec::with_capacity(total_len);
    for chunk in audio_chunks {
        audio.extend_from_slice(&chunk);
    }

    let elapsed = start.elapsed();

    println!("\n=== 统计信息 ===");
    println!("音频块数: {}", chunk_count);
    println!(
        "音频大小: {} bytes ({:.1} KB)",
        audio.len(),
        audio.len() as f64 / 1024.0
    );
    println!("合成耗时: {} ms", elapsed.as_millis());

    // Gemini 返回裸 PCM，添加 WAV 头以便直接播放
    let wav_data = add_wav_header(&audio, 24000);

    // 保存到文件
    match std::fs::write(&args.output, &wav_data) {
        Ok(_) => println!("\n文件已保存: {}", args.output.display()),
        Err(e) => {
            eprintln!("错误: 写入文件失败: {}", e);
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
    wav.extend_from_slice(&16u32.to_le_bytes());
    wav.extend_from_slice(&1u16.to_le_bytes());
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
