//! 测试夹具（Test Fixtures）
//!
//! 定义 TTS/ASR 测试使用的文本和音频数据。

use crate::benchmark::types::TextFixture;

// ============================== 文本夹具 ==============================

/// 文本测试数据集合
pub const TEXT_FIXTURES: &[TextFixture] = &[TextFixture {
    name: "intro-paragraph",
    text: "欢迎来到杭州！我是您的智能导游。杭州是一座有着两千多年历史的古城，曾是南宋都城，如今是现代与古典完美交融的东方名城。西湖、灵隐寺、龙井茶园，处处皆是风景。让我们一起开启这段美妙的杭州之旅吧！",
    category: "medium",
}];

/// 获取第一个可用的文本夹具（用于 TTS 测试）
pub fn get_default_text() -> &'static str {
    TEXT_FIXTURES
        .first()
        .map(|f| f.text)
        .unwrap_or("你好，欢迎使用 Univoice！")
}

// ============================== 音频夹具 ==============================

/// 原始音频配置（const 友好）
struct RawAudioFixture {
    name: &'static str,
    path: &'static str,
    duration: f64,
    format: &'static str,
    expected_text: Option<&'static str>,
}

/// 音频测试数据配置
const RAW_AUDIO_FIXTURES: &[RawAudioFixture] = &[RawAudioFixture {
    name: "medium-intro",
    path: "benchmark/fixtures/audio/medium-intro.pcm",
    duration: 15.0,
    format: "pcm",
    expected_text: Some(
        "欢迎来到杭州！我是您的智能导游。杭州是一座有着两千多年历史的古城，曾是南宋都城，如今是现代与古典完美交融的东方名城。西湖、灵隐寺、龙井茶园，处处皆是风景。让我们一起开启这段美妙的杭州之旅吧！",
    ),
}];

/// 音频夹具运行时实例（从静态夹具 + 文件系统检测生成）
#[derive(Debug, Clone)]
pub struct AudioFixtureOwned {
    pub name: String,
    pub path: String,
    pub duration: f64,
    pub format: String,
    pub expected_text: Option<String>,
}

/// 查找可用的音频文件
///
/// 检查音频文件是否存在，不存在则尝试查找 .mp3 版本。
pub fn find_available_audio() -> Option<AudioFixtureOwned> {
    for fixture in RAW_AUDIO_FIXTURES {
        if std::path::Path::new(fixture.path).exists() {
            return Some(AudioFixtureOwned {
                name: fixture.name.to_string(),
                path: fixture.path.to_string(),
                duration: fixture.duration,
                format: fixture.format.to_string(),
                expected_text: fixture.expected_text.map(|s| s.to_string()),
            });
        }

        // 尝试 mp3 版本
        let mp3_path = fixture.path.replace(".pcm", ".mp3");
        if std::path::Path::new(&mp3_path).exists() {
            return Some(AudioFixtureOwned {
                name: fixture.name.to_string(),
                path: mp3_path,
                duration: fixture.duration,
                format: "mp3".to_string(),
                expected_text: fixture.expected_text.map(|s| s.to_string()),
            });
        }
    }
    None
}
