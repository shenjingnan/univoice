//! Matrix 枚举测试 —— Provider 配置数据
//!
//! 数据从 TypeScript 版 `benchmark/scenarios/matrix/providers/` 移植。

use crate::benchmark::matrix::types::{
    ASRMatrixItem, ASRProviderMatrixConfig, MatrixItem, MatrixScenarioConfig, ProviderMatrixConfig,
};

// ============================== TTS Provider 配置 ==============================

// -------- Qwen --------

pub fn qwen_matrix_items() -> Vec<MatrixItem> {
    vec![
        // cosyvoice-v3-flash + longanyang
        MatrixItem {
            provider: "qwen".into(),
            model: "cosyvoice-v3-flash".into(),
            voice: "longanyang".into(),
            format: "pcm".into(),
            sample_rate: 8000,
        },
        MatrixItem {
            provider: "qwen".into(),
            model: "cosyvoice-v3-flash".into(),
            voice: "longanyang".into(),
            format: "pcm".into(),
            sample_rate: 16000,
        },
        MatrixItem {
            provider: "qwen".into(),
            model: "cosyvoice-v3-flash".into(),
            voice: "longanyang".into(),
            format: "pcm".into(),
            sample_rate: 22050,
        },
        MatrixItem {
            provider: "qwen".into(),
            model: "cosyvoice-v3-flash".into(),
            voice: "longanyang".into(),
            format: "pcm".into(),
            sample_rate: 24000,
        },
        MatrixItem {
            provider: "qwen".into(),
            model: "cosyvoice-v3-flash".into(),
            voice: "longanyang".into(),
            format: "pcm".into(),
            sample_rate: 44100,
        },
        MatrixItem {
            provider: "qwen".into(),
            model: "cosyvoice-v3-flash".into(),
            voice: "longanyang".into(),
            format: "pcm".into(),
            sample_rate: 48000,
        },
        MatrixItem {
            provider: "qwen".into(),
            model: "cosyvoice-v3-flash".into(),
            voice: "longanyang".into(),
            format: "opus".into(),
            sample_rate: 8000,
        },
        MatrixItem {
            provider: "qwen".into(),
            model: "cosyvoice-v3-flash".into(),
            voice: "longanyang".into(),
            format: "opus".into(),
            sample_rate: 16000,
        },
        MatrixItem {
            provider: "qwen".into(),
            model: "cosyvoice-v3-flash".into(),
            voice: "longanyang".into(),
            format: "opus".into(),
            sample_rate: 22050,
        },
        MatrixItem {
            provider: "qwen".into(),
            model: "cosyvoice-v3-flash".into(),
            voice: "longanyang".into(),
            format: "opus".into(),
            sample_rate: 24000,
        },
        MatrixItem {
            provider: "qwen".into(),
            model: "cosyvoice-v3-flash".into(),
            voice: "longanyang".into(),
            format: "opus".into(),
            sample_rate: 44100,
        },
        MatrixItem {
            provider: "qwen".into(),
            model: "cosyvoice-v3-flash".into(),
            voice: "longanyang".into(),
            format: "opus".into(),
            sample_rate: 48000,
        },
        // cosyvoice-v3-plus + longanyang
        MatrixItem {
            provider: "qwen".into(),
            model: "cosyvoice-v3-plus".into(),
            voice: "longanyang".into(),
            format: "pcm".into(),
            sample_rate: 8000,
        },
        MatrixItem {
            provider: "qwen".into(),
            model: "cosyvoice-v3-plus".into(),
            voice: "longanyang".into(),
            format: "pcm".into(),
            sample_rate: 16000,
        },
        MatrixItem {
            provider: "qwen".into(),
            model: "cosyvoice-v3-plus".into(),
            voice: "longanyang".into(),
            format: "pcm".into(),
            sample_rate: 22050,
        },
        MatrixItem {
            provider: "qwen".into(),
            model: "cosyvoice-v3-plus".into(),
            voice: "longanyang".into(),
            format: "pcm".into(),
            sample_rate: 24000,
        },
        MatrixItem {
            provider: "qwen".into(),
            model: "cosyvoice-v3-plus".into(),
            voice: "longanyang".into(),
            format: "pcm".into(),
            sample_rate: 44100,
        },
        MatrixItem {
            provider: "qwen".into(),
            model: "cosyvoice-v3-plus".into(),
            voice: "longanyang".into(),
            format: "pcm".into(),
            sample_rate: 48000,
        },
        MatrixItem {
            provider: "qwen".into(),
            model: "cosyvoice-v3-plus".into(),
            voice: "longanyang".into(),
            format: "opus".into(),
            sample_rate: 8000,
        },
        MatrixItem {
            provider: "qwen".into(),
            model: "cosyvoice-v3-plus".into(),
            voice: "longanyang".into(),
            format: "opus".into(),
            sample_rate: 16000,
        },
        MatrixItem {
            provider: "qwen".into(),
            model: "cosyvoice-v3-plus".into(),
            voice: "longanyang".into(),
            format: "opus".into(),
            sample_rate: 22050,
        },
        MatrixItem {
            provider: "qwen".into(),
            model: "cosyvoice-v3-plus".into(),
            voice: "longanyang".into(),
            format: "opus".into(),
            sample_rate: 24000,
        },
        MatrixItem {
            provider: "qwen".into(),
            model: "cosyvoice-v3-plus".into(),
            voice: "longanyang".into(),
            format: "opus".into(),
            sample_rate: 44100,
        },
        MatrixItem {
            provider: "qwen".into(),
            model: "cosyvoice-v3-plus".into(),
            voice: "longanyang".into(),
            format: "opus".into(),
            sample_rate: 48000,
        },
        // cosyvoice-v2 + longyingxiao
        MatrixItem {
            provider: "qwen".into(),
            model: "cosyvoice-v2".into(),
            voice: "longyingxiao".into(),
            format: "pcm".into(),
            sample_rate: 8000,
        },
        MatrixItem {
            provider: "qwen".into(),
            model: "cosyvoice-v2".into(),
            voice: "longyingxiao".into(),
            format: "pcm".into(),
            sample_rate: 16000,
        },
        MatrixItem {
            provider: "qwen".into(),
            model: "cosyvoice-v2".into(),
            voice: "longyingxiao".into(),
            format: "pcm".into(),
            sample_rate: 22050,
        },
        MatrixItem {
            provider: "qwen".into(),
            model: "cosyvoice-v2".into(),
            voice: "longyingxiao".into(),
            format: "pcm".into(),
            sample_rate: 24000,
        },
        MatrixItem {
            provider: "qwen".into(),
            model: "cosyvoice-v2".into(),
            voice: "longyingxiao".into(),
            format: "pcm".into(),
            sample_rate: 44100,
        },
        MatrixItem {
            provider: "qwen".into(),
            model: "cosyvoice-v2".into(),
            voice: "longyingxiao".into(),
            format: "pcm".into(),
            sample_rate: 48000,
        },
        MatrixItem {
            provider: "qwen".into(),
            model: "cosyvoice-v2".into(),
            voice: "longyingxiao".into(),
            format: "opus".into(),
            sample_rate: 8000,
        },
        MatrixItem {
            provider: "qwen".into(),
            model: "cosyvoice-v2".into(),
            voice: "longyingxiao".into(),
            format: "opus".into(),
            sample_rate: 16000,
        },
        MatrixItem {
            provider: "qwen".into(),
            model: "cosyvoice-v2".into(),
            voice: "longyingxiao".into(),
            format: "opus".into(),
            sample_rate: 22050,
        },
        MatrixItem {
            provider: "qwen".into(),
            model: "cosyvoice-v2".into(),
            voice: "longyingxiao".into(),
            format: "opus".into(),
            sample_rate: 24000,
        },
        MatrixItem {
            provider: "qwen".into(),
            model: "cosyvoice-v2".into(),
            voice: "longyingxiao".into(),
            format: "opus".into(),
            sample_rate: 44100,
        },
        MatrixItem {
            provider: "qwen".into(),
            model: "cosyvoice-v2".into(),
            voice: "longyingxiao".into(),
            format: "opus".into(),
            sample_rate: 48000,
        },
        // cosyvoice-v1 + longwan
        MatrixItem {
            provider: "qwen".into(),
            model: "cosyvoice-v1".into(),
            voice: "longwan".into(),
            format: "pcm".into(),
            sample_rate: 8000,
        },
        MatrixItem {
            provider: "qwen".into(),
            model: "cosyvoice-v1".into(),
            voice: "longwan".into(),
            format: "pcm".into(),
            sample_rate: 16000,
        },
        MatrixItem {
            provider: "qwen".into(),
            model: "cosyvoice-v1".into(),
            voice: "longwan".into(),
            format: "pcm".into(),
            sample_rate: 22050,
        },
        MatrixItem {
            provider: "qwen".into(),
            model: "cosyvoice-v1".into(),
            voice: "longwan".into(),
            format: "pcm".into(),
            sample_rate: 24000,
        },
        MatrixItem {
            provider: "qwen".into(),
            model: "cosyvoice-v1".into(),
            voice: "longwan".into(),
            format: "pcm".into(),
            sample_rate: 44100,
        },
        // qwen3-tts-instruct-flash-realtime + Cherry
        MatrixItem {
            provider: "qwen-realtime".into(),
            model: "qwen3-tts-instruct-flash-realtime".into(),
            voice: "Cherry".into(),
            format: "pcm".into(),
            sample_rate: 8000,
        },
        MatrixItem {
            provider: "qwen-realtime".into(),
            model: "qwen3-tts-instruct-flash-realtime".into(),
            voice: "Cherry".into(),
            format: "pcm".into(),
            sample_rate: 16000,
        },
        MatrixItem {
            provider: "qwen-realtime".into(),
            model: "qwen3-tts-instruct-flash-realtime".into(),
            voice: "Cherry".into(),
            format: "pcm".into(),
            sample_rate: 24000,
        },
        MatrixItem {
            provider: "qwen-realtime".into(),
            model: "qwen3-tts-instruct-flash-realtime".into(),
            voice: "Cherry".into(),
            format: "pcm".into(),
            sample_rate: 48000,
        },
        MatrixItem {
            provider: "qwen-realtime".into(),
            model: "qwen3-tts-instruct-flash-realtime".into(),
            voice: "Cherry".into(),
            format: "opus".into(),
            sample_rate: 8000,
        },
        MatrixItem {
            provider: "qwen-realtime".into(),
            model: "qwen3-tts-instruct-flash-realtime".into(),
            voice: "Cherry".into(),
            format: "opus".into(),
            sample_rate: 16000,
        },
        MatrixItem {
            provider: "qwen-realtime".into(),
            model: "qwen3-tts-instruct-flash-realtime".into(),
            voice: "Cherry".into(),
            format: "opus".into(),
            sample_rate: 24000,
        },
        MatrixItem {
            provider: "qwen-realtime".into(),
            model: "qwen3-tts-instruct-flash-realtime".into(),
            voice: "Cherry".into(),
            format: "opus".into(),
            sample_rate: 48000,
        },
        // qwen3-tts-flash-realtime + Cherry
        MatrixItem {
            provider: "qwen-realtime".into(),
            model: "qwen3-tts-flash-realtime".into(),
            voice: "Cherry".into(),
            format: "pcm".into(),
            sample_rate: 8000,
        },
        MatrixItem {
            provider: "qwen-realtime".into(),
            model: "qwen3-tts-flash-realtime".into(),
            voice: "Cherry".into(),
            format: "pcm".into(),
            sample_rate: 16000,
        },
        MatrixItem {
            provider: "qwen-realtime".into(),
            model: "qwen3-tts-flash-realtime".into(),
            voice: "Cherry".into(),
            format: "pcm".into(),
            sample_rate: 24000,
        },
        MatrixItem {
            provider: "qwen-realtime".into(),
            model: "qwen3-tts-flash-realtime".into(),
            voice: "Cherry".into(),
            format: "pcm".into(),
            sample_rate: 48000,
        },
        MatrixItem {
            provider: "qwen-realtime".into(),
            model: "qwen3-tts-flash-realtime".into(),
            voice: "Cherry".into(),
            format: "opus".into(),
            sample_rate: 8000,
        },
        MatrixItem {
            provider: "qwen-realtime".into(),
            model: "qwen3-tts-flash-realtime".into(),
            voice: "Cherry".into(),
            format: "opus".into(),
            sample_rate: 16000,
        },
        MatrixItem {
            provider: "qwen-realtime".into(),
            model: "qwen3-tts-flash-realtime".into(),
            voice: "Cherry".into(),
            format: "opus".into(),
            sample_rate: 24000,
        },
        MatrixItem {
            provider: "qwen-realtime".into(),
            model: "qwen3-tts-flash-realtime".into(),
            voice: "Cherry".into(),
            format: "opus".into(),
            sample_rate: 48000,
        },
        // qwen3-tts-realtime + Cherry (only 24kHz)
        MatrixItem {
            provider: "qwen-realtime".into(),
            model: "qwen-tts-realtime".into(),
            voice: "Cherry".into(),
            format: "pcm".into(),
            sample_rate: 24000,
        },
    ]
}

