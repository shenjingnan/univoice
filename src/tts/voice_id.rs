//! VoiceId 音色标识符与已知音色常量
//!
//! [`VoiceId`] 是 TTS 音色标识符的字符串新类型，支持两种使用场景：
//! - **已知音色**：通过 `voice_id` 模块中的常量赋值（支持 IDE 自动补全）
//! - **自定义音色**：通过 `VoiceId::new("custom-voice")` 或 `"custom".into()`
//!
//! 对应 TypeScript `src/types/voices/` 的类型定义，提供类似 `AcceptAnyString` 的体验。
//!
//! # 示例
//!
//! ```rust
//! use univoice::tts::VoiceId;
//! use univoice::tts::voice_id;
//!
//! // 使用已知常量（IDE 自动补全）
//! let v1: VoiceId = voice_id::glm::TONGTONG.into();
//!
//! // 自定义音色
//! let v2 = VoiceId::new("my-custom-voice");
//! ```

/// 音色标识符 —— 字符串新类型
///
/// 包装 `String`，接受任意字符串作为音色 ID，同时提供已知音色常量供 IDE 补全。
#[derive(Debug, Clone)]
pub struct VoiceId(String);

impl VoiceId {
    /// 从任意字符串创建 VoiceId
    pub fn new(id: impl Into<String>) -> Self {
        Self(id.into())
    }

    /// 返回底层字符串引用
    pub fn as_str(&self) -> &str {
        &self.0
    }

    /// 消费 self 返回内部 String
    pub fn into_string(self) -> String {
        self.0
    }
}

impl From<&str> for VoiceId {
    fn from(s: &str) -> Self {
        Self(s.to_string())
    }
}

impl From<String> for VoiceId {
    fn from(s: String) -> Self {
        Self(s)
    }
}

impl AsRef<str> for VoiceId {
    fn as_ref(&self) -> &str {
        &self.0
    }
}

impl std::fmt::Display for VoiceId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        self.0.fmt(f)
    }
}

impl PartialEq<str> for VoiceId {
    fn eq(&self, other: &str) -> bool {
        self.0 == other
    }
}

impl PartialEq<&str> for VoiceId {
    fn eq(&self, other: &&str) -> bool {
        self.0 == *other
    }
}

impl serde::Serialize for VoiceId {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        self.0.serialize(serializer)
    }
}

impl<'de> serde::Deserialize<'de> for VoiceId {
    fn deserialize<D: serde::Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        let s = String::deserialize(deserializer)?;
        Ok(Self(s))
    }
}

// ============================================================================
// 已知音色常量
// ============================================================================

/// 音色常量命名空间
///
/// 每个 Provider 对应一个子模块，模块内定义已知音色 ID 常量。
/// 输入 `voice_id::` 时 IDE 会弹出所有子模块，选择子模块后弹出该 Provider 的音色常量。
pub mod doubao {
    // ---- V2 系列 ----
    /// vv 音色 (V2)
    pub const VV: &str = "zh_female_vv_uranus_bigtts";
    /// 小荷 (V2)
    pub const XIAOHE: &str = "zh_female_xiaohe_uranus_bigtts";
    /// m191 (V2)
    pub const M191: &str = "zh_male_m191_uranus_bigtts";
    /// 桃成 (V2)
    pub const TAOCHENG: &str = "zh_male_taocheng_uranus_bigtts";
    /// 刘飞 (V2)
    pub const LIUFEI: &str = "zh_male_liufei_uranus_bigtts";
    /// 清新女声 (V2)
    pub const QINGXIN_NVSHENG: &str = "zh_female_qingxinnvsheng_uranus_bigtts";
    /// 灿灿 (V2)
    pub const CANCAN: &str = "zh_female_cancan_uranus_bigtts";
    /// 甜美校园 (V2)
    pub const TIANMEI_XIAOYUAN: &str = "zh_female_tianmeixiaoyuan_uranus_bigtts";
    /// 甜美桃子 (V2)
    pub const TIANMEI_TAOZI: &str = "zh_female_tianmeitaozi_uranus_bigtts";
    /// 爽快思思 (V2)
    pub const SHUANGKUAI_SISI: &str = "zh_female_shuangkuaisisi_uranus_bigtts";
    /// 沛琪 (V2)
    pub const PEIQI: &str = "zh_female_peiqi_uranus_bigtts";
    /// 邻家女孩 (V2)
    pub const LINJIA_NVHAI: &str = "zh_female_linjianvhai_uranus_bigtts";
    /// 少年自信 (V2)
    pub const SHAONIAN_ZIXIN: &str = "zh_male_shaonianzixin_uranus_bigtts";
    /// 孙悟空 (V2)
    pub const SUNWUKONG: &str = "zh_male_sunwukong_uranus_bigtts";
    /// Tim (V2, 英语)
    pub const TIM: &str = "en_male_tim_uranus_bigtts";
    /// Dacey (V2, 英语)
    pub const DACEY: &str = "en_female_dacey_uranus_bigtts";
    /// Stokie (V2, 英语)
    pub const STOKIE: &str = "en_female_stokie_uranus_bigtts";
    /// 可爱女生 (Saturn)
    pub const KEAI_NVSHENG_TOB: &str = "saturn_zh_female_keainvsheng_tob";
    /// 调皮公主 (Saturn)
    pub const TIAOPI_GONGZHU_TOB: &str = "saturn_zh_female_tiaopigongzhu_tob";

