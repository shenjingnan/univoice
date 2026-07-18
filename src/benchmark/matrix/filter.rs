//! Matrix 过滤器 + 场景名生成

use crate::benchmark::matrix::types::{ASRMatrixFilter, ASRMatrixItem, MatrixFilter, MatrixItem};

/// 按过滤器筛选 TTS MatrixItem 列表
pub fn filter_matrix_items(items: &[MatrixItem], filter: &MatrixFilter) -> Vec<MatrixItem> {
    items
        .iter()
        .filter(|item| {
            if let Some(ref models) = filter.model {
                if !models.contains(&item.model) {
                    return false;
                }
            }
            if let Some(ref voices) = filter.voice {
                if !voices.contains(&item.voice) {
                    return false;
                }
            }
            if let Some(ref formats) = filter.format {
                if !formats.contains(&item.format) {
                    return false;
                }
            }
            if let Some(ref rates) = filter.sample_rate {
                if !rates.contains(&item.sample_rate) {
                    return false;
                }
            }
            true
        })
        .cloned()
        .collect()
}

/// 按过滤器筛选 ASR MatrixItem 列表
pub fn filter_asr_matrix_items(
    items: &[ASRMatrixItem],
    filter: &ASRMatrixFilter,
) -> Vec<ASRMatrixItem> {
    items
        .iter()
        .filter(|item| {
            if let Some(ref models) = filter.model {
                if !models.contains(&item.model) {
                    return false;
                }
            }
            if let Some(ref languages) = filter.language {
                if !languages.contains(&item.language) {
                    return false;
                }
            }
            if let Some(ref formats) = filter.format {
                if !formats.contains(&item.format) {
                    return false;
                }
            }
            if let Some(ref rates) = filter.sample_rate {
                if let Some(sr) = item.sample_rate {
                    if !rates.contains(&sr) {
                        return false;
                    }
                } else {
                    // Item has no sample rate but filter requires one → exclude
                    return false;
                }
            }
            true
        })
        .cloned()
        .collect()
}

/// 生成 MatrixItem 的场景名称
///
/// 格式: `matrix/{model}/{voice}/{format}-{sampleRate}`
pub fn generate_matrix_scenario_name(item: &MatrixItem) -> String {
    format!(
        "matrix/{}/{}/{}-{}",
        item.model, item.voice, item.format, item.sample_rate
    )
}

/// 生成 ASRMatrixItem 的场景名称
///
/// 格式: `asr-matrix/{model}/{language}/{format}-{sampleRate}`
/// 若 sample_rate 为 None，则格式为 `asr-matrix/{model}/{language}/{format}`
pub fn generate_asr_matrix_scenario_name(item: &ASRMatrixItem) -> String {
    match item.sample_rate {
        Some(sr) => format!(
            "asr-matrix/{}/{}/{}-{}",
            item.model, item.language, item.format, sr
        ),
        None => format!(
            "asr-matrix/{}/{}/{}",
            item.model, item.language, item.format
        ),
    }
}

/// 解析 Matrix 场景名为组件（用于报告生成）
pub fn parse_matrix_scenario(scenario: &str) -> Option<ScenarioParts> {
    let stripped = scenario.strip_prefix("matrix/")?;
    let parts: Vec<&str> = stripped.splitn(3, '/').collect();
    if parts.len() != 3 {
        return None;
    }
    let format_rate: Vec<&str> = parts[2].rsplitn(2, '-').collect();
    if format_rate.len() != 2 {
        return None;
    }
    Some(ScenarioParts {
        model: parts[0].to_string(),
        voice_or_language: parts[1].to_string(),
        format: format_rate[1].to_string(),
        sample_rate: format_rate[0].parse().ok()?,
    })
}

/// 解析 ASR 矩阵场景名
pub fn parse_asr_matrix_scenario(scenario: &str) -> Option<ScenarioParts> {
    let stripped = scenario.strip_prefix("asr-matrix/")?;
    let parts: Vec<&str> = stripped.splitn(3, '/').collect();
    if parts.len() != 3 {
        return None;
    }
    let format_rate: Vec<&str> = parts[2].rsplitn(2, '-').collect();
    if format_rate.len() != 2 {
        return None;
    }
    Some(ScenarioParts {
        model: parts[0].to_string(),
        voice_or_language: parts[1].to_string(),
        format: format_rate[1].to_string(),
        sample_rate: format_rate[0].parse().ok()?,
    })
}

