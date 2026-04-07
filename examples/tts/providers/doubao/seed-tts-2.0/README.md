# Seed TTS 2.0

新版本语音合成模型，性能更优。

## 模型特点

| 特性 | 说明 |
|------|------|
| 响应速度 | 快 |
| 成本 | 中等 |
| 音质 | 优秀 |
| 推荐场景 | 一般场景（推荐） |

## 支持的音色

| 音色 ID | 描述 |
|---------|------|
| `zh_male_lengkugege_emo_v2_mars_bigtts` | 冷酷哥哥 - 情感男声 |
| `zh_female_tianmei_emo_v2_mars_bigtts` | 甜美妹妹 - 情感女声 |
| `zh_male_chunhou_emo_v2_mars_bigtts` | 憨厚叔叔 - 情感男声 |
| `zh_female_wanwan_emo_v2_mars_bigtts` | 温婉阿姨 - 情感女声 |

## 示例文件

| 文件 | 场景 | 说明 |
|------|------|------|
| `stream-in-stream-out.ts` | 流式入/流式出 | 实时语音合成（PCM 格式） |
| `stream-in-stream-out-ogg-opus.ts` | 流式入/流式出 | 实时语音合成（OGG Opus 格式） |
| `non-stream-in-non-stream-out.ts` | 非流式入/非流式出 | 一次性获取完整音频 |

## 使用方法

### 流式入/流式出（PCM 格式）

```bash
npx tsx examples/tts/providers/doubao/seed-tts-2.0/stream-in-stream-out.ts
```

### 流式入/流式出（OGG Opus 格式）

```bash
npx tsx examples/tts/providers/doubao/seed-tts-2.0/stream-in-stream-out-ogg-opus.ts
```

### 非流式入/非流式出

```bash
npx tsx examples/tts/providers/doubao/seed-tts-2.0/non-stream-in-non-stream-out.ts
```

## 环境变量

```bash
export DOUBAO_APP_ID="your-app-id"
export DOUBAO_ACCESS_TOKEN="your-access-token"
```