    // ---- Jupiter 系列 ----
    /// vv (Jupiter)
    pub const VV_JUPITER: &str = "zh_female_vv_jupiter_bigtts";
    /// 小荷 (Jupiter)
    pub const XIAOHE_JUPITER: &str = "zh_female_xiaohe_jupiter_bigtts";
    /// 云舟 (Jupiter)
    pub const YUNZHOU_JUPITER: &str = "zh_male_yunzhou_jupiter_bigtts";
    /// 小天 (Jupiter)
    pub const XIAOTIAN_JUPITER: &str = "zh_male_xiaotian_jupiter_bigtts";

    // ---- V1 经典 ----
    /// 甜美校园 (Moon) —— 默认音色
    pub const DEFAULT: &str = "zh_female_tianmeixiaoyuan_moon_bigtts";
    /// 灿灿 (Mars)
    pub const CANCAN_MARS: &str = "zh_female_cancan_mars_bigtts";
    /// 温柔小哥 (Mars)
    pub const WENROU_XIAOGE_MARS: &str = "zh_male_wenrouxiaoge_mars_bigtts";
    /// 邻家女孩 (Moon)
    pub const LINJIA_NVHAI_MOON: &str = "zh_female_linjianvhai_moon_bigtts";
    /// 阳光青年 (Moon)
    pub const YANGGUANG_QINGNIAN_MOON: &str = "zh_male_yangguangqingnian_moon_bigtts";
    /// 甜心小妹 (emo_v2)
    pub const TIANXIN_XIAOMEI_EMO: &str = "zh_female_tianxinxiaomei_emo_v2_mars_bigtts";
    /// 高冷御姐 (emo_v2)
    pub const GAOLENG_YUJIE_EMO: &str = "zh_female_gaolengyujie_emo_v2_mars_bigtts";
    /// 阳光青年 (emo_v2)
    pub const YANGGUANG_QINGNIAN_EMO: &str = "zh_male_yangguangqingnian_emo_v2_mars_bigtts";
    /// 北京小爷 (emo_v2)
    pub const BEIJING_XIAOYE_EMO: &str = "zh_male_beijingxiaoye_emo_v2_mars_bigtts";
}

/// GLM 音色常量
pub mod glm {
    /// 彤彤（默认）
    pub const TONGTONG: &str = "tongtong";
    /// 锤锤
    pub const CHUICHI: &str = "chuichui";
    /// 小陈
    pub const XIAOCHEN: &str = "xiaochen";
    /// 动动动物圈 jam
    pub const JAM: &str = "jam";
    /// 动动动物圈 kazi
    pub const KAZI: &str = "kazi";
    /// 动动动物圈 douji
    pub const DOUJI: &str = "douji";
    /// 动动动物圈 luodo
    pub const LUODO: &str = "luodo";
}

