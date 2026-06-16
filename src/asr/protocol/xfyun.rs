use base64::Engine;
use chrono::Utc;
use hmac::{Hmac, Mac};
use serde::Deserialize;
use sha2::Sha256;
use url::Url;

use crate::asr::error::AsrError;

// ============================== 协议配置 ==============================

/// 讯飞 IAT v2 协议配置选项
#[derive(Debug, Clone)]
pub struct XfyunProtocolOptions {
    pub app_id: String,
    pub api_key: String,
    pub api_secret: String,
    /// 音频编码格式: raw=PCM, lame=MP3
    pub encoding: String,
    pub sample_rate: u32,
    pub domain: String,
    pub language: String,
    pub accent: String,
    pub eos: u32,
    pub dwa: Option<String>,
    pub ltc: Option<i32>,
    pub dhw: Option<String>,
    pub ptt: Option<i32>,
    pub rlang: Option<String>,
    pub vinfo: Option<i32>,
    pub nunum: Option<i32>,
    pub nbest: Option<i32>,
    pub wbest: Option<i32>,
}

// ============================== 服务端响应类型 ==============================

/// 科大讯飞 IAT v2 响应
#[derive(Debug, Deserialize)]
pub struct XfyunResponse {
    pub code: i32,
    #[serde(default)]
    pub message: String,
    #[serde(default)]
    pub sid: String,
    pub data: Option<XfyunResponseData>,
}

#[derive(Debug, Deserialize)]
pub struct XfyunResponseData {
    pub status: i32,
    pub result: Option<XfyunResult>,
}

#[derive(Debug, Deserialize)]
pub struct XfyunResult {
    pub sn: u32,
    pub ls: bool,
    pub bg: u32,
    pub ed: u32,
    pub pgs: Option<String>,
    pub rg: Option<[u32; 2]>,
    pub ws: Vec<XfyunWord>,
}

#[derive(Debug, Deserialize)]
pub struct XfyunWord {
    pub bg: u32,
    pub cw: Vec<XfyunCandidate>,
}

#[derive(Debug, Deserialize)]
pub struct XfyunCandidate {
    pub w: String,
}

// ============================== 鉴权 URL 构建 ==============================

/// 生成鉴权 URL
///
/// 使用 HMAC-SHA256 签名，将 authorization、date、host 附加到 query string。
pub fn build_auth_url(
    host: &str,
    path: &str,
    api_key: &str,
    api_secret: &str,
) -> Result<String, AsrError> {
    let date = Utc::now().format("%a, %d %b %Y %H:%M:%S GMT").to_string();
    let signature_origin = format!("host: {host}\ndate: {date}\nGET {path} HTTP/1.1");

    // HMAC-SHA256 签名
    let mut mac = Hmac::<Sha256>::new_from_slice(api_secret.as_bytes())
        .map_err(|e| AsrError::Other(format!("HMAC key error: {e}")))?;
    mac.update(signature_origin.as_bytes());
    let signature = base64::engine::general_purpose::STANDARD.encode(mac.finalize().into_bytes());

    // 构建 authorization
    let authorization_origin = format!(
        "api_key=\"{api_key}\", algorithm=\"hmac-sha256\", headers=\"host date request-line\", signature=\"{signature}\""
    );
    let authorization = base64::engine::general_purpose::STANDARD.encode(authorization_origin);

    // 使用 url crate 构建最终 URL（自动处理 percent-encoding）
    let mut url = Url::parse(&format!("wss://{host}{path}")).map_err(AsrError::Url)?;
    url.query_pairs_mut()
        .append_pair("authorization", &authorization)
        .append_pair("date", &date)
        .append_pair("host", host);

    Ok(url.to_string())
}

// ============================== 帧构建 ==============================

