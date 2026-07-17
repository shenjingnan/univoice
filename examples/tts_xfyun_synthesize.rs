/// Xfyun TTS - 非流式语音合成示例
///
/// 通过 WebSocket 连接讯飞超拟人 TTS 服务，一次性发送文本并接收完整音频。
///
/// ## 使用方法
///
/// ```bash
/// # 使用环境变量
/// export XFYUN_APP_ID=your_app_id
/// export XFYUN_API_KEY=your_api_key
/// export XFYUN_API_SECRET=your_api_secret
/// cargo run --example tts_xfyun_synthesize -- \
///   --text "你好世界，欢迎使用语音合成服务"
///
/// # 自定义输出路径和发音人
/// cargo run --example tts_xfyun_synthesize -- \
///   --text "欢迎使用讯飞超拟人语音合成" \
///   --output speech.mp3 \
///   --voice x5_lingfeiyi_flow
///
/// # 指定命令行参数
/// cargo run --example tts_xfyun_synthesize -- \
///   --app-id your_app_id \
///   --api-key your_api_key \
///   --api-secret your_api_secret \
///   --text "你好" \
///   --output hello.mp3
/// ```
use std::path::PathBuf;

use clap::Parser;

use univoice::tts::provider::{XfyunTts, XfyunTtsOption};
use univoice::tts::{BaseTtsOption, TtsProvider, TtsRequest};

#[derive(Parser)]
#[command(name = "tts-xfyun-synthesize", about = "Xfyun TTS 非流式合成示例")]
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

    /// 待合成的文本
    #[arg(
        short,
        long,
        default_value = "你好，欢迎使用语音合成服务，今天天气真不错。"
    )]
    text: String,

    /// 输出音频文件路径
    #[arg(short, long, default_value = "output_xfyun.mp3")]
    output: PathBuf,

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

    println!("\n=== Xfyun TTS - 非流式合成 ===");
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
