use std::pin::Pin;
use std::time::Duration;

use async_trait::async_trait;
use base64::Engine;
use futures_util::{Sink, SinkExt, Stream, StreamExt};
use tokio_tungstenite::connect_async;
use tokio_tungstenite::tungstenite::Message;

use crate::asr::error::AsrError;
use crate::asr::protocol::xfyun::{
    XfyunProtocolOptions, XfyunResponse, build_auth_url, create_first_frame, create_last_frame,
    create_middle_frame, extract_text_from_result, has_result_payload, is_finished_response,
    is_success_response,
};
use crate::asr::traits::AsrProvider;
use crate::asr::types::{AsrStreamChunk, AudioContainerFormat, AudioStream, BaseProviderOption};

// ============================== 常量 ==============================

/// 讯飞 IAT v2 默认 WebSocket 地址
pub const XFYUN_DEFAULT_HOST: &str = "iat-api.xfyun.cn";
/// 讯飞 IAT v2 默认路径
pub const XFYUN_DEFAULT_PATH: &str = "/v2/iat";
/// 音频分块大小（讯飞建议 1280 字节）
pub const XFYUN_CHUNK_SIZE: usize = 1280;
/// 最大 sn 值保护（防止恶意 sn 导致 OOM）
pub const XFYUN_MAX_SN: usize = 100_000;

/// 连接超时
#[cfg(not(test))]
const CONNECT_TIMEOUT: Duration = Duration::from_secs(10);
#[cfg(test)]
const CONNECT_TIMEOUT: Duration = Duration::from_secs(1);

// ============================== 内部类型 ==============================

/// 内部 channel 消息类型
enum QueueItem {
    Chunk(AsrStreamChunk),
    Complete,
}

// ============================== XfyunAsrOption ==============================

/// 讯飞 Xfyun ASR 专属配置
#[derive(Debug, Clone, Default)]
pub struct XfyunAsrOption {
    pub base: BaseProviderOption,
    pub app_id: Option<String>,
    pub api_secret: Option<String>,
    pub sample_rate: Option<u32>,
    pub domain: Option<String>,
    pub accent: Option<String>,
    pub eos: Option<u32>,
    pub dwa: Option<String>,
    pub ltc: Option<i32>,
    pub dhw: Option<String>,
    pub ptt: Option<i32>,
    pub rlang: Option<String>,
    pub vinfo: Option<i32>,
    pub nunum: Option<i32>,
    pub nbest: Option<i32>,
    pub wbest: Option<i32>,
    pub send_interval: Option<u64>,
}

// ============================== XfyunAsr ==============================

/// 科大讯飞 Xfyun ASR Provider
///
/// 基于讯飞开放平台 IAT（语音听写）WebSocket JSON API v2 实现语音识别。
pub struct XfyunAsr {
    api_key: String,
    app_id: String,
    api_secret: String,
    sample_rate: u32,
    domain: String,
    accent: String,
    eos: u32,
    dwa: Option<String>,
    ltc: Option<i32>,
    dhw: Option<String>,
    ptt: Option<i32>,
    rlang: Option<String>,
    vinfo: Option<i32>,
    nunum: Option<i32>,
    nbest: Option<i32>,
    wbest: Option<i32>,
    send_interval: u64,
    language: Option<String>,
    format: AudioContainerFormat,
}

impl XfyunAsr {
    pub fn new(options: XfyunAsrOption) -> Self {
        let base = options.base;
        let format = base.format.unwrap_or_default();
        Self {
            api_key: base.api_key.clone().unwrap_or_default(),
            app_id: options.app_id.unwrap_or_default(),
            api_secret: options.api_secret.unwrap_or_default(),
            sample_rate: options.sample_rate.unwrap_or(16000),
            domain: options.domain.unwrap_or_else(|| "iat".into()),
            accent: options.accent.unwrap_or_else(|| "mandarin".into()),
            eos: options.eos.unwrap_or(2000),
            dwa: options.dwa,
            ltc: options.ltc,
            dhw: options.dhw,
            ptt: options.ptt,
            rlang: options.rlang,
            vinfo: options.vinfo,
            nunum: options.nunum,
            nbest: options.nbest,
            wbest: options.wbest,
            send_interval: options.send_interval.unwrap_or(0),
            language: base.language,
            format,
        }
    }