/// 创建首帧（包含 common + business + data，status=0）
pub fn create_first_frame(options: &XfyunProtocolOptions, audio_b64: &str) -> String {
    let mut business = serde_json::Map::new();
    business.insert("language".into(), serde_json::json!(options.language));
    business.insert("domain".into(), serde_json::json!(options.domain));
    business.insert("accent".into(), serde_json::json!(options.accent));
    business.insert("eos".into(), serde_json::json!(options.eos));

    // 条件插入可选字段
    if let Some(ref dwa) = options.dwa {
        business.insert("dwa".into(), serde_json::json!(dwa));
    }
    if let Some(ltc) = options.ltc {
        business.insert("ltc".into(), serde_json::json!(ltc));
    }
    if let Some(ref dhw) = options.dhw {
        business.insert("dhw".into(), serde_json::json!(dhw));
    }
    if let Some(ptt) = options.ptt {
        business.insert("ptt".into(), serde_json::json!(ptt));
    }
    if let Some(ref rlang) = options.rlang {
        business.insert("rlang".into(), serde_json::json!(rlang));
    }
    if let Some(vinfo) = options.vinfo {
        business.insert("vinfo".into(), serde_json::json!(vinfo));
    }
    if let Some(nunum) = options.nunum {
        business.insert("nunum".into(), serde_json::json!(nunum));
    }
    if let Some(nbest) = options.nbest {
        business.insert("nbest".into(), serde_json::json!(nbest));
    }
    if let Some(wbest) = options.wbest {
        business.insert("wbest".into(), serde_json::json!(wbest));
    }

    let frame = serde_json::json!({
        "common": { "app_id": options.app_id },
        "business": business,
        "data": {
            "status": 0,
            "format": format!("audio/L16;rate={}", options.sample_rate),
            "encoding": options.encoding,
            "audio": audio_b64,
        }
    });

    frame.to_string()
}

/// 创建中间帧（只有 data，status=1）
pub fn create_middle_frame(options: &XfyunProtocolOptions, audio_b64: &str) -> String {
    let frame = serde_json::json!({
        "data": {
            "status": 1,
            "format": format!("audio/L16;rate={}", options.sample_rate),
            "encoding": options.encoding,
            "audio": audio_b64,
        }
    });
    frame.to_string()
}

/// 创建末帧（data.status=2，无需额外参数）
pub fn create_last_frame() -> String {
    let frame = serde_json::json!({
        "data": {
            "status": 2,
        }
    });
    frame.to_string()
}

// ============================== 响应工具函数 ==============================

/// 从识别结果中提取纯文本
/// 从 ws[].cw[].w 中提取字词拼接
pub fn extract_text_from_result(result: &XfyunResult) -> String {
    result
        .ws
        .iter()
        .flat_map(|w| w.cw.iter())
        .map(|c| c.w.as_str())
        .collect()
}

/// 判断响应是否成功（code=0）
pub fn is_success_response(response: &XfyunResponse) -> bool {
    response.code == 0
}

/// 判断响应是否为最后一帧（data.status=2）
pub fn is_finished_response(response: &XfyunResponse) -> bool {
    response
        .data
        .as_ref()
        .map(|d| d.status == 2)
        .unwrap_or(false)
}

/// 判断响应是否包含识别结果（有 data.result 字段）
pub fn has_result_payload(response: &XfyunResponse) -> bool {
    response
        .data
        .as_ref()
        .and_then(|d| d.result.as_ref())
        .is_some()
}

// ============================== 测试 ==============================

#[cfg(test)]
mod tests {
    use super::*;

    // ====== build_auth_url ======

    #[test]
    fn test_auth_url_format() {
        let url_str = build_auth_url(
            "iat-api.xfyun.cn",
            "/v2/iat",
            "test-api-key",
            "test-api-secret",
        )
        .unwrap();

        assert!(url_str.starts_with("wss://iat-api.xfyun.cn/v2/iat?"));
        assert!(url_str.contains("authorization="));
        assert!(url_str.contains("date="));
        assert!(url_str.contains("host=iat-api.xfyun.cn"));
    }

    #[test]
    fn test_auth_url_different_params() {
        let url_str =
            build_auth_url("custom.host.com", "/v1/custom", "key123", "secret456").unwrap();

        assert!(url_str.starts_with("wss://custom.host.com/v1/custom?"));
        assert!(url_str.contains("authorization="));
        assert!(url_str.contains("date="));
        assert!(url_str.contains("host=custom.host.com"));
    }

    #[test]
    fn test_auth_url_base64_valid() {
        let url_str = build_auth_url(
            "iat-api.xfyun.cn",
            "/v2/iat",
            "test-api-key",
            "test-api-secret",
        )
        .unwrap();

        // Extract authorization param
        let url = Url::parse(&url_str).unwrap();
        let auth_b64 = url
            .query_pairs()
            .find(|(k, _)| k == "authorization")
            .unwrap()
            .1
            .to_string();
        let decoded = base64::engine::general_purpose::STANDARD
            .decode(&auth_b64)
            .unwrap();
        let decoded_str = String::from_utf8(decoded).unwrap();
        assert!(decoded_str.contains("api_key="));
        assert!(decoded_str.contains("hmac-sha256"));
    }