/// Minimax 音色常量
pub mod minimax {
    // ---- 中文（普通话）核心音色 ----
    /// 男声-青涩（默认）
    pub const DEFAULT: &str = "male-qn-qingse";
    /// 男声-青涩
    pub const MALE_QN_QINGSE: &str = "male-qn-qingse";
    /// 男声-精英
    pub const MALE_QN_JINGYING: &str = "male-qn-jingying";
    /// 男声-霸道
    pub const MALE_QN_BADAO: &str = "male-qn-badao";
    /// 男声-大学生
    pub const MALE_QN_DAXUESHENG: &str = "male-qn-daxuesheng";
    /// 少女
    pub const FEMALE_SHAONV: &str = "female-shaonv";
    /// 御姐
    pub const FEMALE_YUJIE: &str = "female-yujie";
    /// 成熟
    pub const FEMALE_CHENGSHU: &str = "female-chengshu";
    /// 甜美
    pub const FEMALE_TIANMEI: &str = "female-tianmei";
    /// 青涩精品
    pub const QINGSE_JINGPIN: &str = "male-qn-qingse-jingpin";
    /// 精英精品
    pub const JINGYING_JINGPIN: &str = "male-qn-jingying-jingpin";
    /// 霸道精品
    pub const BADAO_JINGPIN: &str = "male-qn-badao-jingpin";
    /// 大学生精品
    pub const DAXUESHENG_JINGPIN: &str = "male-qn-daxuesheng-jingpin";
    /// 少女精品
    pub const SHAONV_JINGPIN: &str = "female-shaonv-jingpin";
    /// 御姐精品
    pub const YUJIE_JINGPIN: &str = "female-yujie-jingpin";
    /// 成熟精品
    pub const CHENGSHU_JINGPIN: &str = "female-chengshu-jingpin";
    /// 甜美精品
    pub const TIANMEI_JINGPIN: &str = "female-tianmei-jingpin";
    /// 抒情之声 (中文)
    pub const LYRIC_VOICE: &str = "Chinese (Mandarin)_Lyrical_Voice";
    /// 新闻主播 (中文)
    pub const NEWS_ANCHOR: &str = "Chinese (Mandarin)_News_Anchor";
    /// 可靠高管 (中文)
    pub const RELIABLE_EXECUTIVE: &str = "Chinese (Mandarin)_Reliable_Executive";

    // ---- 英文 ----
    /// 优雅女士 (英文)
    pub const GRACEFUL_LADY: &str = "English_Graceful_Lady";
    /// 可靠男士 (英文)
    pub const TRUSTWORTHY_MAN: &str = "English_Trustworthy_Man";

    // ---- 日文 ----
    /// 知性前辈 (日文)
    pub const INTELLECTUAL_SENIOR: &str = "Japanese_IntellectualSenior";

    // ---- 韩文 ----
    /// 甜心女孩 (韩文)
    pub const SWEET_GIRL: &str = "Korean_SweetGirl";
    /// 开朗男友 (韩文)
    pub const CHEERFUL_BOYFRIEND: &str = "Korean_CheerfulBoyfriend";

    // ---- 西班牙文 ----
    /// 宁静女士 (西班牙文)
    pub const SERENE_WOMAN: &str = "Spanish_SereneWoman";
}

/// Qwen/CosyVoice 音色常量
pub mod qwen {
    /// 默认模型
    pub const DEFAULT_MODEL: &str = "cosyvoice-v3-flash";
    /// 默认音色
    pub const DEFAULT: &str = "longxiaochun_v3";

    // ---- v1 音色 ----
    /// 龙婉 (v1)
    pub const LONGWAN: &str = "longwan";
    /// 龙橙 (v1)
    pub const LONGCHENG: &str = "longcheng";
    /// 龙华 (v1)
    pub const LONGHUA: &str = "longhua";
    /// 龙小春 (v1)
    pub const LONGXIAOCHUN: &str = "longxiaochun";
    /// 龙小夏 (v1)
    pub const LONGXIAOXIA: &str = "longxiaoxia";