    /// 将语言代码映射为科大讯飞格式
    fn map_language(lang: &Option<String>) -> &str {
        match lang.as_deref() {
            Some("zh-CN" | "zh-TW" | "zh-HK") => "zh_cn",
            Some("en-US" | "en-GB") => "en_us",
            _ => "zh_cn",
        }
    }

    /// 将音频格式映射为科大讯飞编码格式
    fn map_encoding(format: AudioContainerFormat) -> &'static str {
        match format {
            AudioContainerFormat::Pcm => "raw",
            AudioContainerFormat::Mp3 => "lame",
            AudioContainerFormat::Wav | AudioContainerFormat::Ogg => "raw",
        }
    }

    /// 构建协议配置选项
    fn build_protocol_options(&self) -> XfyunProtocolOptions {
        XfyunProtocolOptions {
            app_id: self.app_id.clone(),
            api_key: self.api_key.clone(),
            api_secret: self.api_secret.clone(),
            encoding: Self::map_encoding(self.format).to_string(),
            sample_rate: self.sample_rate,
            domain: self.domain.clone(),
            language: Self::map_language(&self.language).to_string(),
            accent: self.accent.clone(),
            eos: self.eos,
            dwa: self.dwa.clone(),
            ltc: self.ltc,
            dhw: self.dhw.clone(),
            ptt: self.ptt,
            rlang: self.rlang.clone(),
            vinfo: self.vinfo,
            nunum: self.nunum,
            nbest: self.nbest,
            wbest: self.wbest,
        }
    }

    /// 验证必要参数
    fn ensure_valid(&self) -> Result<(), AsrError> {
        if self.app_id.is_empty() {
            return Err(AsrError::InvalidParameter(
                "appId is required for Xfyun ASR".into(),
            ));
        }
        if self.api_key.is_empty() {
            return Err(AsrError::InvalidParameter(
                "apiKey is required for Xfyun ASR".into(),
            ));
        }
        if self.api_secret.is_empty() {
            return Err(AsrError::InvalidParameter(
                "apiSecret is required for Xfyun ASR".into(),
            ));
        }
        Ok(())
    }
}

// ============================== WebSocket 通信函数 ==============================

/// 发送音频流任务
///
/// 按 1280 字节分块，base64 编码后发送，首帧用 create_first_frame，后续用 create_middle_frame，
/// 音频流耗尽后发送末帧。
async fn send_audio_task(
    mut write: impl Sink<Message, Error = tokio_tungstenite::tungstenite::Error> + Unpin + Send,
    audio: AudioStream,
    options: XfyunProtocolOptions,
    send_interval: u64,
) -> Result<(), AsrError> {
    tokio::pin!(audio);
    let mut is_first = true;

    while let Some(chunk) = audio.next().await {
        // 逐 1280 字节子块
        for offset in (0..chunk.len()).step_by(XFYUN_CHUNK_SIZE) {
            let end = std::cmp::min(offset + XFYUN_CHUNK_SIZE, chunk.len());
            let piece = &chunk[offset..end];
            let audio_b64 = base64::engine::general_purpose::STANDARD.encode(piece);

            let frame = if is_first {
                is_first = false;
                create_first_frame(&options, &audio_b64)
            } else {
                create_middle_frame(&options, &audio_b64)
            };

            write
                .send(Message::Text(frame))
                .await
                .map_err(AsrError::Websocket)?;

            if send_interval > 0 {
                tokio::time::sleep(Duration::from_millis(send_interval)).await;
            }
        }
    }

    // 发送末帧
    let last_frame = create_last_frame();
    write
        .send(Message::Text(last_frame))
        .await
        .map_err(AsrError::Websocket)?;

    Ok(())
}

