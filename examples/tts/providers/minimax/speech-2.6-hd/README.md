# Speech 2.6 HD

超低延时语音合成模型。

## 模型特点

| 特性 | 说明 |
|------|------|
| 响应速度 | 快 |
| 成本 | 中等 |
| 音质 | 优秀 |
| 推荐场景 | 实时对话 |

## 包含模型

| 模型 | 说明 |
|------|------|
| `speech-2.6-hd` | 超低延时 |
| `speech-2.6-turbo` | 极速版 |

## 示例文件

| 文件 | 场景 | 说明 |
|------|------|------|
| `stream-in-stream-out.ts` | 流式入/流式出 | 实时语音合成 |
| `non-stream-in-non-stream-out.ts` | 非流式入/非流式出 | 一次性获取完整音频 |

## 使用方法

### 非流式入/非流式出

```bash
npx tsx examples/tts/providers/minimax/speech-2.6-hd/non-stream-in-non-stream-out.ts
```

### 流式入/流式出

```bash
npx tsx examples/tts/providers/minimax/speech-2.6-hd/stream-in-stream-out.ts
```

## 环境变量

```bash
export MINIMAX_API_KEY="your-api-key"
```
