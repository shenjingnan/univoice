# GLM TTS 示例

智谱 AI GLM TTS 服务示例代码，支持 GLM TTS 模型。

## 目录结构

```
examples/tts/providers/glm/
├── glm-tts/                    # GLM TTS 模型
│   ├── stream-in-stream-out.ts      # 流式入/流式出
│   ├── non-stream-in-non-stream-out.ts  # 非流式入/非流式出
│   └── README.md
├── basic.ts                     # 基础示例
├── README.md
└── output/                      # 输出目录
```

## 支持的模型

| 模型 | 说明 | 推荐场景 |
|------|------|----------|
| `glm-tts` | 智谱 AI 语音合成模型 | 一般场景 |

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

## 快速开始

### 非流式入/非流式出

```bash
npx tsx examples/tts/providers/glm/glm-tts/non-stream-in-non-stream-out.ts
```

### 流式入/流式出

```bash
npx tsx examples/tts/providers/glm/glm-tts/stream-in-stream-out.ts
```

### 基础示例

```bash
npx tsx examples/tts/providers/glm/basic.ts
```

## 环境变量

```bash
# 必需
export GLM_API_KEY="your-api-key"
```

## 常见问题

### 1. 如何选择音色？

- **日常使用**: `tongtong`（童童，默认）
- **男声**: `male`
- **女声**: `female`
- **个性化**: 尝试 `xiaochen`、`chuichui` 等特色音色

### 2. 如何播放音频？

```bash
# WAV 格式
ffplay -autoexit output.wav

# PCM 格式（需要指定参数）
ffplay -autoexit -f s16le -ar 24000 output.pcm
```

### 3. 流式输出为什么只支持 PCM 格式？

GLM TTS 流式生成音频时仅支持返回 PCM 格式。非流式模式支持 WAV 和 PCM 格式。

### 4. 如何自定义音色？

在创建 TTS 实例时指定 `voice` 参数：

```typescript
const tts = createTTS({
  provider: 'glm',
  apiKey: 'your-api-key',
  voice: 'xiaochen',
});
```