/// 接收并处理 WebSocket 响应任务
async fn receive_results(
    mut read: impl Stream<Item = Result<Message, tokio_tungstenite::tungstenite::Error>> + Unpin,
    tx: tokio::sync::mpsc::Sender<Result<QueueItem, AsrError>>,
) -> Result<(), AsrError> {
    // 累积结果数组：以 sn 为索引存储每个片段的文本，支持动态修正
    let mut iat_result: Vec<Option<String>> = Vec::new();

    while let Some(msg) = read.next().await {
        let msg = msg.map_err(AsrError::Websocket)?;

        // 先统一处理为文本
        let text = match msg {
            Message::Text(t) => t,
            Message::Binary(data) => String::from_utf8(data).map_err(AsrError::Utf8)?,
            Message::Close(_) => {
                let _ = tx.send(Ok(QueueItem::Complete)).await;
                return Ok(());
            }
            // tungstenite 自动回复 Ping
            Message::Ping(_) | Message::Pong(_) | Message::Frame(_) => continue,
        };

        // 解析 JSON 响应
        let response: XfyunResponse = serde_json::from_str(&text).map_err(AsrError::Json)?;

        // 检查错误响应
        if !is_success_response(&response) {
            let _ = tx
                .send(Err(AsrError::AsrServiceError {
                    code: response.code,
                    message: response.message,
                }))
                .await;
            return Ok(());
        }

        // 处理包含识别结果的响应
        if has_result_payload(&response) {
            if let Some(result) = response.data.as_ref().and_then(|d| d.result.as_ref()) {
                // 动态修正：当 pgs==="rpl" 时，清除 rg 范围内的旧结果
                if result.pgs.as_deref() == Some("rpl") {
                    if let Some(rg) = result.rg {
                        for i in rg[0]..=rg[1] {
                            if let Some(e) = iat_result.get_mut(i as usize) {
                                *e = None;
                            }
                        }
                    }
                }

                // 确保数组长度足够
                let sn = result.sn as usize;
                if sn >= iat_result.len() {
                    iat_result.resize(sn + 1, None);
                }

                // 存储当前片段文本
                let snippet_text = extract_text_from_result(result);
                iat_result[sn] = Some(snippet_text);

                // 拼接完整累积文本
                let full_text: String = iat_result.iter().filter_map(|t| t.as_deref()).collect();

                let is_final = is_finished_response(&response) || result.ls;

                if tx
                    .send(Ok(QueueItem::Chunk(AsrStreamChunk {
                        text: full_text,
                        is_final,
                        confidence: None,
                        segment: None,
                    })))
                    .await
                    .is_err()
                {
                    return Ok(());
                }
            }
        }

        // 如果是最后一帧，标记完成
        if is_finished_response(&response) {
            let _ = tx.send(Ok(QueueItem::Complete)).await;
            return Ok(());
        }
    }

    // WebSocket 流结束（服务端已关闭连接）
    let _ = tx.send(Ok(QueueItem::Complete)).await;
    Ok(())
}

// ============================== AsrProvider 实现 ==============================

#[async_trait]
#[allow(clippy::result_large_err)]
impl AsrProvider for XfyunAsr {
    fn name(&self) -> &'static str {
        "xfyun"
    }

    async fn listen_stream(
        &self,
        audio: AudioStream,
    ) -> Result<Pin<Box<dyn Stream<Item = Result<AsrStreamChunk, AsrError>> + Send>>, AsrError>
    {
        self.ensure_valid()?;

        let protocol_options = self.build_protocol_options();

        // 生成鉴权 URL
        let url = build_auth_url(
            XFYUN_DEFAULT_HOST,
            XFYUN_DEFAULT_PATH,
            &self.api_key,
            &self.api_secret,
        )?;

        // 建立 WebSocket 连接（带超时）
        let (ws_stream, _) = tokio::time::timeout(CONNECT_TIMEOUT, connect_async(&url))
            .await
            .map_err(|_| AsrError::Timeout(CONNECT_TIMEOUT.as_millis() as u64))?
            .map_err(AsrError::Websocket)?;

        let (write, read) = ws_stream.split();

        // 创建 channel：tx 仅 move 进接收任务，stream 中不残留 tx
        let (tx, mut rx) = tokio::sync::mpsc::channel::<Result<QueueItem, AsrError>>(32);

        let send_interval = self.send_interval;

        // spawn 接收任务（tx move 进去）
        let recv_handle: tokio::task::JoinHandle<Result<(), AsrError>> =
            tokio::spawn(async move { receive_results(read, tx).await });

        // spawn 发送任务
        let send_handle: tokio::task::JoinHandle<Result<(), AsrError>> = tokio::spawn(async move {
            send_audio_task(write, audio, protocol_options, send_interval).await
        });

        // 构造输出流
        let stream = async_stream::stream! {
            loop {
                tokio::select! {
                    item = rx.recv() => {
                        match item {
                            Some(Ok(QueueItem::Chunk(chunk))) => yield Ok(chunk),
                            Some(Ok(QueueItem::Complete)) | None => break,
                            Some(Err(e)) => { yield Err(e); break; }
                        }
                    }
                }
            }

            // 流结束后 join 任务，收集残留错误
            if let Ok(Err(e)) = send_handle.await {
                yield Err(e);
            }
            if let Ok(Err(e)) = recv_handle.await {
                yield Err(e);
            }
        };

        Ok(Box::pin(stream))
    }

    // 不实现 connect() → 使用默认 Err(Unsupported)
}