pub fn qwen_scenario_config() -> MatrixScenarioConfig {
    MatrixScenarioConfig {
        name: "qwen-matrix",
        description: "Qwen TTS 矩阵测试：覆盖不同模型、音色、编码、采样率的组合",
        iterations: 3,
        timeout_secs: 120,
    }
}

pub fn qwen_provider_matrix_config() -> ProviderMatrixConfig {
    ProviderMatrixConfig {
        provider: "qwen",
        display_name: "通义千问",
        items: qwen_matrix_items(),
        scenario_config: qwen_scenario_config(),
    }
}

// -------- Doubao --------

pub fn doubao_matrix_items() -> Vec<MatrixItem> {
    vec![
        // seed-tts-1.0 + lengkugege + pcm
        MatrixItem {
            provider: "doubao".into(),
            model: "seed-tts-1.0".into(),
            voice: "zh_male_lengkugege_emo_v2_mars_bigtts".into(),
            format: "pcm".into(),
            sample_rate: 8000,
        },
        MatrixItem {
            provider: "doubao".into(),
            model: "seed-tts-1.0".into(),
            voice: "zh_male_lengkugege_emo_v2_mars_bigtts".into(),
            format: "pcm".into(),
            sample_rate: 16000,
        },
        MatrixItem {
            provider: "doubao".into(),
            model: "seed-tts-1.0".into(),
            voice: "zh_male_lengkugege_emo_v2_mars_bigtts".into(),
            format: "pcm".into(),
            sample_rate: 24000,
        },
        MatrixItem {
            provider: "doubao".into(),
            model: "seed-tts-1.0".into(),
            voice: "zh_male_lengkugege_emo_v2_mars_bigtts".into(),
            format: "pcm".into(),
            sample_rate: 48000,
        },
        // seed-tts-1.0 + lengkugege + ogg_opus
        MatrixItem {
            provider: "doubao".into(),
            model: "seed-tts-1.0".into(),
            voice: "zh_male_lengkugege_emo_v2_mars_bigtts".into(),
            format: "ogg_opus".into(),
            sample_rate: 8000,
        },
        MatrixItem {
            provider: "doubao".into(),
            model: "seed-tts-1.0".into(),
            voice: "zh_male_lengkugege_emo_v2_mars_bigtts".into(),
            format: "ogg_opus".into(),
            sample_rate: 16000,
        },
        MatrixItem {
            provider: "doubao".into(),
            model: "seed-tts-1.0".into(),
            voice: "zh_male_lengkugege_emo_v2_mars_bigtts".into(),
            format: "ogg_opus".into(),
            sample_rate: 24000,
        },
        MatrixItem {
            provider: "doubao".into(),
            model: "seed-tts-1.0".into(),
            voice: "zh_male_lengkugege_emo_v2_mars_bigtts".into(),
            format: "ogg_opus".into(),
            sample_rate: 48000,
        },
        // seed-tts-2.0 + vv + pcm
        MatrixItem {
            provider: "doubao".into(),
            model: "seed-tts-2.0".into(),
            voice: "zh_female_vv_uranus_bigtts".into(),
            format: "pcm".into(),
            sample_rate: 8000,
        },
        MatrixItem {
            provider: "doubao".into(),
            model: "seed-tts-2.0".into(),
            voice: "zh_female_vv_uranus_bigtts".into(),
            format: "pcm".into(),
            sample_rate: 16000,
        },
        MatrixItem {
            provider: "doubao".into(),
            model: "seed-tts-2.0".into(),
            voice: "zh_female_vv_uranus_bigtts".into(),
            format: "pcm".into(),
            sample_rate: 24000,
        },
        MatrixItem {
            provider: "doubao".into(),
            model: "seed-tts-2.0".into(),
            voice: "zh_female_vv_uranus_bigtts".into(),
            format: "pcm".into(),
            sample_rate: 48000,
        },
        // seed-tts-2.0 + vv + ogg_opus
        MatrixItem {
            provider: "doubao".into(),
            model: "seed-tts-2.0".into(),
            voice: "zh_female_vv_uranus_bigtts".into(),
            format: "ogg_opus".into(),
            sample_rate: 8000,
        },
        MatrixItem {
            provider: "doubao".into(),
            model: "seed-tts-2.0".into(),
            voice: "zh_female_vv_uranus_bigtts".into(),
            format: "ogg_opus".into(),
            sample_rate: 16000,
        },
        MatrixItem {
            provider: "doubao".into(),
            model: "seed-tts-2.0".into(),
            voice: "zh_female_vv_uranus_bigtts".into(),
            format: "ogg_opus".into(),
            sample_rate: 24000,
        },
        MatrixItem {
            provider: "doubao".into(),
            model: "seed-tts-2.0".into(),
            voice: "zh_female_vv_uranus_bigtts".into(),
            format: "ogg_opus".into(),
            sample_rate: 48000,
        },
    ]
}

