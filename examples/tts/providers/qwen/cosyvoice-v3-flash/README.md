# CosyVoice v3 Flash

速度快、成本低的语音合成模型，推荐作为默认选择。

## 模型特点

| 特性 | 说明 |
|------|------|
| 响应速度 | 快 |
| 成本 | 低 |
| 音质 | 良好 |
| 推荐场景 | 实时对话、批量处理 |

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
npx tsx examples/tts/providers/qwen/cosyvoice-v3-flash/stream-in-stream-out.ts
```

### 非流式入/非流式出

```bash
npx tsx examples/tts/providers/qwen/cosyvoice-v3-flash/non-stream-in-non-stream-out.ts
```

## 环境变量

```bash
export QWEN_API_KEY="your-api-key"
```