// ============================== 测试 ==============================

#[cfg(test)]
mod tests {
    use super::*;
    use crate::asr::types::AudioStream;

    // ====== 3.1 构造函数与默认值 ======

    #[test]
    fn test_new_defaults() {
        let provider = XfyunAsr::new(XfyunAsrOption {
            base: BaseProviderOption {
                api_key: Some("test-key".into()),
                ..Default::default()
            },
            ..Default::default()
        });
        assert_eq!(provider.name(), "xfyun");
        assert_eq!(provider.sample_rate, 16000);
        assert_eq!(provider.domain, "iat");
        assert_eq!(provider.accent, "mandarin");
        assert_eq!(provider.eos, 2000);
        assert_eq!(provider.send_interval, 0);
    }

    #[test]
    fn test_new_custom_all() {
        let provider = XfyunAsr::new(XfyunAsrOption {
            base: BaseProviderOption {
                api_key: Some("custom-key".into()),
                language: Some("en-US".into()),
                format: Some(AudioContainerFormat::Mp3),
                ..Default::default()
            },
            app_id: Some("custom-app".into()),
            api_secret: Some("custom-secret".into()),
            sample_rate: Some(8000),
            domain: Some("medical".into()),
            accent: Some("cantonese".into()),
            eos: Some(5000),
            dwa: Some("wpgs".into()),
            ltc: Some(1),
            dhw: Some("热词".into()),
            ptt: Some(1),
            rlang: Some("zh-cn".into()),
            vinfo: Some(1),
            nunum: Some(1),
            nbest: Some(5),
            wbest: Some(80),
            send_interval: Some(50),
        });
        assert_eq!(provider.name(), "xfyun");
        assert_eq!(provider.api_key, "custom-key");
        assert_eq!(provider.app_id, "custom-app");
        assert_eq!(provider.api_secret, "custom-secret");
        assert_eq!(provider.sample_rate, 8000);
        assert_eq!(provider.domain, "medical");
        assert_eq!(provider.accent, "cantonese");
        assert_eq!(provider.eos, 5000);
        assert_eq!(provider.dwa, Some("wpgs".into()));
        assert_eq!(provider.ltc, Some(1));
        assert_eq!(provider.dhw, Some("热词".into()));
        assert_eq!(provider.ptt, Some(1));
        assert_eq!(provider.rlang, Some("zh-cn".into()));
        assert_eq!(provider.vinfo, Some(1));
        assert_eq!(provider.nunum, Some(1));
        assert_eq!(provider.nbest, Some(5));
        assert_eq!(provider.wbest, Some(80));
        assert_eq!(provider.send_interval, 50);
    }

    #[test]
    fn test_new_name() {
        let provider = XfyunAsr::new(XfyunAsrOption {
            base: BaseProviderOption {
                api_key: Some("k".into()),
                ..Default::default()
            },
            ..Default::default()
        });
        assert_eq!(provider.name(), "xfyun");
    }

    #[test]
    fn test_new_api_key_from_base() {
        let provider = XfyunAsr::new(XfyunAsrOption {
            base: BaseProviderOption {
                api_key: Some("the-key".into()),
                ..Default::default()
            },
            ..Default::default()
        });
        assert_eq!(provider.api_key, "the-key");

        let provider = XfyunAsr::new(XfyunAsrOption {
            base: BaseProviderOption {
                api_key: None,
                ..Default::default()
            },
            ..Default::default()
        });
        assert_eq!(provider.api_key, "");
    }

