/// GLM (智谱 AI) TTS - 非流式语音合成示例
///
/// 将文本合成为完整音频并保存到文件。
///
/// ## 使用方法
///
/// ```bash
/// # 使用 .env 中的 API Key（GLM_API_KEY）
/// cargo run --example tts_glm_synthesize -- \
///   --text "你好，欢迎使用智谱 GLM 语音合成" \
///   --output output_glm.wav
///
/// # 指定音色、语速、音量
/// cargo run --example tts_glm_synthesize -- \
///   --voice tongtong --speed 1.1 --volume 0.8 \
///   --text "今天天气真不错" --output hello.wav
///
/// # 显式指定 API Key
/// cargo run --example tts_glm_synthesize -- \
///   --api-key xxx --text "你好" --output hello.wav
/// ```
use std::path::PathBuf;

use clap::Parser;

use univoice::tts::provider::{GlmTts, GlmTtsOption};
use univoice::tts::voice_id;
use univoice::tts::{BaseTtsOption, TtsProvider, TtsRequest};

#[derive(Parser)]
#[command(name = "tts-glm-synthesize", about = "GLM (智谱) TTS 非流式合成示例")]
struct Args {
    /// 智谱 AI API Key（也支持 GLM_API_KEY 环境变量）
    #[arg(long, env = "GLM_API_KEY")]
    api_key: String,

    /// 待合成的文本（≤1024 字符）
    #[arg(
        short,
        long,
        default_value = "你好，欢迎使用智谱 GLM 语音合成服务，今天天气真不错。"
    )]
    text: String,

    /// 输出音频文件路径
    #[arg(short, long, default_value = "output_glm.wav")]
    output: PathBuf,

    /// 音色名称（默认 tongtong。可选值见 `voice_id::glm::*` 常量）
    #[arg(long)]
    voice: Option<String>,

    /// 模型名称（默认 glm-tts）
    #[arg(long)]
    model: Option<String>,

    /// 音频格式: wav / pcm（默认 wav）
    #[arg(long, default_value = "wav")]
    format: String,

    /// 语速倍率 (0.5~2.0，默认 1.0)
    #[arg(long)]
    speed: Option<f32>,

    /// 音量倍率 (0.0~1.0，默认 1.0；发送时映射为 GLM 的 0~10)
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

    println!("\n=== GLM (智谱) TTS - 非流式合成 ===");
    println!("文本: {}", args.text);
    println!("输出: {}", args.output.display());

    // 创建 GLM TTS 实例
    // 提示: 可用 `voice_id::glm::XIAOCHEN.into()` 等常量代替字符串
    let tts = GlmTts::new(GlmTtsOption {
        base: BaseTtsOption {
            api_key: Some(args.api_key),
            model: args.model,
            voice: args.voice.map(Into::into),
            speed: args.speed,
            volume: args.volume,
            format: Some(args.format),
            ..Default::default()
        },
        watermark_enabled: if args.watermark { Some(true) } else { None },
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

            // 保存到文件
            match std::fs::write(&args.output, &response.audio) {
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
