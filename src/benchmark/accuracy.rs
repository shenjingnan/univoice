//! ASR 准确率计算
//!
//! Levenshtein 编辑距离 + CER（字符错误率）+ 准确率计算。

/// 计算 Levenshtein 编辑距离
///
/// 使用标准二维 DP 算法，支持 Unicode 字符（通过 `.chars()` 遍历）。
pub fn edit_distance(expected: &str, actual: &str) -> u32 {
    let _m = expected.chars().count();
    let n = actual.chars().count();

    // 优化：使用两行滚动数组减少内存
    let mut prev: Vec<u32> = (0..=n as u32).collect();
    let mut curr = vec![0u32; n + 1];

    for (i, ch_e) in expected.chars().enumerate() {
        curr[0] = (i + 1) as u32;
        for (j, ch_a) in actual.chars().enumerate() {
            let cost = if ch_e == ch_a { 0 } else { 1 };
            curr[j + 1] = (prev[j + 1] + 1) // 删除
                .min(curr[j] + 1) // 插入
                .min(prev[j] + cost); // 替换
        }
        std::mem::swap(&mut prev, &mut curr);
    }

    prev[n]
}

/// 文本标准化：去除非中英文数字字符并转小写
///
/// 保留：中文字符（U+4E00..=U+9FA5）、ASCII 字母数字
pub fn normalize_text(text: &str) -> String {
    text.chars()
        .filter(|c| c.is_ascii_alphanumeric() || ('\u{4e00}'..='\u{9fa5}').contains(c))
        .collect::<String>()
        .to_lowercase()
}

/// 计算字符错误率（CER）
///
/// CER = edit_distance / expected_length
/// 当 expected 为空时：若 actual 也为空返回 0.0，否则返回 1.0
pub fn calculate_cer(expected: &str, actual: &str) -> f64 {
    let exp_norm = normalize_text(expected);
    let act_norm = normalize_text(actual);

    if exp_norm.is_empty() {
        return if act_norm.is_empty() { 0.0 } else { 1.0 };
    }

    let dist = edit_distance(&exp_norm, &act_norm);
    dist as f64 / exp_norm.chars().count() as f64
}

/// 计算准确率
///
/// accuracy = max(0, 1 - CER)
pub fn calculate_accuracy(expected: &str, actual: &str) -> f64 {
    (1.0 - calculate_cer(expected, actual)).max(0.0)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_edit_distance_identical() {
        assert_eq!(edit_distance("hello", "hello"), 0);
    }

    #[test]
    fn test_edit_distance_empty() {
        assert_eq!(edit_distance("", "abc"), 3);
        assert_eq!(edit_distance("abc", ""), 3);
        assert_eq!(edit_distance("", ""), 0);
    }

    #[test]
    fn test_edit_distance_substitution() {
        assert_eq!(edit_distance("cat", "car"), 1);
    }

    #[test]
    fn test_edit_distance_insertion() {
        assert_eq!(edit_distance("cat", "cast"), 1);
    }

    #[test]
    fn test_edit_distance_deletion() {
        assert_eq!(edit_distance("cast", "cat"), 1);
    }

    #[test]
    fn test_edit_distance_chinese() {
        assert_eq!(edit_distance("你好世界", "你好世界"), 0);
        assert_eq!(edit_distance("你好世界", "你好"), 2);
    }

    #[test]
    fn test_normalize_text_remove_punctuation() {
        let result = normalize_text("你好，世界！Hello, World! 123");
        assert_eq!(result, "你好世界helloworld123");
    }

    #[test]
    fn test_normalize_text_lowercase() {
        assert_eq!(normalize_text("HELLO"), "hello");
    }

    #[test]
    fn test_calculate_cer_perfect() {
        let cer = calculate_cer("你好世界", "你好世界");
        assert!((cer - 0.0).abs() < 1e-6);
    }

    #[test]
    fn test_calculate_cer_partial() {
        let cer = calculate_cer("你好世界", "你好");
        assert!((cer - 0.5).abs() < 1e-6);
    }

    #[test]
    fn test_calculate_cer_empty_expected() {
        assert!((calculate_cer("", "") - 0.0).abs() < 1e-6);
        assert!((calculate_cer("", "abc") - 1.0).abs() < 1e-6);
    }

    #[test]
    fn test_calculate_accuracy_perfect() {
        let acc = calculate_accuracy("你好世界", "你好世界");
        assert!((acc - 1.0).abs() < 1e-6);
    }

    #[test]
    fn test_calculate_accuracy_zero() {
        let acc = calculate_accuracy("你好", "");
        assert!((acc - 0.0).abs() < 1e-6);
    }

    #[test]
    fn test_normalize_punctuation_impact() {
        // 标点不影响 CER
        let cer1 = calculate_cer("你好，世界！", "你好世界");
        let cer2 = calculate_cer("你好世界", "你好世界");
        assert!((cer1 - cer2).abs() < 1e-6);
    }
}
