# Qwen3 TTS Instruct Flash Realtime

支持指令控制的实时语音合成模型，可以根据指令调整情感、语气等。

## 模型特点

| 特性 | 说明 |
|------|------|
| 指令控制 | ✅ 支持 |
| 响应速度 | 快 |
| 音频格式 | PCM |
| 推荐场景 | 需要情感控制的场景 |

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

## 使用方法

```bash
npx tsx examples/tts/providers/qwen/qwen3-tts-instruct-flash-realtime/stream-in-stream-out.ts
```

## 指令控制

可以通过 `instructions` 参数控制语音的情感和语气：

```typescript
const tts = createTTS({
  provider: 'qwen-realtime',
  apiKey: 'your-api-key',
  model: 'qwen3-tts-instruct-flash-realtime',
  voice: 'Cherry',
  realtime: {
    instructions: '请用温柔、亲切的语气说话',
  },
});
```

## 环境变量

```bash
export QWEN_API_KEY="your-api-key"
```