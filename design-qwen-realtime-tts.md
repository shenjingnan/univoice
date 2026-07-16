# Qwen Realtime TTS Provider 实现方案

## 1. 现状分析

### 1.1 现有架构

目前在 `main-rs` 分支中，Rust TTS 模块的结构如下：

```
src/tts/
├── mod.rs              # 模块声明
├── error.rs            # TtsError 错误类型
├── traits.rs           # TtsProvider / TtsConnection trait
├── types.rs            # 公共类型定义
├── registry.rs         # Provider 注册/工厂
├── protocol/
│   ├── mod.rs
│   ├── dashscope.rs    # CosyVoice 协议（task 模式）
│   ├── glm.rs
│   ├── minimax.rs
│   ├── volcengine.rs
│   └── xfyun.rs
└── provider/
    ├── mod.rs
    ├── qwen.rs         # QwenTTS (CosyVoice task 模式) ✅
    ├── doubao.rs
    ├── glm.rs
    ├── minimax.rs
    └── xfyun.rs
```

### 1.2 已经具备的能力

- **Base64 编解码**：已在 `Cargo.toml` 中依赖 `base64 = "0.22"`
- **UUID 生成**：已在 `Cargo.toml` 中依赖 `uuid = { version = "1", features = ["v4"] }`
- **WebSocket 客户端**：`tokio-tungstenite`
- **异步运行时**：`tokio`
- **Serde JSON 序列化/反序列化**：`serde_json`
- **流式处理**：`futures-util`、`async-stream`

### 1.3 Qwen Realtime TTS 协议特点

与 CosyVoice（task 模式）的关键区别：

| 维度 | CosyVoice (qwen) | Realtime (qwen-realtime) |
|------|------------------|-------------------------|
| 端点 | `/api-ws/v1/inference/` | `/api-ws/v1/realtime?model=xxx` |
| 协议 | header/payload 结构 | 事件驱动 JSON |
| 模型 | cosyvoice-v1/v2/v3 | qwen3-tts-flash-realtime 等 |
| 音频 | Binary WebSocket 帧 | Base64 编码在 JSON 中 |
| 会话 | 每次合成独立 task | session 生命周期 |
| 情感控制 | `instruction` 参数 | `instructions`（仅 instruct 模型） |

### 1.4 交互流程

```
Client                                     Server
  |                                           |
  |------ WebSocket Connect (wss://...) ----->|
  |                                           |
  |<------ session.created (JSON) ------------|
  |                                           |
  |------ session.update (JSON) ------------->|
  |                                           |
  |<------ session.updated (JSON) ------------|
  |                                           |
  |--- input_text_buffer.append (JSON) ------>|  (可多次)
  |                                           |
  |<---- response.audio.delta (base64) -------|  (可多次)
  |                                           |
  |------ session.finish (JSON) ------------->|
  |                                           |
  |<------ session.finished (JSON) -----------|
  |                                           |
  |<-------- WebSocket Close -----------------|
```

---

## 2. 实施方案

### 2.1 新增文件清单

| # | 文件 | 用途 |
|---|------|------|
| 1 | `src/tts/protocol/dashscope_realtime.rs` | Realtime 协议层：事件类型、序列化/反序列化 |
| 2 | `src/tts/provider/qwen_realtime.rs` | Provider 实现：QwenRealtimeTts + QwenRealtimeTtsConnection |
| 3 | `examples/tts_qwen_realtime_synthesize.rs` | 非流式合成示例 |
| 4 | `examples/tts_qwen_realtime_stream.rs` | 流式合成示例 |

### 2.2 修改文件清单

| # | 文件 | 修改内容 |
|---|------|----------|
| 1 | `src/tts/protocol/mod.rs` | 新增 `pub mod dashscope_realtime;` |
| 2 | `src/tts/provider/mod.rs` | 新增 `pub mod qwen_realtime;` 并导出 |
| 3 | `src/tts/mod.rs` | 无需修改（provider/mod.rs 和 protocol/mod.rs 递归导出） |

### 2.3 详细设计