    #[test]
    fn test_auth_url_empty_key() {
        let url_str = build_auth_url("iat-api.xfyun.cn", "/v2/iat", "", "secret").unwrap();
        assert!(url_str.starts_with("wss://"));
    }

    #[test]
    fn test_auth_url_special_chars() {
        let url_str =
            build_auth_url("iat-api.xfyun.cn", "/v2/iat", "key+/-=", "secret+/=").unwrap();
        assert!(url_str.starts_with("wss://"));
    }

    #[test]
    fn test_auth_url_date_format() {
        let url_str = build_auth_url(
            "iat-api.xfyun.cn",
            "/v2/iat",
            "test-api-key",
            "test-api-secret",
        )
        .unwrap();

        let url = Url::parse(&url_str).unwrap();
        let date = url
            .query_pairs()
            .find(|(k, _)| k == "date")
            .map(|(_, v)| v.to_string())
            .unwrap();

        // RFC 1123: "Mon, 16 Jun 2026 10:00:00 GMT"
        assert!(date.contains("GMT"), "date should end with GMT: {date}");
        assert!(
            date.len() == 29 || date.len() == 30,
            "date should be RFC 1123 format: {date}"
        );
    }

    // ====== create_first_frame ======

    fn make_default_options() -> XfyunProtocolOptions {
        XfyunProtocolOptions {
            app_id: "test-app".into(),
            api_key: "key".into(),
            api_secret: "secret".into(),
            encoding: "raw".into(),
            sample_rate: 16000,
            domain: "iat".into(),
            language: "zh_cn".into(),
            accent: "mandarin".into(),
            eos: 2000,
            dwa: None,
            ltc: None,
            dhw: None,
            ptt: None,
            rlang: None,
            vinfo: None,
            nunum: None,
            nbest: None,
            wbest: None,
        }
    }

    #[test]
    fn test_first_frame_structure() {
        let options = make_default_options();
        let json_str = create_first_frame(&options, "AAAA");
        let parsed: serde_json::Value = serde_json::from_str(&json_str).unwrap();

        assert_eq!(parsed["common"]["app_id"], "test-app");
        assert_eq!(parsed["business"]["language"], "zh_cn");
        assert_eq!(parsed["business"]["domain"], "iat");
        assert_eq!(parsed["business"]["accent"], "mandarin");
        assert_eq!(parsed["business"]["eos"], 2000);
        assert_eq!(parsed["data"]["status"], 0);
        assert_eq!(parsed["data"]["format"], "audio/L16;rate=16000");
        assert_eq!(parsed["data"]["encoding"], "raw");
        assert_eq!(parsed["data"]["audio"], "AAAA");
    }

    #[test]
    fn test_first_frame_all_optionals() {
        let options = XfyunProtocolOptions {
            dwa: Some("wpgs".into()),
            ltc: Some(1),
            dhw: Some("热词".into()),
            ptt: Some(1),
            rlang: Some("zh-cn".into()),
            vinfo: Some(1),
            nunum: Some(1),
            nbest: Some(3),
            wbest: Some(50),
            ..make_default_options()
        };
        let json_str = create_first_frame(&options, "AAAA");
        let parsed: serde_json::Value = serde_json::from_str(&json_str).unwrap();

        assert_eq!(parsed["business"]["dwa"], "wpgs");
        assert_eq!(parsed["business"]["ltc"], 1);
        assert_eq!(parsed["business"]["dhw"], "热词");
        assert_eq!(parsed["business"]["ptt"], 1);
        assert_eq!(parsed["business"]["rlang"], "zh-cn");
        assert_eq!(parsed["business"]["vinfo"], 1);
        assert_eq!(parsed["business"]["nunum"], 1);
        assert_eq!(parsed["business"]["nbest"], 3);
        assert_eq!(parsed["business"]["wbest"], 50);
    }

    #[test]
    fn test_first_frame_no_optionals() {
        let options = make_default_options();
        let json_str = create_first_frame(&options, "AAAA");
        let parsed: serde_json::Value = serde_json::from_str(&json_str).unwrap();

        assert!(parsed["business"].get("dwa").is_none());
        assert!(parsed["business"].get("ltc").is_none());
        assert!(parsed["business"].get("ptt").is_none());
        assert!(parsed["business"].get("nbest").is_none());
    }

