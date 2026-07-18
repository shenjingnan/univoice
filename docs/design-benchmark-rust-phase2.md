# 技术方案：Rust 版 Benchmark —— 阶段二（完整功能）

> 作者: Claude Code  
> 日期: 2026-07-18  
> 状态: 待审批  
> 前置依赖: 阶段一已完成（核心 runner + 指标收集 + JSON 保存）

---

## 1. 现状分析

### 已完成（阶段一）

阶段一实现了 Rust 版 benchmark 的核心骨架：

- 8 个 TTS Provider + 5 个 ASR Provider 的工厂创建
- `synthesize()` 非流式合成测试 + `speak_stream()` 流式输出测试
- `listen_stream()` 流式识别测试
- `MetricsCollector` 纳秒级计时 + 吞吐量计算
- JSON 结果保存（camelCase，与 TS 版格式兼容）
- `-d` dry-run 模式，CLI 参数解析

### 待完成（阶段二）

| 模块 | TS 版行数 | 核心工作量 |
|------|-----------|-----------|
| Matrix 枚举测试 | ~800 行（6 个 Provider 配置 + runner） | **高** — 数据结构设计 + Provider 规格映射 |
| 流式输入 TTS | ~60 行（`createTextStream`） | **低** — Rust Stream trait 封装 |
| 聚合统计分析 | ~300 行（aggregator.ts） | **中** — 排序 + 百分位算法 |
| Markdown 报告生成 | ~1100 行（report-generator.ts） | **高** — 表格渲染 + 🏆 标记 |
| CER 准确率 | ~120 行（accuracy.ts） | **低** — Levenshtein DP 算法 |
| README 同步 | ~80 行（sync-readme.ts） | **低** — 正则替换标记区间 |
| Matrix CLI 参数 | ~100 行（run.ts 中的过滤解析） | **低** — clap 子命令扩展 |

---

## 2. 当前架构分析

### TS 版阶段二架构

```
CLI (run.ts)
  │
  ├── runTTSSuite() ───→ tts-runner.ts（基本 TTS 测试）
  │
  ├── runASRSuite() ───→ asr-runner.ts（基本 ASR 测试）
  │
  ├── Matrix Scenario ──→ scenarios/matrix/runner.ts
  │     ├── Provider 配置（qwen.ts, doubao.ts, ...）
  │     │     每个文件定义 MatrixItem[] = model × voice × format × sampleRate 全组合
  │     ├── filterMatrixItems() — 按 model/voice/format/sampleRate 过滤
  │     ├── runSingleMatrixTest() — 对单个 MatrixItem 执行测试
  │     └── runProviderMatrixScenario() — 遍历 Provider 的所有 MatrixItem
  │
  ├── ASR Matrix ──────→ scenarios/matrix/asr/runner.ts
  │     └── 类似上层的 ASR 版本（language 替代 voice）
  │
  └── analyze ──────────→ aggregator.ts（聚合）→ report-generator.ts（Markdown）
        ├── aggregateByScenario() → ScenarioSummary[]
        │    ├── testType/provider/scenario 分组
        │    ├── P50 / P95 / stddev / min / max
        │    └── ASR: accuracy/CER/RTF | TTS: perCharLatency
        │
        └── generateMarkdownReport() → benchmark.md
             ├── TTS 性能表 × 2（流式出 / 非流式出）
             ├── ASR 性能表 × 1
             ├── 🏆 最佳 / *最差* 自动标记
             └── syncToReadme() → README.md + docs/
```

### 与阶段一的关系

阶段二的代码将**扩展**阶段一的模块，而非重写：

```
src/benchmark/
├── types.rs          ← 扩展: MatrixItem, MatrixFilter, ScenarioSummary 等
├── collector.rs      ← 无变化
├── cli.rs            ← 扩展: --model, --voice, --format, --sample-rate 过滤
├── fixtures.rs       ← 扩展: 矩阵测试文本夹具
├── provider_factory.rs ← 无变化（阶段一已覆盖所有 Provider）
├── tts.rs            ← 扩展: run_tts_stream_input() 流式输入支持
├── asr.rs            ← 无变化
├── result.rs         ← 无变化
│
├── matrix/           ← 新增目录
│   ├── mod.rs        ← 模块导出
│   ├── types.rs      ← ProviderMatrixConfig, MatrixRunOptions
│   ├── filter.rs     ← filter_matrix_items()
│   ├── runner.rs     ← run_matrix_scenario() + run_provider_matrix_scenario()
│   ├── providers.rs  ← 所有 Provider 的 MatrixItem 配置
│   └── asr.rs        ← ASR 矩阵运行器
│
├── accuracy.rs       ← 新增: Levenshtein + CER 计算
├── aggregator.rs     ← 新增: aggregate_by_scenario() + ScenarioSummary
└── report.rs         ← 新增: generate_markdown_report() + sync_to_readme()
```

