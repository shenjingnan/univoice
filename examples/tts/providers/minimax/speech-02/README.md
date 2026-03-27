# Speech 02

旧版语音合成模型，兼容旧版 API。

## 模型特点

| 特性 | 说明 |
|------|------|
| 响应速度 | 中等 |
| 成本 | 较低 |
| 音质 | 良好 |
| 推荐场景 | 兼容旧版 API |

## 包含模型

| 模型 | 说明 |
|------|------|
| `speech-02-hd` | 高音质 |
| `speech-02-turbo` | 高性能 |

## 示例文件

| 文件 | 场景 | 说明 |
|------|------|------|
| `stream-in-stream-out.ts` | 流式入/流式出 | 实时语音合成 |
| `non-stream-in-non-stream-out.ts` | 非流式入/非流式出 | 一次性获取完整音频 |

## 使用方法

### 非流式入/非流式出

```bash
npx tsx examples/tts/providers/minimax/speech-02/non-stream-in-non-stream-out.ts
```

### 流式入/流式出

```bash
npx tsx examples/tts/providers/minimax/speech-02/stream-in-stream-out.ts
```

## 环境变量

```bash
export MINIMAX_API_KEY="your-api-key"
```
