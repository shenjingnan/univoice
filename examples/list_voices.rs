//! 音色列表查看示例
//!
//! 展示所有已定义的 TTS 音色，无需 API Key。
//! 运行方式: cargo run --example list_voices [provider]
//!
//! 支持的 provider: doubao, glm, minimax, qwen, qwen-realtime, all (默认)
//!
//! 在 IDE 中输入 `voice_id::glm::` 可查看自动补全候选音色。

use std::env;

use univoice::tts::voice_id;

fn main() {
    let args: Vec<String> = env::args().collect();
    let filter = args.get(1).map(|s| s.as_str()).unwrap_or("all");

    match filter {
        "doubao" => print_voices("Doubao", &univoice::tts::voices::doubao::list_voices()),
        "glm" => print_voices("GLM", &univoice::tts::voices::glm::list_voices()),
        "minimax" => print_voices("Minimax", &univoice::tts::voices::minimax::list_voices()),
        "qwen" => {
            print_voices(
                "Qwen (CosyVoice v3-flash)",
                &univoice::tts::voices::qwen::list_voices_for_model(Some("cosyvoice-v3-flash")),
            );
            print_voices(
                "Qwen (CosyVoice 全部)",
                &univoice::tts::voices::qwen::list_voices(),
            );
        }
        "qwen-realtime" => print_voices(
            "Qwen Realtime",
            &univoice::tts::voices::qwen_realtime::list_voices(),
        ),
        _ => {
            println!("╔══════════════════════════════════════════════╗");
            println!("║          TTS 音色总览                        ║");
            println!("╚══════════════════════════════════════════════╝");
            println!();

            let doubao = univoice::tts::voices::doubao::list_voices();
            let glm = univoice::tts::voices::glm::list_voices();
            let minimax = univoice::tts::voices::minimax::list_voices();
            let qwen = univoice::tts::voices::qwen::list_voices();
            let qwen_rt = univoice::tts::voices::qwen_realtime::list_voices();

            println!("  Provider           | 音色数量");
            println!("  -------------------+----------");
            println!("  Doubao             | {:>8}", doubao.len());
            println!("  GLM                | {:>8}", glm.len());
            println!("  Minimax            | {:>8}", minimax.len());
            println!("  Qwen (CosyVoice)   | {:>8}", qwen.len());
            println!("  Qwen Realtime      | {:>8}", qwen_rt.len());
            println!("  -------------------+----------");
            let total = doubao.len() + glm.len() + minimax.len() + qwen.len() + qwen_rt.len();
            println!("  总计               | {:>8}", total);
            println!();

            // 显示各 provider 的默认音色
            println!("  默认音色:");
            println!(
                "    Doubao:       {}",
                univoice::tts::voices::doubao::DEFAULT_VOICE
            );
            println!(
                "    GLM:          {}",
                univoice::tts::voices::glm::DEFAULT_VOICE
            );
            println!(
                "    Minimax:      {}",
                univoice::tts::voices::minimax::DEFAULT_VOICE
            );
            println!(
                "    Qwen:         {}",
                univoice::tts::voices::qwen::DEFAULT_VOICE
            );
            println!(
                "    Qwen Realtime: {}",
                univoice::tts::voices::qwen_realtime::DEFAULT_VOICE
            );
            println!();

            println!("  提示: 指定 provider 参数可查看详细列表");
            println!("    cargo run --example list_voices doubao");
            println!("    cargo run --example list_voices minimax");
            println!();
            println!("  voice_id 常量示例（在 IDE 中输入 `voice_id::` 可查看补全）:");
            println!("    voice_id::glm::TONGTONG -> {}", voice_id::glm::TONGTONG);
            println!("    voice_id::glm::XIAOCHEN -> {}", voice_id::glm::XIAOCHEN);
            println!(
                "    voice_id::minimax::FEMALE_SHAONV -> {}",
                voice_id::minimax::FEMALE_SHAONV
            );
            println!(
                "    voice_id::qwen_realtime::SERENA -> {}",
                voice_id::qwen_realtime::SERENA
            );
            println!("    voice_id::gemini::PUCK -> {}", voice_id::gemini::PUCK);
        }
    }
}

fn print_voices(title: &str, voices: &[univoice::tts::types::TtsVoice]) {
    println!("╔══════════════════════════════════════════════╗");
    println!("║  {:<45} ║", title);
    println!("╚══════════════════════════════════════════════╝");
    println!();

    if voices.is_empty() {
        println!("  (无音色数据)");
        println!();
        return;
    }

    for (i, v) in voices.iter().enumerate() {
        println!("  {:<4} {} ({})", format!("{}.", i + 1), v.id, v.language);
    }
    println!();
    println!("  共 {} 个音色", voices.len());
    println!();
}
