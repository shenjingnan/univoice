# 技术方案：Rust 版 Benchmark —— 阶段一（核心流程）

> 作者: Claude Code  
> 日期: 2026-07-18  
> 状态: 待审批

---

## 1. 现状分析

当前 benchmark 系统存在于 `benchmark/` 目录，是一套用 TypeScript 编写的性能测试工具，通过 `pnpm benchmark` 命令驱动。它测试 Rust SDK 的 TTS/ASR 提供商 API，但在 **技术栈上与主项目 Rust SDK 不一致**：

- SDK 本身是 Rust 项目，benchmark 却是 TypeScript/Node.js
- benchmark 实际上调用的是 `univoice` 的 TypeScript SDK（而非 Rust SDK），这使得 benchmark 测量的延迟包含了 Node.js 运行时开销
- 需要维护两套 SDK 调用代码（TS 版 benchmark 和 Rust 版 SDK），增加维护成本
- 需要 `tsx` + `pnpm` + Node.js 环境才能运行

### 核心痛点

| 痛点 | 说明 |
|------|------|
| 技术栈不一致 | Rust SDK + TS Benchmark，双语言维护 |
| 测量精度 | `Date.now()` 毫秒级 vs `tokio::time::Instant` 纳秒级 |
| 环境依赖 | 需要 Node.js / pnpm / tsx |
| 代码重复 | Provider 调用逻辑在 TS 和 Rust 各写一遍 |

### 阶段定位

**阶段一的目标**不是完美替代 TypeScript 版的所有功能，而是先跑通 **Rust 版核心流程**：从创建 TTS/ASR Provider → 执行合成/识别 → 收集指标 → 保存结果为 JSON。后续阶段再补齐矩阵测试、报告生成等功能。

---

## 2. 当前架构分析

### TypeScript Benchmark 架构

```
index.ts (CLI 入口)
  → run.ts (命令行解析 + 调度)
      ├── runTTSSuite() → tts-runner.ts (创建 Provider, 调用 speak/synthesize)
      ├── runASRSuite() → asr-runner.ts (创建 Provider, 调用 listen)
      ├── matrix/ → 矩阵组合测试
      └── MetricsCollector (时间打点 + 统计)
  → analyze.ts → aggregator.ts + report-generator.ts (报告)

结果输出: results/runs/<type>/<provider>/<scenario>/<timestamp>.json
```

### Rust SDK 已就绪的能力

**TTS 层 (8 个 Provider 全部实现)：**

```
TtsProvider trait
  ├── synthesize(&self, TtsRequest) → TtsResponse          # 非流式合成
  ├── speak_stream(&self, TextStream) → TtsAudioStream      # 流式合成
  └── connect(&self, TtsConnectOption) → TtsConnection      # 连接复用
```

**ASR 层 (5 个 Provider 全部实现)：**

```
AsrProvider trait
  ├── listen_stream(&self, AudioStream) → ResultStream      # 流式识别
  └── connect(&self, AsrConnectOption) → AsrConnection      # 连接复用
```

**Provider 选项结构（所有 Provider 统一模式）：**

```rust
// TTS: 每个 Provider 选项都包含 base: BaseTtsOption
pub struct QwenTtsOption     { pub base: BaseTtsOption, pub sample_rate: Option<u32>, ... }
pub struct DoubaoTtsOption   { pub base: BaseTtsOption, pub app_id: Option<String>, ... }
pub struct OpenaiTtsOption   { pub base: BaseTtsOption, pub api_mode: Option<OpenaiApiMode> }
// ... 其他 Provider 类似

// ASR: 每个 Provider 选项都包含 base: BaseProviderOption
pub struct QwenAsrOption     { pub base: BaseProviderOption, pub sample_rate: Option<u32>, ... }
pub struct DoubaoAsrOption   { pub base: BaseProviderOption, pub app_key: Option<String>, ... }
// ... 其他 Provider 类似
```

---

## 3. 技术方案

### 3.1 总体架构

