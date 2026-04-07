# Seed TTS 1.0

早期版本语音合成模型，用于兼容旧版 API。

## 模型特点

| 特性 | 说明 |
|------|------|
| 响应速度 | 中等 |
| 成本 | 中等 |
| 音质 | 良好 |
| 推荐场景 | 需要向后兼容 |

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
| `direct-instance.ts` | 直接实例化 | 不使用工厂函数，直接 `new DoubaoTTS()` 创建实例 |
| `stream-in-stream-out.ts` | 流式入/流式出 | 实时语音合成 |
| `non-stream-in-non-stream-out.ts` | 非流式入/非流式出 | 一次性获取完整音频 |
| `stream-in-stream-out-ogg-opus.ts` | 流式入/流式出 (ogg_opus) | ogg_opus 格式的实时语音合成 |

## 使用方法

### 直接实例化

```bash
npx tsx examples/tts/providers/doubao/seed-tts-1.0/direct-instance.ts
```

### 流式入/流式出

```bash
npx tsx examples/tts/providers/doubao/seed-tts-1.0/stream-in-stream-out.ts
```

### 非流式入/非流式出

```bash
npx tsx examples/tts/providers/doubao/seed-tts-1.0/non-stream-in-non-stream-out.ts
```

### 流式入/流式出 (ogg_opus)

```bash
npx tsx examples/tts/providers/doubao/seed-tts-1.0/stream-in-stream-out-ogg-opus.ts
```

## 环境变量

```bash
export DOUBAO_APP_ID="your-app-id"
export DOUBAO_ACCESS_TOKEN="your-access-token"
```