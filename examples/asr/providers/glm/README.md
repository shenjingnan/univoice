# GLM ASR 示例

智谱 AI GLM ASR 服务示例代码。

## 目录结构

```
examples/asr/providers/glm/
├── basic.ts                             # 基础示例（快速上手）
├── glm-asr-2512/                        # 默认推荐模型
│   ├── stream-in-stream-out.ts          # 流式入/流式出
│   ├── non-stream-in-non-stream-out.ts  # 非流式入/非流式出
│   └── README.md
└── README.md
```

## 支持的模型

| 模型 | 音频格式 | 文件限制 | 特殊参数 | 推荐场景 |
|------|----------|----------|----------|----------|
| `glm-asr-2512` | .wav / .mp3 | ≤ 25 MB，≤ 30 秒 | 热词、上下文 | 通用场景（推荐） |

## 快速开始

### 基础示例

最简单的使用方式：

```bash
npx tsx examples/asr/providers/glm/basic.ts
```

### 流式入/流式出

```bash
npx tsx examples/asr/providers/glm/glm-asr-2512/stream-in-stream-out.ts
```

### 非流式入/非流式出

```bash
npx tsx examples/asr/providers/glm/glm-asr-2512/non-stream-in-non-stream-out.ts
```

## 环境变量

```bash
export GLM_API_KEY="your-api-key"
```

## 输入输出模式说明

### 流式入/流式出

**场景**: 需要实时获取识别结果的场景

**特点**:
- GLM ASR **不支持真正的流式输入**，音频流会被完整收集后一次性发送
- 输出支持流式（Event Stream），可实时获取识别片段
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

### 1. 音频文件从哪里来？

示例代码使用 TTS 生成的音频文件。请先运行 TTS 示例：

```bash
npx tsx examples/tts/providers/glm/basic.ts
```

这会在 `examples/output/` 目录下生成 `glm-tts-demo.wav` 文件。

### 2. GLM ASR 支持真正的流式输入吗？

不支持。GLM ASR 使用 HTTP REST API，需要完整的音频文件才能发起识别。当传入音频流时，SDK 会先将流完整收集为 Buffer，再一次性发送。但输出支持流式模式（`stream=true`），可实时获取识别片段。

### 3. 如何使用热词（hotwords）提高识别准确率？

```typescript
const asr = createASR({
  provider: 'glm',
  apiKey: 'your-api-key',
  model: 'glm-asr-2512',
  hotwords: ['智谱AI', 'GLM', '语音识别'],
});
```

### 4. 如何使用上下文（context）优化长文本识别？

```typescript
const asr = createASR({
  provider: 'glm',
  apiKey: 'your-api-key',
  model: 'glm-asr-2512',
  context: '这是一段关于人工智能技术的演讲',
});
```

### 5. 支持哪些音频格式？

支持 `.wav` 和 `.mp3` 格式，文件大小不超过 25 MB，时长不超过 30 秒。

### 6. 流式识别中 "中间结果" 和 "最终结果" 有什么区别？

- **中间结果**: 实时返回的识别片段，类型为 `transcript.text.delta`
- **最终结果**: 完整的识别结果，类型为 `transcript.text.done`

示例输出：
```
[14:30:25.123] [中间] 欢迎
[14:30:25.234] [中间] 欢迎来到
[14:30:25.345] [最终] 欢迎来到杭州！
```
