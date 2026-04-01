# GLM TTS

智谱 AI 语音合成模型。

## 模型特点

| 特性 | 说明 |
|------|------|
| 协议 | HTTP REST |
| 音频格式 | wav / pcm |
| 流式格式 | 仅 pcm |
| 推荐场景 | 一般语音合成 |

## 支持的音色

| 音色 ID | 描述 |
|---------|------|
| `tongtong` | 童童（默认） |
| `xiaochen` | 小晨 |
| `chuichui` | 吹吹 |
| `jam` | jam |
| `kazi` | 卡子 |
| `douji` | 豆汁 |
| `luodo` | 螺蛳 |
| `female` | 女声 |
| `male` | 男声 |

## 示例文件

| 文件 | 场景 | 说明 |
|------|------|------|
| `stream-in-stream-out.ts` | 流式入/流式出 | 实时语音合成（输出 PCM 格式） |
| `non-stream-in-non-stream-out.ts` | 非流式入/非流式出 | 一次性获取完整音频（输出 WAV 格式） |
| `direct-instance.ts` | 直接实例化 | 直接 `new GlmTTS()` 创建实例，不使用工厂函数 |

## 使用方法

### 非流式入/非流式出

```bash
npx tsx examples/tts/providers/glm/glm-tts/non-stream-in-non-stream-out.ts
```

### 流式入/流式出

```bash
npx tsx examples/tts/providers/glm/glm-tts/stream-in-stream-out.ts
```

### 直接实例化

```bash
npx tsx examples/tts/providers/glm/glm-tts/direct-instance.ts
```

## 环境变量

```bash
export GLM_API_KEY="your-api-key"
```