    #[test]
    fn test_new_language_from_base() {
        let provider = XfyunAsr::new(XfyunAsrOption {
            base: BaseProviderOption {
                api_key: Some("k".into()),
                language: Some("en-US".into()),
                ..Default::default()
            },
            ..Default::default()
        });
        assert_eq!(provider.language, Some("en-US".into()));
    }

    #[test]
    fn test_new_format_default_pcm() {
        let provider = XfyunAsr::new(XfyunAsrOption {
            base: BaseProviderOption {
                api_key: Some("k".into()),
                format: None,
                ..Default::default()
            },
            ..Default::default()
        });
        assert_eq!(provider.format, AudioContainerFormat::Pcm);
    }

    #[test]
    fn test_new_format_custom() {
        let provider = XfyunAsr::new(XfyunAsrOption {
            base: BaseProviderOption {
                api_key: Some("k".into()),
                format: Some(AudioContainerFormat::Mp3),
                ..Default::default()
            },
            ..Default::default()
        });
        assert_eq!(provider.format, AudioContainerFormat::Mp3);
    }

    // ====== 3.2 map_language ======

    #[test]
    fn test_map_language_zh_cn() {
        assert_eq!(XfyunAsr::map_language(&Some("zh-CN".into())), "zh_cn");
    }

    #[test]
    fn test_map_language_zh_tw() {
        assert_eq!(XfyunAsr::map_language(&Some("zh-TW".into())), "zh_cn");
    }

    #[test]
    fn test_map_language_en_us() {
        assert_eq!(XfyunAsr::map_language(&Some("en-US".into())), "en_us");
    }

    #[test]
    fn test_map_language_en_gb() {
        assert_eq!(XfyunAsr::map_language(&Some("en-GB".into())), "en_us");
    }

    #[test]
    fn test_map_language_unknown() {
        assert_eq!(XfyunAsr::map_language(&Some("ja-JP".into())), "zh_cn");
    }

    #[test]
    fn test_map_language_none() {
        assert_eq!(XfyunAsr::map_language(&None), "zh_cn");
    }

    #[test]
    fn test_map_language_empty() {
        assert_eq!(XfyunAsr::map_language(&Some("".into())), "zh_cn");
    }

    // ====== 3.3 map_encoding ======

    #[test]
    fn test_map_encoding_pcm() {
        assert_eq!(XfyunAsr::map_encoding(AudioContainerFormat::Pcm), "raw");
    }

    #[test]
    fn test_map_encoding_mp3() {
        assert_eq!(XfyunAsr::map_encoding(AudioContainerFormat::Mp3), "lame");
    }

    #[test]
    fn test_map_encoding_wav() {
        assert_eq!(XfyunAsr::map_encoding(AudioContainerFormat::Wav), "raw");
    }

    #[test]
    fn test_map_encoding_ogg() {
        assert_eq!(XfyunAsr::map_encoding(AudioContainerFormat::Ogg), "raw");
    }

    // ====== 3.4 ensure_valid ======

    #[test]
    fn test_ensure_valid_all_empty() {
        let provider = XfyunAsr::new(XfyunAsrOption {
            base: BaseProviderOption {
                api_key: Some("".into()),
                ..Default::default()
            },
            app_id: Some("".into()),
            api_secret: Some("".into()),
            ..Default::default()
        });
        assert!(provider.ensure_valid().is_err());
    }

    #[test]
    fn test_ensure_valid_missing_app_id() {
        let provider = XfyunAsr::new(XfyunAsrOption {
            base: BaseProviderOption {
                api_key: Some("key".into()),
                ..Default::default()
            },
            app_id: Some("".into()),
            api_secret: Some("secret".into()),
            ..Default::default()
        });
        let result = provider.ensure_valid();
        assert!(matches!(result, Err(AsrError::InvalidParameter(msg)) if msg.contains("appId")));
    }

    #[test]
    fn test_ensure_valid_missing_api_key() {
        let provider = XfyunAsr::new(XfyunAsrOption {
            base: BaseProviderOption {
                api_key: Some("".into()),
                ..Default::default()
            },
            app_id: Some("app".into()),
            api_secret: Some("secret".into()),
            ..Default::default()
        });
        let result = provider.ensure_valid();
        assert!(matches!(result, Err(AsrError::InvalidParameter(msg)) if msg.contains("apiKey")));
    }