---

## 3. 技术方案

### 3.1 Matrix 枚举测试

#### 数据结构

```rust
/// TTS 矩阵测试项
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MatrixItem {
    pub provider: String,
    pub model: String,
    pub voice: String,
    pub format: String,        // "pcm" | "opus" | "ogg_opus"
    pub sample_rate: u32,      // 8000 | 16000 | 22050 | 24000 | 32000 | 44100 | 48000
}

/// ASR 矩阵测试项
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ASRMatrixItem {
    pub provider: String,
    pub model: String,
    pub language: String,
    pub format: String,        // "pcm" | "wav" | "mp3"
    pub sample_rate: u32,
}

/// 矩阵过滤器
#[derive(Debug, Clone, Default)]
pub struct MatrixFilter {
    pub model: Option<Vec<String>>,
    pub voice: Option<Vec<String>>,
    pub format: Option<Vec<String>>,
    pub sample_rate: Option<Vec<u32>>,
}

/// 单 Provider 矩阵配置
pub struct ProviderMatrixConfig {
    pub provider: &'static str,
    pub display_name: &'static str,
    pub items: Vec<MatrixItem>,
    pub scenario_config: MatrixScenarioConfig,
}

pub struct MatrixScenarioConfig {
    pub name: &'static str,
    pub description: &'static str,
    pub iterations: u32,
    pub timeout_secs: u64,
}
```

#### Provider 配置示例（Qwen）

每个 Provider 的 MatrixItem 数据直接用 Vec 定义（因为 Rust 的 const vec 还不稳定，使用 `fn` 生成）：

```rust
pub fn qwen_matrix_items() -> Vec<MatrixItem> {
    let models = &["cosyvoice-v3-flash", "cosyvoice-v3-plus", "cosyvoice-v2", "cosyvoice-v1"];
    let voices = &["longanyang", "longyingxiao", "longwan"];
    let formats = &["pcm", "opus"];
    let sample_rates = &[8000u32, 16000, 22050, 24000, 44100, 48000];

    // 通过组合生成（但不同 model/voice 组合有限制，需手动控制）
    vec![
        // cosyvoice-v3-flash + longanyang
        MatrixItem { provider: "qwen", model: "cosyvoice-v3-flash", voice: "longanyang", format: "pcm", sample_rate: 8000 },
        MatrixItem { provider: "qwen", model: "cosyvoice-v3-flash", voice: "longanyang", format: "pcm", sample_rate: 16000 },
        // ... 每个组合一项
    ]
}
```

**简化方案**：对于阶段二，不做完全的笛卡尔积自动生成，而是直接**复制 TS 版已有的 MatrixItem 数组**到 Rust 代码中。这样虽然有些冗长，但能确保与 TS 版行为完全一致，且未来可优化。

TS 版各 Provider 的 MatrixItem 数量：

| Provider | 矩阵项数 | 枚举依据 |
|----------|---------|---------|
| qwen | 77 | 4 模型 × 2 格式 × 6 采样率 + realtime 补充 |
| qwen-realtime | 17 | 2 模型 × 2 格式 × 4 采样率 + 1 补充 |
| doubao | 16 | 2 模型 × 2 格式 × 4 采样率 |
| glm | 1 | 单配置 |
| minimax | 36 | 6 模型 × 6 采样率（固定格式 pcm） |
| xfyun | 3 | 3 种采样率（固定模型/音色/格式） |
| **TTS 合计** | **150** | |

| ASR Provider | 矩阵项数 | 枚举依据 |
|-------------|---------|---------|
| qwen | 2 | 2 种格式 |
| doubao | 1 | 单配置 |
| glm | 2 | 2 种格式 |
| xfyun | 1 | 单配置 |
| **ASR 合计** | **6** | |

#### 过滤器实现

