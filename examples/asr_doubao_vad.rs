/// Doubao ASR - 流式端点检测示例（VAD / End-of-Speech）
///
/// 核心演示内容：
/// 1. 从目录读取 Opus 数据包，使用 OpusDecoder 解码为 PCM 流
/// 2. 展示 ASR 实时返回中间识别结果
/// 3. 【重点】展示 VAD 端点检测：ASR 判断用户说完话后返回 isFinal=true，
///    并附带 segment 信息（含 start_time 和 end_time 时间戳）
///
/// 使用方法:
/// ```bash
/// cargo run --features opus-decoder --example asr_doubao_vad -- \
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

use univoice::asr::utils::{OpusDecodeOptions, OpusDecoder};
use univoice::asr::{
    AsrProvider, AsrStreamChunk, BaseProviderOption, DoubaoAsr, DoubaoAsrMode, DoubaoAsrOption,
};

// ============================================
// 命令行参数
// ============================================

#[derive(Parser)]
#[command(name = "asr-doubao-vad", about = "Doubao ASR 流式端点检测（VAD）")]
struct Args {
    #[arg(long, env = "DOUBAO_APP_KEY")]
    app_key: String,

    #[arg(long, env = "DOUBAO_ACCESS_TOKEN")]
    access_key: String,

    /// Opus 数据包目录（默认 examples/assets/16khz_16bit_1channel）
    #[arg(long)]
    opus_dir: Option<PathBuf>,
}

// ============================================
// 辅助函数
// ============================================

/// 格式化时间为秒
fn format_time(ms: u64) -> String {
    format!("{:.2}s", ms as f64 / 1000.0)
}

/// 格式化分隔线
fn separator(char: &str, width: usize) -> String {
    char.repeat(width)
}

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

