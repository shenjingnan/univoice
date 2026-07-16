# Minimax TTS Provider 实现方案（纯 HTTP）

## 1. 现状分析

### 1.1 JS/TS 版现状

TypeScript 端已有完整的 Minimax TTS 实现：

| 文件 | 描述 |
|---|---|
| `src/tts/protocols/minimax.ts` | **WebSocket** 协议层：消息构造、事件解析、hex 音频解码 |
| `src/tts/providers/minimax.ts` | **WebSocket** Provider：`synthesize()` + `speakStream()` |
| `src/types/voices/minimax.ts` | 音色类型定义（中/英/日/韩等 20+ 语言） |

TS 版使用 **WebSocket** 实现，但 MiniMax 也提供 **HTTP** 接口。

### 1.2 Rust 版现状

Rust 已实现的 TTS Provider 对比：

| Provider | 协议 | 特点 | 对本方案的参考价值 |
|---|---|---|---|
| **Qwen** (`tts/provider/qwen.rs`) | WS + 二进制帧 | 双向流式，首帧延迟低 | 架构不同，参考价值有限 |
| **Doubao** (`tts/provider/doubao.rs`) | WS + 二进制协议 | 复杂双向协议 | 架构不同，参考价值有限 |
| **GLM** (`tts/provider/glm.rs`) | **HTTP + SSE** | 非流式直接返回二进制，流式走 SSE base64 | **高** — 完全一致的模式 |

### 1.3 为什么选择 HTTP 而非 WebSocket

| 方面 | HTTP | WebSocket |
|---|---|---|
| 复杂度 | 低 — 1 次 POST | 高 — `connected_success` → `task_start` → `task_started` → `task_continue` → `task_continued` → `task_finish` → `task_finished` 共 7 步 |
| 非流式合成 | ✅ 直接返回音频 | ❌ 需要完整走 WS 流程 |
| 流式输出 | ✅ SSE 支持 | ✅ 原生支持 |
| **流式输入增益** | **不适用** — MiniMax 每次合成需完整文本 | ❌ **伪增益** — 每个 `task_continue` 独立合成，不降低首字延迟 |
| 依赖 | `reqwest`（已有） | `tokio-tungstenite`（已有但不需要） |
| 可参考实现 | ✅ `glm.rs`（HTTP+SSE，模式完全一致） | 无 |
| 代码量 | 约 **150-200 行**（参考 GLM） | 约 **400-500 行**（参考 Qwen） |

**关键判断**：MiniMax WS 不能像 Qwen 那样实现"边发边收"降低首字延迟。因为：

1. 每个 `task_continue` 对应一次独立合成，`task_continued` 返回 `is_final: true`
2. 音频是 **hex 编码的 JSON 文本帧**，不是原始二进制流
3. HTTP `stream: true` 返回的 SSE 事件和 WS 的 `task_continued` 数据格式**完全一致**

所以 **HTTP SSE** 是更优选择，与 `glm.rs` 完全一致的架构。

---

## 2. 当前架构分析

### 2.1 Rust TTS 模块架构

```
src/tts/
├── mod.rs              # 模块入口，重导出
├── error.rs            # 错误类型
├── traits.rs           # TtsProvider / TtsConnection trait
├── types.rs            # 通用类型（TtsRequest, TtsResponse, BaseTtsOption 等）
├── registry.rs         # Provider 注册表
├── protocol/           # 协议层（按 provider 分文件）
│   ├── mod.rs
│   ├── dashscope.rs    # Qwen 协议
│   ├── glm.rs          # GLM 协议
│   └── volcengine.rs   # Doubao 协议
└── provider/           # Provider 实现
    ├── mod.rs
    ├── doubao.rs
    ├── glm.rs          # HTTP + SSE 参考
    └── qwen.rs
```

### 2.2 GLM Provider 模式（本方案参考）

**协议层 `protocol/glm.rs`**：
- 请求体序列化（`GlmSpeechRequest`）
- SSE 响应解析（`SseLineParser`, `extract_data`, `parse_data`）
- 参数映射（`map_format`, `map_speed`, `map_volume`）
- 错误解析（`parse_error_body`）

