//! Benchmark 主调度器
//!
//! 协调 TTS/ASR 测试的执行流程，处理 CLI 参数分发。

use crate::benchmark::asr::run_asr_test;
use crate::benchmark::cli::CliArgs;
use crate::benchmark::fixtures::{find_available_audio, get_default_text};
use crate::benchmark::provider_factory::{resolve_asr_providers, resolve_tts_providers};
use crate::benchmark::result::{generate_mock_result, save_result};

/// 运行 Benchmark
pub async fn run_benchmark(args: &CliArgs) -> Result<(), Box<dyn std::error::Error>> {
    let output_dir = std::path::Path::new(&args.output);
    let text = get_default_text();

    // ====== Matrix 场景模式 ======
    if args.is_matrix_scenario() {
        return run_matrix_scenario_mode(args, text, output_dir).await;
    }

    if args.dry_run {
        return run_dry_run(args, output_dir).await;
    }

    let mut total_tts = 0u32;
    let mut total_asr = 0u32;
    let mut success_tts = 0u32;
    let mut success_asr = 0u32;

    // ====== TTS 测试 ======
    if args.test_type == "tts" || args.test_type == "all" {
        let providers = resolve_tts_providers(&args.provider);
        if providers.is_empty() {
            println!("⚠️  没有匹配的 TTS Provider，跳过 TTS 测试");
        } else {
            println!("📝 开始 TTS 性能测试...\n");

            for provider in &providers {
                let model = std::env::var(format!("{}_MODEL", provider.to_uppercase()))
                    .unwrap_or_else(|_| match provider.as_str() {
                        "qwen" => "cosyvoice-v1".to_string(),
                        "qwen-realtime" => "qwen3-tts-flash-realtime".to_string(),
                        "doubao" => "default".to_string(),
                        "openai" => "tts-1".to_string(),
                        "gemini" => "gemini-2.0-flash-001".to_string(),
                        "glm" => "glm-4-voice".to_string(),
                        "minimax" => "minimax-tts".to_string(),
                        "xfyun" => "default".to_string(),
                        _ => "default".to_string(),
                    });

                let voice = std::env::var(format!("{}_VOICE", provider.to_uppercase()))
                    .unwrap_or_else(|_| match provider.as_str() {
                        "qwen" => "longxiaochun".to_string(),
                        "qwen-realtime" => "Cherry".to_string(),
                        "doubao" => "zh_female_tianmeixiaoyuan_moon_bigtts".to_string(),
                        "openai" => "alloy".to_string(),
                        "gemini" => "Zephyr".to_string(),
                        "glm" => "tongtong".to_string(),
                        "minimax" => "male-qn-qingse".to_string(),
                        "xfyun" => "x5_lingxiaoxuan_flow".to_string(),
                        _ => "default".to_string(),
                    });

                let format = std::env::var(format!("{}_FORMAT", provider.to_uppercase()))
                    .unwrap_or_else(|_| "mp3".to_string());

                println!(
                    "  ▶ Provider: {} (model={}, voice={}, format={})",
                    provider, model, voice, format
                );

                match crate::benchmark::tts::run_tts_synthesize(
                    provider,
                    &model,
                    &voice,
                    &format,
                    text,
                    args.iterations,
                    args.timeout,
                )
                .await
                {
                    Ok(results) => {
                        for result in &results {
                            if let Err(e) = save_result(result, output_dir).await {
                                eprintln!("    ⚠️  保存结果失败: {}", e);
                            }
                            if result.status == "success" {
                                success_tts += 1;
                            } else {
                                if let Some(ref err) = result.error {
                                    eprintln!("    ⚠️  测试失败: {}", err);
                                }
                            }
                        }
                        total_tts += results.len() as u32;
                        println!(
                            "    ✓ 完成 ({} 次迭代, {} 成功)",
                            results.len(),
                            results.iter().filter(|r| r.status == "success").count()
                        );
                    }
                    Err(e) => {
                        eprintln!("    ✗ Provider '{}' 创建失败: {}", provider, e);
                    }
                }
            }
            println!();
        }
    }

    // ====== ASR 测试 ======
    if args.test_type == "asr" || args.test_type == "all" {
        let providers = resolve_asr_providers(&args.provider);
        if providers.is_empty() {
            println!("⚠️  没有匹配的 ASR Provider，跳过 ASR 测试");
        } else {
            println!("🎤 开始 ASR 性能测试...\n");

            // 查找音频文件
            let audio = match find_available_audio() {
                Some(a) => a,
                None => {
                    println!(
                        "⚠️  没有找到音频文件，请确保 benchmark/fixtures/audio/ 目录下有音频文件"
                    );
                    println!(
                        "   提示: 可运行 pnpm benchmark:generate-audio 或手动复制音频文件到该目录"
                    );
                    return Ok(());
                }
            };

            let audio_path = std::path::Path::new(&audio.path);
            println!(
                "  📁 音频文件: {} ({}s, {})",
                audio.name, audio.duration, audio.format
            );

            for provider in &providers {
                let model = std::env::var(format!("{}_ASR_MODEL", provider.to_uppercase()))
                    .or_else(|_| std::env::var(format!("{}_MODEL", provider.to_uppercase())))
                    .unwrap_or_else(|_| match provider.as_str() {
                        "qwen" => "paraformer-realtime-v2".to_string(),
                        "doubao" => "default".to_string(),
                        "glm" => "glm-4-voice".to_string(),
                        "mimo" => "default".to_string(),
                        "xfyun" => "default".to_string(),
                        _ => "default".to_string(),
                    });

                println!("  ▶ Provider: {} (model={})", provider, model);

                match run_asr_test(
                    provider,
                    &model,
                    audio_path,
                    audio.duration,
                    &audio.format,
                    audio.expected_text.as_deref(),
                    args.iterations,
                    args.timeout,
                )
                .await
                {
                    Ok(results) => {
                        for result in &results {
                            if let Err(e) = save_result(result, output_dir).await {
                                eprintln!("    ⚠️  保存结果失败: {}", e);
                            }
                            if result.status == "success" {
                                success_asr += 1;
                            } else {
                                if let Some(ref err) = result.error {
                                    eprintln!("    ⚠️  测试失败: {}", err);
                                }
                            }
                        }
                        total_asr += results.len() as u32;
                        println!(
                            "    ✓ 完成 ({} 次迭代, {} 成功)",
                            results.len(),
                            results.iter().filter(|r| r.status == "success").count()
                        );
                    }
                    Err(e) => {
                        eprintln!("    ✗ Provider '{}' 创建失败: {}", provider, e);
                    }
                }
            }
            println!();
        }
    }

    // ====== 汇总 ======
    println!("========================================");
    println!("✅ Benchmark 完成!");
    if total_tts > 0 {
        println!("   TTS: {}/{} 成功", success_tts, total_tts);
    }
    if total_asr > 0 {
        println!("   ASR: {}/{} 成功", success_asr, total_asr);
    }
    println!("   结果目录: {}", output_dir.display());

    Ok(())
}

