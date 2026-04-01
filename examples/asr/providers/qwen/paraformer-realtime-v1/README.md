# Paraformer Realtime v1

标准实时语音识别模型，支持 16kHz 采样率。

## 模型特点

| 特性 | 说明 |
|------|------|
| 语言支持 | 中文 |
| 采样率 | 16kHz |
| 响应速度 | 快 |
| 推荐场景 | 标准音频识别 |

## 示例文件

| 文件 | 场景 | 说明 |
|------|------|------|
| `direct-instance.ts` | 直接实例化 | 使用 Opus 数据包 + `new QwenASR()` 直接实例化 |
| `stream-in-stream-out.ts` | 流式入/流式出 | 实时音频流识别，边发边收 |
| `non-stream-in-non-stream-out.ts` | 非流式入/非流式出 | 离线音频文件处理 |

## 使用方法

### 直接实例化

使用 Opus 数据包和 `new QwenASR()` 直接实例化，无需工厂函数。

```bash
npx tsx examples/asr/providers/qwen/paraformer-realtime-v1/direct-instance.ts
```

### 流式入/流式出

适用于实时音频流识别场景。

```bash
npx tsx examples/asr/providers/qwen/paraformer-realtime-v1/stream-in-stream-out.ts
```

### 非流式入/非流式出

适用于离线音频文件处理，一次性返回完整识别结果。

```bash
npx tsx examples/asr/providers/qwen/paraformer-realtime-v1/non-stream-in-non-stream-out.ts
```

## 环境变量

```bash
export QWEN_API_KEY="your-api-key"
```

## 与其他模型对比

| 模型 | 语言支持 | 采样率 | 推荐场景 |
|------|----------|--------|----------|
| paraformer-realtime-v2 | 多语言 | 任意 | 通用场景（推荐） |
| paraformer-realtime-8k-v1 | 中文 | 8kHz | 电话语音 |
| **paraformer-realtime-v1** | 中文 | 16kHz | 标准音频 |