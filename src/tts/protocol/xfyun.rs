//! 科大讯飞超拟人语音合成 WebSocket 协议实现
//!
//! 对应 TypeScript 端的 `src/tts/protocols/xfyun.ts`。
//!
//! 参考文档:
//! - 超拟人合成: wss://cbm01.cn-huabei-1.xf-yun.com/v1/private/mcd9m97e6
//!
//! 协议特点:
//! - 双向流式 WebSocket（JSON 文本帧）
//! - HMAC-SHA256 鉴权（与 ASR 共享，复用 [`crate::asr::protocol::xfyun::build_auth_url`]）
//! - 请求/响应均为 JSON 格式
//! - 支持 status=0/1/2 流式分段发送

use base64::Engine;
use serde::Deserialize;

/// 复用 ASR 模块的讯飞鉴权 URL 构建函数
///
/// 超拟人 TTS 与 IAT v2 使用完全相同的 HMAC-SHA256 鉴权流程，
/// 仅 host/path 不同。
pub use crate::asr::protocol::xfyun::build_auth_url;

// ============================== 常量 ==============================

/// 超拟人合成 WebSocket 端点 Host
pub const XFYUN_TTS_HOST: &str = "cbm01.cn-huabei-1.xf-yun.com";

/// 超拟人合成 WebSocket 端点 Path
pub const XFYUN_TTS_PATH: &str = "/v1/private/mcd9m97e6";

/// 默认发音人
pub const XFYUN_DEFAULT_VOICE: &str = "x5_lingxiaoxuan_flow";

/// 默认采样率
pub const XFYUN_DEFAULT_SAMPLE_RATE: u32 = 24000;

/// 默认音频格式
pub const XFYUN_DEFAULT_ENCODING: &str = "lame";

/// 可选参数默认值
const DEFAULT_BGS: u32 = 0;
const DEFAULT_REG: u32 = 0;
const DEFAULT_RDN: u32 = 0;
const DEFAULT_RHY: u32 = 0;

// ============================== 协议选项 ==============================

/// 超拟人 TTS 协议配置选项
#[derive(Debug, Clone)]
pub struct XfyunTtsProtocolOptions {
    pub app_id: String,
    pub vcn: String,
    pub speed: u32,
    pub volume: u32,
    pub pitch: u32,
    pub encoding: String,
    pub sample_rate: u32,
    pub bgs: u32,
    pub reg: u32,
    pub rdn: u32,
    pub rhy: u32,
    /// 口语化等级（仅 x4 系列发音人支持）
    pub oral_level: Option<String>,
    /// 是否通过大模型进行口语化（仅 x4 系列发音人支持）
    pub spark_assist: Option<u32>,
    /// 是否关闭服务端拆句（仅 x4 系列发音人支持）
    pub stop_split: Option<u32>,
    /// 是否保留原书面语的样子（仅 x4 系列发音人支持）
    pub remain: Option<u32>,
}

impl Default for XfyunTtsProtocolOptions {
    fn default() -> Self {
        Self {
            app_id: String::new(),
            vcn: XFYUN_DEFAULT_VOICE.into(),
            speed: 50,
            volume: 50,
            pitch: 50,
            encoding: XFYUN_DEFAULT_ENCODING.into(),
            sample_rate: XFYUN_DEFAULT_SAMPLE_RATE,
            bgs: DEFAULT_BGS,
            reg: DEFAULT_REG,
            rdn: DEFAULT_RDN,
            rhy: DEFAULT_RHY,
            oral_level: None,
            spark_assist: None,
            stop_split: None,
            remain: None,
        }
    }
}

// ============================== 请求构建 ==============================

