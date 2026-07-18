use std::collections::HashMap;
use std::sync::{LazyLock, Mutex};

use crate::tts::error::TtsError;
use crate::tts::traits::TtsProvider;
use crate::tts::types::BaseTtsOption;

type ProviderFactory = Box<dyn Fn(BaseTtsOption) -> Box<dyn TtsProvider> + Send + Sync>;

static REGISTRY: LazyLock<Mutex<HashMap<String, ProviderFactory>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));

/// 注册 TTS Provider
pub fn register_tts(name: &str, factory: ProviderFactory) {
    REGISTRY.lock().unwrap().insert(name.to_string(), factory);
}

/// 通过名称和配置创建 TTS Provider 实例
pub fn create_tts(
    provider_name: &str,
    options: BaseTtsOption,
) -> Result<Box<dyn TtsProvider>, TtsError> {
    let registry = REGISTRY.lock().unwrap();
    let factory = registry.get(provider_name).ok_or_else(|| {
        TtsError::InvalidParameter(format!("TTS provider '{}' not found", provider_name))
    })?;
    Ok(factory(options))
}

/// 获取所有已注册的 Provider 名称
pub fn get_tts_providers() -> Vec<String> {
    REGISTRY.lock().unwrap().keys().cloned().collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::tts::provider::{QwenTts, QwenTtsOption};

    #[test]
    fn test_g1_register_and_create() {
        REGISTRY.lock().unwrap().clear();

        register_tts(
            "qwen",
            Box::new(|options| {
                Box::new(QwenTts::new(QwenTtsOption {
                    base: options,
                    ..Default::default()
                }))
            }),
        );

        let options = BaseTtsOption {
            api_key: Some("test-key".into()),
            ..Default::default()
        };
        let provider = create_tts("qwen", options).unwrap();
        assert_eq!(provider.name(), "qwen");
    }

    #[test]
    fn test_g2_create_unknown_provider() {
        REGISTRY.lock().unwrap().clear();
        let result = create_tts("nonexistent", BaseTtsOption::default());
        assert!(matches!(result, Err(TtsError::InvalidParameter(_))));
    }

    #[test]
    fn test_g3_register_overwrite() {
        REGISTRY.lock().unwrap().clear();

        register_tts(
            "test_provider",
            Box::new(|_| {
                Box::new(QwenTts::new(QwenTtsOption {
                    base: BaseTtsOption::default(),
                    ..Default::default()
                }))
            }),
        );

        register_tts(
            "test_provider",
            Box::new(|_| {
                Box::new(QwenTts::new(QwenTtsOption {
                    base: BaseTtsOption::default(),
                    ..Default::default()
                }))
            }),
        );

        let providers = get_tts_providers();
        assert_eq!(providers.len(), 1);
        assert!(providers.contains(&"test_provider".to_string()));
    }
}
