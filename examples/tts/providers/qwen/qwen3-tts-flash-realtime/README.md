# Qwen3 TTS Flash Realtime

标准实时语音合成模型，适用于一般实时场景。

## 模型特点

| 特性 | 说明 |
|------|------|
| 指令控制 | ❌ 不支持 |
| 响应速度 | 快 |
| 音频格式 | PCM |
| 推荐场景 | 一般实时场景 |

## 支持的音色

| 音色 ID | 描述 |
|---------|------|
| `Cherry` | 甜美女声（默认） |
| `Ethan` | 沉稳男声 |
| `Luna` | 温柔女声 |

## 示例文件

| 文件 | 场景 | 说明 |
|------|------|------|
| `stream-in-stream-out.ts` | 流式入/流式出 | LLM 流式输出转语音 |

## 注意事项

**Realtime 模型仅支持流式输出，不支持 `synthesize()` 非流式合成。**

如果需要指令控制功能，请使用 `qwen3-tts-instruct-flash-realtime` 模型。

## 使用方法

```bash
npx tsx examples/tts/providers/qwen/qwen3-tts-flash-realtime/stream-in-stream-out.ts
```

## 环境变量

```bash
export QWEN_API_KEY="your-api-key"
```