/// 场景组件
#[derive(Debug, Clone)]
pub struct ScenarioParts {
    pub model: String,
    pub voice_or_language: String,
    pub format: String,
    pub sample_rate: u32,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_filter_matrix_items_no_filter() {
        let items = vec![MatrixItem {
            provider: "qwen".into(),
            model: "cosyvoice-v1".into(),
            voice: "longwan".into(),
            format: "pcm".into(),
            sample_rate: 16000,
        }];
        let result = filter_matrix_items(&items, &MatrixFilter::default());
        assert_eq!(result.len(), 1);
    }

    #[test]
    fn test_filter_matrix_items_by_model() {
        let items = vec![
            MatrixItem {
                provider: "qwen".into(),
                model: "cosyvoice-v1".into(),
                voice: "longwan".into(),
                format: "pcm".into(),
                sample_rate: 16000,
            },
            MatrixItem {
                provider: "qwen".into(),
                model: "cosyvoice-v2".into(),
                voice: "longwan".into(),
                format: "pcm".into(),
                sample_rate: 16000,
            },
        ];
        let filter = MatrixFilter {
            model: Some(vec!["cosyvoice-v1".into()]),
            ..Default::default()
        };
        let result = filter_matrix_items(&items, &filter);
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].model, "cosyvoice-v1");
    }

    #[test]
    fn test_filter_matrix_items_multi() {
        let items = vec![
            MatrixItem {
                provider: "qwen".into(),
                model: "v1".into(),
                voice: "a".into(),
                format: "pcm".into(),
                sample_rate: 16000,
            },
            MatrixItem {
                provider: "qwen".into(),
                model: "v1".into(),
                voice: "a".into(),
                format: "mp3".into(),
                sample_rate: 16000,
            },
            MatrixItem {
                provider: "qwen".into(),
                model: "v1".into(),
                voice: "b".into(),
                format: "pcm".into(),
                sample_rate: 16000,
            },
        ];
        let filter = MatrixFilter {
            voice: Some(vec!["a".into()]),
            format: Some(vec!["pcm".into()]),
            ..Default::default()
        };
        let result = filter_matrix_items(&items, &filter);
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].voice, "a");
        assert_eq!(result[0].format, "pcm");
    }

    #[test]
    fn test_generate_scenario_name() {
        let item = MatrixItem {
            provider: "qwen".into(),
            model: "cosyvoice-v1".into(),
            voice: "longwan".into(),
            format: "pcm".into(),
            sample_rate: 16000,
        };
        let name = generate_matrix_scenario_name(&item);
        assert_eq!(name, "matrix/cosyvoice-v1/longwan/pcm-16000");
    }

    #[test]
    fn test_generate_asr_scenario_name() {
        let item = ASRMatrixItem {
            provider: "qwen".into(),
            model: "paraformer-realtime-v2".into(),
            language: "zh-CN".into(),
            format: "pcm".into(),
            sample_rate: Some(16000),
        };
        let name = generate_asr_matrix_scenario_name(&item);
        assert_eq!(name, "asr-matrix/paraformer-realtime-v2/zh-CN/pcm-16000");
    }

    #[test]
    fn test_parse_matrix_scenario() {
        let parts = parse_matrix_scenario("matrix/cosyvoice-v1/longwan/pcm-16000").unwrap();
        assert_eq!(parts.model, "cosyvoice-v1");
        assert_eq!(parts.voice_or_language, "longwan");
        assert_eq!(parts.format, "pcm");
        assert_eq!(parts.sample_rate, 16000);
    }

    #[test]
    fn test_parse_matrix_scenario_invalid() {
        assert!(parse_matrix_scenario("invalid").is_none());
        assert!(parse_matrix_scenario("matrix/only-two-parts").is_none());
    }

    #[test]
    fn test_filter_asr_matrix_items() {
        let items = vec![
            ASRMatrixItem {
                provider: "qwen".into(),
                model: "paraformer-realtime-v2".into(),
                language: "zh-CN".into(),
                format: "pcm".into(),
                sample_rate: Some(16000),
            },
            ASRMatrixItem {
                provider: "qwen".into(),
                model: "paraformer-realtime-v2".into(),
                language: "en-US".into(),
                format: "mp3".into(),
                sample_rate: Some(16000),
            },
        ];
        let filter = ASRMatrixFilter {
            language: Some(vec!["zh-CN".into()]),
            ..Default::default()
        };
        let result = filter_asr_matrix_items(&items, &filter);
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].language, "zh-CN");
    }
}
