use std::collections::HashMap;
use std::sync::{LazyLock, Mutex};

use crate::asr::DoubaoAsrOption;
use crate::asr::error::AsrError;
use crate::asr::traits::AsrProvider;

type ProviderFactory = Box<dyn Fn(DoubaoAsrOption) -> Box<dyn AsrProvider> + Send + Sync>;

static REGISTRY: LazyLock<Mutex<HashMap<String, ProviderFactory>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));

/// 注册 ASR Provider
pub fn register_provider(name: &str, factory: ProviderFactory) {
    REGISTRY.lock().unwrap().insert(name.to_string(), factory);
}

/// 通过名称和配置创建 ASR Provider 实例
pub fn create_asr(
    provider_name: &str,
    options: DoubaoAsrOption,
) -> Result<Box<dyn AsrProvider>, AsrError> {
    let registry = REGISTRY.lock().unwrap();
    let factory = registry.get(provider_name).ok_or_else(|| {
        AsrError::InvalidParameter(format!("ASR provider '{}' not found", provider_name))
    })?;
    Ok(factory(options))
}

/// 获取所有已注册的 Provider 名称
pub fn get_providers() -> Vec<String> {
    REGISTRY.lock().unwrap().keys().cloned().collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::asr::provider::DoubaoAsr;

    #[test]
    fn test_g1_register_and_create() {
        // 清理注册表
        REGISTRY.lock().unwrap().clear();

        register_provider(
            "doubao",
            Box::new(|options| Box::new(DoubaoAsr::new(options))),
        );

        let options = DoubaoAsrOption {
            app_key: Some("test".into()),
            access_key: Some("test".into()),
            ..Default::default()
        };
        let provider = create_asr("doubao", options).unwrap();
        assert_eq!(provider.name(), "doubao");
    }

    #[test]
    fn test_g2_create_unknown_provider() {
        REGISTRY.lock().unwrap().clear();
        let result = create_asr("nonexistent", DoubaoAsrOption::default());
        assert!(matches!(result, Err(AsrError::InvalidParameter(_))));
    }

    #[test]
    fn test_g3_register_overwrite() {
        REGISTRY.lock().unwrap().clear();

        register_provider(
            "test_provider",
            Box::new(|_| Box::new(DoubaoAsr::new(DoubaoAsrOption::default()))),
        );

        // 重新注册同名 provider（覆盖）
        register_provider(
            "test_provider",
            Box::new(|_| Box::new(DoubaoAsr::new(DoubaoAsrOption::default()))),
        );

        let providers = get_providers();
        assert_eq!(providers.len(), 1);
        assert!(providers.contains(&"test_provider".to_string()));
    }
}