```rust
pub fn filter_matrix_items(items: &[MatrixItem], filter: &MatrixFilter) -> Vec<MatrixItem> {
    items.iter().filter(|item| {
        if let Some(ref models) = filter.model {
            if !models.contains(&item.model) { return false; }
        }
        if let Some(ref voices) = filter.voice {
            if !voices.contains(&item.voice) { return false; }
        }
        if let Some(ref formats) = filter.format {
            if !formats.contains(&item.format) { return false; }
        }
        if let Some(ref rates) = filter.sample_rate {
            if !rates.contains(&item.sample_rate) { return false; }
        }
        true
    }).cloned().collect()
}
```

#### Matrix Runner 流程

```
run_matrix_scenario(options)
  │
  ├── 解析 CLI 参数 → MatrixFilter
  │
  ├── 遍历 Provider 配置（ALL_PROVIDER_MATRIX_CONFIGS）
  │     │
  │     ├── provider_config.items → filter_matrix_items(items, filter)
  │     │
  │     ├── 对每个 MatrixItem:
  │     │     ├── generate_matrix_scenario_name(item)
  │     │     │     → "matrix/{model}/{voice}/{format}-{sampleRate}"
  │     │     │
  │     │     ├── create_tts_provider(provider, model, voice, format, sample_rate)
  │     │     │
  │     │     ├── for iteration in 1..=iterations:
  │     │     │     ├── tts.synthesize(TtsRequest { text, ... })
  │     │     │     │    或 tts.speak_stream(text_stream)
  │     │     │     ├── MetricsCollector 记录
  │     │     │     └── save_result(result, output_dir)
  │     │     │
  │     │     └── print_progress(current, total, item, result)
  │     │
  │     └── 汇总该 Provider 的测试结果
  │
  └── 返回全部结果
```

#### CLI 参数扩展

```rust
#[derive(Debug, Parser)]
pub struct CliArgs {
    // ... 已有参数 ...

    /// Matrix 场景名称（如 "qwen-matrix", "doubao-matrix", "all-matrix"）
    #[arg(short = 's', long, help = "Matrix scenario name")]
    pub scenario: Option<String>,

    // Matrix 过滤参数
    #[arg(long, help = "Filter by model (comma-separated)")]
    pub model: Option<String>,

    #[arg(long, help = "Filter by voice (comma-separated)")]
    pub voice: Option<String>,

    #[arg(long, help = "Filter by audio format (comma-separated)")]
    pub format: Option<String>,

    #[arg(long = "sample-rate", help = "Filter by sample rate (comma-separated)")]
    pub sample_rate: Option<String>,
}
```

#### ASR 矩阵

ASR 矩阵运行器结构与 TTS 对称，但：
- 使用 `language` 替代 `voice`
- 需要音频文件输入
- 调用 `asr.listen_stream()`

```rust
pub async fn run_asr_matrix_scenario(
    audio_path: &Path,
    audio_duration: f64,
    audio_format: &str,
    options: &MatrixRunOptions,
) -> Result<Vec<SingleTestResult>> {
    // 遍历 Provider → 过滤 → 执行测试
}
```

### 3.2 流式输入 TTS 测试

TS 版流式输入模拟：每 5 个字符，间隔 50ms。

```rust
use futures_util::stream::Stream;
use std::pin::Pin;
use std::task::{Context, Poll};
use tokio::time::{Duration, Instant};

/// 文本块流：按指定大小分块，间隔指定时间发送
pub struct ChunkedTextStream {
    text: String,
    chunk_size: usize,
    interval: Duration,
    pos: usize,
    next_tick: Option<Instant>,
}

impl Stream for ChunkedTextStream {
    type Item = String;

    fn poll_next(mut self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Option<Self::Item>> {
        if self.pos >= self.text.len() {
            return Poll::Ready(None);
        }

        let now = Instant::now();
        if let Some(tick) = self.next_tick {
            if now < tick {
                // 还没到发送时间，注册 wake
                let waker = cx.waker().clone();
                let delay = tick - now;
                tokio::spawn(async move {
                    tokio::time::sleep(delay).await;
                    waker.wake();
                });
                return Poll::Pending;
            }
        }

        let end = (self.pos + self.chunk_size).min(self.text.len());
        let chunk = self.text[self.pos..end].to_string();
        self.pos = end;
        self.next_tick = Some(now + self.interval);
        Poll::Ready(Some(chunk))
    }
}
```

然后在 TTS runner 中新增 `run_tts_stream_input()` 函数：

