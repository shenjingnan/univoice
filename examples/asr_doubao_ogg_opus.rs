/// Doubao ASR - 流式入/流式出示例（Ogg Opus 格式）
///
/// 使用 Ogg Opus 格式直接流式输入 ASR，无需本地解码为 PCM。
/// 裸 Opus 数据包通过 OggMuxer 封装为 OGG 流后直接发送。
///
/// 特点:
/// - 设置 format=ogg, codec=opus，告诉服务端直接接收 OGG Opus 格式
/// - 使用 OggMuxer 将裸 Opus 帧封装为 OGG 页面流
/// - 无需本地 PCM 解码，传输压缩数据，带宽更优
///
/// 使用方法:
/// ```bash
/// cargo run --example asr_doubao_ogg_opus -- \
///   --app-key YOUR_APP_KEY \
///   --access-key YOUR_ACCESS_KEY
/// ```
///
/// 环境变量:
/// - DOUBAO_APP_KEY: 火山引擎 App Key
/// - DOUBAO_ACCESS_TOKEN: 火山引擎 Access Key
use std::path::PathBuf;
use std::time::Instant;

use clap::Parser;
use futures_util::StreamExt;

use univoice::asr::utils::{OggMuxer, OggMuxerOptions};
use univoice::asr::{
    AsrProvider, AudioCodecFormat, AudioContainerFormat, BaseProviderOption, DoubaoAsr,
    DoubaoAsrMode, DoubaoAsrOption,
};

// ============================================
// 命令行参数
// ============================================

#[derive(Parser)]
#[command(
    name = "asr-doubao-ogg-opus",
    about = "Doubao ASR OGG Opus 流式识别示例"
)]
struct Args {
    #[arg(long, env = "DOUBAO_APP_KEY")]
    app_key: String,

    #[arg(long, env = "DOUBAO_ACCESS_TOKEN")]
    access_key: String,

    /// Opus 数据包目录（默认 examples/assets/16khz_opus_60ms_opus-packets）
    #[arg(long)]
    opus_dir: Option<PathBuf>,
}

// ============================================
// 辅助函数
// ============================================

/// 从目录读取 Opus 数据包，按文件名数字排序
fn read_opus_packets(dir: &std::path::Path) -> Result<Vec<(String, Vec<u8>)>, String> {
    let mut entries: Vec<_> = std::fs::read_dir(dir)
        .map_err(|e| format!("无法读取目录 {}: {}", dir.display(), e))?
        .filter_map(|entry| entry.ok())
        .filter(|entry| {
            entry
                .path()
                .extension()
                .map(|ext| ext == "opus")
                .unwrap_or(false)
        })
        .collect();

    // 按文件名数字排序
    entries.sort_by(|a, b| {
        let a_name = a.file_name().to_string_lossy().to_string();
        let b_name = b.file_name().to_string_lossy().to_string();
        numeric_sort_key(&a_name).cmp(&numeric_sort_key(&b_name))
    });

    let mut packets = Vec::new();
    for entry in entries {
        let data = std::fs::read(entry.path())
            .map_err(|e| format!("读取文件失败 {}: {}", entry.path().display(), e))?;
        packets.push((entry.file_name().to_string_lossy().to_string(), data));
    }

    if packets.is_empty() {
        return Err(format!("目录中没有 .opus 文件: {}", dir.display()));
    }

    Ok(packets)
}

/// 提取文件名中的数字用于排序
fn numeric_sort_key(filename: &str) -> usize {
    filename
        .chars()
        .filter(|c| c.is_ascii_digit())
        .collect::<String>()
        .parse::<usize>()
        .unwrap_or(0)
}

// ============================================
// 主函数
// ============================================

