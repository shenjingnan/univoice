# Univoice Benchmark 性能测试

本目录包含 univoice SDK 的性能基准测试工具，用于评估各 TTS/ASR 提供商的性能指标。

## 快速开始

```bash
# 运行全部测试
pnpm benchmark

# 或者直接运行
tsx benchmark/index.ts
```

## 环境要求

测试需要配置相应提供商的 API Key。在项目根目录创建 `.env` 文件：

```env
# TTS 提供商
DOUBAO_APP_KEY=your-app-id
DOUBAO_ACCESS_TOKEN=your-access-token
QWEN_API_KEY=your-api-key
MINIMAX_API_KEY=your-api-key
MINIMAX_GROUP_ID=your-group-id
GLM_API_KEY=your-api-key

# ASR 提供商
DOUBAO_APP_KEY=your-app-key
DOUBAO_ACCESS_TOKEN=your-access-key
```

## 目录结构

```
benchmark/
├── README.md                    # 本文档
├── fixtures/                    # 测试数据
│   └── texts.ts                 # 文本测试数据（短/中/长）
├── scenarios/                   # 测试场景
│   ├── text-length.ts           # 文本长度场景
│   ├── stream-input.ts          # 流式输入场景
│   └── audio-format.ts          # 音频格式场景
├── runners/                     # 测试运行器
│   ├── tts-runner.ts            # TTS 测试运行器
│   └── asr-runner.ts            # ASR 测试运行器
├── metrics/                     # 指标收集
│   ├── collector.ts             # 指标收集器
│   └── types.ts                 # 类型定义
├── results/                     # 测试结果
│   ├── latest/                  # 最新结果
│   └── history/                 # 历史结果（可选）
└── index.ts                     # CLI 入口
```

## 指标名词解释

### 延迟指标

| 指标 | 英文名称 | 说明 |
|------|----------|------|
| 首次耗时 | First Latency | 第一次请求的耗时，通常包含冷启动开销（如连接建立、模型加载等） |
| 平均耗时 | Average Latency | 多次测试的平均处理时间（排除首次测试后计算），反映稳定状态下的性能 |
| P50 | Median / 50th Percentile | 50% 的请求延迟低于此值，即中位数，反映典型请求的性能 |
| P95 | 95th Percentile | 95% 的请求延迟低于此值，用于评估尾部延迟，反映最坏情况下的性能 |
| 标准差 | Standard Deviation | 延迟的离散程度，值越小表示性能越稳定 |

### 吞吐量指标

| 指标 | 适用类型 | 计算公式 | 说明 |
|------|----------|----------|------|
| 吞吐量 | TTS | 文本长度 / 总耗时(秒) | 每秒处理的字符数，值越大表示处理效率越高 |
| RTF (实时率) | ASR | 处理时长 / 音频时长 | < 1 表示处理速度快于实时播放 |

### 质量指标

| 指标 | 适用类型 | 说明 |
|------|----------|------|
| 准确率 | ASR | 语音识别的正确率，越高越好 |
| CER (字符错误率) | ASR | 识别错误的字符比例，越低越好 |

## 测试维度

### 延迟指标

| 指标 | 说明 |
|------|------|
| 首包延迟 (TTFB) | 从请求开始到收到第一个音频块 |
| 总延迟 | 从请求开始到完成 |
| 平均每字符延迟 | 总延迟/文本长度（TTS） |
| 实时率 (RTF) | 处理时间/音频时长（ASR，< 1 表示快于实时） |

### 吞吐量指标

| 指标 | 说明 |
|------|------|
| 数据速率 | bytes/ms |
| 处理速率 | chars/ms (TTS) 或 audio-sec/proc-sec (ASR) |
| 音频块数量和平均大小 | - |

### 稳定性指标

| 指标 | 说明 |
|------|------|
| 成功率 | 成功请求数/总请求数 |
| 错误类型分布 | - |
| 超时率 | - |

## 测试场景

### 1. 文本长度场景 (TTS)

测试不同文本长度对性能的影响：

| 场景 | 字符范围 | 说明 |
|------|---------|------|
| 短文本 | 1-20 | 简单句 |
| 中等文本 | 50-200 | 段落 |
| 长文本 | 500-2000 | 多段落 |

### 2. 流式输入场景 (TTS)

测试不同流式输入速度对性能的影响：

| 场景 | 发送间隔 | 说明 |
|------|---------|------|
| 快速流式 | 50ms | 模拟快速 LLM 输出 |
| 正常流式 | 100ms | 模拟正常 LLM 输出 |
| 慢速流式 | 200ms | 模拟慢速 LLM 输出 |

### 3. 音频格式场景

测试不同音频格式对性能的影响：

- TTS: mp3, wav, pcm
- ASR: mp3, wav, pcm (16kHz)

## 结果格式

### JSON 结果

```json
{
  "id": "uuid",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "provider": "qwen",
  "model": "cosyvoice-v3-flash",
  "testType": "tts",
  "scenario": "non-stream-in-stream-out",
  "config": {
    "inputMode": "non-stream",
    "outputMode": "stream",
    "format": "mp3",
    "textLength": 100
  },
  "latency": {
    "firstChunk": 150,
    "total": 2000,
    "perChar": 20
  },
  "throughput": {
    "dataRate": 1024,
    "chunkCount": 10,
    "avgChunkSize": 2048
  },
  "quality": {
    "dataSize": 20480
  },
  "status": "success"
}
```

### Markdown 报告

测试完成后会生成 `benchmark/results/latest/benchmark.md` 报告，包含：

- 各提供商首包延迟对比
- P50/P95 延迟统计
- 能力矩阵

## 自定义测试

### 只测试特定提供商

```typescript
import { runTTSSuite } from './runners/tts-runner';

const results = await runTTSSuite({
  providers: ['qwen', 'doubao'],
  iterations: 5,
});
```

### 只运行特定场景

```typescript
import { runTextLengthScenario } from './scenarios/text-length';

const results = await runTextLengthScenario({
  providers: ['qwen'],
  iterations: 3,
});
```

### 添加自定义音频文件（ASR）

```typescript
import { runASRSuite } from './runners/asr-runner';

const results = await runASRSuite({
  audioFiles: [
    {
      name: 'test-audio',
      path: '/path/to/audio.mp3',
      duration: 10,
      format: 'mp3',
    },
  ],
});
```

## 注意事项

1. **API 费用**: 运行测试会产生 API 调用费用，请根据实际情况调整测试次数
2. **网络环境**: 测试结果受网络环境影响，建议在网络稳定的环境下进行
3. **并发限制**: 部分提供商有并发限制，测试时会顺序执行以避免限流
4. **缓存**: 测试结果会缓存到 `benchmark/results/` 目录

## 扩展指南

### 添加新的测试场景

1. 在 `scenarios/` 目录创建新文件
2. 实现 `ScenarioConfig` 和运行函数
3. 在 `index.ts` 中导入并运行

### 添加新的提供商

1. 在 `runners/tts-runner.ts` 或 `runners/asr-runner.ts` 中添加配置
2. 配置环境变量和创建参数
3. 测试运行器会自动检测环境变量
