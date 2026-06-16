/// MIMO ASR - 非流式识别示例
///
/// 从音频文件读取完整音频数据，通过小米 MiMo OpenAI 兼容 API 进行语音识别，
/// 一次性返回完整识别结果。
///
/// 使用方法:
/// ```bash
/// cargo run --example asr_mimo_non_stream -- \
///   --file speech.wav
/// ```
///
/// API Key 通过 .env 文件中的 XIAOMI_API_KEY 提供。
use std::path::PathBuf;
use std::time::Instant;

use clap::Parser;
use futures_util::StreamExt;

use univoice::asr::{
    AsrProvider, AudioInput, BaseProviderOption, DEFAULT_CHUNK_SIZE, MimoAsr, MimoAsrOption,
    adapt_audio_input,
};

#[derive(Parser)]
#[command(name = "asr-mimo-non-stream", about = "MIMO ASR 非流式识别示例")]
struct Args {
    /// 小米 MiMo API Key
    #[arg(long, env = "XIAOMI_API_KEY")]
    api_key: String,

    /// 音频文件路径（支持 wav, mp3, ogg 等格式）
    #[arg(short, long)]
    file: PathBuf,

    /// 模型名称（默认 mimo-v2.5-asr）
    #[arg(long)]
    model: Option<String>,

    /// API Base URL（可选）
    /// 如果提供且不含 /chat/completions 路径，会自动补全
    #[arg(long, env = "XIAOMI_BASE_URL")]
    base_url: Option<String>,

    /// 识别语言（zh/auto/en 等，默认 zh）
    #[arg(long, default_value = "zh")]
    language: String,
}

#[tokio::main]
async fn main() {
    dotenvy::dotenv().ok();
    let args = Args::parse();

    // 验证参数
    if args.api_key.is_empty() {
        eprintln!("错误: 请提供 --api-key");
        eprintln!("也可以设置 XIAOMI_API_KEY 环境变量或在 .env 文件中配置");
        std::process::exit(1);
    }

    if !args.file.exists() {
        eprintln!("错误: 音频文件不存在: {}", args.file.display());
        std::process::exit(1);
    }

    // 标准化 base_url：确保包含 /chat/completions 路径
    let full_base_url = args.base_url.map(|url| {
        if url.ends_with("/chat/completions") {
            url
        } else {
            let trimmed = url.trim_end_matches('/');
            format!("{}/chat/completions", trimmed)
        }
    });

    // 读取音频文件
    let audio_data = match std::fs::read(&args.file) {
        Ok(data) => data,
        Err(e) => {
            eprintln!("错误: 读取文件失败: {}", e);
            std::process::exit(1);
        }
    };

    println!("\n=== MIMO ASR - 非流式识别 ===");
    println!("音频文件: {}", args.file.display());
    println!("音频大小: {} 字节", audio_data.len());
    println!("语言: {}", args.language);
    println!();

    // 创建 MIMO ASR 实例
    let asr = MimoAsr::new(MimoAsrOption {
        base: BaseProviderOption {
            api_key: Some(args.api_key),
            base_url: full_base_url,
            model: args.model,
            ..Default::default()
        },
        language: Some(args.language),
    });

    // 将音频数据切分为流
    let audio_stream = adapt_audio_input(AudioInput::Data(audio_data), DEFAULT_CHUNK_SIZE);

    // 执行流式识别并收集所有结果块
    let start = Instant::now();
    let mut text_parts: Vec<String> = Vec::new();

    println!("正在识别...\n");

    match asr.listen_stream(audio_stream).await {
        Ok(mut stream) => {
            while let Some(chunk) = stream.next().await {
                match chunk {
                    Ok(chunk) => {
                        if !chunk.text.is_empty() {
                            text_parts.push(chunk.text);
                        }
                    }
                    Err(e) => {
                        eprintln!("识别错误: {}", e);
                        std::process::exit(1);
                    }
                }
            }
        }
        Err(e) => {
            eprintln!("启动识别失败: {}", e);
            std::process::exit(1);
        }
    }

    let elapsed = start.elapsed();
    let full_text: String = text_parts.join("");

    println!("=== 识别结果 ===");
    println!("耗时: {} ms", elapsed.as_millis());

    if full_text.is_empty() {
        println!("\n识别结果: (无识别结果)");
    } else {
        println!("\n识别结果: {}", full_text);
    }
}