pub fn doubao_scenario_config() -> MatrixScenarioConfig {
    MatrixScenarioConfig {
        name: "doubao-matrix",
        description: "Doubao TTS 矩阵测试：覆盖不同模型、音色、编码、采样率的组合",
        iterations: 3,
        timeout_secs: 120,
    }
}

pub fn doubao_provider_matrix_config() -> ProviderMatrixConfig {
    ProviderMatrixConfig {
        provider: "doubao",
        display_name: "豆包",
        items: doubao_matrix_items(),
        scenario_config: doubao_scenario_config(),
    }
}

// -------- GLM --------

pub fn glm_matrix_items() -> Vec<MatrixItem> {
    vec![MatrixItem {
        provider: "glm".into(),
        model: "glm-tts".into(),
        voice: "tongtong".into(),
        format: "pcm".into(),
        sample_rate: 24000,
    }]
}

pub fn glm_scenario_config() -> MatrixScenarioConfig {
    MatrixScenarioConfig {
        name: "glm-matrix",
        description: "GLM TTS 矩阵测试",
        iterations: 3,
        timeout_secs: 120,
    }
}

pub fn glm_provider_matrix_config() -> ProviderMatrixConfig {
    ProviderMatrixConfig {
        provider: "glm",
        display_name: "智谱 GLM",
        items: glm_matrix_items(),
        scenario_config: glm_scenario_config(),
    }
}