    #[test]
    fn test_ensure_valid_missing_api_secret() {
        let provider = XfyunAsr::new(XfyunAsrOption {
            base: BaseProviderOption {
                api_key: Some("key".into()),
                ..Default::default()
            },
            app_id: Some("app".into()),
            api_secret: Some("".into()),
            ..Default::default()
        });
        let result = provider.ensure_valid();
        assert!(
            matches!(result, Err(AsrError::InvalidParameter(msg)) if msg.contains("apiSecret"))
        );
    }

    #[test]
    fn test_ensure_valid_all_present() {
        let provider = XfyunAsr::new(XfyunAsrOption {
            base: BaseProviderOption {
                api_key: Some("key".into()),
                ..Default::default()
            },
            app_id: Some("app".into()),
            api_secret: Some("secret".into()),
            ..Default::default()
        });
        assert!(provider.ensure_valid().is_ok());
    }

    #[test]
    fn test_ensure_valid_whitespace_only() {
        let provider = XfyunAsr::new(XfyunAsrOption {
            base: BaseProviderOption {
                api_key: Some(" ".into()),
                ..Default::default()
            },
            app_id: Some(" ".into()),
            api_secret: Some(" ".into()),
            ..Default::default()
        });
        // is_empty() 不认为空白字符为空，所以 whitespace 会通过校验
        assert!(provider.ensure_valid().is_ok());
    }

    #[test]
    fn test_ensure_valid_send_interval_zero() {
        let provider = XfyunAsr::new(XfyunAsrOption {
            base: BaseProviderOption {
                api_key: Some("key".into()),
                ..Default::default()
            },
            app_id: Some("app".into()),
            api_secret: Some("secret".into()),
            send_interval: Some(0),
            ..Default::default()
        });
        assert_eq!(provider.send_interval, 0);
        assert!(provider.ensure_valid().is_ok());
    }

    #[test]
    fn test_ensure_valid_eos_zero() {
        let provider = XfyunAsr::new(XfyunAsrOption {
            base: BaseProviderOption {
                api_key: Some("key".into()),
                ..Default::default()
            },
            app_id: Some("app".into()),
            api_secret: Some("secret".into()),
            eos: Some(0),
            ..Default::default()
        });
        assert_eq!(provider.eos, 0);
        assert!(provider.ensure_valid().is_ok());
    }

    // ====== 3.5 build_protocol_options ======

    #[test]
    fn test_build_protocol_options() {
        let provider = XfyunAsr::new(XfyunAsrOption {
            base: BaseProviderOption {
                api_key: Some("test-key".into()),
                language: Some("en-US".into()),
                format: Some(AudioContainerFormat::Mp3),
                ..Default::default()
            },
            app_id: Some("test-app".into()),
            api_secret: Some("test-secret".into()),
            sample_rate: Some(44100),
            domain: Some("medical".into()),
            accent: Some("mandarin".into()),
            eos: Some(3000),
            dwa: Some("wpgs".into()),
            ..Default::default()
        });

        let opts = provider.build_protocol_options();
        assert_eq!(opts.app_id, "test-app");
        assert_eq!(opts.api_key, "test-key");
        assert_eq!(opts.api_secret, "test-secret");
        assert_eq!(opts.encoding, "lame");
        assert_eq!(opts.sample_rate, 44100);
        assert_eq!(opts.domain, "medical");
        assert_eq!(opts.language, "en_us");
        assert_eq!(opts.accent, "mandarin");
        assert_eq!(opts.eos, 3000);
        assert_eq!(opts.dwa, Some("wpgs".into()));
    }

    #[test]
    fn test_build_protocol_options_encoding() {
        let provider = XfyunAsr::new(XfyunAsrOption {
            base: BaseProviderOption {
                api_key: Some("k".into()),
                format: Some(AudioContainerFormat::Mp3),
                ..Default::default()
            },
            app_id: Some("a".into()),
            api_secret: Some("s".into()),
            ..Default::default()
        });
        let opts = provider.build_protocol_options();
        assert_eq!(opts.encoding, "lame");

        let provider = XfyunAsr::new(XfyunAsrOption {
            base: BaseProviderOption {
                api_key: Some("k".into()),
                format: Some(AudioContainerFormat::Pcm),
                ..Default::default()
            },
            app_id: Some("a".into()),
            api_secret: Some("s".into()),
            ..Default::default()
        });
        let opts = provider.build_protocol_options();
        assert_eq!(opts.encoding, "raw");
    }