```rust
pub async fn run_tts_stream_input(
    provider: &str,
    model: &str,
    voice: &str,
    format: &str,
    text: &str,
    iterations: u32,
    timeout_secs: u64,
) -> Result<Vec<SingleTestResult>> {
    let tts = create_tts_provider(provider, model, voice, format, None)?;

    for i in 1..=iterations {
        let text_stream: crate::tts::TextStream = Box::pin(
            ChunkedTextStream::new(text.to_string(), 5, Duration::from_millis(50))
        );

        let mut audio_stream = tts.speak_stream(text_stream).await?;
        // 逐块收集音频 + 计时...
    }
}
```

### 3.3 聚合统计分析

```rust
/// 场景统计汇总
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScenarioSummary {
    pub provider: String,
    pub scenario: String,
    pub test_type: String,
    pub sample_count: u32,
    pub success_count: u32,
    pub success_rate: f64,
    // 首包延迟
    pub avg_first_chunk_latency: f64,
    pub median_first_chunk_latency: f64,
    pub p95_first_chunk_latency: f64,
    // 总延迟
    pub avg_total_latency: f64,
    pub median_total_latency: f64,
    pub p50_total_latency: f64,
    pub p95_total_latency: f64,
    pub std_dev_total_latency: f64,
    pub min_total_latency: f64,
    pub max_total_latency: f64,
    // TTS 特有
    pub avg_per_char_latency: Option<f64>,
    pub throughput: Option<f64>,
    // ASR 特有
    pub avg_accuracy: Option<f64>,
    pub avg_cer: Option<f64>,
    pub avg_rtf: Option<f64>,
}
```

**聚合实现**（aggregator.rs）：

```rust
/// 按 testType/provider/scenario 分组聚合
pub fn aggregate_by_scenario(results: &[SingleTestResult]) -> Vec<ScenarioSummary> {
    let mut grouped: HashMap<String, Vec<&SingleTestResult>> = HashMap::new();

    for result in results {
        let key = format!("{}/{}/{}", result.test_type, result.provider, result.scenario);
        grouped.entry(key).or_default().push(result);
    }

    grouped.into_iter().map(|(_, group)| {
        let success: Vec<_> = group.iter().filter(|r| r.status == "success").collect();
        let sample_count = group.len() as u32;
        let success_count = success.len() as u32;

        let first_chunks: Vec<f64> = success
            .iter()
            .filter_map(|r| r.throughput.chunks.as_ref()?.first())
            .map(|c| c.relative_time)
            .collect();

        let totals: Vec<f64> = success
            .filter_map(|r| r.throughput.chunks.as_ref()?.last())
            .map(|c| c.relative_time)
            .collect();

        // 计算百分位 ...
        let p50 = percentile(&totals, 50.0);
        let p95 = percentile(&totals, 95.0);
        let stddev = std_deviation(&totals);

        // 从第一个结果获取元数据
        let first = group[0];

        ScenarioSummary {
            provider: first.provider.clone(),
            scenario: first.scenario.clone(),
            test_type: first.test_type.clone(),
            sample_count,
            success_count,
            success_rate: if sample_count > 0 { success_count as f64 / sample_count as f64 } else { 0.0 },
            avg_first_chunk_latency: average(&first_chunks),
            median_first_chunk_latency: percentile(&first_chunks, 50.0),
            p95_first_chunk_latency: percentile(&first_chunks, 95.0),
            avg_total_latency: average(&totals),
            median_total_latency: percentile(&totals, 50.0),
            p50_total_latency: p50,
            p95_total_latency: p95,
            std_dev_total_latency: stddev,
            min_total_latency: totals.iter().cloned().fold(f64::MAX, f64::min),
            max_total_latency: totals.iter().cloned().fold(f64::MIN, f64::max),
            avg_per_char_latency: None,  // 从 config.textLength 计算
            throughput: None,
            avg_accuracy: None,
            avg_cer: None,
            avg_rtf: None,
        }
    }).collect()
}
```

**通用百分位计算**（已在 collector.rs 中实现，可直接复用）：

```rust
pub fn percentile(values: &[f64], p: f64) -> f64;
pub fn average(values: &[f64]) -> f64;
pub fn std_dev(values: &[f64], mean: f64) -> f64;
```

### 3.4 CER / 准确率计算

