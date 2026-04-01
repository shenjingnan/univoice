# Paraformer Realtime 8k v1

专为 8kHz 采样率优化的实时语音识别模型，适用于电话语音场景。

## 模型特点

| 特性 | 说明 |
|------|------|
| 语言支持 | 中文 |
| 采样率 | 8kHz |
| 响应速度 | 快 |
| 推荐场景 | 电话语音识别 |

## 示例文件

| 文件 | 场景 | 说明 |
|------|------|------|
| `direct-instance.ts` | 直接实例化 | 直接 new QwenASR() 创建实例，Opus 数据包流式识别 |
| `stream-in-stream-out.ts` | 流式入/流式出 | 实时音频流识别，边发边收 |
| `non-stream-in-non-stream-out.ts` | 非流式入/非流式出 | 离线音频文件处理 |

## 使用方法

### 直接实例化

使用 Opus 数据包和 `new QwenASR()` 直接实例化，无需工厂函数。

```bash
npx tsx examples/asr/providers/qwen/paraformer-realtime-8k-v1/direct-instance.ts
```

### 流式入/流式出

适用于实时电话语音识别场景。

```bash
npx tsx examples/asr/providers/qwen/paraformer-realtime-8k-v1/stream-in-stream-out.ts
```

### 非流式入/非流式出

适用于离线电话录音文件处理。

```bash
npx tsx examples/asr/providers/qwen/paraformer-realtime-8k-v1/non-stream-in-non-stream-out.ts
```

## 环境变量

```bash
export QWEN_API_KEY="your-api-key"
```

## 与其他模型对比

| 模型 | 语言支持 | 采样率 | 推荐场景 |
|------|----------|--------|----------|
| paraformer-realtime-v2 | 多语言 | 任意 | 通用场景（推荐） |
| **paraformer-realtime-8k-v1** | 中文 | 8kHz | 电话语音 |
| paraformer-realtime-v1 | 中文 | 16kHz | 标准音频 |