**Provider 层 `provider/glm.rs`**：
- `GlmTtsOption` — 配置结构体
- `GlmTts` — Provider struct
- `synthesize()` — HTTP POST 直接返回音频
- `speak_stream()` — HTTP POST + SSE 流式解析
- `list_voices()` — 返回系统音色列表
- `connect()` — 不实现（HTTP 无长连接）

---

## 3. 技术方案

### 3.1 总体结构

```
src/tts/
├── protocol/
│   ├── mod.rs           # 【修改】pub mod minimax;
│   └── minimax.rs       # 【新增】MiniMax HTTP + SSE 协议层
├── provider/
│   ├── mod.rs           # 【修改】pub use minimax::...;
│   └── minimax.rs       # 【新增】MiniMax TTS Provider
```

### 3.2 协议层 `src/tts/protocol/minimax.rs`

负责请求体序列化、SSE 事件解析、hex 音频解码、参数映射。

```rust
// ============================== 常量 ==============================

/// MiniMax TTS 默认地址
pub const MINIMAX_DEFAULT_BASE_URL: &str = "https://api.minimaxi.com/v1/t2a_v2";
/// 备用地址
pub const MINIMAX_BACKUP_BASE_URL: &str = "https://api-bj.minimaxi.com/v1/t2a_v2";
/// 默认模型
pub const MINIMAX_DEFAULT_MODEL: &str = "speech-2.8-hd";
/// 默认音色
pub const MINIMAX_DEFAULT_VOICE: &str = "male-qn-qingse";

// ============================== 请求体 ==============================

/// MiniMax TTS 请求体
#[derive(Debug, Serialize)]
pub struct MinimaxTtsRequest {
    pub model: String,
    pub text: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stream: Option<bool>,
    pub voice_setting: VoiceSetting,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub audio_setting: Option<AudioSetting>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub language_boost: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub subtitle_enable: Option<bool>,
    // 可选：pronunciation_dict, timbre_weights, voice_modify, subtitle_type,
    //       continuous_sound, output_format 等暂不暴露，按需扩展
}

#[derive(Debug, Serialize)]
pub struct VoiceSetting {
    pub voice_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub speed: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub vol: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pitch: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub emotion: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub english_normalization: Option<bool>,
}

#[derive(Debug, Serialize)]
pub struct AudioSetting {
    pub format: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sample_rate: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bitrate: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub channel: Option<u32>,
}

// ============================== 响应体 ==============================

/// MiniMax TTS 响应（非流式 + SSE 数据行共用）
#[derive(Debug, Deserialize)]
pub struct MinimaxResponse {
    pub data: Option<ResponseData>,
    pub trace_id: Option<String>,
    pub extra_info: Option<ExtraInfo>,
    pub base_resp: Option<BaseResp>,
}

#[derive(Debug, Deserialize)]
pub struct ResponseData {
    pub audio: Option<String>,  // hex 编码
    pub status: Option<i32>,    // 1=合成中, 2=合成结束
}

#[derive(Debug, Deserialize)]
pub struct ExtraInfo {
    pub audio_length: Option<i64>,
    pub audio_sample_rate: Option<i64>,
    pub audio_size: Option<i64>,
    pub bitrate: Option<i64>,
    pub word_count: Option<i64>,
    pub usage_characters: Option<i64>,
    pub audio_format: Option<String>,
    pub audio_channel: Option<i64>,
}

#[derive(Debug, Deserialize)]
pub struct BaseResp {
    pub status_code: i32,
    pub status_msg: Option<String>,
}

// ============================== SSE 事件 ==============================

/// 单帧 SSE data 行解析后的事件
pub enum MinimaxStreamEvent {
    Audio(Vec<u8>),       // hex 解码后的音频
    Finished,             // status=2 或 SSE 流结束
    Error(TtsError),      // base_resp.status_code != 0
}
```

**SSE 解析**：复用 GLM 的 `SseLineParser` 模式（基于字节缓冲按 `\n` 切行）。

**hex 解码**：

