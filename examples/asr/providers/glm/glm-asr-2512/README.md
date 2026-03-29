# GLM ASR 2512

智谱 AI 默认推荐的语音识别模型。

## 模型特点

| 特性 | 说明 |
|------|------|
| 语言支持 | 中文、英文等多语言 |
| 音频格式 | .wav / .mp3 |
| 文件限制 | ≤ 25 MB，时长 ≤ 30 秒 |
| 流式输出 | 支持（Event Stream） |
| 特殊参数 | 热词（hotwords）、上下文（context） |
| 推荐场景 | 通用场景（默认推荐） |

> **注意**: GLM ASR 不支持真正的流式输入。当传入音频流时，SDK 会先将流完整收集为 Buffer，再一次性发送给 API。但输出支持流式模式，可实时获取识别片段。

## 示例文件

| 文件 | 场景 | 说明 |
|------|------|------|
| `stream-in-stream-out.ts` | 流式入/流式出 | 音频流输入，实时获取识别结果（推荐） |
| `non-stream-in-non-stream-out.ts` | 非流式入/非流式出 | 文件路径输入，一次性返回完整结果 |

## 使用方法

### 流式入/流式出

适用于需要实时获取识别结果的场景。音频流会被完整收集后发送，但识别结果通过 Event Stream 实时返回。

```bash
npx tsx examples/asr/providers/glm/glm-asr-2512/stream-in-stream-out.ts
```

### 非流式入/非流式出

适用于离线音频文件处理，一次性返回完整识别结果。

```bash
npx tsx examples/asr/providers/glm/glm-asr-2512/non-stream-in-non-stream-out.ts
```

## 环境变量

```bash
export GLM_API_KEY="your-api-key"
```