/// 创建 TTS 请求体 JSON 字符串
///
/// # 参数
/// - `options`: 协议配置（发音人、语速、音量等）
/// - `text`: 待合成文本（plain text，函数内部 base64 编码）
/// - `status`: 数据状态：0-开始, 1-中间, 2-结束（一次性合成直接传 2）
/// - `seq`: 数据序号
pub fn create_request_payload(
    options: &XfyunTtsProtocolOptions,
    text: &str,
    status: u32,
    seq: u32,
) -> String {
    let text_b64 = base64::engine::general_purpose::STANDARD.encode(text);

    let tts_param = serde_json::json!({
        "vcn": options.vcn,
        "speed": options.speed,
        "volume": options.volume,
        "pitch": options.pitch,
        "bgs": options.bgs,
        "reg": options.reg,
        "rdn": options.rdn,
        "rhy": options.rhy,
        "audio": {
            "encoding": options.encoding,
            "sample_rate": options.sample_rate,
            "channels": 1,
            "bit_depth": 16,
            "frame_size": 0,
        }
    });

    let mut payload = serde_json::json!({
        "header": {
            "app_id": options.app_id,
            "status": status,
        },
        "parameter": {
            "tts": tts_param,
        },
        "payload": {
            "text": {
                "encoding": "utf8",
                "compress": "raw",
                "format": "plain",
                "status": status,
                "seq": seq,
                "text": text_b64,
            }
        }
    });

    // 条件插入 oral 参数（仅 x4 系列发音人支持）
    if options.oral_level.is_some()
        || options.spark_assist.is_some()
        || options.stop_split.is_some()
        || options.remain.is_some()
    {
        let mut oral = serde_json::Map::new();
        if let Some(ref level) = options.oral_level {
            oral.insert("oral_level".into(), serde_json::json!(level));
        }
        if let Some(v) = options.spark_assist {
            oral.insert("spark_assist".into(), serde_json::json!(v));
        }
        if let Some(v) = options.stop_split {
            oral.insert("stop_split".into(), serde_json::json!(v));
        }
        if let Some(v) = options.remain {
            oral.insert("remain".into(), serde_json::json!(v));
        }
        payload["parameter"]["oral"] = serde_json::Value::Object(oral);
    }

    payload.to_string()
}

// ============================== 响应类型 ==============================

/// 超拟人 TTS 响应
#[derive(Debug, Deserialize)]
pub struct XfyunTtsResponse {
    pub header: XfyunTtsHeader,
    #[serde(default)]
    pub payload: Option<XfyunTtsPayload>,
}

#[derive(Debug, Deserialize)]
pub struct XfyunTtsHeader {
    pub code: i32,
    #[serde(default)]
    pub message: String,
    #[serde(default)]
    pub sid: String,
    #[serde(default)]
    pub status: u32,
}

#[derive(Debug, Deserialize)]
pub struct XfyunTtsPayload {
    #[serde(default)]
    pub audio: Option<XfyunTtsAudio>,
}

#[derive(Debug, Deserialize)]
pub struct XfyunTtsAudio {
    #[serde(default)]
    pub encoding: String,
    #[serde(default)]
    pub sample_rate: u32,
    #[serde(default)]
    pub channels: u32,
    #[serde(default)]
    pub bit_depth: u32,
    #[serde(default)]
    pub status: u32,
    #[serde(default)]
    pub seq: u32,
    #[serde(default)]
    pub frame_size: u32,
    /// base64 编码的音频数据
    #[serde(default)]
    pub audio: String,
}

// ============================== 响应工具函数 ==============================

/// 解析 TTS WebSocket 响应 JSON
pub fn parse_response(data: &str) -> Result<XfyunTtsResponse, serde_json::Error> {
    serde_json::from_str(data)
}

/// 从响应中提取并解码音频数据
///
/// 返回 `Some(Vec<u8>)` 如果存在音频数据，否则返回 `None`。
pub fn extract_audio(response: &XfyunTtsResponse) -> Option<Vec<u8>> {
    let audio_b64 = response.payload.as_ref()?.audio.as_ref()?.audio.as_str();
    if audio_b64.is_empty() {
        return None;
    }
    base64::engine::general_purpose::STANDARD
        .decode(audio_b64)
        .ok()
}

/// 判断响应是否成功（code=0）
pub fn is_success(response: &XfyunTtsResponse) -> bool {
    response.header.code == 0
}

/// 判断响应是否为最后一帧（header.status=2）
pub fn is_finished(response: &XfyunTtsResponse) -> bool {
    response.header.status == 2
}

// ============================== 音频编码映射 ==============================

/// 将音频格式映射为讯飞编码
///
/// | 输入格式 | Xfyun 编码 |
/// |---------|-----------|
/// | mp3     | lame      |
/// | pcm     | raw       |
/// | opus    | opus      |
/// | 其他    | lame（默认) |
pub fn map_audio_encoding(format: &str) -> &'static str {
    match format {
        "mp3" => "lame",
        "pcm" => "raw",
        "opus" => "opus",
        _ => "lame",
    }
}

// ============================== 发音人列表 ==============================

/// 发音人信息
#[derive(Debug, Clone)]
pub struct XfyunVoice {
    pub vcn: &'static str,
    pub name: &'static str,
    pub gender: &'static str,
    pub language: &'static str,
}