/// 模拟运行模式
async fn run_dry_run(
    args: &CliArgs,
    output_dir: &std::path::Path,
) -> Result<(), Box<dyn std::error::Error>> {
    println!("📋 Dry-run 模式: 生成模拟数据\n");

    let providers = if args.provider.is_empty() {
        vec![
            "qwen".to_string(),
            "doubao".to_string(),
            "openai".to_string(),
        ]
    } else {
        resolve_tts_providers(&args.provider)
    };

    let mut count = 0u32;
    for provider in &providers {
        for i in 1..=args.iterations {
            let result = generate_mock_result(provider, "tts", i);
            save_result(&result, output_dir).await?;
            count += 1;

            let result = generate_mock_result(provider, "asr", i);
            save_result(&result, output_dir).await?;
            count += 1;
        }
    }

    println!("✅ Dry-run 完成! 已生成 {} 条模拟结果", count);
    println!("   保存到: {}", output_dir.display());

    Ok(())
}

// ============================== Matrix 场景模式 ==============================

/// 运行 Matrix 场景测试
async fn run_matrix_scenario_mode(
    args: &CliArgs,
    text: &str,
    output_dir: &std::path::Path,
) -> Result<(), Box<dyn std::error::Error>> {
    use crate::benchmark::matrix::runner as matrix_runner;
    use crate::benchmark::matrix::types::MatrixRunOptions;

    let scenario = args.scenario.as_deref().unwrap_or("all-matrix");
    let matrix_filter = args.parse_matrix_filter();

    // 检查是否是 ASR 矩阵
    let is_asr = scenario.ends_with("-asr-matrix");

    if is_asr {
        // ASR 矩阵
        let provider_name = scenario.strip_suffix("-asr-matrix");
        let audio = match find_available_audio() {
            Some(a) => a,
            None => {
                println!("⚠️  没有找到音频文件");
                return Ok(());
            }
        };
        let _audio_path = std::path::Path::new(&audio.path);

        println!("🎤 ASR 矩阵测试: {}", scenario);
        if let Some(ref filter) = matrix_filter {
            print_matrix_filter(filter);
        }
        println!();

        let asr_filter = args.parse_asr_matrix_filter();
        let options = crate::benchmark::matrix::types::ASRMatrixRunOptions {
            iterations: args.iterations,
            interval_ms: 1000,
            filter: asr_filter,
            timeout_secs: args.timeout,
        };

        let results =
            crate::benchmark::matrix::asr::run_asr_matrix_scenario(provider_name, &audio, &options)
                .await;

        let count = results.len();
        for result in &results {
            save_result(result, output_dir).await?;
        }
        println!("✅ ASR 矩阵测试完成! 共 {} 次测试", count);
    } else {
        // TTS 矩阵
        let provider_name = scenario.strip_suffix("-matrix").filter(|s| *s != "all");
        if provider_name.is_some() && scenario != "all-matrix" && scenario != provider_name.unwrap()
        {
            // valid specific scenario
        }

        println!("📊 TTS 矩阵测试: {}", scenario);
        if let Some(ref filter) = matrix_filter {
            print_matrix_filter(filter);
        }
        println!();

        let options = MatrixRunOptions {
            iterations: args.iterations,
            interval_ms: 1000,
            filter: matrix_filter,
            timeout_secs: args.timeout,
        };

        let results = matrix_runner::run_matrix_scenario(provider_name, text, &options).await;

        let count = results.len();
        for result in &results {
            save_result(result, output_dir).await?;
        }
        println!("✅ TTS 矩阵测试完成! 共 {} 次测试", count);
    }

    // 自动生成报告
    println!("\n📊 正在生成报告...");
    run_analyze(output_dir).await?;

    Ok(())
}