    #[test]
    fn test_build_protocol_options_language() {
        let provider = XfyunAsr::new(XfyunAsrOption {
            base: BaseProviderOption {
                api_key: Some("k".into()),
                language: Some("en-US".into()),
                ..Default::default()
            },
            app_id: Some("a".into()),
            api_secret: Some("s".into()),
            ..Default::default()
        });
        let opts = provider.build_protocol_options();
        assert_eq!(opts.language, "en_us");

        let provider = XfyunAsr::new(XfyunAsrOption {
            base: BaseProviderOption {
                api_key: Some("k".into()),
                language: Some("zh-CN".into()),
                ..Default::default()
            },
            app_id: Some("a".into()),
            api_secret: Some("s".into()),
            ..Default::default()
        });
        let opts = provider.build_protocol_options();
        assert_eq!(opts.language, "zh_cn");
    }

    // ====== 3.6 音频发送逻辑 ======

    #[test]
    fn test_chunk_size_1280() {
        assert_eq!(XFYUN_CHUNK_SIZE, 1280);
    }

    // ====== 3.7 iat_result 累积与动态修正 ======

    /// 辅助函数：构造 iat_result 场景测试（模拟接收任务的累积逻辑）
    fn simulate_iat_result(
        responses: Vec<(u32, Option<String>, Option<[u32; 2]>, bool)>,
    ) -> Vec<String> {
        let mut iat_result: Vec<Option<String>> = Vec::new();
        let mut outputs: Vec<String> = Vec::new();

        for (sn, pgs, rg, _ls) in responses {
            // 动态修正
            if pgs.as_deref() == Some("rpl") {
                if let Some(rgv) = rg {
                    for i in rgv[0]..=rgv[1] {
                        if let Some(e) = iat_result.get_mut(i as usize) {
                            *e = None;
                        }
                    }
                }
            }

            // 确保长度
            let sn_u = sn as usize;
            if sn_u >= iat_result.len() {
                iat_result.resize(sn_u + 1, None);
            }

            iat_result[sn_u] = Some(format!("seg_{sn}"));

            let full_text: String = iat_result.iter().filter_map(|t| t.as_deref()).collect();
            outputs.push(full_text);
        }

        outputs
    }

    #[test]
    fn test_iat_result_simple_accumulate() {
        let outputs = simulate_iat_result(vec![
            (0, None, None, false),
            (1, None, None, false),
            (2, None, None, false),
        ]);
        assert_eq!(outputs.last().unwrap(), "seg_0seg_1seg_2");
    }

    #[test]
    fn test_iat_result_out_of_order() {
        let outputs = simulate_iat_result(vec![
            (2, None, None, false),
            (0, None, None, false),
            (1, None, None, false),
        ]);
        assert_eq!(outputs.last().unwrap(), "seg_0seg_1seg_2");
    }

    #[test]
    fn test_iat_result_dynamic_correction() {
        let outputs = simulate_iat_result(vec![
            (0, None, None, false),
            (1, None, None, false),
            (2, None, None, false),
            // 修正 sn=1..2
            (3, Some("rpl".into()), Some([1, 2]), false),
        ]);
        assert_eq!(outputs.last().unwrap(), "seg_0seg_3");
    }

    #[test]
    fn test_iat_result_rg_out_of_bounds() {
        let outputs = simulate_iat_result(vec![
            (0, None, None, false),
            // rg 超出当前 vec 长度，应安全跳过
            (1, Some("rpl".into()), Some([5, 10]), false),
        ]);
        assert_eq!(outputs.last().unwrap(), "seg_0seg_1");
    }

    #[test]
    fn test_iat_result_large_sn_gap() {
        let outputs = simulate_iat_result(vec![(0, None, None, false), (100, None, None, false)]);
        assert_eq!(outputs.last().unwrap(), "seg_0seg_100");
    }