// -------- Mimo --------

pub fn mimo_matrix_items() -> Vec<MatrixItem> {
    vec![MatrixItem {
        provider: "mimo".into(),
        model: "mimo-v2-tts".into(),
        voice: "default_zh".into(),
        format: "pcm".into(),
        sample_rate: 24000,
    }]
}

pub fn mimo_scenario_config() -> MatrixScenarioConfig {
    MatrixScenarioConfig {
        name: "mimo-matrix",
        description: "小米 Mimo TTS 矩阵测试",
        iterations: 3,
        timeout_secs: 120,
    }
}

pub fn mimo_provider_matrix_config() -> ProviderMatrixConfig {
    ProviderMatrixConfig {
        provider: "mimo",
        display_name: "小米 Mimo",
        items: mimo_matrix_items(),
        scenario_config: mimo_scenario_config(),
    }
}

// -------- Minimax --------

pub fn minimax_matrix_items() -> Vec<MatrixItem> {
    vec![
        // speech-2.8-hd
        MatrixItem {
            provider: "minimax".into(),
            model: "speech-2.8-hd".into(),
            voice: "male-qn-qingse".into(),
            format: "pcm".into(),
            sample_rate: 8000,
        },
        MatrixItem {
            provider: "minimax".into(),
            model: "speech-2.8-hd".into(),
            voice: "male-qn-qingse".into(),
            format: "pcm".into(),
            sample_rate: 16000,
        },
        MatrixItem {
            provider: "minimax".into(),
            model: "speech-2.8-hd".into(),
            voice: "male-qn-qingse".into(),
            format: "pcm".into(),
            sample_rate: 22050,
        },
        MatrixItem {
            provider: "minimax".into(),
            model: "speech-2.8-hd".into(),
            voice: "male-qn-qingse".into(),
            format: "pcm".into(),
            sample_rate: 24000,
        },
        MatrixItem {
            provider: "minimax".into(),
            model: "speech-2.8-hd".into(),
            voice: "male-qn-qingse".into(),
            format: "pcm".into(),
            sample_rate: 32000,
        },
        MatrixItem {
            provider: "minimax".into(),
            model: "speech-2.8-hd".into(),
            voice: "male-qn-qingse".into(),
            format: "pcm".into(),
            sample_rate: 44100,
        },
        // speech-2.8-turbo
        MatrixItem {
            provider: "minimax".into(),
            model: "speech-2.8-turbo".into(),
            voice: "male-qn-qingse".into(),
            format: "pcm".into(),
            sample_rate: 8000,
        },
        MatrixItem {
            provider: "minimax".into(),
            model: "speech-2.8-turbo".into(),
            voice: "male-qn-qingse".into(),
            format: "pcm".into(),
            sample_rate: 16000,
        },
        MatrixItem {
            provider: "minimax".into(),
            model: "speech-2.8-turbo".into(),
            voice: "male-qn-qingse".into(),
            format: "pcm".into(),
            sample_rate: 22050,
        },
        MatrixItem {
            provider: "minimax".into(),
            model: "speech-2.8-turbo".into(),
            voice: "male-qn-qingse".into(),
            format: "pcm".into(),
            sample_rate: 24000,
        },
        MatrixItem {
            provider: "minimax".into(),
            model: "speech-2.8-turbo".into(),
            voice: "male-qn-qingse".into(),
            format: "pcm".into(),
            sample_rate: 32000,
        },
        MatrixItem {
            provider: "minimax".into(),
            model: "speech-2.8-turbo".into(),
            voice: "male-qn-qingse".into(),
            format: "pcm".into(),
            sample_rate: 44100,
        },
        // speech-2.6-hd
        MatrixItem {
            provider: "minimax".into(),
            model: "speech-2.6-hd".into(),
            voice: "male-qn-qingse".into(),
            format: "pcm".into(),
            sample_rate: 8000,
        },
        MatrixItem {
            provider: "minimax".into(),
            model: "speech-2.6-hd".into(),
            voice: "male-qn-qingse".into(),
            format: "pcm".into(),
            sample_rate: 16000,
        },
        MatrixItem {
            provider: "minimax".into(),
            model: "speech-2.6-hd".into(),
            voice: "male-qn-qingse".into(),
            format: "pcm".into(),
            sample_rate: 22050,
        },
        MatrixItem {
            provider: "minimax".into(),
            model: "speech-2.6-hd".into(),
            voice: "male-qn-qingse".into(),
            format: "pcm".into(),
            sample_rate: 24000,
        },
        MatrixItem {
            provider: "minimax".into(),
            model: "speech-2.6-hd".into(),
            voice: "male-qn-qingse".into(),
            format: "pcm".into(),
            sample_rate: 32000,
        },
        MatrixItem {
            provider: "minimax".into(),
            model: "speech-2.6-hd".into(),
            voice: "male-qn-qingse".into(),
            format: "pcm".into(),
            sample_rate: 44100,
        },
        // speech-2.6-turbo
        MatrixItem {
            provider: "minimax".into(),
            model: "speech-2.6-turbo".into(),
            voice: "male-qn-qingse".into(),
            format: "pcm".into(),
            sample_rate: 8000,
        },
        MatrixItem {
            provider: "minimax".into(),
            model: "speech-2.6-turbo".into(),
            voice: "male-qn-qingse".into(),
            format: "pcm".into(),
            sample_rate: 16000,
        },
        MatrixItem {
            provider: "minimax".into(),
            model: "speech-2.6-turbo".into(),
            voice: "male-qn-qingse".into(),
            format: "pcm".into(),
            sample_rate: 22050,
        },
        MatrixItem {
            provider: "minimax".into(),
            model: "speech-2.6-turbo".into(),
            voice: "male-qn-qingse".into(),
            format: "pcm".into(),
            sample_rate: 24000,
        },
        MatrixItem {
            provider: "minimax".into(),
            model: "speech-2.6-turbo".into(),
            voice: "male-qn-qingse".into(),
            format: "pcm".into(),
            sample_rate: 32000,
        },
        MatrixItem {
            provider: "minimax".into(),
            model: "speech-2.6-turbo".into(),
            voice: "male-qn-qingse".into(),
            format: "pcm".into(),
            sample_rate: 44100,
        },
        // speech-02-hd
        MatrixItem {
            provider: "minimax".into(),
            model: "speech-02-hd".into(),
            voice: "male-qn-qingse".into(),
            format: "pcm".into(),
            sample_rate: 8000,
        },
        MatrixItem {
            provider: "minimax".into(),
            model: "speech-02-hd".into(),
            voice: "male-qn-qingse".into(),
            format: "pcm".into(),
            sample_rate: 16000,
        },
        MatrixItem {
            provider: "minimax".into(),
            model: "speech-02-hd".into(),
            voice: "male-qn-qingse".into(),
            format: "pcm".into(),
            sample_rate: 22050,
        },
        MatrixItem {
            provider: "minimax".into(),
            model: "speech-02-hd".into(),
            voice: "male-qn-qingse".into(),
            format: "pcm".into(),
            sample_rate: 24000,
        },
        MatrixItem {
            provider: "minimax".into(),
            model: "speech-02-hd".into(),
            voice: "male-qn-qingse".into(),
            format: "pcm".into(),
            sample_rate: 32000,
        },
        MatrixItem {
            provider: "minimax".into(),
            model: "speech-02-hd".into(),
            voice: "male-qn-qingse".into(),
            format: "pcm".into(),
            sample_rate: 44100,
        },
        // speech-02-turbo
        MatrixItem {
            provider: "minimax".into(),
            model: "speech-02-turbo".into(),
            voice: "male-qn-qingse".into(),
            format: "pcm".into(),
            sample_rate: 8000,
        },
        MatrixItem {
            provider: "minimax".into(),
            model: "speech-02-turbo".into(),
            voice: "male-qn-qingse".into(),
            format: "pcm".into(),
            sample_rate: 16000,
        },
        MatrixItem {
            provider: "minimax".into(),
            model: "speech-02-turbo".into(),
            voice: "male-qn-qingse".into(),
            format: "pcm".into(),
            sample_rate: 22050,
        },
        MatrixItem {
            provider: "minimax".into(),
            model: "speech-02-turbo".into(),
            voice: "male-qn-qingse".into(),
            format: "pcm".into(),
            sample_rate: 24000,
        },
        MatrixItem {
            provider: "minimax".into(),
            model: "speech-02-turbo".into(),
            voice: "male-qn-qingse".into(),
            format: "pcm".into(),
            sample_rate: 32000,
        },
        MatrixItem {
            provider: "minimax".into(),
            model: "speech-02-turbo".into(),
            voice: "male-qn-qingse".into(),
            format: "pcm".into(),
            sample_rate: 44100,
        },
        // speech-01-hd
        MatrixItem {
            provider: "minimax".into(),
            model: "speech-01-hd".into(),
            voice: "male-qn-qingse".into(),
            format: "pcm".into(),
            sample_rate: 8000,
        },
        MatrixItem {
            provider: "minimax".into(),
            model: "speech-01-hd".into(),
            voice: "male-qn-qingse".into(),
            format: "pcm".into(),
            sample_rate: 16000,
        },
        MatrixItem {
            provider: "minimax".into(),
            model: "speech-01-hd".into(),
            voice: "male-qn-qingse".into(),
            format: "pcm".into(),
            sample_rate: 22050,
        },
        MatrixItem {
            provider: "minimax".into(),
            model: "speech-01-hd".into(),
            voice: "male-qn-qingse".into(),
            format: "pcm".into(),
            sample_rate: 24000,
        },
        MatrixItem {
            provider: "minimax".into(),
            model: "speech-01-hd".into(),
            voice: "male-qn-qingse".into(),
            format: "pcm".into(),
            sample_rate: 32000,
        },
        MatrixItem {
            provider: "minimax".into(),
            model: "speech-01-hd".into(),
            voice: "male-qn-qingse".into(),
            format: "pcm".into(),
            sample_rate: 44100,
        },
        // speech-01-turbo
        MatrixItem {
            provider: "minimax".into(),
            model: "speech-01-turbo".into(),
            voice: "male-qn-qingse".into(),
            format: "pcm".into(),
            sample_rate: 8000,
        },
        MatrixItem {
            provider: "minimax".into(),
            model: "speech-01-turbo".into(),
            voice: "male-qn-qingse".into(),
            format: "pcm".into(),
            sample_rate: 16000,
        },
        MatrixItem {
            provider: "minimax".into(),
            model: "speech-01-turbo".into(),
            voice: "male-qn-qingse".into(),
            format: "pcm".into(),
            sample_rate: 22050,
        },
        MatrixItem {
            provider: "minimax".into(),
            model: "speech-01-turbo".into(),
            voice: "male-qn-qingse".into(),
            format: "pcm".into(),
            sample_rate: 24000,
        },
        MatrixItem {
            provider: "minimax".into(),
            model: "speech-01-turbo".into(),
            voice: "male-qn-qingse".into(),
            format: "pcm".into(),
            sample_rate: 32000,
        },
        MatrixItem {
            provider: "minimax".into(),
            model: "speech-01-turbo".into(),
            voice: "male-qn-qingse".into(),
            format: "pcm".into(),
            sample_rate: 44100,
        },
    ]
}