    // ---- v3-flash 音色（常用） ----
    /// 龙小春 v3
    pub const LONGXIAOCHUN_V3: &str = "longxiaochun_v3";
    /// 龙小夏 v3
    pub const LONGXIAOXIA_V3: &str = "longxiaoxia_v3";
    /// 龙彪彪 v3
    pub const LONGHUIHU_V3: &str = "longhuhu_v3";
    /// 龙泡泡 v3
    pub const LONGPAOPAO_V3: &str = "longpaopao_v3";
    /// 龙灵儿 v3
    pub const LONGLING_V3: &str = "longling_v3";
    /// 龙姗姗 v3
    pub const LONGSHANSHAN_V3: &str = "longshanshan_v3";
    /// 龙妞妞 v3
    pub const LONGNIUNIU_V3: &str = "longniuniu_v3";
    /// 龙华 v3
    pub const LONGHUA_V3: &str = "longhua_v3";
    /// 龙橙 v3
    pub const LONGCHENG_V3: &str = "longcheng_v3";
    /// 龙颜 v3
    pub const LONGYAN_V3: &str = "longyan_v3";
    /// 龙天 v3
    pub const LONGTIAN_V3: &str = "longtian_v3";
    /// 龙炎 v3
    pub const LONGYAN2_V3: &str = "longyan_v3";
    /// 龙万 v3
    pub const LONGWAN_V3: &str = "longwan_v3";
    /// 龙强 v3
    pub const LONGQIANG_V3: &str = "longqiang_v3";
    /// 龙皓 v3
    pub const LONGHAO_V3: &str = "longhao_v3";
    /// 龙拾 v3
    pub const LONGSHUO_V3: &str = "longshuo_v3";
    /// 龙叔 v3
    pub const LONGSHU_V3: &str = "longshu_v3";

    // ---- v3-plus 音色 ----
    /// 龙昂扬 (v3+)
    pub const LONGANYANG: &str = "longanyang";
    /// 龙欢欢 (v3+)
    pub const LONGANHUAN: &str = "longanhuan";
}

/// Qwen Realtime TTS 音色常量
pub mod qwen_realtime {
    /// Cherry（默认）
    pub const DEFAULT: &str = "Cherry";
    pub const CHERRY: &str = "Cherry";
    pub const SERENA: &str = "Serena";
    pub const ETHAN: &str = "Ethan";
    pub const CHELSIE: &str = "Chelsie";
    pub const MOMO: &str = "Momo";
    pub const VIVIAN: &str = "Vivian";
    pub const MOON: &str = "Moon";
    pub const MAIA: &str = "Maia";
    pub const KAI: &str = "Kai";
    pub const NOFISH: &str = "Nofish";
    pub const BELLA: &str = "Bella";
    pub const JENNIFER: &str = "Jennifer";
    pub const RYAN: &str = "Ryan";
    pub const KATERINA: &str = "Katerina";
    pub const AIDEN: &str = "Aiden";
    pub const MIA: &str = "Mia";
    pub const MOCHI: &str = "Mochi";
    pub const BELLONA: &str = "Bellona";
    pub const VINCENT: &str = "Vincent";
    pub const BUNNY: &str = "Bunny";
    pub const NEIL: &str = "Neil";
    pub const ELIAS: &str = "Elias";
    pub const ARTHUR: &str = "Arthur";
    pub const NINI: &str = "Nini";
    pub const SEREN: &str = "Seren";
    pub const PIP: &str = "Pip";
    pub const STELLA: &str = "Stella";
    pub const BODEGA: &str = "Bodega";
    pub const SONRISA: &str = "Sonrisa";
    pub const ALEK: &str = "Alek";
    pub const DOLCE: &str = "Dolce";
    pub const SOHEE: &str = "Sohee";
    pub const LENN: &str = "Lenn";
    pub const EMILIEN: &str = "Emilien";
    pub const ANDRE: &str = "Andre";
    pub const JADA: &str = "Jada";
    pub const DYLAN: &str = "Dylan";
    pub const LI: &str = "Li";
    pub const MARCUS: &str = "Marcus";
    pub const ROY: &str = "Roy";
    pub const PETER: &str = "Peter";
    pub const SUNNY: &str = "Sunny";
    pub const ERIC: &str = "Eric";
    pub const ROCKY: &str = "Rocky";
    pub const KIKI: &str = "Kiki";
}