#[tokio::main]
async fn main() {
    dotenvy::dotenv().ok();
    let args = Args::parse();

    if args.app_key.is_empty() || args.access_key.is_empty() {
        eprintln!("错误: 请提供 --app-key 和 --access-key");
        eprintln!("也可以设置 DOUBAO_APP_KEY 和 DOUBAO_ACCESS_TOKEN 环境变量");
        std::process::exit(1);
    }

    // 确定 Opus 数据包目录
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let opus_dir = args
        .opus_dir
        .unwrap_or_else(|| manifest_dir.join("examples/assets/16khz_opus_60ms_opus-packets"));

    if !opus_dir.exists() {
        eprintln!("错误: Opus 数据包目录不存在: {}", opus_dir.display());
        eprintln!("提示: 可用目录:");
        eprintln!("  - examples/assets/16khz_opus_60ms_opus-packets/");
        eprintln!("  - examples/assets/16khz_16bit_1channel/");
        std::process::exit(1);
    }

    // 读取 Opus 数据包
    let opus_packets = match read_opus_packets(&opus_dir) {
        Ok(packets) => packets,
        Err(e) => {
            eprintln!("错误: 读取 Opus 数据包失败: {}", e);
            std::process::exit(1);
        }
    };

    println!();
    println!("=== Doubao ASR - 流式入/流式出（Ogg Opus 格式）===");
    println!("场景: Opus 数据包 → Ogg Muxer → OGG 流 → ASR");
    println!();
    println!("数据包目录: {}", opus_dir.display());
    println!("Opus 包数量: {}", opus_packets.len());
    println!();

    // ---------------------------------------------------------------
    // 阶段 1: 创建 ASR 实例（使用 OGG/Opus 格式）
    // ---------------------------------------------------------------
    let asr = DoubaoAsr::new(DoubaoAsrOption {
        base: BaseProviderOption {
            language: Some("zh-CN".into()),
            format: Some(AudioContainerFormat::Ogg),
            codec: Some(AudioCodecFormat::Opus),
            ..Default::default()
        },
        app_key: Some(args.app_key),
        access_key: Some(args.access_key),
        mode: DoubaoAsrMode::Streaming,
        sample_rate: 16000,
        bits: 16,
        channel: 1,
        ..Default::default()
    });

    println!("[ASR 实例已创建] provider=doubao, format=ogg, codec=opus");

    // ---------------------------------------------------------------
    // 阶段 2: 将 Opus 数据包封装为 OGG 流
    // ---------------------------------------------------------------
    let mut muxer = OggMuxer::new(OggMuxerOptions {
        sample_rate: 16000,
        channels: 1,
        frame_size_ms: 60,
    });

    let ogg_pages: Vec<Vec<u8>> = {
        let mut pages = Vec::new();
        for (_name, packet) in &opus_packets {
            let new_pages = muxer.push_packet(packet);
            pages.extend(new_pages);
        }
        pages
    };

    println!(
        "[OGG 流已构建] {} 个 Opus 包 → {} 个 OGG 页面",
        opus_packets.len(),
        ogg_pages.len()
    );
    println!();

    // ---------------------------------------------------------------
    // 阶段 3: 流式识别
    // ---------------------------------------------------------------
    let start = Instant::now();
    let mut first_result_time: Option<u64> = None;
    let mut chunk_count = 0;
    let mut results: Vec<String> = Vec::new();

    // 创建 OGG 音频流
    let ogg_stream = futures_util::stream::iter(ogg_pages);
    let audio_stream: univoice::asr::AudioStream = Box::pin(ogg_stream);

    println!("[开始流式识别...]\n");

    match asr.listen_stream(audio_stream).await {
        Ok(mut stream) => {
            while let Some(chunk) = stream.next().await {
                match chunk {
                    Ok(chunk) => {
                        chunk_count += 1;
                        let now = start.elapsed().as_millis() as u64;

                        if first_result_time.is_none() {
                            first_result_time = Some(now);
                            println!("[首字延迟] {} ms\n", now);
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
            eprintln!("错误: 启动识别失败: {}", e);
            std::process::exit(1);
        }
    }

    let elapsed = start.elapsed().as_millis() as u64;

    // ---------------------------------------------------------------
    // 阶段 4: 输出统计信息
    // ---------------------------------------------------------------
    println!();
    println!("=== 统计信息 ===");
    println!("总耗时: {} ms", elapsed);
    if let Some(first) = first_result_time {
        println!("首字延迟: {} ms", first);
    }
    println!("结果块数: {}", chunk_count);
    println!();
    let joined = results.join("");
    println!(
        "完整识别结果: {}",
        if joined.is_empty() { "(无)" } else { &joined }
    );
}