pub fn minimax_scenario_config() -> MatrixScenarioConfig {
    MatrixScenarioConfig {
        name: "minimax-matrix",
        description: "Minimax TTS 矩阵测试",
        iterations: 3,
        timeout_secs: 120,
    }
}

pub fn minimax_provider_matrix_config() -> ProviderMatrixConfig {
    ProviderMatrixConfig {
        provider: "minimax",
        display_name: "MiniMax",
        items: minimax_matrix_items(),
        scenario_config: minimax_scenario_config(),
    }
}

// -------- Xfyun --------

pub fn xfyun_matrix_items() -> Vec<MatrixItem> {
    vec![
        MatrixItem {
            provider: "xfyun".into(),
            model: "super-human-tts".into(),
            voice: "x5_lingxiaoxuan_flow".into(),
            format: "pcm".into(),
            sample_rate: 8000,
        },
        MatrixItem {
            provider: "xfyun".into(),
            model: "super-human-tts".into(),
            voice: "x5_lingxiaoxuan_flow".into(),
            format: "pcm".into(),
            sample_rate: 16000,
        },
        MatrixItem {
            provider: "xfyun".into(),
            model: "super-human-tts".into(),
            voice: "x5_lingxiaoxuan_flow".into(),
            format: "pcm".into(),
            sample_rate: 24000,
        },
    ]
}