/// Gemini TTS 音色常量
pub mod gemini {
    /// Zephyr——明亮（默认）
    pub const DEFAULT: &str = "Zephyr";
    pub const ZEPHYR: &str = "Zephyr";
    pub const PUCK: &str = "Puck";
    pub const CHARON: &str = "Charon";
    pub const KORE: &str = "Kore";
    pub const FENRIR: &str = "Fenrir";
    pub const LEDA: &str = "Leda";
    pub const ORUS: &str = "Orus";
    pub const AOEDE: &str = "Aoede";
    pub const CALLIRRHOE: &str = "Callirrhoe";
    pub const AUTONOE: &str = "Autonoe";
    pub const ENCELADUS: &str = "Enceladus";
    pub const IAPETUS: &str = "Iapetus";
    pub const UMBRIEL: &str = "Umbriel";
    pub const ALGIEBA: &str = "Algieba";
    pub const DESPINA: &str = "Despina";
    pub const ERINOME: &str = "Erinome";
    pub const ALGENIB: &str = "Algenib";
    pub const RASALGETHI: &str = "Rasalgethi";
    pub const LAOMEDEIA: &str = "Laomedeia";
    pub const ACHERNAR: &str = "Achernar";
    pub const ALNILAM: &str = "Alnilam";
    pub const SCHEDAR: &str = "Schedar";
    pub const GACRUX: &str = "Gacrux";
    pub const PULCHERRIMA: &str = "Pulcherrima";
    pub const ACHIRD: &str = "Achird";
    pub const VINDEMIATRIX: &str = "Vindemiatrix";
    pub const SADACHBIA: &str = "Sadachbia";
    pub const SADALTAGER: &str = "Sadaltager";
    pub const SULAFAT: &str = "Sulafat";
}

/// OpenAI TTS 音色常量
pub mod openai {
    /// 预设 1（默认）
    pub const ALLOY: &str = "alloy";
    /// 预设 2
    pub const ECHO: &str = "echo";
    /// 预设 3
    pub const FABLE: &str = "fable";
    /// 预设 4
    pub const NOVA: &str = "nova";
    /// 预设 5
    pub const SHIMMER: &str = "shimmer";
    /// 预设 6
    pub const ASH: &str = "ash";
    /// 预设 7
    pub const BALLAD: &str = "ballad";
    /// 预设 8
    pub const CORAL: &str = "coral";
    /// 预设 9
    pub const SAGE: &str = "sage";
    /// 预设 10
    pub const VERSE: &str = "verse";
}

/// Xfyun 音色常量
pub mod xfyun {
    /// x5_lingxiaoxuan_flow（默认）
    pub const DEFAULT: &str = "x5_lingxiaoxuan_flow";
    /// 暖心磁性男声
    pub const X6_WENNUANCIXING: &str = "x6_wennuancixingnansheng_mini";
    /// 小奶狗弟弟
    pub const X6_XIAONAIGOU: &str = "x6_xiaonaigoudidi_mini";
    /// 娱乐新闻女声
    pub const X6_YULEXINWEN: &str = "x6_yulexinwennvsheng_mini";
    /// 灵小萱（流式）
    pub const X5_LINGXIAOXUAN: &str = "x5_lingxiaoxuan_flow";
    /// 灵飞逸（流式）
    pub const X5_LINGFEIYI: &str = "x5_lingfeiyi_flow";
    /// 灵小琪（流式）
    pub const X5_LINGXIAOQI: &str = "x5_lingxiaoqi_flow";
}

#[cfg(test)]
mod tests {
    use super::*;

    // -------- V1-V5: VoiceId 基本操作 --------

    #[test]
    fn test_v1_from_str() {
        let v: VoiceId = "hello".into();
        assert_eq!(v.as_str(), "hello");
    }

    #[test]
    fn test_v2_from_string() {
        let v: VoiceId = String::from("world").into();
        assert_eq!(v.as_str(), "world");
    }

    #[test]
    fn test_v3_new() {
        let v = VoiceId::new("custom");
        assert_eq!(v.as_str(), "custom");
    }

    #[test]
    fn test_v4_display() {
        let v = VoiceId::new("test-voice");
        assert_eq!(v.to_string(), "test-voice");
    }