    #[test]
    fn test_first_frame_partial_optionals() {
        let options = XfyunProtocolOptions {
            dwa: Some("wpgs".into()),
            ptt: Some(1),
            ..make_default_options()
        };
        let json_str = create_first_frame(&options, "AAAA");
        let parsed: serde_json::Value = serde_json::from_str(&json_str).unwrap();

        assert_eq!(parsed["business"]["dwa"], "wpgs");
        assert_eq!(parsed["business"]["ptt"], 1);
        assert!(parsed["business"].get("ltc").is_none());
        assert!(parsed["business"].get("dhw").is_none());
        assert!(parsed["business"].get("rlang").is_none());
        assert!(parsed["business"].get("vinfo").is_none());
        assert!(parsed["business"].get("nbest").is_none());
    }

    #[test]
    fn test_first_frame_sample_rate() {
        let options = XfyunProtocolOptions {
            sample_rate: 8000,
            ..make_default_options()
        };
        let json_str = create_first_frame(&options, "AAAA");
        let parsed: serde_json::Value = serde_json::from_str(&json_str).unwrap();
        assert_eq!(parsed["data"]["format"], "audio/L16;rate=8000");

        let options = XfyunProtocolOptions {
            sample_rate: 44100,
            ..make_default_options()
        };
        let json_str = create_first_frame(&options, "AAAA");
        let parsed: serde_json::Value = serde_json::from_str(&json_str).unwrap();
        assert_eq!(parsed["data"]["format"], "audio/L16;rate=44100");
    }

    #[test]
    fn test_first_frame_encoding_lame() {
        let options = XfyunProtocolOptions {
            encoding: "lame".into(),
            ..make_default_options()
        };
        let json_str = create_first_frame(&options, "AAAA");
        let parsed: serde_json::Value = serde_json::from_str(&json_str).unwrap();
        assert_eq!(parsed["data"]["encoding"], "lame");
    }

    #[test]
    fn test_first_frame_large_audio() {
        let audio_data = vec![0u8; 1280];
        let b64 = base64::engine::general_purpose::STANDARD.encode(&audio_data);
        let options = make_default_options();
        let json_str = create_first_frame(&options, &b64);
        let parsed: serde_json::Value = serde_json::from_str(&json_str).unwrap();
        assert_eq!(parsed["data"]["audio"].as_str().unwrap().len(), b64.len());
    }

    // ====== create_middle_frame ======

    #[test]
    fn test_middle_frame_structure() {
        let options = make_default_options();
        let json_str = create_middle_frame(&options, "BBBB");
        let parsed: serde_json::Value = serde_json::from_str(&json_str).unwrap();

        assert!(parsed.get("common").is_none());
        assert!(parsed.get("business").is_none());
        assert_eq!(parsed["data"]["status"], 1);
        assert_eq!(parsed["data"]["format"], "audio/L16;rate=16000");
        assert_eq!(parsed["data"]["encoding"], "raw");
        assert_eq!(parsed["data"]["audio"], "BBBB");
    }

    #[test]
    fn test_middle_frame_sample_rate() {
        let options = XfyunProtocolOptions {
            sample_rate: 44100,
            ..make_default_options()
        };
        let json_str = create_middle_frame(&options, "BBBB");
        let parsed: serde_json::Value = serde_json::from_str(&json_str).unwrap();
        assert_eq!(parsed["data"]["format"], "audio/L16;rate=44100");
    }

    // ====== create_last_frame ======

    #[test]
    fn test_last_frame_structure() {
        let json_str = create_last_frame();
        let parsed: serde_json::Value = serde_json::from_str(&json_str).unwrap();
        assert_eq!(parsed["data"]["status"], 2);
        assert!(parsed["data"].get("audio").is_none());
        assert!(parsed.get("common").is_none());
        assert!(parsed.get("business").is_none());
    }

    // ====== extract_text_from_result ======

    #[test]
    fn test_extract_text_simple() {
        let result = XfyunResult {
            sn: 0,
            ls: true,
            bg: 0,
            ed: 100,
            pgs: None,
            rg: None,
            ws: vec![
                XfyunWord {
                    bg: 0,
                    cw: vec![
                        XfyunCandidate { w: "你".into() },
                        XfyunCandidate { w: "好".into() },
                    ],
                },
                XfyunWord {
                    bg: 50,
                    cw: vec![XfyunCandidate { w: "世界".into() }],
                },
            ],
        };
        assert_eq!(extract_text_from_result(&result), "你好世界");
    }

