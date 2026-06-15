/// Qwen ASR - 流式识别示例
///
/// 从音频文件读取数据，流式发送到阿里云 DashScope Paraformer ASR 服务，
/// 实时输出中间识别结果和最终识别结果。
///
/// 使用方法:
/// ```bash
/// cargo run --example asr_qwen_stream -- \
///   --api-key YOUR_API_KEY \
///   --file speech.mp3
/// ```
use std::path::PathBuf;

use clap::Parser;
use futures_util::StreamExt;

use univoice::asr::{
    AsrProvider, AudioContainerFormat, AudioInput, BaseProviderOption, DEFAULT_CHUNK_SIZE, QwenAsr,
    QwenAsrOption, adapt_audio_input,
};

#[derive(Parser)]
#[command(name = "asr-qwen-stream", about = "Qwen ASR 流式识别示例")]
struct Args {
    /// DashScope API Key
    #[arg(long, env = "QWEN_API_KEY")]
    api_key: String,

    /// 音频文件路径（支持 mp3, wav, pcm 等格式）
    #[arg(short, long)]
    file: PathBuf,

    /// 模型名称（默认 paraformer-realtime-v2）
    #[arg(long)]
    model: Option<String>,

    /// 采样率（可选，PCM 文件建议指定，默认 16000）
    #[arg(long)]
    sample_rate: Option<u32>,

    /// 音频格式（可选，默认从文件扩展名推断: pcm/wav/mp3）
    #[arg(long)]
    format: Option<String>,
}

/// 从文件扩展名推断音频容器格式
fn detect_format(path: &PathBuf) -> AudioContainerFormat {
    match path.extension().and_then(|s| s.to_str()) {
        Some("pcm") => AudioContainerFormat::Pcm,
        Some("wav") => AudioContainerFormat::Wav,
        Some("mp3") => AudioContainerFormat::Mp3,
        _ => {
            eprintln!("提示: 无法从文件扩展名推断格式，默认使用 mp3");
            AudioContainerFormat::Mp3
        }
    }
}

#[tokio::main]
async fn main() {
    dotenvy::dotenv().ok();
    let args = Args::parse();

    // 验证参数
    if args.api_key.is_empty() {
        eprintln!("错误: 请提供 --api-key");
        eprintln!("也可以设置 QWEN_API_KEY 环境变量");
        std::process::exit(1);
    }

    if !args.file.exists() {
        eprintln!("错误: 音频文件不存在: {}", args.file.display());
        std::process::exit(1);
    }

    // 读取音频文件
    let audio_data = match std::fs::read(&args.file) {
        Ok(data) => data,
        Err(e) => {
            eprintln!("错误: 读取文件失败: {}", e);
            std::process::exit(1);
        }
    };

    // 检测音频格式
    let format = match &args.format {
        Some(f) => match f.as_str() {
            "pcm" => AudioContainerFormat::Pcm,
            "wav" => AudioContainerFormat::Wav,
            "mp3" => AudioContainerFormat::Mp3,
            _ => {
                eprintln!("错误: 不支持的格式 '{}'，支持: pcm, wav, mp3", f);
                std::process::exit(1);
            }
        },
        None => detect_format(&args.file),
    };

    // PCM 文件默认采样率 16000
    let sample_rate = args.sample_rate.or_else(|| {
        if format == AudioContainerFormat::Pcm {
            Some(16000)
        } else {
            None
        }
    });

    println!("\n=== Qwen ASR - 流式识别 ===");
    println!("音频文件: {}", args.file.display());
    println!("音频格式: {:?}", format);
    if let Some(sr) = sample_rate {
        println!("采样率: {} Hz", sr);
    }
    println!("音频大小: {} 字节\n", audio_data.len());

    // 创建 Qwen ASR 实例
    let asr = QwenAsr::new(QwenAsrOption {
        base: BaseProviderOption {
            api_key: Some(args.api_key),
            model: args.model,
            format: Some(format),
            ..Default::default()
        },
        sample_rate,
        ..Default::default()
    });

    // 将音频数据切分为流
    let audio_stream = adapt_audio_input(AudioInput::Data(audio_data), DEFAULT_CHUNK_SIZE);

    // 执行流式识别
    let start = std::time::Instant::now();
    let mut first_result_time = None;
    let mut chunk_count = 0;
    let mut results: Vec<String> = Vec::new();

    println!("开始流式识别...\n");

    match asr.listen_stream(audio_stream).await {
        Ok(mut stream) => {
            while let Some(chunk) = stream.next().await {
                match chunk {
                    Ok(chunk) => {
                        chunk_count += 1;

                        if first_result_time.is_none() {
                            first_result_time = Some(start.elapsed());
                            println!("[首字延迟] {} ms\n", first_result_time.unwrap().as_millis());
                        }

                        let status = if chunk.is_final { "最终" } else { "中间" };
                        let text = if chunk.text.is_empty() {
                            "(空)"
                        } else {
                            &chunk.text
                        };
                        println!("[{}] {}: {}", status, chunk_count, text);

                        if chunk.is_final && !chunk.text.is_empty() {
                            results.push(chunk.text);
                        }
                    }
                    Err(e) => {
                        eprintln!("识别错误: {}", e);
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

    println!("\n=== 统计信息 ===");
    println!("总耗时: {} ms", elapsed.as_millis());
    if let Some(first) = first_result_time {
        println!("首字延迟: {} ms", first.as_millis());
    }
    println!("结果块数: {}", chunk_count);
    println!("\n完整识别结果: {}", results.join(""));
}