#### 2.3.1 协议层 `dashscope_realtime.rs`

负责：
1. **客户端事件类型定义和序列化**（`SessionUpdateEvent`、`InputTextBufferAppendEvent`、`SessionFinishEvent`）
2. **服务端事件类型定义和反序列化**（`SessionCreated`、`SessionUpdated`、`ResponseAudioDelta`、`SessionFinished`、`Error`）
3. **事件创建函数**
4. **事件接收/解析函数**

**客户端事件结构：**

```rust
// session.update
struct ClientSessionUpdate { ... }

// input_text_buffer.append
struct ClientInputTextBufferAppend { event_id, text }

// input_text_buffer.commit (可选，后续扩展)
struct ClientInputTextBufferCommit { event_id }

// input_text_buffer.clear (可选，后续扩展)
struct ClientInputTextBufferClear { event_id }

// session.finish
struct ClientSessionFinish { event_id }
```

**服务端事件枚举：**

```rust
enum ServerEvent {
    SessionCreated { session: SessionInfo },
    SessionUpdated { session: SessionInfo },
    ResponseAudioDelta { delta: String },  // base64 编码
    ResponseDone,
    SessionFinished { usage: Option<Usage> },
    Error { code: String, message: String },
    // 忽略中间事件（response.created, response.output_item.added 等）
}
```

**核心函数：**

| 函数 | 说明 |
|------|------|
| `create_session_update(...)` | 构建 session.update JSON |
| `create_input_text_buffer_append(text)` | 构建 append JSON |
| `create_session_finish()` | 构建 session.finish JSON |
| `parse_server_event(json_str)` | 解析服务端 JSON 事件 |
| `create_ws_request(url, api_key)` | 构建带 Auth 头的 WS 请求 |

#### 2.3.2 Provider 层 `qwen_realtime.rs`

**配置结构体：**

```rust
pub struct QwenRealtimeTtsOption {
    pub base: BaseTtsOption,
    /// 采样率
    pub sample_rate: Option<u32>,
    /// 情感控制指令（仅 instruct 模型支持）
    pub instruction: Option<String>,
    /// 是否启用指令优化
    pub optimize_instructions: Option<bool>,
    /// 语速倍率 (0.5~2.0)
    pub speech_rate: Option<f32>,
    /// 音调倍率 (0.5~2.0)
    pub pitch_rate: Option<f32>,
    /// 交互模式
    pub mode: Option<RealtimeMode>,
    /// 语言类型
    pub language_type: Option<String>,
}
```

**Provider 结构体：**

```rust
pub struct QwenRealtimeTts {
    api_key: String,
    base_url: String,
    model: String,
    voice: String,
    format: String,
    sample_rate: u32,
    instruction: Option<String>,
    optimize_instructions: bool,
    speech_rate: f32,
    pitch_rate: f32,
    mode: RealtimeMode,
    language_type: Option<String>,
}
```

**TtsProvider 实现：**

| 方法 | 行为 |
|------|------|
| `name()` | 返回 `"qwen-realtime"` |
| `synthesize()` | 非流式：connect → session.init → append text → session.finish → 收集全部 audio → 返回 `TtsResponse` |
| `speak_stream()` | 流式：connect → session.init → 并发 TextStream→append + 接收 audio→TtsAudioStream |
| `connect()` | 建立 WS 连接 + 完成 session 初始化，返回 `QwenRealtimeTtsConnection` |
| `list_voices()` | 返回空（API 未提供） |

**核心函数：**

```
run_realtime_synthesize(ws, text, config) -> Result<TtsResponse>
  ├── initialize_session(ws, config)     // 等待 session.created → 发送 session.update → 等待 session.updated
  ├── send_text_and_finish(ws, text)     // 发送 append + session.finish
  └── collect_audio(ws)                  // 循环读取事件，提取 base64 delta 直到 session.finished

run_realtime_stream(ws, input, config) -> Result<TtsAudioStream>
  ├── initialize_session(ws, config)
  ├── tokio::spawn(send_loop)            // TextStream → append → session.finish
  ├── tokio::spawn(recv_loop)            // 事件循环：base64 delta → tx channel
  └── async_stream! { rx → TtsStreamChunk }
```

