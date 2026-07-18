/// Xfyun TTS - 流式语音合成示例（WebSocket 双向流）
///
/// 通过 WebSocket 连接讯飞超拟人 TTS 服务，以流式方式分块发送文本，
/// 并实时接收音频数据保存到文件。
///
/// ## 使用方法
///
/// ```bash
/// # 使用环境变量
/// export XFYUN_APP_ID=your_app_id
/// export XFYUN_API_KEY=your_api_key
/// export XFYUN_API_SECRET=your_api_secret
/// cargo run --example tts_xfyun_stream
///
/// # 自定义文本和发音人
/// cargo run --example tts_xfyun_stream -- \
///   --text "欢迎体验讯飞超拟人语音合成，本系统支持流式输入文本。" \
///   --output speech.mp3 \
///   --voice x5_lingfeiyi_flow
///
/// # 命令行参数
/// cargo run --example tts_xfyun_stream -- \
///   --app-id your_app_id \
///   --api-key your_api_key \
///   --api-secret your_api_secret \
///   --text "你好，世界" \
///   --output hello.mp3
/// ```
use std::path::PathBuf;

use clap::Parser;
use futures_util::StreamExt;

use univoice::tts::provider::{XfyunTts, XfyunTtsOption};
use univoice::tts::{BaseTtsOption, TextStream, TtsProvider};

#[derive(Parser)]
#[command(
    name = "tts-xfyun-stream",
    about = "Xfyun TTS 流式合成示例（WebSocket 双向流）"
)]
struct Args {
    /// 讯飞 App ID（也支持 XFYUN_APP_ID 环境变量）
    #[arg(long, env = "XFYUN_APP_ID")]
    app_id: String,

    /// 讯飞 API Key（也支持 XFYUN_API_KEY 环境变量）
    #[arg(long, env = "XFYUN_API_KEY")]
    api_key: String,

    /// 讯飞 API Secret（也支持 XFYUN_API_SECRET 环境变量）
    #[arg(long, env = "XFYUN_API_SECRET")]
    api_secret: String,

    /// 输出音频文件路径
    #[arg(short, long, default_value = "output_xfyun_stream.mp3")]
    output: PathBuf,

    /// 待合成的文本（会按逗号/句号等切分模拟流式输入）
    #[arg(
        short,
        long,
        default_value = "欢迎体验讯飞超拟人语音合成。本系统支持流式文本输入。今天天气真不错，适合出门散步。"
    )]
    text: String,

    /// 发音人（默认 x5_lingxiaoxuan_flow）
    #[arg(long)]
    voice: Option<String>,

    /// 音频格式: mp3, pcm, opus（默认 mp3）
    #[arg(long)]
    format: Option<String>,

    /// 采样率: 16000, 24000（默认 24000）
    #[arg(long)]
    sample_rate: Option<u32>,

    /// 语速 (0.0~2.0，默认 1.0)
    #[arg(long)]
    speed: Option<f32>,

    /// 音量 (0.0~2.0，默认 1.0)
    #[arg(long)]
    volume: Option<f32>,

    /// 语调 (0.0~2.0，默认 1.0)
    #[arg(long)]
    pitch: Option<f32>,

    /// 口语化等级: high, mid, low（仅 x4 系列发音人支持）
    #[arg(long)]
    oral_level: Option<String>,

    /// 英文发音方式: 0=自动, 1=按字母
    #[arg(long)]
    reg: Option<u32>,

    /// 数字发音方式: 0=自动, 1=数值, 2=字符串
    #[arg(long)]
    rdn: Option<u32>,

    /// 背景音: 0=关闭, 1=开启
    #[arg(long)]
    bgs: Option<u32>,
}

#[tokio::main]
async fn main() {
    dotenvy::dotenv().ok();
    let args = Args::parse();

    if args.app_id.is_empty() || args.api_key.is_empty() || args.api_secret.is_empty() {
        eprintln!("错误: 请提供 --app-id, --api-key, --api-secret");
        eprintln!("也可以设置 XFYUN_APP_ID, XFYUN_API_KEY, XFYUN_API_SECRET 环境变量");
        std::process::exit(1);
    }

    println!("\n=== Xfyun TTS - 流式合成（WebSocket 双向流）===");
    println!("文本: {}", args.text);
    println!(
        "发音人: {}",
        args.voice
            .as_deref()
            .unwrap_or("x5_lingxiaoxuan_flow(默认)")
    );
    println!("输出: {}", args.output.display());

    // 创建 Xfyun TTS 实例
    let tts = XfyunTts::new(XfyunTtsOption {
        base: BaseTtsOption {
            api_key: Some(args.api_key),
            voice: args.voice.map(Into::into),
            speed: args.speed,
            volume: args.volume,
            pitch: args.pitch,
            format: args.format,
            ..Default::default()
        },
        app_id: Some(args.app_id),
        api_secret: Some(args.api_secret),
        sample_rate: args.sample_rate,
        oral_level: args.oral_level,
        reg: args.reg,
        rdn: args.rdn,
        bgs: args.bgs,
        ..Default::default()
    });

    // 模拟流式输入：按标点切分文本
    let chunks: Vec<String> = args
        .text
        .split_inclusive(|c: char| c == '。' || c == '！' || c == '？' || c == '\n')
        .map(|s| {
            if s.trim().is_empty() {
                s.to_string()
            } else {
                s.trim().to_string()
            }
        })
        .filter(|s| !s.is_empty())
        .collect();

    println!("\n流式文本输入 (共 {} 块):", chunks.len());
    for (i, chunk) in chunks.iter().enumerate() {
        println!("  [{}/{}] {}", i + 1, chunks.len(), chunk);
    }

    // 构建文本流
    let text_stream: TextStream = Box::pin(futures_util::stream::iter(chunks.into_iter()));

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

                        if chunk_count % 5 == 0 || chunk_count == 1 {
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
