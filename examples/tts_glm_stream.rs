/// GLM (智谱 AI) TTS - 流式语音合成示例
///
/// 通过 SSE 接收 base64 PCM 音频流并保存。GLM 流式固定输出 PCM（24000 Hz）。
///
/// 注意：GLM 流式 API 的文本是一次性发送的——分段文本会在客户端缓冲合并后
/// 再请求，低延迟优势主要体现在音频输出侧（首帧约 400ms）。
///
/// ## 使用方法
///
/// ```bash
/// # 使用 .env 中的 API Key（GLM_API_KEY）
/// cargo run --example tts_glm_stream -- --output output_glm_stream.pcm
///
/// # 自定义文本分段
/// cargo run --example tts_glm_stream -- \
///   --text "第一段内容。" --text "第二段内容。" \
///   --output speech.pcm
/// ```
use std::path::PathBuf;

use clap::Parser;
use futures_util::StreamExt;

use univoice::tts::provider::{GlmTts, GlmTtsOption};
use univoice::tts::{BaseTtsOption, TextStream, TtsProvider};

#[derive(Parser)]
#[command(name = "tts-glm-stream", about = "GLM (智谱) TTS 流式合成示例")]
struct Args {
    /// 智谱 AI API Key（也支持 GLM_API_KEY 环境变量）
    #[arg(long, env = "GLM_API_KEY")]
    api_key: String,

    /// 输出音频文件路径（PCM 格式，24000 Hz）
    #[arg(short, long, default_value = "output_glm_stream.pcm")]
    output: PathBuf,

    /// 文本分段（可指定多个；GLM 流式会在客户端缓冲合并后一次性发送）
    #[arg(
        short,
        long,
        default_value = "你好，欢迎使用智谱 GLM 流式语音合成。",
        default_value = "今天天气真不错，适合出门散步。"
    )]
    text: Vec<String>,

    /// 音色名称（默认 tongtong）
    #[arg(long)]
    voice: Option<String>,

    /// 模型名称（默认 glm-tts）
    #[arg(long)]
    model: Option<String>,

    /// 语速倍率 (0.5~2.0，默认 1.0)
    #[arg(long)]
    speed: Option<f32>,

    /// 音量倍率 (0.0~1.0，默认 1.0)
    #[arg(long)]
    volume: Option<f32>,

    /// 启用 AI 生成音频水印
    #[arg(long)]
    watermark: bool,
}

#[tokio::main]
async fn main() {
    dotenvy::dotenv().ok();
    let args = Args::parse();

    if args.api_key.is_empty() {
        eprintln!("错误: 请提供 --api-key 或设置 GLM_API_KEY 环境变量");
        std::process::exit(1);
    }

    println!("\n=== GLM (智谱) TTS - 流式合成（SSE / PCM 24000Hz）===");
    println!("文本分段数: {}", args.text.len());
    for (i, t) in args.text.iter().enumerate() {
        println!("  分段 {}: \"{}\" ({} 字)", i + 1, t, t.chars().count());
    }
    println!("输出: {}", args.output.display());

    // 创建 GLM TTS 实例（流式固定 PCM，无需指定 format）
    let tts = GlmTts::new(GlmTtsOption {
        base: BaseTtsOption {
            api_key: Some(args.api_key),
            model: args.model,
            voice: args.voice.map(Into::into),
            speed: args.speed,
            volume: args.volume,
            ..Default::default()
        },
        watermark_enabled: if args.watermark { Some(true) } else { None },
    });

    // 构建文本流（GLM 会在 provider 内部缓冲合并）
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

    // 保存到文件
    match std::fs::write(&args.output, &audio) {
        Ok(_) => println!("\n文件已保存: {}", args.output.display()),
        Err(e) => {
            eprintln!("错误: 写入文件失败: {}", e);
            std::process::exit(1);
        }
    }
}