**Connection 结构体：**

```rust
pub struct QwenRealtimeTtsConnection {
    ws: Option<WebSocketStream<MaybeTlsStream<TcpStream>>>,
    state: ConnectionState,
    config: QwenRealtimeConfig,
}
```

**TtsConnection 实现：**

| 方法 | 行为 |
|------|------|
| `state()` | 返回当前状态 |
| `synthesize()` | 在预初始化 session 上直接 append text + session.finish + 收集 audio |
| `speak_stream()` | take ws，执行 run_realtime_stream |
| `close()` | 关闭 WS |

### 2.3.3 URL 构建逻辑

Realtime API 的 model 通过 URL query 参数传递，与 CosyVoice 不同：

```rust
fn build_realtime_url(base_url: &str, model: &str) -> url::Url {
    let mut url = url::Url::parse(base_url).unwrap();
    url.query_pairs_mut().append_pair("model", model);
    url
}
```

### 2.3.4 Base64 音频解码

音频数据通过 `response.audio.delta` 事件以 Base64 字符串传输：

```rust
fn decode_audio_delta(delta: &str) -> Result<Vec<u8>, TtsError> {
    use base64::Engine;
    base64::engine::general_purpose::STANDARD
        .decode(delta)
        .map_err(|e| TtsError::Other(format!("Base64 decode error: {}", e)))
}
```

注意：`base64 = "0.22"` 使用 `base64::Engine` trait，需导入 `use base64::engine::general_purpose;`

### 2.4 错误处理

利用现有的 `TtsError` 枚举，无需新增错误变体：

| 错误场景 | TtsError 类型 |
|----------|--------------|
| API Key 为空 | `InvalidParameter` |
| WS 连接超时 | `Timeout` |
| WS 断开 | `Websocket` / `ConnectionClosed` |
| 服务端返回 error 事件 | `ServiceError { code, message }` |
| 未收到音频 | `NoAudio` |
| JSON 解析失败 | `Json` |
| Base64 解码失败 | `Other("Base64 decode error: ...")` |

### 2.5 示例程序

遵循现有示例模式（参考 `examples/tts_qwen_synthesize.rs` / `examples/tts_qwen_stream.rs`）：

#### 非流式示例 `examples/tts_qwen_realtime_synthesize.rs`

```rust
#[tokio::main]
async fn main() -> Result<()> {
    let api_key = std::env::var("QWEN_API_KEY").expect("QWEN_API_KEY");
    let tts = QwenRealtimeTts::new(QwenRealtimeTtsOption {
        base: BaseTtsOption { api_key: Some(api_key), ..Default::default() },
        ..Default::default()
    });
    let resp = tts.synthesize(TtsRequest { text: "你好世界".into(), options: None }).await?;
    std::fs::write("output.mp3", resp.audio)?;
    Ok(())
}
```

#### 流式示例 `examples/tts_qwen_realtime_stream.rs`

```rust
#[tokio::main]
async fn main() -> Result<()> {
    let api_key = std::env::var("QWEN_API_KEY")?;
    let tts = QwenRealtimeTts::new(QwenRealtimeTtsOption {
        base: BaseTtsOption { api_key: Some(api_key), ..Default::default() },
        ..Default::default()
    });
    let input: TextStream = Box::pin(futures_util::stream::iter(
        vec!["你好".to_string(), "世界".to_string()].into_iter()
    ));
    let mut stream = tts.speak_stream(input).await?;
    while let Some(chunk) = stream.next().await {
        let chunk = chunk?;
        // 处理 audio_chunk
    }
    Ok(())
}
```

---

## 3. 实现步骤

### 阶段 1：协议层（`dashscope_realtime.rs`）

