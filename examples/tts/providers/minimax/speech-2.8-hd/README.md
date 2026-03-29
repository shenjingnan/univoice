# Speech 2.8 HD

精准还原真实语气的语音合成模型，推荐使用。

## 模型特点

| 特性 | 说明 |
|------|------|
| 响应速度 | 中等 |
| 成本 | 中等 |
| 音质 | 优秀 |
| 推荐场景 | 通用场景（推荐） |

## 包含模型

| 模型 | 说明 |
|------|------|
| `speech-2.8-hd` | 精准还原真实语气（推荐） |
| `speech-2.8-turbo` | 更快更优惠 |

## 示例文件

| 文件 | 场景 | 说明 |
|------|------|------|
| `stream-in-stream-out.ts` | 流式入/流式出 | 实时语音合成 |
| `non-stream-in-non-stream-out.ts` | 非流式入/非流式出 | 一次性获取完整音频 |

## 使用方法

### 非流式入/非流式出

```bash
npx tsx examples/tts/providers/minimax/speech-2.8-hd/non-stream-in-non-stream-out.ts
```

### 流式入/流式出

```bash
npx tsx examples/tts/providers/minimax/speech-2.8-hd/stream-in-stream-out.ts
```

## 环境变量

```bash
export MINIMAX_API_KEY="your-api-key"
```