/// 获取所有支持的超拟人 TTS 发音人
pub fn list_voices() -> Vec<XfyunVoice> {
    vec![
        // x6 系列（最新版）
        XfyunVoice {
            vcn: "x6_wennuancixingnansheng_mini",
            name: "温暖磁性男声",
            gender: "男",
            language: "中文普通话",
        },
        XfyunVoice {
            vcn: "x6_xiaonaigoudidi_mini",
            name: "小奶狗弟弟",
            gender: "男",
            language: "中文普通话",
        },
        XfyunVoice {
            vcn: "x6_shibingnvsheng_mini",
            name: "士兵女声",
            gender: "女",
            language: "中文普通话",
        },
        XfyunVoice {
            vcn: "x6_kongbunvsheng_mini",
            name: "恐怖女声",
            gender: "女",
            language: "中文普通话",
        },
        XfyunVoice {
            vcn: "x6_yulexinwennvsheng_mini",
            name: "娱乐新闻女声",
            gender: "女",
            language: "中文普通话",
        },
        XfyunVoice {
            vcn: "x6_wenrounansheng_mini",
            name: "温柔男声",
            gender: "男",
            language: "中文普通话",
        },
        XfyunVoice {
            vcn: "x6_jingqudaolannvsheng_mini",
            name: "景区导览女声",
            gender: "女",
            language: "中文普通话",
        },
        XfyunVoice {
            vcn: "x6_daqixuanchuanpiannansheng_mini",
            name: "大气宣传片男声",
            gender: "男",
            language: "中文普通话",
        },
        XfyunVoice {
            vcn: "x6_cuishounvsheng_pro",
            name: "催收女声",
            gender: "女",
            language: "中文普通话",
        },
        XfyunVoice {
            vcn: "x6_yingxiaonv_pro",
            name: "营销女声",
            gender: "女",
            language: "中文普通话",
        },
        XfyunVoice {
            vcn: "x6_huanlemianbao_pro",
            name: "海绵宝宝",
            gender: "男",
            language: "中文普通话",
        },
        XfyunVoice {
            vcn: "x6_xiangruiyingyu_pro",
            name: "商务殷语",
            gender: "男",
            language: "中文普通话",
        },
        XfyunVoice {
            vcn: "x6_taiqiangnuannan_pro",
            name: "台湾腔温柔男声",
            gender: "男",
            language: "台湾话",
        },
        XfyunVoice {
            vcn: "x6_wumeinv_pro",
            name: "妩媚姐姐",
            gender: "女",
            language: "中文普通话",
        },
        XfyunVoice {
            vcn: "x6_lingbosong_pro",
            name: "聆伯松",
            gender: "男",
            language: "中文普通话",
        },
        XfyunVoice {
            vcn: "x6_dudulibao_pro",
            name: "少女可莉",
            gender: "女",
            language: "中文普通话",
        },
        XfyunVoice {
            vcn: "x6_huajidama_pro",
            name: "滑稽大妈",
            gender: "女",
            language: "中文普通话",
        },
        XfyunVoice {
            vcn: "x6_huoposhaonian_pro",
            name: "活泼少年",
            gender: "男",
            language: "中文普通话",
        },
        XfyunVoice {
            vcn: "x6_lingxiaoxue_pro",
            name: "聆小雪",
            gender: "女",
            language: "中文普通话",
        },
        XfyunVoice {
            vcn: "x6_gufengxianv_mini",
            name: "古风侠女",
            gender: "女",
            language: "中文普通话",
        },
        XfyunVoice {
            vcn: "x6_wuyediantai_mini",
            name: "午夜电台",
            gender: "女",
            language: "中文普通话",
        },
        XfyunVoice {
            vcn: "x6_tiexinnanyou_mini",
            name: "贴心男友",
            gender: "男",
            language: "中文普通话",
        },
        XfyunVoice {
            vcn: "x6_lingxiaoli_pro",
            name: "聆小璃",
            gender: "女",
            language: "中文普通话",
        },
        XfyunVoice {
            vcn: "x6_xiaoqiChat_pro",
            name: "聆小琪",
            gender: "女",
            language: "中文普通话",
        },
        XfyunVoice {
            vcn: "x6_lingfeiyi_pro",
            name: "聆飞逸",
            gender: "男",
            language: "中文普通话",
        },
        XfyunVoice {
            vcn: "x6_feizheChat_pro",
            name: "聆飞哲",
            gender: "男",
            language: "中文普通话",
        },
        XfyunVoice {
            vcn: "x6_lingxiaoyue_pro",
            name: "聆小玥",
            gender: "女",
            language: "中文普通话",
        },
        XfyunVoice {
            vcn: "x6_lingxiaoxuan_pro",
            name: "聆小璇",
            gender: "女",
            language: "中文普通话",
        },
        XfyunVoice {
            vcn: "x6_lingyuyan_pro",
            name: "聆玉言",
            gender: "女",
            language: "中文普通话",
        },
        XfyunVoice {
            vcn: "x6_pangbainan1_pro",
            name: "旁白男声",
            gender: "男",
            language: "中文普通话",
        },
        XfyunVoice {
            vcn: "x6_pangbainv1_pro",
            name: "旁白女声",
            gender: "女",
            language: "中文普通话",
        },
        XfyunVoice {
            vcn: "x6_lingfeihan_pro",
            name: "聆飞瀚",
            gender: "男",
            language: "中文普通话",
        },
        XfyunVoice {
            vcn: "x6_lingfeihao_pro",
            name: "聆飞皓",
            gender: "男",
            language: "中文普通话",
        },
        XfyunVoice {
            vcn: "x6_gufengpangbai_pro",
            name: "古风旁白",
            gender: "男",
            language: "中文普通话",
        },
        XfyunVoice {
            vcn: "x6_lingyuaner_pro",
            name: "聆园儿",
            gender: "女",
            language: "中文普通话",
        },
        XfyunVoice {
            vcn: "x6_ganliannvxing_pro",
            name: "干练女性",
            gender: "女",
            language: "中文普通话",
        },
        XfyunVoice {
            vcn: "x6_ruyadashu_pro",
            name: "儒雅大叔",
            gender: "男",
            language: "中文普通话",
        },
        XfyunVoice {
            vcn: "x6_lingyufei_pro",
            name: "聆玉菲",
            gender: "女",
            language: "中文普通话",
        },
        XfyunVoice {
            vcn: "x6_lingxiaoshan_pro",
            name: "聆小珊",
            gender: "女",
            language: "中文普通话",
        },
        XfyunVoice {
            vcn: "x6_lingxiaoyun_pro",
            name: "聆小芸",
            gender: "女",
            language: "中文普通话",
        },
        XfyunVoice {
            vcn: "x6_lingyouyou_pro",
            name: "聆佑佑",
            gender: "女",
            language: "中文普通话",
        },
        XfyunVoice {
            vcn: "x6_lingxiaoying_pro",
            name: "聆小颖",
            gender: "女",
            language: "中文普通话",
        },
        XfyunVoice {
            vcn: "x6_lingxiaozhen_pro",
            name: "聆小瑱",
            gender: "女",
            language: "中文普通话",
        },
        XfyunVoice {
            vcn: "x6_lingfeibo_pro",
            name: "聆飞博",
            gender: "男",
            language: "中文普通话",
        },
        XfyunVoice {
            vcn: "x6_waiguodashu_pro",
            name: "外国大叔",
            gender: "男",
            language: "中文普通话",
        },
        XfyunVoice {
            vcn: "x6_gaolengnanshen_pro",
            name: "高冷男神",
            gender: "男",
            language: "中文普通话",
        },
        XfyunVoice {
            vcn: "x6_dongmanshaonv_pro",
            name: "动漫少女",
            gender: "女",
            language: "中文普通话",
        },
        // x5 系列
        XfyunVoice {
            vcn: "x5_lingxiaotang_flow",
            name: "聆小糖",
            gender: "女",
            language: "中文普通话",
        },
        XfyunVoice {
            vcn: "x5_lingyuzhao_flow",
            name: "聆玉昭",
            gender: "女",
            language: "中文普通话",
        },
        XfyunVoice {
            vcn: "x5_lingxiaoxuan_flow",
            name: "聆小璇",
            gender: "女",
            language: "中文普通话",
        },
        XfyunVoice {
            vcn: "x5_lingfeiyi_flow",
            name: "聆飞逸",
            gender: "男",
            language: "中文普通话",
        },
        XfyunVoice {
            vcn: "x5_lingxiaoyue_flow",
            name: "聆小玥",
            gender: "女",
            language: "中文普通话",
        },
        XfyunVoice {
            vcn: "x5_lingyuyan_flow",
            name: "聆玉言",
            gender: "女",
            language: "中文普通话",
        },
        XfyunVoice {
            vcn: "x5_EnUs_Grant_flow",
            name: "Grant",
            gender: "女",
            language: "英文美式",
        },
        XfyunVoice {
            vcn: "x5_EnUs_Lila_flow",
            name: "Lila",
            gender: "女",
            language: "英文美式",
        },
        // x4 系列（支持口语化）
        XfyunVoice {
            vcn: "x4_zijin_oral",
            name: "子津",
            gender: "男",
            language: "天津话",
        },
        XfyunVoice {
            vcn: "x4_ziyang_oral",
            name: "子阳",
            gender: "男",
            language: "东北话",
        },
    ]
}