/// 提取文件名中的数字用于排序（例如 "01.opus" → 1, "12.opus" → 12）
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
        .unwrap_or_else(|| manifest_dir.join("examples/assets/16khz_16bit_1channel"));

    if !opus_dir.exists() {
        eprintln!("错误: Opus 数据包目录不存在: {}", opus_dir.display());
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
    println!("{}", separator("=", 60));
    println!("  Doubao ASR - 流式端点检测演示（VAD / End-of-Speech）");
    println!("{}", separator("=", 60));
    println!();
    println!("音频源: {}", opus_dir.display());
    println!("Opus 数据包数: {}", opus_packets.len());
    println!("格式: Opus → PCM (OpusDecoder), 16kHz, 单声道");
    println!();

    // ---------------------------------------------------------------
    // 阶段 1: 创建 ASR 实例（开启 VAD 端点检测）
    // ---------------------------------------------------------------
    let asr = DoubaoAsr::new(DoubaoAsrOption {
        base: BaseProviderOption {
            language: Some("zh-CN".into()),
            ..Default::default()
        },
        app_key: Some(args.app_key),
        access_key: Some(args.access_key),
        mode: DoubaoAsrMode::Streaming,
        sample_rate: 16000,
        bits: 16,
        channel: 1,
        // 开启 VAD 端点检测：静音 800ms 后自动判停
        end_window_size: Some(800),
        ..Default::default()
    });

    println!("[ASR 实例已创建] provider=doubao, VAD endWindowSize=800ms");

    // ---------------------------------------------------------------
    // 阶段 2: 将 Opus 数据包解码为 PCM 音频流
    // ---------------------------------------------------------------
    let decoder = match OpusDecoder::new(OpusDecodeOptions {
        sample_rate: 16000,
        channels: 1,
        frame_size_ms: 60,
    }) {
        Ok(d) => d,
        Err(e) => {
            eprintln!("错误: 创建 Opus 解码器失败: {}", e);
            std::process::exit(1);
        }
    };

    let pcm_chunks: Vec<Vec<u8>> = {
        let mut dec = decoder;
        let mut chunks = Vec::with_capacity(opus_packets.len());
        for (_name, packet) in &opus_packets {
            match dec.decode_packet(packet) {
                Ok(pcm) => {
                    let bytes: Vec<u8> = pcm.iter().flat_map(|s| s.to_le_bytes()).collect();
                    chunks.push(bytes);
                }
                Err(e) => {
                    eprintln!("警告: Opus 解码失败 ({}): {}", _name, e);
                }
            }
        }
        chunks
    };

    println!(
        "[音频流已构建] Opus → PCM, 16kHz, {} 个 PCM 块",
        pcm_chunks.len()
    );
    println!();

    // ---------------------------------------------------------------
    // 阶段 3: 流式识别 + 端点检测
    // ---------------------------------------------------------------
    let start = Instant::now();
    let mut first_result_time: Option<u64> = None;
    let mut chunk_count = 0;
    let mut intermediate_count = 0;
    let mut final_result_time: Option<u64> = None;
    let mut vad_endpoint_triggered = false;
    let mut results: Vec<AsrStreamChunk> = Vec::new();

    // 创建 PCM 音频流
    let pcm_stream = futures_util::stream::iter(pcm_chunks);
    let audio_stream = Box::pin(pcm_stream) as _;

    println!("[开始流式识别...]");
    println!("{}", separator("-", 60));
    println!();

    match asr.listen_stream(audio_stream).await {
        Ok(mut stream) => {
            while let Some(chunk) = stream.next().await {
                match chunk {
                    Ok(chunk) => {
                        chunk_count += 1;
                        let now = start.elapsed().as_millis() as u64;

                        if first_result_time.is_none() {
                            first_result_time = Some(now);
                            println!("[时延] [首字延迟] {} ms", now);
                            println!("{}", separator("-", 60));
                            println!();
                        }

                        // 检测 VAD 端点（segment confidence = 1 表示 definite utterance）
                        let is_vad_endpoint = chunk
                            .segment
                            .as_ref()
                            .and_then(|s| s.confidence)
                            .map(|c| c >= 0.99)
                            .unwrap_or(false);

                        if is_vad_endpoint || chunk.is_final {
                            // ===== VAD 判停 / 最终结果 =====
                            final_result_time = Some(now);

                            // 收到首个 VAD 端点后跳过后续重复
                            if vad_endpoint_triggered {
                                break;
                            }
                            vad_endpoint_triggered = true;

                            let label = if is_vad_endpoint && !chunk.is_final {
                                "[VAD] ★★★ [VAD 端点触发 / definite] ★★★"
                            } else {
                                "[VAD] ★★★ [最终结果 / VAD 端点触发] ★★★"
                            };
                            println!("{}", label);
                            println!("[VAD] 识别文本: \"{}\"", chunk.text);

                            if let Some(ref seg) = chunk.segment {
                                let duration = seg.end - seg.start;
                                let confidence_pct = seg
                                    .confidence
                                    .map(|c| format!("{:.0}%", c * 100.0))
                                    .unwrap_or_else(|| "N/A".into());

                                println!();
                                println!("[VAD]   ├─ 语音分段信息:");
                                println!("[VAD]   │  ├─ 文本: \"{}\"", seg.text);
                                println!(
                                    "[VAD]   │  ├─ 时间范围: [{}ms - {}ms] ({} - {})",
                                    seg.start,
                                    seg.end,
                                    format_time(seg.start as u64),
                                    format_time(seg.end as u64)
                                );
                                println!(
                                    "[VAD]   │  ├─ 语音时长: {}ms ({})",
                                    duration,
                                    format_time(duration as u64)
                                );
                                println!("[VAD]   │  └─ 置信度: {}", confidence_pct);
                                println!("[VAD]   │");
                                println!("[VAD]   └─ VAD 检测结论:");
                                println!("[VAD]      ├─ ASR 判断用户已停止说话");
                                println!(
                                    "[VAD]      └─ 语音结束位置: 第 {} 处",
                                    format_time(seg.end as u64)
                                );
                            }

                            println!();
                            results.push(chunk);
                        } else {
                            // ===== 中间结果 =====
                            intermediate_count += 1;
                            println!(
                                "[中间] [中间结果 #{}] \"{}\"",
                                intermediate_count, chunk.text
                            );
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
    // 阶段 4: 输出统计摘要
    // ---------------------------------------------------------------
    println!("{}", separator("=", 60));
    println!("[统计] === 端点检测统计摘要 ===");
    println!("{}", separator("-", 60));
    println!(
        "  总耗时:           {} ms ({})",
        elapsed,
        format_time(elapsed)
    );
    println!(
        "  首字延迟:         {} ms ({})",
        first_result_time.unwrap_or(0),
        format_time(first_result_time.unwrap_or(0))
    );
    println!(
        "  端点检测时刻:     +{} ms 自识别开始 ({})",
        final_result_time.unwrap_or(0),
        format_time(final_result_time.unwrap_or(0))
    );
    println!("  总接收结果块数:   {}", chunk_count);
    println!("    - 中间结果:     {} 块", intermediate_count);
    println!(
        "    - 最终结果:     {} 块 (VAD 触发)",
        chunk_count - intermediate_count
    );
    println!("{}", separator("-", 60));

    if !results.is_empty() {
        println!();
        println!("  完整识别结果:");
        for (i, r) in results.iter().enumerate() {
            println!("    [{}] \"{}\"", i + 1, r.text);
            if let Some(ref seg) = r.segment {
                let confidence_pct = seg
                    .confidence
                    .map(|c| format!("{:.0}%", c * 100.0))
                    .unwrap_or_else(|| "N/A".into());
                println!(
                    "         时段: [{}ms - {}ms], 置信度: {}",
                    seg.start, seg.end, confidence_pct
                );
            }
        }
    } else {
        println!();
        println!("  完整识别结果: (无)");
    }

    println!("{}", separator("=", 60));
    println!();
}