    #[test]
    fn test_v5_as_ref() {
        let v: VoiceId = "ref-me".into();
        assert_eq!(v.as_ref(), "ref-me");
    }

    #[test]
    fn test_v6_into_string() {
        let v: VoiceId = "owned".into();
        assert_eq!(v.into_string(), "owned");
    }

    #[test]
    fn test_v7_eq_str() {
        let v: VoiceId = "tongtong".into();
        assert_eq!(v, "tongtong");
    }

    #[test]
    fn test_v8_eq_ref_str() {
        let v: VoiceId = "glm".into();
        assert_eq!(v.as_str(), "glm");
    }

    // -------- K1-K6: 音色常量 --------

    #[test]
    fn test_k1_glm_constants() {
        assert_eq!(glm::TONGTONG, "tongtong");
        assert_eq!(glm::CHUICHI, "chuichui");
        assert_eq!(glm::XIAOCHEN, "xiaochen");
    }

    #[test]
    fn test_k2_qwen_constants() {
        assert_eq!(qwen::DEFAULT, "longxiaochun_v3");
        assert_eq!(qwen::LONGXIAOCHUN, "longxiaochun");
    }

    #[test]
    fn test_k3_qwen_realtime_constants() {
        assert_eq!(qwen_realtime::DEFAULT, "Cherry");
        assert_eq!(qwen_realtime::CHERRY, "Cherry");
        assert!(!qwen_realtime::SERENA.is_empty());
    }

    #[test]
    fn test_k4_gemini_constants() {
        assert_eq!(gemini::DEFAULT, "Zephyr");
        assert!(!gemini::PUCK.is_empty());
    }

    #[test]
    fn test_k5_minimax_constants() {
        assert_eq!(minimax::DEFAULT, "male-qn-qingse");
    }

    #[test]
    fn test_k6_openai_constants() {
        assert_eq!(openai::ALLOY, "alloy");
        assert_eq!(openai::ECHO, "echo");
        assert_eq!(openai::FABLE, "fable");
        assert_eq!(openai::NOVA, "nova");
        assert_eq!(openai::SHIMMER, "shimmer");
        assert_eq!(openai::ASH, "ash");
        assert_eq!(openai::BALLAD, "ballad");
        assert_eq!(openai::CORAL, "coral");
        assert_eq!(openai::SAGE, "sage");
        assert_eq!(openai::VERSE, "verse");
    }

    #[test]
    fn test_k7_doubao_constants() {
        assert_eq!(doubao::DEFAULT, "zh_female_tianmeixiaoyuan_moon_bigtts");
        assert_eq!(doubao::VV, "zh_female_vv_uranus_bigtts");
    }

    // -------- S1-S2: serde 序列化/反序列化 --------

    #[test]
    fn test_s1_serde_roundtrip() {
        let v: VoiceId = "test-voice-id".into();
        let json = serde_json::to_string(&v).unwrap();
        assert_eq!(json, "\"test-voice-id\"");

        let deserialized: VoiceId = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized, "test-voice-id");
    }

    #[test]
    fn test_s2_serde_empty_string() {
        let v: VoiceId = "".into();
        let json = serde_json::to_string(&v).unwrap();
        assert_eq!(json, "\"\"");

        let deserialized: VoiceId = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.as_str(), "");
    }

    // -------- P1-P2: PartialEq 边界 --------

    #[test]
    fn test_p1_eq_str() {
        let v: VoiceId = "hello".into();
        assert!(v == "hello");
        assert!(v != "world");
    }

    #[test]
    fn test_p2_eq_ref_str() {
        let v: VoiceId = "hello".into();
        let s: &str = "hello";
        let rs: &&str = &s;
        assert_eq!(v, *rs);
    }

    // -------- X1: xfyun constants --------

    #[test]
    fn test_x1_xfyun_constants() {
        assert_eq!(xfyun::DEFAULT, "x5_lingxiaoxuan_flow");
        assert_eq!(xfyun::X5_LINGXIAOXUAN, "x5_lingxiaoxuan_flow");
        assert_eq!(xfyun::X5_LINGFEIYI, "x5_lingfeiyi_flow");
    }
}