// ============================== 测试 ==============================

#[cfg(test)]
mod tests {
    use super::*;

    // -------- 1.1 map_audio_encoding --------

    #[test]
    fn test_p1_map_encoding_mp3_to_lame() {
        assert_eq!(map_audio_encoding("mp3"), "lame");
    }

    #[test]
    fn test_p2_map_encoding_pcm_to_raw() {
        assert_eq!(map_audio_encoding("pcm"), "raw");
    }

    #[test]
    fn test_p3_map_encoding_opus() {
        assert_eq!(map_audio_encoding("opus"), "opus");
    }

    #[test]
    fn test_p4_map_encoding_unknown_default() {
        assert_eq!(map_audio_encoding("wav"), "lame");
        assert_eq!(map_audio_encoding("ogg"), "lame");
        assert_eq!(map_audio_encoding(""), "lame");
    }

    // -------- 1.2 create_request_payload --------

    fn make_default_options() -> XfyunTtsProtocolOptions {
        XfyunTtsProtocolOptions {
            app_id: "test-app-id".into(),
            vcn: "x5_lingxiaoxuan_flow".into(),
            speed: 50,
            volume: 50,
            pitch: 50,
            encoding: "lame".into(),
            sample_rate: 24000,
            ..Default::default()
        }
    }