```rust
/// Levenshtein 编辑距离
pub fn edit_distance(expected: &str, actual: &str) -> u32 {
    let m = expected.chars().count();
    let n = actual.chars().count();
    let mut dp = vec![vec![0u32; n + 1]; m + 1];

    for i in 0..=m { dp[i][0] = i as u32; }
    for j in 0..=n { dp[0][j] = j as u32; }

    for (i, ch_e) in expected.chars().enumerate() {
        for (j, ch_a) in actual.chars().enumerate() {
            let cost = if ch_e == ch_a { 0 } else { 1 };
            dp[i + 1][j + 1] = (dp[i][j + 1] + 1)     // 删除
                .min(dp[i + 1][j] + 1)                  // 插入
                .min(dp[i][j] + cost);                  // 替换
        }
    }

    dp[m][n]
}

/// 文本标准化：去除非中英文数字字符
pub fn normalize_text(text: &str) -> String {
    text.chars()
        .filter(|c| c.is_ascii_alphanumeric() || ('\u{4e00}'..='\u{9fa5}').contains(c))
        .collect::<String>()
        .to_lowercase()
}

/// 计算 CER
pub fn calculate_cer(expected: &str, actual: &str) -> f64 {
    if expected.is_empty() {
        return if actual.is_empty() { 0.0 } else { 1.0 };
    }
    let dist = edit_distance(expected, actual);
    dist as f64 / expected.chars().count() as f64
}

/// 计算准确率
pub fn calculate_accuracy(expected: &str, actual: &str) -> f64 {
    (1.0 - calculate_cer(expected, actual)).max(0.0)
}
```

### 3.5 Markdown 报告生成

报告生成是阶段二工作量最大的模块。采用**直接字符串拼接**方式（不引入模板引擎）。

```rust
pub fn generate_markdown_report(
    summaries: &[ScenarioSummary],
    matrix_coverage: Option<&MatrixCoverage>,
) -> String {
    let mut md = String::new();

    // 标题 + 说明
    md.push_str("# Univoice 性能基准测试报告\n\n");
    md.push_str("> 生成时间: ");
    md.push_str(&chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string());
    md.push_str("\n\n");

    // TTS 指标说明表
    md.push_str("## TTS 性能指标\n\n");
    md.push_str("### 指标说明\n");
    md.push_str("| 指标 | 含义 | 计算方法 | 作用 |\n");
    md.push_str("|------|------|----------|------|\n");
    md.push_str("| 首包延迟 | 从发起请求到收到第一个音频包的时间 | chunks[0].relativeTime | 反映服务响应速度 |\n");
    md.push_str("| P50 | 中位数延迟 | 排序后取 50% 分位 | 反映典型体验 |\n");
    md.push_str("| P95 | 95 分位延迟 | 排序后取 95% 分位 | 反映最差情况 |\n");
    // ...

    // TTS 性能表（非流式入/流式出）
    md.push_str("### 非流式入 / 流式出\n\n");
    md.push_str("| 服务商 | 模型 | 音色 | 编码格式 | 采样率(Hz) | 测试次数 | 首包延迟(ms) | P50(ms) | P95(ms) | 标准差 | 吞吐量(chars/s) |\n");
    md.push_str("|---|---|---|---|---|---|---|---|---|---|---|\n");

    for row in &tts_rows {
        md.push_str(&format_row(row, &best_worst));
    }

    // ASR 性能表
    // ...

    md
}
```

#### 🏆 最佳/最差标记逻辑

```rust
/// 性能指标行
struct ReportRow {
    provider: String,
    model: String,
    voice_or_lang: String,
    format: String,
    sample_rate: String,
    test_count: u32,
    first_chunk: Option<f64>,
    p50: Option<f64>,
    p95: Option<f64>,
    stddev: Option<f64>,
    throughput: Option<f64>,
}

/// 在列中找到最佳和最差值
fn find_min_max(values: &[Option<f64>]) -> Vec<Mark> {
    // "越低越好" 指标：首包延迟/P50/P95/stddev → min 为 🏆，max 为斜体
    // "越高越好" 指标：吞吐量 → max 为 🏆，min 为斜体
}

/// 格式化指标值，带 🏆/斜体 标记
fn format_metric(value: Option<f64>, mark: Mark, decimal: usize) -> String {
    match (value, mark) {
        (Some(v), Mark::Best) => format!("**{:.d$} 🏆**", v, d = decimal),
        (Some(v), Mark::Worst) => format!("*{:.d$}*", v, d = decimal),
        (Some(v), Mark::Normal) => format!("{:.d$}", v, d = decimal),
        (None, _) => "N/A".to_string(),
    }
}
```

#### README 同步

