# Qwen TTS 示例

阿里云 DashScope TTS 服务示例代码，支持 CosyVoice 和 Realtime 两种模式。

## 目录结构

```
examples/tts/providers/qwen/
├── cosyvoice-v3-flash/          # 推荐模型
│   ├── stream-in-stream-out.ts      # 流式入/流式出
│   ├── non-stream-in-non-stream-out.ts  # 非流式入/非流式出
│   └── README.md
├── cosyvoice-v3-plus/           # 高质量版本
│   ├── stream-in-stream-out.ts
│   ├── non-stream-in-non-stream-out.ts
│   └── README.md
├── cosyvoice-v2/                # V2 版本
│   ├── stream-in-stream-out.ts
│   ├── non-stream-in-non-stream-out.ts
│   └── README.md
├── cosyvoice-v1/                # V1 版本
│   ├── stream-in-stream-out.ts
│   ├── non-stream-in-non-stream-out.ts
│   └── README.md
├── qwen3-tts-instruct-flash-realtime/  # 支持指令控制
│   ├── stream-in-stream-out.ts
│   └── README.md
├── qwen3-tts-flash-realtime/    # 标准实时版本
│   ├── stream-in-stream-out.ts
│   └── README.md
├── basic.ts                     # 基础示例（支持命令行指定模型）
├── stream-input.ts              # 流式输入示例
├── non-stream-output.ts         # 非流式输出示例
├── opus-output.ts               # Opus 格式输出
├── realtime.ts                  # Realtime API 示例
├── README.md
└── output/                      # 输出目录
```

## 支持的模型

### CosyVoice 模型 (provider: `qwen`)

| 模型 | 说明 | 推荐场景 |
|------|------|----------|
| `cosyvoice-v3-flash` | 速度快、成本低 | 实时对话、批量处理（推荐） |
| `cosyvoice-v3-plus` | 高质量版本 | 高质量音频制作 |
| `cosyvoice-v2` | V2 版本 | 兼容旧版 API |
| `cosyvoice-v1` | V1 版本 | 兼容旧版 API |

### Realtime 模型 (provider: `qwen-realtime`)

| 模型 | 说明 | 推荐场景 |
|------|------|----------|
| `qwen3-tts-instruct-flash-realtime` | 支持指令控制 | 需要情感控制的场景（推荐） |
| `qwen3-tts-flash-realtime` | 标准版本 | 一般实时场景 |

## 支持的音色

### CosyVoice 音色

| 音色 ID | 描述 |
|---------|------|
| `longxiaochun_v3` | 龙小淳 - 知性积极女（默认） |
| `longanhuan` | 龙安欢 - 欢脱元气女 |
| `longanyang` | 龙昂扬 - 阳光大男孩 |
| `longhuhu_v3` | 龙呼呼 - 天真烂漫女童 |

### Realtime 音色

| 音色 ID | 描述 |
|---------|------|
| `Cherry` | 甜美女声（默认） |
| `Ethan` | 沉稳男声 |
| `Luna` | 温柔女声 |

## 快速开始

### 推荐模型: CosyVoice v3 Flash

```bash
# 流式入/流式出
npx tsx examples/tts/providers/qwen/cosyvoice-v3-flash/stream-in-stream-out.ts

# 非流式入/非流式出
npx tsx examples/tts/providers/qwen/cosyvoice-v3-flash/non-stream-in-non-stream-out.ts
```

### 高质量模型: CosyVoice v3 Plus

```bash
# 流式入/流式出
npx tsx examples/tts/providers/qwen/cosyvoice-v3-plus/stream-in-stream-out.ts

# 非流式入/非流式出
npx tsx examples/tts/providers/qwen/cosyvoice-v3-plus/non-stream-in-non-stream-out.ts
```

### 指令控制: Qwen3 TTS Instruct Flash Realtime

```bash
# 流式入/流式出（支持情感控制）
npx tsx examples/tts/providers/qwen/qwen3-tts-instruct-flash-realtime/stream-in-stream-out.ts
```

## 旧示例文件

以下示例文件仍然可用，支持通过命令行参数指定模型：

| 文件 | 场景 | 说明 |
|------|------|------|
| `basic.ts` | 字符串输入 → 流式输出 | 最常用的场景，展示基础用法 |
| `stream-input.ts` | 流式输入 → 流式输出 | LLM 流式输出转语音 |
| `non-stream-output.ts` | 字符串输入 → 完整音频 | 离线存储或批量处理 |
| `opus-output.ts` | Opus 格式输出 | 高压缩比音频格式 |
| `realtime.ts` | Realtime API | 指令控制、情感调节 |

## 旧示例文件使用方法

### 基础示例

```bash
# 使用默认模型
npx tsx examples/tts/providers/qwen/basic.ts

# 指定模型
npx tsx examples/tts/providers/qwen/basic.ts cosyvoice-v3-plus

# 查看帮助
npx tsx examples/tts/providers/qwen/basic.ts --help
```

### 流式输入示例

```bash
# 使用默认模型
npx tsx examples/tts/providers/qwen/stream-input.ts

# 指定模型
npx tsx examples/tts/providers/qwen/stream-input.ts cosyvoice-v3-plus
```

### 非流式输出示例

```bash
# 默认 mp3 格式
npx tsx examples/tts/providers/qwen/non-stream-output.ts

# 指定格式
npx tsx examples/tts/providers/qwen/non-stream-output.ts cosyvoice-v3-flash opus
```

### Realtime 示例

```bash
# 无指令
npx tsx examples/tts/providers/qwen/realtime.ts

# 使用预设指令
npx tsx examples/tts/providers/qwen/realtime.ts happy

# 自定义指令
npx tsx examples/tts/providers/qwen/realtime.ts "用小孩子语气说话"
```

## 环境变量

```bash
# 必需
export QWEN_API_KEY="your-api-key"

# 可选（如果使用不同的端点）
export QWEN_BASE_URL="wss://dashscope.aliyuncs.com/api-ws/v1/inference/"
```

## CosyVoice vs Realtime 选择指南

| 特性 | CosyVoice | Realtime |
|------|-----------|----------|
| 指令控制 | ❌ | ✅ |
| 音色数量 | 多 | 少 |
| 响应速度 | 快 | 更快 |
| 音频格式 | mp3/wav/pcm/opus/aac/flac | pcm |
| 推荐场景 | 一般语音合成 | 需要情感控制 |

## 常见问题

### 1. 如何选择模型？

- **追求速度和低成本**: `cosyvoice-v3-flash`
- **追求高质量**: `cosyvoice-v3-plus`
- **需要情感控制**: `qwen3-tts-instruct-flash-realtime`

### 2. 如何播放音频？

```bash
# MP3 格式
ffplay -autoexit output.mp3

# PCM 格式（需要指定参数）
ffplay -autoexit -f s16le -ar 24000 output.pcm

# Opus/Ogg 格式
ffplay -autoexit output.ogg
```

### 3. 如何自定义音色？

在创建 TTS 实例时指定 `voice` 参数：

```typescript
const tts = createTTS({
  provider: 'qwen',
  apiKey: 'your-api-key',
  voice: 'longanhuan', // 欢脱元气女
});
```

### 4. 如何调整语速和音量？

```typescript
const tts = createTTS({
  provider: 'qwen',
  apiKey: 'your-api-key',
  speed: 1.2, // 语速倍率
  volume: 0.8, // 音量 (0-1)
});
```