```
Cargo.toml
  └── [[bin]] name = "univoice-bench"  # 新的 benchmark 二进制

src/benchmark/
├── mod.rs              # 模块导出
├── cli.rs              # CLI 参数定义 (clap)
├── types.rs            # 类型定义 (BenchmarkResult 等)
├── collector.rs        # 指标收集器 (Timer + MetricsCollector)
├── fixtures.rs         # 测试夹具 (文本/音频)
├── provider_factory.rs # Provider 工厂 (从环境变量创建)
├── runner.rs           # 主调度逻辑
├── tts.rs              # TTS 测试执行
├── asr.rs              # ASR 测试执行
└── result.rs           # JSON 结果序列化

src/bin/bench.rs        # 二进制入口
```

### 3.2 核心数据流

```
CLI 参数 (clap)
  │
  ▼
解析参数: provider / test_type / iterations / dry_run
  │
  ▼
ProviderFactory::from_env()
  │  读取环境变量创建 Provider 配置列表
  ▼
Runner::run()
  ├── 对每个 Provider:
  │     ├── TTS: 调用 synthesize() 和/或 speak_stream()
  │     │        MetricsCollector 记录每个 audio_chunk 的时间
  │     │        → SingleTestResult
  │     └── ASR: 调用 listen_stream()
  │              读取音频文件 → AudioStream
  │              MetricsCollector 记录每个 text chunk 的时间
  │              → SingleTestResult
  │
  ▼
ResultSaver::save()
  │  保存到 results/runs/<type>/<provider>/<scenario>/<timestamp>.json
  │  控制台输出摘要
  ▼

完成
```

### 3.3 类型定义

#### BenchmarkConfig（测试配置）

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BenchmarkConfig {
    pub input_mode: String,    // "stream" | "non-stream"
    pub output_mode: String,   // "stream" | "non-stream"
    pub format: String,
    pub text_length: Option<usize>,
    pub audio_duration: Option<f64>,
    pub voice: Option<String>,
    pub sample_rate: Option<u32>,
}
```

#### SingleTestResult（单次测试结果）

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SingleTestResult {
    pub id: String,              // UUID v4
    pub timestamp: String,       // ISO 8601
    pub provider: String,
    pub model: String,
    pub test_type: String,       // "tts" | "asr"
    pub scenario: String,
    pub iteration: u32,
    pub config: BenchmarkConfig,
    pub start_time: f64,         // SystemTime millis
    pub throughput: ThroughputMetrics,
    pub quality: QualityMetrics,
    pub accuracy: Option<RawAccuracyData>,
    pub status: String,          // "success" | "error" | "timeout"
    pub error: Option<String>,
}
```

