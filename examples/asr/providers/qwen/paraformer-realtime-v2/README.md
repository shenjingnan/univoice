# Paraformer Realtime v2

推荐使用的实时语音识别模型，支持多语言和任意采样率。

## 模型特点

| 特性 | 说明 |
|------|------|
| 语言支持 | 中文、英文、日文、韩文等多语言 |
| 采样率 | 任意采样率（自动检测） |
| 响应速度 | 快 |
| 推荐场景 | 通用场景（默认推荐） |

## 示例文件

| 文件 | 场景 | 说明 |
|------|------|------|
| `stream-in-stream-out.ts` | 流式入/流式出 | 实时音频流识别，边发边收 |
| `non-stream-in-non-stream-out.ts` | 非流式入/非流式出 | 离线音频文件处理 |
| `connect-and-listen.ts` | 连接预建立 | 预建立连接后再识别，降低首次延迟 |

## 使用方法

### 流式入/流式出

适用于实时音频流识别场景，如麦克风输入、实时通话。

```bash
npx tsx examples/asr/providers/qwen/paraformer-realtime-v2/stream-in-stream-out.ts
```

### 非流式入/非流式出

适用于离线音频文件处理，一次性返回完整识别结果。

```bash
npx tsx examples/asr/providers/qwen/paraformer-realtime-v2/non-stream-in-non-stream-out.ts
```

## 环境变量

```bash
export QWEN_API_KEY="your-api-key"
```

## 与其他模型对比

| 模型 | 语言支持 | 采样率 | 推荐场景 |
|------|----------|--------|----------|
| **paraformer-realtime-v2** | 多语言 | 任意 | 通用场景（推荐） |
| paraformer-realtime-8k-v1 | 中文 | 8kHz | 电话语音 |
| paraformer-realtime-v1 | 中文 | 16kHz | 标准音频 |