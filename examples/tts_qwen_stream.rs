/// Qwen TTS - 流式语音合成示例（边发边收）
///
/// 将分段文本流式发送到服务端，同时接收音频流并保存到文件。
/// 适用于 LLM 流式输出转语音等场景。
///
/// ## 使用方法
///
/// ```bash
/// # 使用 .env 中的 API Key
/// cargo run --example tts_qwen_stream -- \
///   --output output.mp3
///
/// # 自定义文本分段
/// cargo run --example tts_qwen_stream -- \
///   --text "第一段内容。" --text "第二段内容。" --text "第三段内容。" \
///   --output speech.mp3
/// ```
use std::path::PathBuf;

use clap::Parser;
use futures_util::StreamExt;

use univoice::tts::provider::{QwenTts, QwenTtsOption};
use univoice::tts::{BaseTtsOption, TextStream, TtsProvider};

#[derive(Parser)]
#[command(name = "tts-qwen-stream", about = "Qwen TTS 流式合成示例")]
struct Args {
    /// DashScope API Key（也支持 QWEN_API_KEY 环境变量）
    #[arg(long, env = "QWEN_API_KEY")]
    api_key: String,

    /// 输出音频文件路径
    #[arg(short, long, default_value = "output_stream.mp3")]
    output: PathBuf,

    /// 文本分段（可指定多个，每个分段作为独立的 continue-task 发送）
    #[arg(
        short,
        long,
        default_value = "你好，欢迎使用语音合成服务。",
        default_value = "今天天气真不错，适合出门散步。"
    )]
    text: Vec<String>,

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

    /// 采样率（可选，如 24000）
    #[arg(long)]
    sample_rate: Option<u32>,
}

#[tokio::main]
async fn main() {
    dotenvy::dotenv().ok();
    let args = Args::parse();

    if args.api_key.is_empty() {
        eprintln!("错误: 请提供 --api-key 或设置 QWEN_API_KEY 环境变量");
        std::process::exit(1);
    }

    println!("\n=== Qwen TTS - 流式合成（边发边收）===");
    println!("文本分段数: {}", args.text.len());
    for (i, t) in args.text.iter().enumerate() {
        println!("  分段 {}: \"{}\" ({} 字)", i + 1, t, t.chars().count());
    }
    println!("输出: {}", args.output.display());

    // 创建 Qwen TTS 实例
    let tts = QwenTts::new(QwenTtsOption {
        base: BaseTtsOption {
            api_key: Some(args.api_key),
            model: args.model,
            voice: args.voice.map(Into::into),
            speed: args.speed,
            format: args.format,
            ..Default::default()
        },
        sample_rate: args.sample_rate,
        instruction: None,
    });

    // 构建文本流（将 Vec<String> 转为 TextStream）
    let text_chunks: Vec<String> = args.text.clone();
    let text_stream: TextStream = Box::pin(futures_util::stream::iter(text_chunks));

    // 执行流式合成
    let start = std::time::Instant::now();
    let mut audio_chunks: Vec<Vec<u8>> = Vec::new();
    let mut chunk_count = 0;

    println!("\n开始流式合成...\n");

    match tts.speak_stream(text_stream).await {
        Ok(mut stream) => {
            while let Some(result) = stream.next().await {
                match result {
                    Ok(chunk) => {
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

    let elapsed = start.elapsed();

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

    println!("\n=== 统计信息 ===");
    println!("音频块数: {}", chunk_count);
    println!(
        "音频大小: {} bytes ({:.1} KB)",
        audio.len(),
        audio.len() as f64 / 1024.0
    );
    println!("合成耗时: {} ms", elapsed.as_millis());

    // 保存到文件
    match std::fs::write(&args.output, &audio) {
        Ok(_) => println!("\n文件已保存: {}", args.output.display()),
        Err(e) => {
            eprintln!("错误: 写入文件失败: {}", e);
            std::process::exit(1);
        }
    }
}
