# Qwen ASR 示例

阿里云 DashScope ASR 服务示例代码，基于 Paraformer 实时语音识别模型。

## 目录结构

```
examples/asr/providers/qwen/
├── paraformer-realtime-v2/          # 推荐模型（支持多语言、任意采样率）
│   ├── stream-in-stream-out.ts          # 流式入/流式出
│   ├── non-stream-in-non-stream-out.ts  # 非流式入/非流式出
│   ├── connect-and-listen.ts            # 连接预建立
│   └── README.md
├── paraformer-realtime-8k-v1/       # 8kHz 版本（电话语音）
│   ├── stream-in-stream-out.ts
│   ├── non-stream-in-non-stream-out.ts
│   └── README.md
├── paraformer-realtime-v1/          # v1 版本（16kHz 采样率）
│   ├── stream-in-stream-out.ts
│   ├── non-stream-in-non-stream-out.ts
│   └── README.md
└── README.md
```

## 支持的模型

| 模型 | 语言支持 | 采样率 | 推荐场景 |
|------|----------|--------|----------|
| `paraformer-realtime-v2` | 多语言 | 任意 | 通用场景（推荐） |
| `paraformer-realtime-8k-v1` | 中文 | 8kHz | 电话语音 |
| `paraformer-realtime-v1` | 中文 | 16kHz | 标准音频 |

## 快速开始

### 推荐模型: Paraformer Realtime v2

```bash
# 流式入/流式出
npx tsx examples/asr/providers/qwen/paraformer-realtime-v2/stream-in-stream-out.ts

# 非流式入/非流式出
npx tsx examples/asr/providers/qwen/paraformer-realtime-v2/non-stream-in-non-stream-out.ts
```

### 电话语音: Paraformer Realtime 8k v1

```bash
# 流式入/流式出
npx tsx examples/asr/providers/qwen/paraformer-realtime-8k-v1/stream-in-stream-out.ts

# 非流式入/非流式出
npx tsx examples/asr/providers/qwen/paraformer-realtime-8k-v1/non-stream-in-non-stream-out.ts
```

### 标准音频: Paraformer Realtime v1

```bash
# 流式入/流式出
npx tsx examples/asr/providers/qwen/paraformer-realtime-v1/stream-in-stream-out.ts

# 非流式入/非流式出
npx tsx examples/asr/providers/qwen/paraformer-realtime-v1/non-stream-in-non-stream-out.ts
```

## 环境变量

```bash
export QWEN_API_KEY="your-api-key"
```

## 输入输出模式说明

### 流式入/流式出

**场景**: 实时音频流识别，如麦克风输入、实时通话

**特点**:
- 边发边收，实时返回识别片段
- 低延迟，适合交互场景
- 示例中使用 `mockAudioStream` 将音频文件模拟为流

**API**:
```typescript
for await (const chunk of asr.listen(audioStream, { stream: true })) {
  console.log(chunk.text);
}
```

### 非流式入/非流式出

**场景**: 离线音频文件处理

**特点**:
- 一次性返回完整识别结果
- 简单直接，适合批量处理
- 支持分段信息输出

**API**:
```typescript
const result = await asr.listen(audioPath);
console.log(result.text);
```

## 常见问题

### 1. 如何选择模型？

- **通用场景**: `paraformer-realtime-v2`（支持多语言、任意采样率）
- **电话语音**: `paraformer-realtime-8k-v1`（8kHz 优化）
- **标准音频**: `paraformer-realtime-v1`（16kHz 采样率）

### 2. 音频文件从哪里来？

示例代码使用 TTS 生成的音频文件。请先运行 TTS 示例：

```bash
npx tsx examples/tts/providers/qwen/basic.ts
```

这会在 `examples/output/` 目录下生成 `qwen-tts-demo.mp3` 文件。

### 3. 如何指定识别语言？

创建 ASR 实例时指定 `language` 参数：

```typescript
const asr = createASR({
  provider: 'qwen',
  apiKey: 'your-api-key',
  language: 'zh-CN', // 中文
});
```

### 4. 如何启用词级时间戳？

```typescript
const asr = createASR({
  provider: 'qwen',
  apiKey: 'your-api-key',
  enableWords: true, // 启用词级时间戳
});
```

### 5. 流式识别中 "中间结果" 和 "最终结果" 有什么区别？

- **中间结果**: 实时返回的识别片段，可能会随着更多音频输入而变化
- **最终结果**: 句子结束时的最终识别结果，不会再变化

示例输出：
```
[14:30:25.123] [中间] 欢迎
[14:30:25.234] [中间] 欢迎来到
[14:30:25.345] [最终] 欢迎来到杭州！
```