```rust
const README_MARKER_START: &str = "<!-- PERFORMANCE_TABLE_START -->";
const README_MARKER_END: &str = "<!-- PERFORMANCE_TABLE_END -->";

pub fn sync_to_readme(report: &str, readme_path: &Path) -> Result<()> {
    let content = std::fs::read_to_string(readme_path)?;

    // 提取 PERFORMANCE_TABLE_START 和 PERFORMANCE_TABLE_END 之间的部分
    // 用新的报告表格替换

    let new_content = // ... 替换逻辑
    std::fs::write(readme_path, new_content)?;
    Ok(())
}
```

支持两个同步目标：
1. **README.md**：通过 `<!-- PERFORMANCE_TABLE_START -->` / `<!-- PERFORMANCE_TABLE_END -->` 标记替换
2. **docs/content/benchmark.mdx**：通过 `<!-- BENCHMARK_START -->` / `<!-- BENCHMARK_END -->` 标记替换

### 3.6 CLI 参数总览

```
cargo run --bin univoice-bench -- [OPTIONS]

基本选项（阶段一已有）:
  -p, --provider <NAME>   Provider 过滤
  -t, --type <TYPE>       测试类型: tts | asr | all
  -i, --iterations <N>    迭代次数
  -d, --dry-run           模拟运行
  -o, --output <DIR>      输出目录
      --timeout <SEC>     超时时间（秒）

阶段二新增选项:
  -s, --scenario <NAME>   矩阵场景: qwen-matrix | doubao-matrix | ... | all-matrix

矩阵过滤选项:
      --model <MODELS>        按模型过滤（逗号分隔）
      --voice <VOICES>        按音色过滤（逗号分隔）
      --format <FORMATS>      按编码格式过滤（逗号分隔）
      --sample-rate <RATES>   按采样率过滤（逗号分隔）

分析/报告选项:
      --analyze               运行分析 + 生成报告（从已有结果）
      --report-only           仅生成报告，不运行测试

示例:
  # 运行 qwen 矩阵测试
  cargo run --bin univoice-bench -- -s qwen-matrix -i 3

  # 矩阵测试 + 过滤
  cargo run --bin univoice-bench -- -s qwen-matrix --format pcm --sample-rate 16000,24000

  # 从已有结果生成报告
  cargo run --bin univoice-bench -- --analyze

  # 完整流程：运行 → 分析 → 报告
  cargo run --bin univoice-bench -- -s all-matrix && cargo run --bin univoice-bench -- --analyze
```

---

## 4. 实施方案

### 4.1 任务分解

#### 任务组 A：Matrix 枚举测试（3 天）

| # | 任务 | 文件 | 预估 |
|---|------|------|------|
| A1 | 定义 MatrixItem/ASRMatrixItem/MatrixFilter 类型 | `matrix/types.rs` | 0.5 天 |
| A2 | 实现 filter_matrix_items() 过滤器 | `matrix/filter.rs` | 0.3 天 |
| A3 | 实现 generate_matrix_scenario_name() 场景名生成 | `matrix/filter.rs` | 0.2 天 |
| A4 | 移植 6 个 Provider 的 MatrixItem 数据（~150 项） | `matrix/providers.rs` | 1 天 |
| A5 | 实现 Matrix Runner: run_matrix_scenario() | `matrix/runner.rs` | 0.5 天 |
| A6 | 实现 ASR Matrix Runner | `matrix/asr.rs` | 0.5 天 |
| A7 | CLI 参数扩展 + 场景分发 | `cli.rs` | 0.3 天 |

**验收**：`cargo run --bin univoice-bench -- -s qwen-matrix --format pcm` 能运行矩阵测试

#### 任务组 B：流式输入 TTS（1 天）

| # | 任务 | 文件 | 预估 |
|---|------|------|------|
| B1 | 实现 ChunkedTextStream | `tts.rs` 扩展 | 0.5 天 |
| B2 | 实现 run_tts_stream_input() | `tts.rs` 扩展 | 0.5 天 |

**验收**：对有流式输入能力的 Provider（qwen/doubao）能运行流式输入测试

#### 任务组 C：聚合分析（1.5 天）

| # | 任务 | 文件 | 预估 |
|---|------|------|------|
| C1 | 实现 ScenarioSummary 类型 | `types.rs` 扩展 | 0.3 天 |
| C2 | 实现 aggregate_by_scenario() | `aggregator.rs` | 0.5 天 |
| C3 | 实现 MatrixCoverage 计算 | `aggregator.rs` | 0.3 天 |
| C4 | 场景名解析（parse_matrix_scenario） | `aggregator.rs` | 0.2 天 |
| C5 | 实现 analyze CLI 命令 | `runner.rs` 扩展 | 0.2 天 |

