/// GLM ASR - 流式识别示例
///
/// 从音频文件读取数据，发送到智谱 AI GLM ASR HTTP REST API，
/// 通过 SSE (Server-Sent Events) 实时输出中间识别结果和最终识别结果。
///
/// 使用方法:
/// ```bash
/// cargo run --example asr_glm_stream -- \
///   --api-key YOUR_API_KEY \
///   --file speech.mp3
/// ```
use std::path::PathBuf;

use clap::Parser;
use futures_util::StreamExt;

use univoice::asr::{
    AsrProvider, AudioInput, BaseProviderOption, DEFAULT_CHUNK_SIZE, GlmAsr, GlmAsrOption,
    adapt_audio_input,
};

#[derive(Parser)]
#[command(name = "asr-glm-stream", about = "GLM ASR 流式识别示例")]
struct Args {
    /// 智谱 AI API Key
    #[arg(long, env = "GLM_API_KEY")]
    api_key: String,

    /// 音频文件路径（支持 .wav, .mp3，最大 25MB）
    #[arg(short, long)]
    file: PathBuf,

    /// 模型名称（默认 glm-asr-2512）
    #[arg(long)]
    model: Option<String>,

    /// 热词列表（逗号分隔）
    #[arg(long)]
    hotwords: Option<String>,

    /// 上下文文本
    #[arg(long)]
    context: Option<String>,
}

#[tokio::main]
async fn main() {
    dotenvy::dotenv().ok();
    let args = Args::parse();

    // 验证参数
    if args.api_key.is_empty() {
        eprintln!("错误: 请提供 --api-key");
        eprintln!("也可以设置 GLM_API_KEY 环境变量");
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

    // 解析热词
    let hotwords = args.hotwords.map(|hw| {
        hw.split(',')
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .collect()
    });

    println!("\n=== GLM ASR - 流式识别 ===");
    println!("音频文件: {}", args.file.display());
    println!("音频大小: {} 字节\n", audio_data.len());

    // 创建 GLM ASR 实例
    let asr = GlmAsr::new(GlmAsrOption {
        base: BaseProviderOption {
            api_key: Some(args.api_key),
            model: args.model,
            ..Default::default()
        },
        hotwords,
        context: args.context,
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