    #[test]
    fn test_p5_full_structure() {
        let opt = make_default_options();
        let json_str = create_request_payload(&opt, "你好世界", 2, 0);
        let parsed: serde_json::Value = serde_json::from_str(&json_str).unwrap();

        assert_eq!(parsed["header"]["app_id"], "test-app-id");
        assert_eq!(parsed["header"]["status"], 2);
        assert_eq!(parsed["parameter"]["tts"]["vcn"], "x5_lingxiaoxuan_flow");
        assert_eq!(parsed["parameter"]["tts"]["speed"], 50);
        assert_eq!(parsed["parameter"]["tts"]["volume"], 50);
        assert_eq!(parsed["parameter"]["tts"]["pitch"], 50);
        assert_eq!(parsed["parameter"]["tts"]["bgs"], 0);
        assert_eq!(parsed["parameter"]["tts"]["reg"], 0);
        assert_eq!(parsed["parameter"]["tts"]["rdn"], 0);
        assert_eq!(parsed["parameter"]["tts"]["rhy"], 0);
        assert_eq!(parsed["parameter"]["tts"]["audio"]["encoding"], "lame");
        assert_eq!(parsed["parameter"]["tts"]["audio"]["sample_rate"], 24000);
        assert_eq!(parsed["parameter"]["tts"]["audio"]["channels"], 1);
        assert_eq!(parsed["parameter"]["tts"]["audio"]["bit_depth"], 16);
        assert_eq!(parsed["payload"]["text"]["encoding"], "utf8");
        assert_eq!(parsed["payload"]["text"]["compress"], "raw");
        assert_eq!(parsed["payload"]["text"]["format"], "plain");
        assert_eq!(parsed["payload"]["text"]["status"], 2);
        assert_eq!(parsed["payload"]["text"]["seq"], 0);
    }

    #[test]
    fn test_p6_text_base64_encoded() {
        let opt = make_default_options();
        let json_str = create_request_payload(&opt, "你好", 2, 0);
        let parsed: serde_json::Value = serde_json::from_str(&json_str).unwrap();
        let text_b64 = parsed["payload"]["text"]["text"]
            .as_str()
            .unwrap()
            .to_string();
        let decoded = base64::engine::general_purpose::STANDARD
            .decode(&text_b64)
            .unwrap();
        assert_eq!(String::from_utf8(decoded).unwrap(), "你好");
    }

    #[test]
    fn test_p7_empty_text() {
        let opt = make_default_options();
        let json_str = create_request_payload(&opt, "", 2, 0);
        let parsed: serde_json::Value = serde_json::from_str(&json_str).unwrap();
        let text_b64 = parsed["payload"]["text"]["text"]
            .as_str()
            .unwrap()
            .to_string();
        let decoded = base64::engine::general_purpose::STANDARD
            .decode(&text_b64)
            .unwrap();
        assert_eq!(String::from_utf8(decoded).unwrap(), "");
    }

    #[test]
    fn test_p8_no_oral_by_default() {
        let opt = make_default_options();
        let json_str = create_request_payload(&opt, "测试", 2, 0);
        let parsed: serde_json::Value = serde_json::from_str(&json_str).unwrap();
        assert!(parsed["parameter"].get("oral").is_none());
    }

    #[test]
    fn test_p9_oral_level_only() {
        let mut opt = make_default_options();
        opt.oral_level = Some("high".into());
        let json_str = create_request_payload(&opt, "测试", 2, 0);
        let parsed: serde_json::Value = serde_json::from_str(&json_str).unwrap();
        assert_eq!(parsed["parameter"]["oral"]["oral_level"], "high");
        assert!(parsed["parameter"]["oral"].get("spark_assist").is_none());
    }