**验收**：`--analyze` 能从 JSON 结果生成 ScenarioSummary

#### 任务组 D：准确率计算（0.5 天）

| # | 任务 | 文件 | 预估 |
|---|------|------|------|
| D1 | 实现 edit_distance() / normalize_text() | `accuracy.rs` | 0.3 天 |
| D2 | 实现 calculate_cer() / calculate_accuracy() | `accuracy.rs` | 0.2 天 |

**验收**：`cargo test` 中包含 CER 计算测试用例

#### 任务组 E：Markdown 报告（2 天）

| # | 任务 | 文件 | 预估 |
|---|------|------|------|
| E1 | 实现 TTS 性能表生成 | `report.rs` | 0.8 天 |
| E2 | 实现 ASR 性能表生成 | `report.rs` | 0.5 天 |
| E3 | 实现 🏆 最佳/*最差*标记 | `report.rs` | 0.3 天 |
| E4 | 实现 sync_to_readme() | `report.rs` | 0.2 天 |
| E5 | 实现 make docs 报告版本 | `report.rs` | 0.2 天 |

**验收**：`--analyze` 后能在 `results/latest/benchmark.md` 看到完整报告

#### 任务组 F：整合测试（1 天）

| # | 任务 | 预估 |
|---|------|------|
| F1 | Provider Matrix 配置全量验证（数量、字段正确性） | 0.3 天 |
| F2 | dry-run 模式支持 Matrix 场景 | 0.2 天 |
| F3 | 端到端 dry-run → analyze → report | 0.3 天 |
| F4 | 与 TS 版结果对比验证（同一 Provider 的统计数据偏差 <5%） | 0.2 天 |

### 4.2 实施顺序

```
第 1-2 天: A1 → A2 → A3 → A4     Matrix 数据 + 基础框架
第 3 天:   A5 → A6 → A7             Matrix Runner + CLI
第 4 天:   B1 → B2                  流式输入 TTS
第 5 天:   C1 → C2 → C3 → C4 → C5  聚合分析
第 5-6 天: D1 → D2                  CER 准确率
第 6-7 天: E1 → E2 → E3 → E4 → E5   Markdown 报告
第 7-8 天: F1 → F2 → F3 → F4        整合测试
```

### 4.3 Cargo.toml 新增依赖

```toml
[dependencies]
# 可能需要的额外依赖（根据实现情况）
strsim = "0.11"   # 可选：字符串编辑距离（备选方案，不依赖则手写 DP）
```

目前已有的依赖已覆盖大部分需求：serde / serde_json / tokio / futures-util / uuid / chrono / anyhow / thiserror。

---

## 5. 不包含在阶段二的内容

以下功能**明确排除**：

- ❌ 历史趋势图表（可视化留存到 Phase 3）
- ❌ CI 集成（GitHub Actions 中和 benchmark 运行自动化）
- ❌ 性能回归告警
- ❌ TS 版删除（阶段二完成后保留两版共存，待稳定后再决定退役）
- ❌ Benchmark 结果 Web 可视化

---

## 6. 验收标准

### 功能性验收

| 验收项 | 验证方式 | 预期 |
|--------|---------|------|
| Matrix 场景 | `-- -s qwen-matrix --format pcm --sample-rate 16000` | 只运行符合过滤条件的项 |
| Matrix dry-run | `-- -s qwen-matrix -d` | 为每项生成模拟结果 |
| 流式输入 | 对有流式输入能力的 Provider 运行测试 | ChunkedTextStream 正常发送 |
| 聚合分析 | `-- --analyze` | 输出 ScenarioSummary 列表 |
| Markdown 报告 | `-- --analyze` | `results/latest/benchmark.md` 含完整表格 |
| 🏆 标记 | 检查报告表格 | 最佳值有 🏆 标记 |
| README 同步 | 运行后检查 | README.md 中表格已更新 |
| CER 计算 | 单元测试 | 已知字符串对的 CER 精确匹配 |

### 代码质量验收

| 验收项 | 命令 |
|--------|------|
| 编译通过 | `cargo build` |
| 格式规范 | `cargo fmt --check` |
| 无 clippy 警告 | `cargo clippy -- -D warnings` |
| 全部测试通过 | `cargo test` |

---

## 7. 风险评估

| 风险 | 影响 | 概率 | 缓解措施 |
|------|------|------|---------|
| MatrixItem 数据量大（150+ 项），手动录入容易出错 | 矩阵测试跑不全 | 中 | 写测试验证每个 Provider 的 MatrixItem 数量与 TS 版一致 |
| 流式输入 TTS 只有 Qwen/Doubao 支持 | 部分 Provider 测试失败 | 低 | 对不支持的 Provider 跳过流式输入测试并打印提示 |
| Markdown 表格渲染不美观 | 报告可读性差 | 中 | 参考 TS 版报告格式，用 `|` 表格对齐 |
| 🏆 标记对齐问题 | 不同列最佳值可能不一致 | 低 | 每列独立计算 best/worst |
| CER 计算字符编码问题 | 中文 CER 不准确 | 低 | 使用 `.chars()` 而非 `.bytes()` 遍历 |

---

## 8. 附录

### 8.1 文件清单（新增/修改）

**新增文件（6 个）：**

| 文件 | 行数预估 | 作用 |
|------|---------|------|
| `src/benchmark/matrix/mod.rs` | 10 | 模块导出 |
| `src/benchmark/matrix/types.rs` | 80 | MatrixItem/MatrixFilter 等类型 |
| `src/benchmark/matrix/filter.rs` | 60 | 过滤器 + 场景名生成 |
| `src/benchmark/matrix/providers.rs` | 500+ | 6 个 Provider 的 MatrixItem 数据 |
| `src/benchmark/matrix/runner.rs` | 250 | TTS Matrix Runner |
| `src/benchmark/matrix/asr.rs` | 200 | ASR Matrix Runner |
| `src/benchmark/accuracy.rs` | 100 | CER/Levenshtein |
| `src/benchmark/aggregator.rs` | 200 | 聚合分析 |
| `src/benchmark/report.rs` | 500+ | Markdown 报告生成 |

**修改文件（4 个）：**

| 文件 | 改动 |
|------|------|
| `src/benchmark/mod.rs` | 添加 matrix/accuracy/aggregator/report 子模块 |
| `src/benchmark/cli.rs` | 添加 scenario/model/voice/format/sample_rate/analyze 参数 |
| `src/benchmark/types.rs` | 添加 MatrixItem/MatrixFilter/ScenarioSummary 类型 |
| `src/benchmark/tts.rs` | 添加 run_tts_stream_input() |
| `src/benchmark/runner.rs` | 添加 Matrix 调度 + analyze 入口 |

### 8.2 TS 到 Rust 关键差异对照

| 功能点 | TypeScript 实现 | Rust 实现 |
|--------|----------------|-----------|
| MatrixItem 数据 | 每个 Provider 一个 `.ts` 文件导出数组 | 集中在 `providers.rs` 的 `fn matrix_items()` |
| 文本流 | `AsyncGenerator<string>` | `ChunkedTextStream` 自定义 Stream impl |
| 聚合分析 | Map + filter + sort | `HashMap<String, Vec<&Result>>` + sort_by |
| 百分位 | `Array.sort()` + index | `values.sort_by()` + index |
| Markdown | 模板字符串 + join | `write!()` / `push_str()` 拼接 |
| CER | 二维 DP 数组 | 同算法，`vec![vec![0; n+1]; m+1]` |
| 🏆 标记 | 遍历找 min/max + 条件字符串 | 同逻辑 |

### 8.3 与阶段一的依赖关系

```
阶段一已完成 ✅                         阶段二待完成
┌─────────────────┐                   ┌─────────────────┐
│  types.rs       │ ← 扩展 ────────── │  Matrix 类型     │
│  cli.rs         │ ← 扩展 ────────── │  +scenario +filter│
│  tts.rs         │ ← 扩展 ────────── │  +流式输入       │
│  collector.rs   │ ← 复用 ────────── │  聚合统计         │
│  provider_factory│ ← 复用 ──────────│  Matrix Runner    │
│  result.rs      │ ← 复用 ────────── │  报告保存         │
│  runner.rs      │ ← 扩展 ────────── │  Matrix 调度      │
└─────────────────┘                   └─────────────────┘
```

### 8.4 Matrix 调试模式

开发阶段可启用 `RUST_BENCH_VERBOSE=1` 环境变量，打印更多调试信息：

```rust
fn debug_matrix_item(item: &MatrixItem, index: usize, total: usize) {
    if std::env::var("RUST_BENCH_VERBOSE").is_ok() {
        println!("  [{}/{}] {} / {} / {} / {}-{}",
            index + 1, total,
            item.provider, item.model, item.voice,
            item.format, item.sample_rate);
    }
}
```