- [ ] 1.1 定义客户端事件结构体（`ClientSessionUpdate`, `ClientInputTextBufferAppend`, `ClientSessionFinish`）
- [ ] 1.2 定义服务端事件枚举（`ServerEvent`）
- [ ] 1.3 实现 `create_session_update()` 函数
- [ ] 1.4 实现 `create_input_text_buffer_append()` 函数
- [ ] 1.5 实现 `create_session_finish()` 函数
- [ ] 1.6 实现 `parse_server_event()` 函数
- [ ] 1.7 实现 `create_ws_request()` 函数（带 Authorization header + model query param）
- [ ] 1.8 编写单元测试覆盖所有事件序列化和反序列化

### 阶段 2：Provider 层（`qwen_realtime.rs`）

- [ ] 2.1 定义 `QwenRealtimeTtsOption` 配置结构体
- [ ] 2.2 定义 `QwenRealtimeTts` 主结构体，实现 `new()`、`ensure_valid()`、`build_realtime_url()`
- [ ] 2.3 实现 `initialize_session()` — session.created → session.update → session.updated
- [ ] 2.4 实现 `run_realtime_synthesize()` — 非流式合成完整流程
- [ ] 2.5 实现 `run_realtime_stream()` — 流式合成（ws.split + 双 tokio task）
- [ ] 2.6 实现 `TtsProvider` trait（name, synthesize, speak_stream, connect, list_voices）
- [ ] 2.7 定义 `QwenRealtimeTtsConnection`，实现 `TtsConnection` trait
- [ ] 2.8 编写单元测试覆盖配置、参数验证、URL 构建、状态机

### 阶段 3：注册与示例

- [ ] 3.1 在 `src/tts/protocol/mod.rs` 注册新模块
- [ ] 3.2 在 `src/tts/provider/mod.rs` 注册新模块
- [ ] 3.3 编写非流式示例 `examples/tts_qwen_realtime_synthesize.rs`
- [ ] 3.4 编写流式示例 `examples/tts_qwen_realtime_stream.rs`

### 阶段 4：质量检查

- [ ] 4.1 `cargo fmt --check` 格式检查
- [ ] 4.2 `cargo clippy -- -D warnings` Lint 检查
- [ ] 4.3 `cargo test` 全部测试通过

---

## 4. 关键设计决策

### 4.1 协议模块为何独立而不合并到 `dashscope.rs`

CosyVoice 和 Realtime 虽然都来自 DashScope，但：
- 协议格式完全不同（header/payload vs 事件驱动）
- 端点 URL 不同（model 在 query param vs path）
- 事件类型不同（run-task vs session.update）
- 音频传输方式不同（Binary frame vs base64）

所以 **新建 `dashscope_realtime.rs`** 更清晰，保持关注点分离。

### 4.2 为什么 `connect()` 必须完成 session 初始化

Realtime 协议要求在发送文本前必须先完成 session 初始化（`session.created` → `session.update` → `session.updated`）。对于 `connect()` 方法，设计是在建立 WS 连接后**自动完成 session 初始化**，这样调用者拿到的 `TtsConnection` 已经可以直接发送文本。

### 4.3 关于 `commit` 模式

根据文档，`server_commit` 模式下只需 `append` 文本即可自动触发合成，是最常用的模式。`commit` 模式需要额外调用 `input_text_buffer.commit`。第一期只实现 `server_commit` 模式，`commit` 模式留作后续扩展。

### 4.4 中间事件的处理

服务端在音频生成过程中会发送多个中间事件：
- `response.created`
- `response.output_item.added`
- `response.content_part.added`
- `response.audio.done`
- `response.content_part.done`
- `response.output_item.done`
- `response.done`

这些事件对客户端无实际用处（不包含音频数据），只需忽略即可，直到遇到 `response.audio.delta`（包含 base64 音频）、`session.finished`（结束）或 `error`（失败）。

---

## 5. 验收标准

1. ✅ `cargo build` 编译通过，无 warning
2. ✅ `cargo clippy -- -D warnings` 通过
3. ✅ `cargo fmt --check` 通过
4. ✅ `cargo test` 所有测试通过
5. ✅ 协议层单元测试覆盖所有事件类型的序列化和反序列化
6. ✅ Provider 配置参数验证测试覆盖
7. ✅ URL 构建逻辑正确（model 在 query param 中）