```rust
fn decode_hex_audio(hex: &str) -> Result<Vec<u8>, TtsError> {
    (0..hex.len())
        .step_by(2)
        .map(|i| u8::from_str_radix(&hex[i..i+2], 16))
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| TtsError::Other(format!("Minimax hex decode error: {}", e)))
}
```

### 3.3 Provider 层 `src/tts/provider/minimax.rs`

```rust
// ============================== MinimaxTtsOption ==============================

#[derive(Debug, Clone, Default)]
pub struct MinimaxTtsOption {
    pub base: BaseTtsOption,
    pub sample_rate: Option<u32>,
    pub bitrate: Option<u32>,
    pub emotion: Option<String>,
    pub language_boost: Option<String>,
    pub subtitle_enable: Option<bool>,
    pub channel: Option<u32>,
}

// ============================== MinimaxTts ==============================

pub struct MinimaxTts {
    api_key: String,
    base_url: String,
    model: String,
    voice: String,
    format: String,
    speed: f32,
    volume: f32,
    pitch: i32,
    sample_rate: Option<u32>,
    bitrate: Option<u32>,
    emotion: Option<String>,
    language_boost: Option<String>,
    subtitle_enable: Option<bool>,
    channel: Option<u32>,
    client: reqwest::Client,  // 同 GLM
}
```

#### 3.3.1 参数映射

| `BaseTtsOption` | MiniMax 协议字段 | 映射 |
|---|---|---|
| `speed` (f32, 0.5~2.0) | `voice_setting.speed` | 直接传递 |
| `volume` (f32, 0.0~1.0) | `voice_setting.vol` | 直接传递（范围 0~10，默认 1.0） |
| `pitch` (f32) | `voice_setting.pitch` | `as i32`（范围 -12~12） |
| `format` (String) | `audio_setting.format` | MiniMax 支持: mp3/pcm/flac/wav/pcmu_raw/pcmu_wav/opus |

#### 3.3.2 核心方法

**非流式 `synthesize()`**：

```
POST /v1/t2a_v2 { model, text, voice_setting, audio_setting, stream: false }
  → 200 { data: { audio: "<hex>" }, base_resp: { status_code: 0 } }
  → 解码 hex → TtsResponse
```

**流式 `speak_stream()`**：

```
POST /v1/t2a_v2 { model, text, voice_setting, audio_setting, stream: true }
  → SSE:
    data: { data: { audio: "<hex>", status: 1 }, ... }
    data: { data: { audio: "<hex>", status: 1 }, ... }
    data: { data: { audio: "<hex>", status: 2 }, ... }  ← 最后一个
  → 逐帧解码 → TtsAudioStream
```

**`speak_stream` 的文本流处理**（同 GLM）：

```rust
async fn speak_stream(&self, input: TextStream) -> Result<TtsAudioStream, TtsError> {
    // MiniMax HTTP API 的 text 是一次性发送的，需先缓冲文本流
    let mut text = String::new();
    let mut input = input;
    while let Some(chunk) = input.next().await {
        text.push_str(&chunk);
    }

    // POST stream: true + SSE 解析
    let resp = self.client.post(&self.base_url)
        .header(AUTHORIZATION, format!("Bearer {}", self.api_key))
        .json(&self.build_request(&text, true))
        .send().await?;

    // 处理 SSE 流...
}
```

**`list_voices()`**：返回常用系统音色列表（中文/英文/日文的核心音色）。

**`connect()`**：不实现（HTTP 无长连接，同 GLM）。

---

## 4. 实施方案

### 阶段 1：协议层 `src/tts/protocol/minimax.rs`（1h）

**具体任务**：
1. 定义常量（`MINIMAX_DEFAULT_BASE_URL`, `MINIMAX_DEFAULT_MODEL`, `MINIMAX_DEFAULT_VOICE`）
2. 定义请求体结构体（`MinimaxTtsRequest`, `VoiceSetting`, `AudioSetting`）
3. 定义响应体结构体（`MinimaxResponse`, `ResponseData`, `BaseResp` 等）
4. 定义 SSE 事件枚举 `MinimaxStreamEvent`
5. 实现 hex 音频解码函数
6. 实现 SSE data 行解析函数 `parse_data()`
7. 实现错误解析函数 `parse_error_body()`
8. 复用 GLM 的 `SseLineParser`（提取到公共模块，或直接复制一份）