pub fn xfyun_scenario_config() -> MatrixScenarioConfig {
    MatrixScenarioConfig {
        name: "xfyun-matrix",
        description: "Xfyun TTS 矩阵测试：覆盖超拟人模型不同采样率的组合",
        iterations: 3,
        timeout_secs: 120,
    }
}

pub fn xfyun_provider_matrix_config() -> ProviderMatrixConfig {
    ProviderMatrixConfig {
        provider: "xfyun",
        display_name: "科大讯飞",
        items: xfyun_matrix_items(),
        scenario_config: xfyun_scenario_config(),
    }
}

// ============================== TTS 汇总 ==============================

/// 所有 TTS Provider 的矩阵配置
pub fn all_tts_provider_matrix_configs() -> Vec<ProviderMatrixConfig> {
    vec![
        qwen_provider_matrix_config(),
        doubao_provider_matrix_config(),
        glm_provider_matrix_config(),
        mimo_provider_matrix_config(),
        minimax_provider_matrix_config(),
        xfyun_provider_matrix_config(),
    ]
}

/// 按名称获取 TTS Provider 的矩阵配置
pub fn get_tts_provider_matrix_config(name: &str) -> Option<ProviderMatrixConfig> {
    all_tts_provider_matrix_configs()
        .into_iter()
        .find(|c| c.provider == name)
}