/// 打印矩阵过滤条件
fn print_matrix_filter(filter: &crate::benchmark::matrix::types::MatrixFilter) {
    if let Some(ref models) = filter.model {
        println!("   模型过滤: {}", models.join(", "));
    }
    if let Some(ref voices) = filter.voice {
        println!("   音色过滤: {}", voices.join(", "));
    }
    if let Some(ref formats) = filter.format {
        println!("   格式过滤: {}", formats.join(", "));
    }
    if let Some(ref rates) = filter.sample_rate {
        println!(
            "   采样率过滤: {}",
            rates
                .iter()
                .map(|r| r.to_string())
                .collect::<Vec<_>>()
                .join(", ")
        );
    }
}

// ============================== 分析模式 ==============================

/// 分析已有结果并生成报告
pub async fn run_analyze(output_dir: &std::path::Path) -> Result<(), Box<dyn std::error::Error>> {
    use crate::benchmark::aggregator::aggregate_by_scenario;
    use crate::benchmark::report::generate_markdown_report;

    // 从结果目录扫描加载 JSON
    let runs_dir = output_dir.join("runs");
    if !runs_dir.exists() {
        println!("⚠️  没有找到结果目录: {}", runs_dir.display());
        return Ok(());
    }

    let mut all_results = Vec::new();
    scan_results(&runs_dir, &mut all_results)?;

    if all_results.is_empty() {
        println!("⚠️  没有找到测试结果");
        return Ok(());
    }

    println!("  已加载 {} 条测试结果", all_results.len());

    // 分组聚合
    let tts_results: Vec<_> = all_results
        .iter()
        .filter(|r| r.test_type == "tts")
        .cloned()
        .collect();
    let asr_results: Vec<_> = all_results
        .iter()
        .filter(|r| r.test_type == "asr")
        .cloned()
        .collect();

    let tts_summaries = aggregate_by_scenario(&tts_results);
    let asr_summaries = aggregate_by_scenario(&asr_results);

    println!(
        "  TTS: {} 个场景, ASR: {} 个场景",
        tts_summaries.len(),
        asr_summaries.len()
    );

    // 生成 Markdown 报告
    let report = generate_markdown_report(&tts_summaries, &asr_summaries, None);

    // 保存到 latest 目录
    let latest_dir = output_dir.join("latest");
    std::fs::create_dir_all(&latest_dir)?;

    let md_path = latest_dir.join("benchmark.md");
    std::fs::write(&md_path, &report)?;
    println!("  ✓ 报告已保存: {}", md_path.display());

    // 尝试同步到 README.md
    let readme_path = "README.md";
    if std::path::Path::new(readme_path).exists() {
        match crate::benchmark::report::sync_to_readme(&report, readme_path) {
            Ok(_) => {}
            Err(e) => println!("  ⚠️  README 同步跳过: {}", e),
        }
    }

    // 尝试同步到 docs
    let docs_path = "docs/content/benchmark.mdx";
    if std::path::Path::new(docs_path).exists() {
        match crate::benchmark::report::sync_to_docs(&report, docs_path) {
            Ok(_) => {}
            Err(e) => println!("  ⚠️  docs 同步跳过: {}", e),
        }
    }

    println!("\n✅ 分析完成!");
    Ok(())
}

/// 递归扫描结果目录加载 JSON 文件
fn scan_results(
    dir: &std::path::Path,
    results: &mut Vec<crate::benchmark::types::SingleTestResult>,
) -> Result<(), Box<dyn std::error::Error>> {
    if !dir.is_dir() {
        return Ok(());
    }

    for entry in std::fs::read_dir(dir)? {
        let entry = entry?;
        let path = entry.path();

        if path.is_dir() {
            scan_results(&path, results)?;
        } else if path.extension().and_then(|s| s.to_str()) == Some("json") {
            // Skip benchmark.json/latest
            if path
                .parent()
                .and_then(|p| p.file_name())
                .and_then(|s| s.to_str())
                == Some("latest")
            {
                continue;
            }
            if let Ok(content) = std::fs::read_to_string(&path) {
                if let Ok(result) =
                    serde_json::from_str::<crate::benchmark::types::SingleTestResult>(&content)
                {
                    results.push(result);
                }
            }
        }
    }

    Ok(())
}