    #[test]
    fn test_p10_all_oral_params() {
        let mut opt = make_default_options();
        opt.oral_level = Some("mid".into());
        opt.spark_assist = Some(1);
        opt.stop_split = Some(0);
        opt.remain = Some(1);
        let json_str = create_request_payload(&opt, "测试", 2, 0);
        let parsed: serde_json::Value = serde_json::from_str(&json_str).unwrap();
        assert_eq!(parsed["parameter"]["oral"]["oral_level"], "mid");
        assert_eq!(parsed["parameter"]["oral"]["spark_assist"], 1);
        assert_eq!(parsed["parameter"]["oral"]["stop_split"], 0);
        assert_eq!(parsed["parameter"]["oral"]["remain"], 1);
    }

    #[test]
    fn test_p11_status_seq_values() {
        let opt = make_default_options();
        let json_str = create_request_payload(&opt, "test", 0, 5);
        let parsed: serde_json::Value = serde_json::from_str(&json_str).unwrap();
        assert_eq!(parsed["header"]["status"], 0);
        assert_eq!(parsed["payload"]["text"]["status"], 0);
        assert_eq!(parsed["payload"]["text"]["seq"], 5);
    }

    #[test]
    fn test_p12_custom_format() {
        let mut opt = make_default_options();
        opt.encoding = "raw".into();
        opt.sample_rate = 16000;
        let json_str = create_request_payload(&opt, "test", 2, 0);
        let parsed: serde_json::Value = serde_json::from_str(&json_str).unwrap();
        assert_eq!(parsed["parameter"]["tts"]["audio"]["encoding"], "raw");
        assert_eq!(parsed["parameter"]["tts"]["audio"]["sample_rate"], 16000);
    }

    #[test]
    fn test_p13_custom_params() {
        let mut opt = make_default_options();
        opt.vcn = "x5_lingfeiyi_flow".into();
        opt.speed = 80;
        opt.volume = 30;
        opt.pitch = 70;
        opt.bgs = 1;
        opt.reg = 1;
        opt.rdn = 2;
        opt.rhy = 0;
        let json_str = create_request_payload(&opt, "test", 2, 0);
        let parsed: serde_json::Value = serde_json::from_str(&json_str).unwrap();
        assert_eq!(parsed["parameter"]["tts"]["vcn"], "x5_lingfeiyi_flow");
        assert_eq!(parsed["parameter"]["tts"]["speed"], 80);
        assert_eq!(parsed["parameter"]["tts"]["volume"], 30);
        assert_eq!(parsed["parameter"]["tts"]["pitch"], 70);
        assert_eq!(parsed["parameter"]["tts"]["bgs"], 1);
        assert_eq!(parsed["parameter"]["tts"]["reg"], 1);
        assert_eq!(parsed["parameter"]["tts"]["rdn"], 2);
        assert_eq!(parsed["parameter"]["tts"]["rhy"], 0);
    }

    #[test]
    fn test_p14_unicode_text() {
        let opt = make_default_options();
        let json_str = create_request_payload(&opt, "🎉🎊", 2, 0);
        let parsed: serde_json::Value = serde_json::from_str(&json_str).unwrap();
        let text_b64 = parsed["payload"]["text"]["text"]
            .as_str()
            .unwrap()
            .to_string();
        let decoded = base64::engine::general_purpose::STANDARD
            .decode(&text_b64)
            .unwrap();
        assert_eq!(String::from_utf8(decoded).unwrap(), "🎉🎊");
    }

    #[test]
    fn test_p15_long_text() {
        let opt = make_default_options();
        let long_text = "a".repeat(1024);
        let json_str = create_request_payload(&opt, &long_text, 2, 0);
        let parsed: serde_json::Value = serde_json::from_str(&json_str).unwrap();
        let text_b64 = parsed["payload"]["text"]["text"]
            .as_str()
            .unwrap()
            .to_string();
        let decoded = base64::engine::general_purpose::STANDARD
            .decode(&text_b64)
            .unwrap();
        assert_eq!(String::from_utf8(decoded).unwrap(), long_text);
    }

    // -------- 1.3 parse_response --------