// ============================== ASR Provider 配置 ==============================

// -------- Qwen ASR --------

pub fn qwen_asr_matrix_items() -> Vec<ASRMatrixItem> {
    vec![
        ASRMatrixItem {
            provider: "qwen".into(),
            model: "paraformer-realtime-v2".into(),
            language: "zh-CN".into(),
            format: "pcm".into(),
            sample_rate: Some(16000),
        },
        ASRMatrixItem {
            provider: "qwen".into(),
            model: "paraformer-realtime-v1".into(),
            language: "zh-CN".into(),
            format: "pcm".into(),
            sample_rate: Some(16000),
        },
    ]
}

pub fn qwen_asr_scenario_config() -> MatrixScenarioConfig {
    MatrixScenarioConfig {
        name: "qwen-asr-matrix",
        description: "Qwen ASR 矩阵测试",
        iterations: 3,
        timeout_secs: 120,
    }
}

pub fn qwen_asr_provider_matrix_config() -> ASRProviderMatrixConfig {
    ASRProviderMatrixConfig {
        provider: "qwen",
        display_name: "通义千问",
        items: qwen_asr_matrix_items(),
        scenario_config: qwen_asr_scenario_config(),
    }
}

// -------- Doubao ASR --------

pub fn doubao_asr_matrix_items() -> Vec<ASRMatrixItem> {
    vec![ASRMatrixItem {
        provider: "doubao".into(),
        model: "bigmodel".into(),
        language: "zh-CN".into(),
        format: "pcm".into(),
        sample_rate: Some(16000),
    }]
}

pub fn doubao_asr_scenario_config() -> MatrixScenarioConfig {
    MatrixScenarioConfig {
        name: "doubao-asr-matrix",
        description: "Doubao ASR 矩阵测试",
        iterations: 3,
        timeout_secs: 120,
    }
}

pub fn doubao_asr_provider_matrix_config() -> ASRProviderMatrixConfig {
    ASRProviderMatrixConfig {
        provider: "doubao",
        display_name: "火山引擎",
        items: doubao_asr_matrix_items(),
        scenario_config: doubao_asr_scenario_config(),
    }
}

// -------- GLM ASR --------