**验收**：
- 请求体序列化测试（None 字段不出现、stream 字段等）
- 响应体反序列化测试（正常响应、错误响应）
- Hex 解码测试
- `cargo test` 通过
- `cargo clippy -- -D warnings` 通过

### 阶段 2：Provider 层 `src/tts/provider/minimax.rs`（2h）

**具体任务**：
1. 定义 `MinimaxTtsOption` 结构体
2. 定义 `MinimaxTts` Provider struct + `new()` 构造函数
3. 实现 `ensure_valid()` — api_key 校验
4. 实现 `build_request()` — 构建 `MinimaxTtsRequest`
5. 实现 `TtsProvider` trait：
   - `fn name() -> "minimax"`
   - `async fn synthesize()` — 非流式：POST → hex 解码 → `TtsResponse`
   - `async fn speak_stream()` — 流式：POST `stream: true` → SSE 解析 → `TtsAudioStream`
   - `async fn list_voices()` — 返回音色列表

**验收**：
- 构造参数测试（默认值、自定义值、空 api_key）
- 请求体构建测试（参数映射、None 不发送）
- `cargo test` 通过
- `cargo clippy -- -D warnings` 通过

### 阶段 3：注册与导出（0.2h）

**具体任务**：
1. 在 `src/tts/protocol/mod.rs` 添加 `pub mod minimax;`
2. 在 `src/tts/provider/mod.rs` 添加 `pub mod minimax;` 和 `pub use` 导出
3. 确认 `lib.rs` / `mod.rs` 无需额外修改

**验收**：
- `cargo build` 通过

### 阶段 4：示例程序（1h）

**具体任务**：
1. 创建 `examples/tts_minimax_synthesize.rs` — 非流式合成示例（参照 `tts_qwen_synthesize.rs`）
2. 创建 `examples/tts_minimax_stream.rs` — 流式合成示例（参照 `tts_qwen_stream.rs`）

**验收**：
- `cargo build --example tts_minimax_synthesize` 通过
- `cargo build --example tts_minimax_stream` 通过

### 阶段 5：集成测试（0.5h）

**具体任务**：
1. 协议层完整的单元测试覆盖
2. Provider 层参数映射完整测试
3. 可选的 mock HTTP server 测试（参照 `tests/common/mock_glm_http_server.rs` 模式）

**验收**：
- 所有测试通过
- `cargo test` 全绿
- `cargo clippy -- -D warnings` 通过

---

## 5. 边界场景与注意事项

### 5.1 `data` 可能为 null
```json
{ "data": null, "base_resp": { "status_code": 1004, "status_msg": "auth failed" } }
```
需处理 `Option<ResponseData>`。

### 5.2 `data.audio` 可能为 null 或空字符串
某些情况下（如文本很短时）可能没有音频数据。

### 5.3 SSE 流结束判断
- `status: 2` 表示当前批次合成结束
- 流式场景下可能有多次 `status: 1` 事件后出现 `status: 2`
- 非流式场景 `status` 始终为 `2`

### 5.4 请求体序列化
GLM 使用 `serde_json::to_vec` 手动序列化，MiniMax 可以使用 `reqwest::RequestBuilder::json()` 自动序列化（更简洁）。

### 5.5 emotion 参数
TS 版未暴露 emotion，但 HTTP 文档支持。Rust 版通过 `MinimaxTtsOption.emotion` 暴露。

### 5.6 长文本处理
MiniMax API 限制 text 最多 10,000 字符。超过建议走流式输出。
需在 `build_request` 中做长度校验或文档说明。

### 5.7 SSELineParser 复用策略
GLM 的 `SseLineParser` 定义在 `src/tts/protocol/glm.rs` 中（非 pub）。有两种方案：
- **方案 A（推荐）**：在 `src/tts/protocol/minimax.rs` 中直接复制一份（简单，无耦合）
- **方案 B**：提取到 `src/tts/protocol/mod.rs` 中作为公共模块