    #[test]
    fn test_p20_parse_success_response() {
        let json = r#"{
            "header": { "code": 0, "message": "success", "sid": "sid001", "status": 1 },
            "payload": {
                "audio": {
                    "encoding": "lame", "sample_rate": 24000,
                    "channels": 1, "bit_depth": 16,
                    "status": 1, "seq": 0, "frame_size": 0,
                    "audio": "dGVzdGF1ZGlv"
                }
            }
        }"#;
        let response: XfyunTtsResponse = parse_response(json).unwrap();
        assert_eq!(response.header.code, 0);
        assert_eq!(response.header.message, "success");
        assert_eq!(response.header.sid, "sid001");
        assert_eq!(response.header.status, 1);
        let audio = response.payload.and_then(|p| p.audio).unwrap();
        assert_eq!(audio.encoding, "lame");
        assert_eq!(audio.sample_rate, 24000);
        assert_eq!(audio.audio, "dGVzdGF1ZGlv");
    }

    #[test]
    fn test_p21_parse_error_response() {
        let json = r#"{
            "header": { "code": 10139, "message": "参数错误", "sid": "sid002", "status": 1 }
        }"#;
        let response: XfyunTtsResponse = parse_response(json).unwrap();
        assert_eq!(response.header.code, 10139);
        assert!(response.payload.is_none());
    }

    #[test]
    fn test_p22_parse_finished_response() {
        let json = r#"{
            "header": { "code": 0, "message": "success", "sid": "sid003", "status": 2 },
            "payload": {
                "audio": {
                    "encoding": "lame", "sample_rate": 24000,
                    "channels": 1, "bit_depth": 16,
                    "status": 2, "seq": 5, "frame_size": 0,
                    "audio": ""
                }
            }
        }"#;
        let response: XfyunTtsResponse = parse_response(json).unwrap();
        assert_eq!(response.header.status, 2);
    }

    #[test]
    fn test_p23_parse_invalid_json() {
        let result: Result<XfyunTtsResponse, _> = parse_response("not valid json");
        assert!(result.is_err());
    }

    #[test]
    fn test_p24_parse_partial_response() {
        let json = r#"{"header": { "code": 0, "message": "ok", "sid": "", "status": 0 }}"#;
        let response: XfyunTtsResponse = parse_response(json).unwrap();
        assert_eq!(response.header.code, 0);
        assert!(response.payload.is_none());
    }

    #[test]
    fn test_p25_parse_extra_fields() {
        let json = r#"{
            "header": { "code": 0, "message": "ok", "sid": "s1", "status": 1 },
            "extra": "ignored"
        }"#;
        let response: XfyunTtsResponse = parse_response(json).unwrap();
        assert_eq!(response.header.code, 0);
    }

    #[test]
    fn test_p26_parse_missing_header_fields() {
        let json = r#"{"header": { "code": 0 }}"#;
        let response: XfyunTtsResponse = parse_response(json).unwrap();
        assert_eq!(response.header.code, 0);
        assert!(response.header.sid.is_empty());
        assert!(response.header.message.is_empty());
        assert_eq!(response.header.status, 0);
    }

    // -------- 1.4 extract_audio --------

    #[test]
    fn test_p30_extract_audio_success() {
        let json = r#"{
            "header": { "code": 0, "message": "success", "sid": "s1", "status": 1 },
            "payload": {
                "audio": {
                    "encoding": "lame", "sample_rate": 24000,
                    "channels": 1, "bit_depth": 16,
                    "status": 1, "seq": 0, "frame_size": 0,
                    "audio": "dGVzdGF1ZGlv"
                }
            }
        }"#;
        let response: XfyunTtsResponse = parse_response(json).unwrap();
        let audio = extract_audio(&response).unwrap();
        assert_eq!(String::from_utf8(audio).unwrap(), "testaudio");
    }

    #[test]
    fn test_p31_extract_audio_no_payload() {
        let json = r#"{"header": { "code": 0, "message": "ok", "sid": "s1", "status": 2 }}"#;
        let response: XfyunTtsResponse = parse_response(json).unwrap();
        assert!(extract_audio(&response).is_none());
    }

    #[test]
    fn test_p32_extract_audio_empty_string() {
        let json = r#"{
            "header": { "code": 0, "message": "ok", "sid": "s1", "status": 1 },
            "payload": {
                "audio": {
                    "encoding": "lame", "sample_rate": 24000,
                    "channels": 1, "bit_depth": 16,
                    "status": 1, "seq": 0, "frame_size": 0,
                    "audio": ""
                }
            }
        }"#;
        let response: XfyunTtsResponse = parse_response(json).unwrap();
        assert!(extract_audio(&response).is_none());
    }

    #[test]
    fn test_p33_extract_audio_no_audio_field() {
        let json = r#"{
            "header": { "code": 0, "message": "ok", "sid": "s1", "status": 1 },
            "payload": { }
        }"#;
        let response: XfyunTtsResponse = parse_response(json).unwrap();
        assert!(extract_audio(&response).is_none());
    }

    #[test]
    fn test_p34_extract_audio_invalid_base64() {
        let json = r#"{
            "header": { "code": 0, "message": "ok", "sid": "s1", "status": 1 },
            "payload": {
                "audio": {
                    "encoding": "lame", "sample_rate": 24000,
                    "channels": 1, "bit_depth": 16,
                    "status": 1, "seq": 0, "frame_size": 0,
                    "audio": "!!!invalid base64!!!"
                }
            }
        }"#;
        let response: XfyunTtsResponse = parse_response(json).unwrap();
        assert!(extract_audio(&response).is_none());
    }

    // -------- 1.5 is_success / is_finished --------

    #[test]
    fn test_p40_is_success_ok() {
        let response = XfyunTtsResponse {
            header: XfyunTtsHeader {
                code: 0,
                message: "ok".into(),
                sid: "s1".into(),
                status: 1,
            },
            payload: None,
        };
        assert!(is_success(&response));
    }

    #[test]
    fn test_p41_is_success_error() {
        let response = XfyunTtsResponse {
            header: XfyunTtsHeader {
                code: 10139,
                message: "error".into(),
                sid: "s1".into(),
                status: 1,
            },
            payload: None,
        };
        assert!(!is_success(&response));
    }

    #[test]
    fn test_p42_is_success_negative() {
        let response = XfyunTtsResponse {
            header: XfyunTtsHeader {
                code: -1,
                message: "".into(),
                sid: "s1".into(),
                status: 1,
            },
            payload: None,
        };
        assert!(!is_success(&response));
    }

    #[test]
    fn test_p43_is_finished_yes() {
        let response = XfyunTtsResponse {
            header: XfyunTtsHeader {
                code: 0,
                message: "ok".into(),
                sid: "s1".into(),
                status: 2,
            },
            payload: None,
        };
        assert!(is_finished(&response));
    }

    #[test]
    fn test_p44_is_finished_no() {
        let response = XfyunTtsResponse {
            header: XfyunTtsHeader {
                code: 0,
                message: "ok".into(),
                sid: "s1".into(),
                status: 1,
            },
            payload: None,
        };
        assert!(!is_finished(&response));
    }

    #[test]
    fn test_p45_is_finished_zero() {
        let response = XfyunTtsResponse {
            header: XfyunTtsHeader {
                code: 0,
                message: "ok".into(),
                sid: "s1".into(),
                status: 0,
            },
            payload: None,
        };
        assert!(!is_finished(&response));
    }

    // -------- 1.6 list_voices --------

    #[test]
    fn test_p50_list_voices_not_empty() {
        let voices = list_voices();
        // 至少 50+ 个发音人（x6 ~47 + x5 ~7 + x4 ~2）
        assert!(voices.len() > 50);
    }

    #[test]
    fn test_p51_list_voices_contains_default() {
        let voices = list_voices();
        assert!(voices.iter().any(|v| v.vcn == XFYUN_DEFAULT_VOICE));
    }

    #[test]
    fn test_p52_list_voices_has_x5_and_x6() {
        let voices = list_voices();
        assert!(voices.iter().any(|v| v.vcn.starts_with("x5_")));
        assert!(voices.iter().any(|v| v.vcn.starts_with("x6_")));
    }

    #[test]
    fn test_p53_list_voices_has_oral_support() {
        let voices = list_voices();
        assert!(voices.iter().any(|v| v.vcn.starts_with("x4_")));
    }

    #[test]
    fn test_p54_list_voices_gender_field() {
        let voices = list_voices();
        for voice in &voices {
            assert!(!voice.gender.is_empty());
        }
    }

    // -------- 1.7 XfyunTtsProtocolOptions defaults --------

    #[test]
    fn test_p55_defaults() {
        let opt = XfyunTtsProtocolOptions::default();
        assert_eq!(opt.vcn, XFYUN_DEFAULT_VOICE);
        assert_eq!(opt.speed, 50);
        assert_eq!(opt.volume, 50);
        assert_eq!(opt.pitch, 50);
        assert_eq!(opt.encoding, XFYUN_DEFAULT_ENCODING);
        assert_eq!(opt.sample_rate, XFYUN_DEFAULT_SAMPLE_RATE);
        assert_eq!(opt.bgs, 0);
        assert_eq!(opt.reg, 0);
        assert_eq!(opt.rdn, 0);
        assert_eq!(opt.rhy, 0);
        assert!(opt.oral_level.is_none());
        assert!(opt.spark_assist.is_none());
        assert!(opt.stop_split.is_none());
        assert!(opt.remain.is_none());
    }
}