pub fn glm_asr_matrix_items() -> Vec<ASRMatrixItem> {
    vec![
        ASRMatrixItem {
            provider: "glm".into(),
            model: "glm-asr-2512".into(),
            language: "zh-CN".into(),
            format: "wav".into(),
            sample_rate: Some(16000),
        },
        ASRMatrixItem {
            provider: "glm".into(),
            model: "glm-asr-2512".into(),
            language: "zh-CN".into(),
            format: "mp3".into(),
            sample_rate: None,
        },
    ]
}

pub fn glm_asr_scenario_config() -> MatrixScenarioConfig {
    MatrixScenarioConfig {
        name: "glm-asr-matrix",
        description: "GLM ASR 矩阵测试：wav/mp3 格式",
        iterations: 3,
        timeout_secs: 120,
    }
}

pub fn glm_asr_provider_matrix_config() -> ASRProviderMatrixConfig {
    ASRProviderMatrixConfig {
        provider: "glm",
        display_name: "智谱 GLM",
        items: glm_asr_matrix_items(),
        scenario_config: glm_asr_scenario_config(),
    }
}

// -------- Xfyun ASR --------

pub fn xfyun_asr_matrix_items() -> Vec<ASRMatrixItem> {
    vec![ASRMatrixItem {
        provider: "xfyun".into(),
        model: "iat".into(),
        language: "zh-CN".into(),
        format: "pcm".into(),
        sample_rate: Some(16000),
    }]
}

pub fn xfyun_asr_scenario_config() -> MatrixScenarioConfig {
    MatrixScenarioConfig {
        name: "xfyun-asr-matrix",
        description: "Xfyun ASR 矩阵测试",
        iterations: 3,
        timeout_secs: 120,
    }
}

pub fn xfyun_asr_provider_matrix_config() -> ASRProviderMatrixConfig {
    ASRProviderMatrixConfig {
        provider: "xfyun",
        display_name: "科大讯飞",
        items: xfyun_asr_matrix_items(),
        scenario_config: xfyun_asr_scenario_config(),
    }
}

// ============================== ASR 汇总 ==============================

/// 所有 ASR Provider 的矩阵配置
pub fn all_asr_provider_matrix_configs() -> Vec<ASRProviderMatrixConfig> {
    vec![
        qwen_asr_provider_matrix_config(),
        doubao_asr_provider_matrix_config(),
        glm_asr_provider_matrix_config(),
        xfyun_asr_provider_matrix_config(),
    ]
}

/// 按名称获取 ASR Provider 的矩阵配置
pub fn get_asr_provider_matrix_config(name: &str) -> Option<ASRProviderMatrixConfig> {
    all_asr_provider_matrix_configs()
        .into_iter()
        .find(|c| c.provider == name)
}

// ============================== 测试 ==============================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_qwen_matrix_count() {
        assert_eq!(qwen_matrix_items().len(), 58);
    }

    #[test]
    fn test_doubao_matrix_count() {
        assert_eq!(doubao_matrix_items().len(), 16);
    }

    #[test]
    fn test_glm_matrix_count() {
        assert_eq!(glm_matrix_items().len(), 1);
    }

    #[test]
    fn test_mimo_matrix_count() {
        assert_eq!(mimo_matrix_items().len(), 1);
    }

    #[test]
    fn test_minimax_matrix_count() {
        assert_eq!(minimax_matrix_items().len(), 48);
    }

    #[test]
    fn test_xfyun_matrix_count() {
        assert_eq!(xfyun_matrix_items().len(), 3);
    }

    #[test]
    fn test_asr_qwen_matrix_count() {
        assert_eq!(qwen_asr_matrix_items().len(), 2);
    }

    #[test]
    fn test_asr_doubao_matrix_count() {
        assert_eq!(doubao_asr_matrix_items().len(), 1);
    }

    #[test]
    fn test_asr_glm_matrix_count() {
        assert_eq!(glm_asr_matrix_items().len(), 2);
    }

    #[test]
    fn test_asr_xfyun_matrix_count() {
        assert_eq!(xfyun_asr_matrix_items().len(), 1);
    }

    #[test]
    fn test_all_tts_configs_have_unique_names() {
        let configs = all_tts_provider_matrix_configs();
        let names: Vec<&str> = configs.iter().map(|c| c.provider).collect();
        let mut unique = names.clone();
        unique.sort();
        unique.dedup();
        assert_eq!(names.len(), unique.len(), "Provider names must be unique");
    }

    #[test]
    fn test_get_tts_provider_config() {
        let config = get_tts_provider_matrix_config("qwen").unwrap();
        assert_eq!(config.provider, "qwen");
        assert_eq!(config.display_name, "通义千问");
    }

    #[test]
    fn test_get_tts_provider_config_unknown() {
        assert!(get_tts_provider_matrix_config("nonexistent").is_none());
    }

    #[test]
    fn test_get_asr_provider_config() {
        let config = get_asr_provider_matrix_config("qwen").unwrap();
        assert_eq!(config.provider, "qwen");
    }

    #[test]
    fn test_all_matrix_items_have_provider() {
        for item in qwen_matrix_items() {
            assert!(
                item.provider == "qwen" || item.provider == "qwen-realtime",
                "Expected qwen or qwen-realtime, got {}",
                item.provider
            );
        }
        for item in doubao_matrix_items() {
            assert_eq!(item.provider, "doubao");
        }
    }
}
