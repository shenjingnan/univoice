# Doubao TTS 示例

火山引擎 TTS 服务示例代码，支持 Seed TTS 系列模型。

## 目录结构

```
examples/tts/providers/doubao/
├── seed-tts-1.0/               # V1 版本模型
│   ├── stream-in-stream-out.ts     # 流式入/流式出
│   ├── non-stream-in-non-stream-out.ts  # 非流式入/非流式出
│   └── README.md
├── seed-tts-2.0/               # V2 版本模型（推荐）
│   ├── stream-in-stream-out.ts     # 流式入/流式出
│   ├── non-stream-in-non-stream-out.ts  # 非流式入/非流式出
│   └── README.md
├── basic.ts                    # 基础示例
├── pcm-output.ts               # PCM 格式输出示例
├── README.md
└── output/                     # 输出目录
```

## 支持的模型

| 模型 | 说明 | 推荐场景 |
|------|------|----------|
| `seed-tts-2.0` | 新版本，性能更好 | 一般场景（推荐） |
| `seed-tts-1.0` | 早期版本 | 兼容旧版 API |

## 支持的音色

| 音色 ID | 描述 |
|---------|------|
| `zh_male_lengkugege_emo_v2_mars_bigtts` | 冷酷哥哥 - 情感男声 |
| `zh_female_tianmei_emo_v2_mars_bigtts` | 甜美妹妹 - 情感女声 |
| `zh_male_chunhou_emo_v2_mars_bigtts` | 憨厚叔叔 - 情感男声 |
| `zh_female_wanwan_emo_v2_mars_bigtts` | 温婉阿姨 - 情感女声 |

## 快速开始

### 推荐模型: seed-tts-2.0

```bash
# 流式入/流式出
npx tsx examples/tts/providers/doubao/seed-tts-2.0/stream-in-stream-out.ts
```

### 基础示例

```bash
npx tsx examples/tts/providers/doubao/basic.ts
```

### PCM 格式输出

```bash
npx tsx examples/tts/providers/doubao/pcm-output.ts
```

## 环境变量

```bash
# 必需
export DOUBAO_APP_ID="your-app-id"
export DOUBAO_ACCESS_TOKEN="your-access-token"
```

## 常见问题

### 1. 如何选择模型？

- **追求性能**: `seed-tts-2.0`
- **需要兼容旧版**: `seed-tts-1.0`

### 2. 如何播放音频？

```bash
# MP3 格式
ffplay -autoexit output.mp3

# PCM 格式（需要指定参数）
ffplay -autoexit -f s16le -ar 24000 output.pcm
```

### 3. 如何自定义音色？

在创建 TTS 实例时指定 `voice` 参数：

```typescript
const tts = createTTS({
  provider: 'doubao',
  appId: 'your-app-id',
  accessToken: 'your-access-token',
  voice: 'zh_female_tianmei_emo_v2_mars_bigtts',
});
```