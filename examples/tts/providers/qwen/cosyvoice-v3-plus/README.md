# CosyVoice v3 Plus

高质量语音合成模型，适用于对音质要求较高的场景。

## 模型特点

| 特性 | 说明 |
|------|------|
| 响应速度 | 中等 |
| 成本 | 中等 |
| 音质 | 优秀 |
| 推荐场景 | 高质量音频制作 |

## 支持的音色

| 音色 ID | 描述 |
|---------|------|
| `longxiaochun_v3` | 龙小淳 - 知性积极女（默认） |
| `longanhuan` | 龙安欢 - 欢脱元气女 |
| `longanyang` | 龙昂扬 - 阳光大男孩 |
| `longhuhu_v3` | 龙呼呼 - 天真烂漫女童 |

## 示例文件

| 文件 | 场景 | 说明 |
|------|------|------|
| `stream-in-stream-out.ts` | 流式入/流式出 | LLM 流式输出转语音 |
| `non-stream-in-non-stream-out.ts` | 非流式入/非流式出 | 一次性获取完整音频 |

## 使用方法

### 流式入/流式出

```bash
npx tsx examples/tts/providers/qwen/cosyvoice-v3-plus/stream-in-stream-out.ts
```

### 非流式入/非流式出

```bash
npx tsx examples/tts/providers/qwen/cosyvoice-v3-plus/non-stream-in-non-stream-out.ts
```

## 环境变量

```bash
export QWEN_API_KEY="your-api-key"
```