    #[test]
    fn test_extract_text_empty_ws() {
        let result = XfyunResult {
            sn: 0,
            ls: true,
            bg: 0,
            ed: 0,
            pgs: None,
            rg: None,
            ws: vec![],
        };
        assert_eq!(extract_text_from_result(&result), "");
    }

    #[test]
    fn test_extract_text_single_word() {
        let result = XfyunResult {
            sn: 0,
            ls: true,
            bg: 0,
            ed: 0,
            pgs: None,
            rg: None,
            ws: vec![XfyunWord {
                bg: 0,
                cw: vec![XfyunCandidate { w: "hello".into() }],
            }],
        };
        assert_eq!(extract_text_from_result(&result), "hello");
    }

    #[test]
    fn test_extract_text_unicode() {
        let result = XfyunResult {
            sn: 0,
            ls: true,
            bg: 0,
            ed: 0,
            pgs: None,
            rg: None,
            ws: vec![
                XfyunWord {
                    bg: 0,
                    cw: vec![XfyunCandidate { w: "🎉".into() }],
                },
                XfyunWord {
                    bg: 0,
                    cw: vec![XfyunCandidate { w: "🎊".into() }],
                },
            ],
        };
        assert_eq!(extract_text_from_result(&result), "🎉🎊");
    }

    #[test]
    fn test_extract_text_mixed() {
        let result = XfyunResult {
            sn: 0,
            ls: true,
            bg: 0,
            ed: 0,
            pgs: None,
            rg: None,
            ws: vec![XfyunWord {
                bg: 0,
                cw: vec![XfyunCandidate {
                    w: "hello你好".into(),
                }],
            }],
        };
        assert_eq!(extract_text_from_result(&result), "hello你好");
    }

    // ====== 响应工具函数 ======

    #[test]
    fn test_is_success_response_ok() {
        let resp = XfyunResponse {
            code: 0,
            message: "success".into(),
            sid: "sid".into(),
            data: None,
        };
        assert!(is_success_response(&resp));
    }

    #[test]
    fn test_is_success_response_error() {
        let resp = XfyunResponse {
            code: 10105,
            message: "error".into(),
            sid: "".into(),
            data: None,
        };
        assert!(!is_success_response(&resp));
    }

    #[test]
    fn test_is_success_response_negative() {
        let resp = XfyunResponse {
            code: -1,
            message: "".into(),
            sid: "".into(),
            data: None,
        };
        assert!(!is_success_response(&resp));
    }

    #[test]
    fn test_is_finished_response_ok() {
        let resp = XfyunResponse {
            code: 0,
            message: String::new(),
            sid: String::new(),
            data: Some(XfyunResponseData {
                status: 2,
                result: None,
            }),
        };
        assert!(is_finished_response(&resp));
    }

    #[test]
    fn test_is_finished_response_mid() {
        let resp = XfyunResponse {
            code: 0,
            message: String::new(),
            sid: String::new(),
            data: Some(XfyunResponseData {
                status: 1,
                result: None,
            }),
        };
        assert!(!is_finished_response(&resp));
    }

    #[test]
    fn test_is_finished_response_no_data() {
        let resp = XfyunResponse {
            code: 0,
            message: String::new(),
            sid: String::new(),
            data: None,
        };
        assert!(!is_finished_response(&resp));
    }

    #[test]
    fn test_has_result_payload_yes() {
        let resp = XfyunResponse {
            code: 0,
            message: String::new(),
            sid: String::new(),
            data: Some(XfyunResponseData {
                status: 1,
                result: Some(XfyunResult {
                    sn: 0,
                    ls: false,
                    bg: 0,
                    ed: 0,
                    pgs: None,
                    rg: None,
                    ws: vec![],
                }),
            }),
        };
        assert!(has_result_payload(&resp));
    }

    #[test]
    fn test_has_result_payload_no() {
        let resp = XfyunResponse {
            code: 0,
            message: String::new(),
            sid: String::new(),
            data: Some(XfyunResponseData {
                status: 1,
                result: None,
            }),
        };
        assert!(!has_result_payload(&resp));
    }

    #[test]
    fn test_has_result_payload_no_data() {
        let resp = XfyunResponse {
            code: 0,
            message: String::new(),
            sid: String::new(),
            data: None,
        };
        assert!(!has_result_payload(&resp));
    }