    #[test]
    fn test_iat_result_all_replaced() {
        let outputs = simulate_iat_result(vec![
            (0, None, None, false),
            (1, None, None, false),
            (2, None, None, false),
            // 修正全部
            (3, Some("rpl".into()), Some([0, 2]), false),
        ]);
        assert_eq!(outputs.last().unwrap(), "seg_3");
    }

    #[test]
    fn test_iat_result_rg_reversed() {
        // rg = [5, 2] → Rust `5..=2` 空 range，不清除任何条目
        let outputs = simulate_iat_result(vec![
            (0, None, None, false),
            (1, None, None, false),
            (2, Some("rpl".into()), Some([5, 2]), false),
        ]);
        assert_eq!(outputs.last().unwrap(), "seg_0seg_1seg_2");
    }

    #[test]
    fn test_iat_result_sn_duplicate() {
        let outputs = simulate_iat_result(vec![
            (0, None, None, false),
            (1, None, None, false),
            (1, None, None, false), // 同一个 sn 第二次
        ]);
        // sn=1 被第二次覆盖
        assert_eq!(outputs.last().unwrap(), "seg_0seg_1");
    }

    #[test]
    fn test_consecutive_same_sn() {
        let outputs = simulate_iat_result(vec![
            (0, None, None, false),
            (1, Some("rpl".into()), Some([0, 0]), false),
            (1, Some("rpl".into()), Some([0, 0]), false),
        ]);
        assert_eq!(outputs.last().unwrap(), "seg_1");
    }

    // ====== listen_stream 参数校验（不实际连接） ======

    #[tokio::test]
    async fn test_listen_stream_missing_app_id() {
        let provider = XfyunAsr::new(XfyunAsrOption {
            base: BaseProviderOption {
                api_key: Some("key".into()),
                ..Default::default()
            },
            app_id: Some("".into()),
            api_secret: Some("secret".into()),
            ..Default::default()
        });
        let audio: AudioStream = Box::pin(futures_util::stream::empty());
        let result = provider.listen_stream(audio).await;
        assert!(matches!(result, Err(AsrError::InvalidParameter(msg)) if msg.contains("appId")));
    }

    #[tokio::test]
    async fn test_listen_stream_missing_api_key() {
        let provider = XfyunAsr::new(XfyunAsrOption {
            base: BaseProviderOption {
                api_key: Some("".into()),
                ..Default::default()
            },
            app_id: Some("app".into()),
            api_secret: Some("secret".into()),
            ..Default::default()
        });
        let audio: AudioStream = Box::pin(futures_util::stream::empty());
        let result = provider.listen_stream(audio).await;
        assert!(matches!(result, Err(AsrError::InvalidParameter(msg)) if msg.contains("apiKey")));
    }

    #[tokio::test]
    async fn test_listen_stream_missing_api_secret() {
        let provider = XfyunAsr::new(XfyunAsrOption {
            base: BaseProviderOption {
                api_key: Some("key".into()),
                ..Default::default()
            },
            app_id: Some("app".into()),
            api_secret: Some("".into()),
            ..Default::default()
        });
        let audio: AudioStream = Box::pin(futures_util::stream::empty());
        let result = provider.listen_stream(audio).await;
        assert!(
            matches!(result, Err(AsrError::InvalidParameter(msg)) if msg.contains("apiSecret"))
        );
    }

    #[tokio::test]
    async fn test_listen_stream_valid_credential() {
        let provider = XfyunAsr::new(XfyunAsrOption {
            base: BaseProviderOption {
                api_key: Some("valid-key".into()),
                ..Default::default()
            },
            app_id: Some("valid-app".into()),
            api_secret: Some("valid-secret".into()),
            ..Default::default()
        });
        let audio: AudioStream = Box::pin(futures_util::stream::empty());

        // 凭证有效，但 WebSocket 连接会失败（无真实服务），
        // 这里只验证 ensure_valid 通过后返回的不是 InvalidParameter
        let result = provider.listen_stream(audio).await;
        match result {
            Err(AsrError::InvalidParameter(_)) => panic!("不应是参数错误"),
            Err(_) => { /* 连接失败或其他错误，预期行为 */ }
            Ok(_) => panic!("不应连接成功（无真实服务）"),
        }
    }
}