#### ThroughputMetrics / QualityMetrics / RawAccuracyData

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ThroughputMetrics {
    pub data_rate: f64,          // bytes/ms
    pub chunk_count: u32,
    pub avg_chunk_size: f64,
    pub chunks: Option<Vec<ChunkDetail>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChunkDetail {
    pub timestamp: f64,
    pub relative_time: f64,      // ms
    pub size: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QualityMetrics {
    pub data_size: usize,
    pub text_length: Option<usize>,
    pub audio_duration: Option<f64>,  // seconds (estimated)
    pub bitrate: Option<f64>,         // kbps
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RawAccuracyData {
    pub expected_text: Option<String>,
    pub actual_text: Option<String>,
}
```

### 3.4 CLI 接口

```bash
cargo run --bin univoice-bench -- [OPTIONS]

选项:
  -p, --provider <NAME>   Provider 过滤（可重复，如 -p qwen -p doubao）
  -t, --type <TYPE>       测试类型: tts | asr | all（默认 all）
  -i, --iterations <N>    迭代次数（默认 3）
  -d, --dry-run           模拟运行，不调用真实 API
  -o, --output <DIR>      结果输出目录（默认 benchmark/results）
  -h, --help              显示帮助
```

### 3.5 Provider 工厂设计

Phase 1 采用**直接实例化**（不使用 registry），因为每个 Provider 的 Option 结构体不同。通过 `ProviderFactory` 模块统一管理。

```rust
// 所有支持的 TTS Provider
pub const TTS_PROVIDERS: &[&str] = &[
    "qwen", "qwen-realtime", "doubao", "openai",
    "gemini", "glm", "minimax", "xfyun",
];

// 所有支持的 ASR Provider
pub const ASR_PROVIDERS: &[&str] = &[
    "qwen", "doubao", "glm", "mimo", "xfyun",
];
```

**工厂函数接口：**

```rust
pub fn create_tts_provider(
    name: &str,
    model: &str,
    voice: &str,
    format: &str,
    sample_rate: Option<u32>,
) -> Result<Box<dyn TtsProvider>, TtsError>
```

每个 Provider 的环境变量约定：

| Provider   | 环境变量                                |
|------------|----------------------------------------|
| qwen       | `QWEN_API_KEY`                         |
| doubao     | `DOUBAO_APP_ID`, `DOUBAO_ACCESS_TOKEN` |
| openai     | `OPENAI_API_KEY`                       |
| gemini     | `GEMINI_API_KEY`                       |
| glm        | `GLM_API_KEY`                          |
| minimax    | `MINIMAX_API_KEY`, `MINIMAX_GROUP_ID`  |
| xfyun      | `XFYUN_APP_ID`, `XFYUN_API_KEY`, `XFYUN_API_SECRET` |
| mimo       | `MIMO_API_KEY`                         |

### 3.6 指标收集器设计

```rust
pub struct Timer {
    start: Option<tokio::time::Instant>,
    first_chunk: Option<tokio::time::Instant>,
    end: Option<tokio::time::Instant>,
}

impl Timer {
    pub fn start(&mut self);              // 记录启动时间
    pub fn record_first_chunk(&mut self); // 记录首包时间（仅首次）
    pub fn stop(&mut self);              // 记录结束时间

    pub fn first_chunk_latency(&self) -> Option<Duration>;
    pub fn total_latency(&self) -> Option<Duration>;
}

pub struct MetricsCollector {
    timer: Timer,
    chunks: Vec<ChunkDetail>,
    total_size: usize,
    text_length: Option<usize>,
}

impl MetricsCollector {
    pub fn new() -> Self;
    pub fn start(&mut self);              // 重置并开始计时
    pub fn add_chunk(&mut self, data: &[u8]);   // 记录一个数据块
    pub fn set_text_length(&mut self, len: usize);
    pub fn stop(&mut self);

    pub fn throughput(&self) -> ThroughputMetrics;
    pub fn quality(&self, data_size: usize) -> QualityMetrics;
}
```

### 3.7 TTS 测试执行流程

```rust
pub async fn run_tts_test(
    provider: &str,
    text: &str,
    iterations: u32,
) -> Result<Vec<SingleTestResult>> {

    // 1. 从环境变量读取配置
    let config = TtsBenchmarkConfig::from_env(provider);

    // 2. 创建 Provider 实例
    let tts = create_tts_provider(provider, &config)?;

    // 3. 执行多次迭代
    for i in 0..iterations {
        let mut collector = MetricsCollector::new();
        collector.start();

        // 4. 调用 synthesize()（非流式）
        let response = tts.synthesize(TtsRequest {
            text: text.to_string(),
            options: None,
        }).await?;

        // 5. 记录音频块（非流式结果视为一个完整块）
        collector.add_chunk(&response.audio);
        collector.stop();

        // 6. 构建结果
        let result = SingleTestResult {
            provider: provider.to_string(),
            model: config.model.clone(),
            test_type: "tts".to_string(),
            scenario: "synthesize".to_string(),
            iteration: i + 1,
            throughput: collector.throughput(),
            quality: collector.quality(response.audio.len()),
            status: "success".to_string(),
            // ...
        };

        results.push(result);
    }

    Ok(results)
}
```

对于**流式测试**（Phase 1 可选），使用 `speak_stream()` + `StreamExt::next()` 循环：

```rust
// 流式测试
let stream = tts.speak_stream(Box::pin(futures_util::stream::once(
    async { text.to_string() }
))).await?;

tokio::pin!(stream);
while let Some(chunk) = stream.next().await {
    let chunk = chunk?;
    collector.add_chunk(&chunk.audio_chunk);
}
```

### 3.8 ASR 测试执行流程

```rust
pub async fn run_asr_test(
    provider: &str,
    audio_path: &Path,
    audio_duration: f64,
    expected_text: Option<&str>,
    iterations: u32,
) -> Result<Vec<SingleTestResult>> {

    // 1. 从环境变量读取配置
    let config = AsrBenchmarkConfig::from_env(provider);

    // 2. 创建 Provider 实例
    let asr = create_asr_provider(provider, &config)?;

    // 3. 执行多次迭代
    for i in 0..iterations {
        // 4. 读取音频文件
        let audio_data = tokio::fs::read(audio_path).await?;

        // 5. 创建音频流（按 DEFAULT_CHUNK_SIZE 分块）
        let audio_stream = adapt_audio_input(
            AudioInput::Data(audio_data),
            DEFAULT_CHUNK_SIZE,
        );

        let mut collector = MetricsCollector::new();
        collector.start();

        // 6. 调用 listen_stream()
        let mut result_text = String::new();
        let mut stream = asr.listen_stream(audio_stream).await?;

        tokio::pin!(stream);
        while let Some(chunk) = stream.next().await {
            let chunk = chunk?;
            collector.add_chunk(chunk.text.as_bytes());
            if chunk.is_final && !chunk.text.is_empty() {
                result_text.push_str(&chunk.text);
            }
        }
        collector.stop();

        // 7. 构建结果
        let mut accuracy = None;
        if let Some(expected) = expected_text {
            accuracy = Some(RawAccuracyData {
                expected_text: Some(expected.to_string()),
                actual_text: Some(result_text),
            });
        }

        // ...
    }

    Ok(results)
}
```

### 3.9 结果保存

```rust
pub async fn save_result(
    result: &SingleTestResult,
    output_dir: &Path,
) -> Result<PathBuf> {
    // 目录结构: {output_dir}/runs/{type}/{provider}/{scenario}/
    let dir = output_dir
        .join("runs")
        .join(&result.test_type)
        .join(&result.provider)
        .join(&result.scenario);

    tokio::fs::create_dir_all(&dir).await?;

    // 文件名: {provider}-{type}-{scenario}-{YYYYMMDD}-{HHmmss}-{iteration}.json
    let timestamp = chrono::Local::now();
    let filename = format!(
        "{}-{}-{}-{}-{}-{}.json",
        result.provider,
        result.test_type,
        result.scenario,
        timestamp.format("%Y%m%d"),
        timestamp.format("%H%M%S"),
        result.iteration,
    );

    let path = dir.join(&filename);
    let json = serde_json::to_string_pretty(result)?;
    tokio::fs::write(&path, json).await?;

    Ok(path)
}
```

### 3.10 模拟模式（dry-run）

```rust
pub fn generate_mock_result(
    provider: &str,
    test_type: &str,
    iteration: u32,
) -> SingleTestResult {
    // 生成合理的模拟值：首包延迟 ~500ms，总延迟 ~2000ms
    SingleTestResult {
        id: Uuid::new_v4().to_string(),
        timestamp: chrono::Utc::now().to_rfc3339(),
        provider: provider.to_string(),
        model: "mock-model".to_string(),
        test_type: test_type.to_string(),
        scenario: "mock-scenario".to_string(),
        iteration,
        config: BenchmarkConfig {
            input_mode: "non-stream".to_string(),
            output_mode: "non-stream".to_string(),
            format: "mp3".to_string(),
            text_length: None,
            audio_duration: None,
            voice: None,
            sample_rate: None,
        },
        start_time: /* ... */,
        throughput: ThroughputMetrics {
            data_rate: 12.5,
            chunk_count: 1,
            avg_chunk_size: 25000.0,
            chunks: Some(vec![ChunkDetail {
                timestamp: /* ... */,
                relative_time: 2000.0,
                size: 25000,
            }]),
        },
        status: "success".to_string(),
        error: None,
        // ...
    }
}
```

---

## 4. 实施方案

### 4.1 阶段划分

#### 阶段一（本期，预计 3-5 天）

**目标**：跑通 TTS 非流式合成 + ASR 流式识别的基本流程，JSON 结果可保存。

**任务清单**：

| 任务 | 文件 | 预估 |
|------|------|------|
| 1. 创建 `src/benchmark/` 模块框架和类型定义 | `mod.rs`, `types.rs` | 0.5 天 |
| 2. 实现 CLI 参数解析 | `cli.rs`, `src/bin/bench.rs` | 0.5 天 |
| 3. 实现指标收集器 | `collector.rs` | 0.5 天 |
| 4. 实现 Provider 工厂 | `provider_factory.rs` | 0.5 天 |
| 5. 实现 TTS 测试执行 | `tts.rs` | 1 天 |
| 6. 实现 ASR 测试执行 | `asr.rs` | 1 天 |
| 7. 实现结果保存 | `result.rs` | 0.5 天 |
| 8. 实现主调度逻辑和 dry-run | `runner.rs`, `fixtures.rs` | 0.5 天 |
| 9. 配置 `Cargo.toml` 添加 `[[bin]]` 目标 | `Cargo.toml` | 0.1 天 |
| 10. 集成测试、调试验证 | — | 0.5 天 |

#### 阶段二（后续）

- Matrix 组合测试（model × voice × format × sampleRate）
- 流式输入测试（chunked text input for TTS）
- Markdown 报告生成
- 聚合统计分析（P50/P95/stddev)
- ASR 准确率计算（CER/Levenshtein）
- README 同步
- 与现有 TypeScript 版 benchmark 结果格式完全兼容

### 4.2 Cargo.toml 改动

```toml
# 新增 binary 目标
[[bin]]
name = "univoice-bench"
path = "src/bin/bench.rs"
required-features = []

# 新增依赖（如已有则忽略）
[dependencies]
uuid = { version = "1", features = ["v4"] }   # 已有
chrono = "0.4"                                 # 已有
serde = { version = "1", features = ["derive"] } # 已有
serde_json = "1"                                # 已有
tokio = { version = "1", features = ["full"] }  # 已有
dotenvy = "0.15"                                # 已有
```

### 4.3 文件清单

**新增文件（10 个）：**

| 文件 | 作用 |
|------|------|
| `src/bin/bench.rs` | 二进制入口，`#[tokio::main]` |
| `src/benchmark/mod.rs` | 模块导出 |
| `src/benchmark/cli.rs` | `CliArgs` 结构体 (`#[derive(Parser)]`) |
| `src/benchmark/types.rs` | 所有 Result 结构体 |
| `src/benchmark/collector.rs` | `Timer`, `MetricsCollector` |
| `src/benchmark/fixtures.rs` | 文本夹具、test data |
| `src/benchmark/provider_factory.rs` | Provider 创建 + 环境变量读取 |
| `src/benchmark/runner.rs` | `run_benchmark()` 主函数 |
| `src/benchmark/tts.rs` | `run_tts_test()` |
| `src/benchmark/asr.rs` | `run_asr_test()` |

**修改文件（1 个）：**

| 文件 | 改动 |
|------|------|
| `Cargo.toml` | 添加 `[[bin]]` 目标 |

**不涉及修改（保留现有 TS 版不动）：**

| 文件 | 说明 |
|------|------|
| `benchmark/*` | 保留全部，阶段二完成前 TS 版仍为主力 |
| `results/` | 阶段一使用相同的输出目录，方便对比 |
| `README.md` | 暂不同步 |
| `docs/` | 暂不同步 |

### 4.4 不包含在阶段一的内容

以下功能**明确排除**在阶段一之外，将在阶段二中覆盖：

- ❌ 流式输入 TTS 测试（TextStream chunked）
- ❌ 流式输出 TTS 测试（可用 `synthesize()` 替代简化版本）
- ❌ Matrix 组合枚举测试
- ❌ Markdown 报告生成
- ❌ README / docs 同步
- ❌ ASR 准确率计算（CER/Levenshtein）
- ❌ 聚合统计（P50/P95/stddev）
- ❌ 与 TS 版 JSON 格式严格兼容（但结构类似）

---

## 5. 验收标准

### 5.1 功能性验收

| 验收项 | 验证方式 | 预期 |
|--------|---------|------|
| CLI 帮助信息 | `cargo run --bin univoice-bench -- -h` | 显示完整帮助 |
| Dry-run 模式 | `cargo run --bin univoice-bench -- -d` | 输出模拟摘要，不调用 API |
| TTS 非流式测试 | `cargo run --bin univoice-bench -- -p qwen -t tts -i 1` | 成功调用 synthesize，保存 JSON |
| TTS 多迭代 | `cargo run --bin univoice-bench -- -p qwen -t tts -i 3` | 生成 3 个 JSON 文件 |
| ASR 测试 | `cargo run --bin univoice-bench -- -p qwen -t asr -i 1` | 成功调用 listen_stream，保存 JSON |
| 结果目录 | `ls benchmark/results/runs/` | 目录结构符合预期 |
| Provider 过滤 | `-p qwen -p doubao` | 只测试指定 Provider |

### 5.2 代码质量验收

| 验收项 | 命令 |
|--------|------|
| 编译通过 | `cargo build` |
| 格式规范 | `cargo fmt --check` |
| 无 clippy 警告 | `cargo clippy -- -D warnings` |
| 单元测试通过 | `cargo test` |

### 5.3 性能对比验收（可选）

在同一台机器上，用相同 Provider 和文本，对比 Rust 版和 TS 版的首包延迟：

- Rust 版的额外开销应远小于 TS 版（无 Node.js runtime 开销）
- 延迟数据的方差应更小（纳秒级计时精度）

---

## 6. 风险评估

| 风险 | 影响 | 概率 | 缓解措施 |
|------|------|------|---------|
| Provider 工厂参数覆盖不全 | 某些 Provider 无法正确创建 | 中 | Phase 1 先覆盖最常用的 3-5 个 Provider（qwen/doubao/openai），后续补齐 |
| ASR 音频格式兼容问题 | 音频文件读取失败 | 低 | 使用 `std::fs::read` 读原始字节，让 Provider 内部处理格式 |
| uuid/timestamp 格式不兼容 | TS 分析工具无法读取 | 低 | Phase 1 独立输出，不与 TS 工具互操作 |
| 环境变量命名不一致 | 用户需要重新配置 | 中 | 沿用 TS 版的环境变量约定 |
| Provider API 超时 | 测试卡住 | 低 | 设置全局超时 `tokio::time::timeout()` |

---

## 7. 附录

### 7.1 与 TypeScript 版环境变量对照

| TypeScript 版 | Rust 版（阶段一） |
|---------------|------------------|
| `QWEN_API_KEY` | 沿用 `QWEN_API_KEY` |
| `DOUBAO_APP_ID`, `DOUBAO_ACCESS_TOKEN` | 沿用 |
| `OPENAI_API_KEY` | 沿用 |
| `GEMINI_API_KEY` | 沿用 |
| `GLM_API_KEY` | 沿用 |
| `MINIMAX_API_KEY`, `MINIMAX_GROUP_ID` | 沿用 |
| `XFYUN_APP_ID`, `XFYUN_API_KEY`, `XFYUN_API_SECRET` | 沿用 |
| `MIMO_API_KEY` | 沿用 |

### 7.2 结果 JSON 示例

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2026-07-18T10:30:00+08:00",
  "provider": "qwen",
  "model": "cosyvoice-v1",
  "testType": "tts",
  "scenario": "synthesize",
  "iteration": 1,
  "config": {
    "inputMode": "non-stream",
    "outputMode": "non-stream",
    "format": "mp3",
    "textLength": 98,
    "voice": "longxiaochun"
  },
  "startTime": 1721270000000.0,
  "throughput": {
    "dataRate": 18.5,
    "chunkCount": 1,
    "avgChunkSize": 37000.0,
    "chunks": [
      {
        "timestamp": 1721270002000.0,
        "relativeTime": 2000.0,
        "size": 37000
      }
    ]
  },
  "quality": {
    "dataSize": 37000,
    "audioDuration": 2.31
  },
  "status": "success"
}
```

### 7.3 Key API 映射

| TypeScript | Rust | 说明 |
|------------|------|------|
| `createTTS({...})` | `create_tts_provider(name, model, voice, ...)` | 工厂函数 |
| `tts.synthesize({text})` | `provider.synthesize(TtsRequest { text, .. })` | 非流式合成 |
| `tts.speak(text, {stream: true})` | `provider.speak_stream(text_stream)` | 流式合成 |
| `asr.listen(audioStream, {stream: true})` | `provider.listen_stream(audio_stream)` | 流式识别 |
| `MetricsCollector.addChunk(data)` | `collector.add_chunk(data)` | 记录数据块 |
| `saveSingleResult(result)` | `save_result(&result, &dir).await` | 保存 JSON |
