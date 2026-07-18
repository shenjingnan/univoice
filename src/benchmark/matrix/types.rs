//! Matrix 枚举测试类型定义

use serde::{Deserialize, Serialize};

/// TTS 矩阵测试项
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MatrixItem {
    pub provider: String,
    pub model: String,
    pub voice: String,
    pub format: String,
    pub sample_rate: u32,
}

/// ASR 矩阵测试项
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ASRMatrixItem {
    pub provider: String,
    pub model: String,
    pub language: String,
    pub format: String,
    pub sample_rate: Option<u32>,
}

/// 矩阵过滤器
#[derive(Debug, Clone, Default)]
pub struct MatrixFilter {
    pub model: Option<Vec<String>>,
    pub voice: Option<Vec<String>>,
    pub format: Option<Vec<String>>,
    pub sample_rate: Option<Vec<u32>>,
}

/// ASR 矩阵过滤器
#[derive(Debug, Clone, Default)]
pub struct ASRMatrixFilter {
    pub model: Option<Vec<String>>,
    pub language: Option<Vec<String>>,
    pub format: Option<Vec<String>>,
    pub sample_rate: Option<Vec<u32>>,
}

/// 矩阵场景配置
#[derive(Debug, Clone)]
pub struct MatrixScenarioConfig {
    pub name: &'static str,
    pub description: &'static str,
    pub iterations: u32,
    pub timeout_secs: u64,
}

/// 单 Provider TTS 矩阵配置
pub struct ProviderMatrixConfig {
    pub provider: &'static str,
    pub display_name: &'static str,
    pub items: Vec<MatrixItem>,
    pub scenario_config: MatrixScenarioConfig,
}

/// 单 Provider ASR 矩阵配置
pub struct ASRProviderMatrixConfig {
    pub provider: &'static str,
    pub display_name: &'static str,
    pub items: Vec<ASRMatrixItem>,
    pub scenario_config: MatrixScenarioConfig,
}

/// 矩阵运行选项
#[derive(Debug, Clone)]
pub struct MatrixRunOptions {
    pub iterations: u32,
    pub interval_ms: u64,
    pub filter: Option<MatrixFilter>,
    pub timeout_secs: u64,
}

impl Default for MatrixRunOptions {
    fn default() -> Self {
        Self {
            iterations: 3,
            interval_ms: 1000,
            filter: None,
            timeout_secs: 120,
        }
    }
}

/// ASR 矩阵运行选项
#[derive(Debug, Clone)]
pub struct ASRMatrixRunOptions {
    pub iterations: u32,
    pub interval_ms: u64,
    pub filter: Option<ASRMatrixFilter>,
    pub timeout_secs: u64,
}

impl Default for ASRMatrixRunOptions {
    fn default() -> Self {
        Self {
            iterations: 3,
            interval_ms: 1000,
            filter: None,
            timeout_secs: 120,
        }
    }
}