    // ====== JSON 反序列化 ======

    #[test]
    fn test_parse_complete_response() {
        let json = r#"{
            "code": 0,
            "message": "success",
            "sid": "sid12345",
            "data": {
                "status": 2,
                "result": {
                    "sn": 3,
                    "ls": true,
                    "bg": 0,
                    "ed": 1500,
                    "pgs": "apd",
                    "rg": [0, 3],
                    "ws": [
                        { "bg": 0, "cw": [{ "w": "今" }, { "w": "天" }] },
                        { "bg": 200, "cw": [{ "w": "天" }] },
                        { "bg": 400, "cw": [{ "w": "气" }] },
                        { "bg": 600, "cw": [{ "w": "真" }, { "w": "好" }] }
                    ]
                }
            }
        }"#;

        let response: XfyunResponse = serde_json::from_str(json).unwrap();
        assert_eq!(response.code, 0);
        let data = response.data.unwrap();
        assert_eq!(data.status, 2);
        let result = data.result.unwrap();
        assert_eq!(result.sn, 3);
        assert!(result.ls);
        assert_eq!(result.pgs, Some("apd".into()));
        assert_eq!(result.rg, Some([0, 3]));
        assert_eq!(extract_text_from_result(&result), "今天天气真好");
    }

    #[test]
    fn test_parse_error_response() {
        let json = r#"{"code": 10105, "message": "invalid app_id", "sid": ""}"#;
        let response: XfyunResponse = serde_json::from_str(json).unwrap();
        assert_eq!(response.code, 10105);
        assert_eq!(response.message, "invalid app_id");
        assert!(response.data.is_none());
        assert!(!is_success_response(&response));
    }

    #[test]
    fn test_parse_intermediate_response() {
        let json = r#"{
            "code": 0, "message": "success", "sid": "sid001",
            "data": { "status": 1, "result": { "sn": 1, "ls": false, "bg": 0, "ed": 500, "ws": [{ "bg": 0, "cw": [{ "w": "你好" }] }] } }
        }"#;
        let response: XfyunResponse = serde_json::from_str(json).unwrap();
        let data = response.data.unwrap();
        assert_eq!(data.status, 1);
        let result = data.result.unwrap();
        assert!(!result.ls);
        assert_eq!(extract_text_from_result(&result), "你好");
    }

    #[test]
    fn test_parse_response_no_sid() {
        let json = r#"{"code": 0, "message": "ok"}"#;
        let response: XfyunResponse = serde_json::from_str(json).unwrap();
        assert!(response.sid.is_empty());
    }

    #[test]
    fn test_parse_response_no_message() {
        let json = r#"{"code": 0, "sid": "s1"}"#;
        let response: XfyunResponse = serde_json::from_str(json).unwrap();
        assert!(response.message.is_empty());
    }

    #[test]
    fn test_parse_response_extra_fields() {
        let json = r#"{"code": 0, "message": "ok", "sid": "s1", "extra": "ignored"}"#;
        let response: XfyunResponse = serde_json::from_str(json).unwrap();
        assert_eq!(response.code, 0);
    }

    #[test]
    fn test_parse_response_empty_ws() {
        let json = r#"{
            "code": 0, "message": "ok", "sid": "s1",
            "data": { "status": 2, "result": { "sn": 0, "ls": true, "bg": 0, "ed": 0, "ws": [] } }
        }"#;
        let response: XfyunResponse = serde_json::from_str(json).unwrap();
        let text = extract_text_from_result(&response.data.unwrap().result.unwrap());
        assert_eq!(text, "");
    }

    #[test]
    fn test_parse_invalid_json() {
        let result: Result<XfyunResponse, _> = serde_json::from_str("not valid json");
        assert!(result.is_err());
    }

    #[test]
    fn test_frame_chain_order() {
        let options = make_default_options();

        let first = create_first_frame(&options, "AAAA");
        let first_val: serde_json::Value = serde_json::from_str(&first).unwrap();
        assert_eq!(first_val["data"]["status"], 0);

        let mid = create_middle_frame(&options, "BBBB");
        let mid_val: serde_json::Value = serde_json::from_str(&mid).unwrap();
        assert_eq!(mid_val["data"]["status"], 1);

        let last = create_last_frame();
        let last_val: serde_json::Value = serde_json::from_str(&last).unwrap();
        assert_eq!(last_val["data"]["status"], 2);
    }
}
