# Minimax TTS 示例

Minimax TTS 服务示例代码，支持 Speech 2.8、Speech 2.6、Speech 02 三个系列模型。

## 目录结构

```
examples/tts/providers/minimax/
├── speech-2.8-hd/               # 2.8 系列 - 精准还原真实语气（推荐）
│   ├── stream-in-stream-out.ts      # 流式入/流式出
│   ├── non-stream-in-non-stream-out.ts  # 非流式入/非流式出
│   └── README.md
├── speech-2.6-hd/               # 2.6 系列 - 超低延时
│   ├── stream-in-stream-out.ts      # 流式入/流式出
│   ├── non-stream-in-non-stream-out.ts  # 非流式入/非流式出
│   └── README.md
├── speech-02/                   # 02 系列 - 旧版兼容
│   ├── stream-in-stream-out.ts      # 流式入/流式出
│   ├── non-stream-in-non-stream-out.ts  # 非流式入/非流式出
│   └── README.md
├── basic.ts                     # 基础示例
├── README.md
└── output/                      # 输出目录
```

## 支持的模型

### 2.8 系列（精准还原真实语气）

| 模型 | 说明 | 推荐场景 |
|------|------|----------|
| `speech-2.8-hd` | 精准还原真实语气 | 通用场景（推荐） |
| `speech-2.8-turbo` | 更快更优惠 | 对速度和成本敏感 |

### 2.6 系列（超低延时）

| 模型 | 说明 | 推荐场景 |
|------|------|----------|
| `speech-2.6-hd` | 超低延时 | 实时对话 |
| `speech-2.6-turbo` | 极速版 | 极低延时场景 |

### 02 系列（旧版兼容）

| 模型 | 说明 | 推荐场景 |
|------|------|----------|
| `speech-02-hd` | 高音质 | 兼容旧版 API |
| `speech-02-turbo` | 高性能 | 兼容旧版 API |

## 快速开始

### 推荐模型: speech-2.8-hd

```bash
# 非流式入/非流式出
npx tsx examples/tts/providers/minimax/speech-2.8-hd/non-stream-in-non-stream-out.ts

# 流式入/流式出
npx tsx examples/tts/providers/minimax/speech-2.8-hd/stream-in-stream-out.ts
```

### 超低延时: speech-2.6-hd

```bash
npx tsx examples/tts/providers/minimax/speech-2.6-hd/stream-in-stream-out.ts
```

### 基础示例

```bash
npx tsx examples/tts/providers/minimax/basic.ts
```

## 环境变量

```bash
# 必需
export MINIMAX_API_KEY="your-api-key"
```

## 常见问题

### 1. 如何选择模型？

- **追求音质和语气还原**: `speech-2.8-hd`
- **追求低延时**: `speech-2.6-hd`
- **需要兼容旧版**: `speech-02-hd`
- **追求速度和低成本**: `speech-2.8-turbo` 或 `speech-2.6-turbo`

### 2. 如何播放音频？

```bash
# MP3 格式
ffplay -autoexit output.mp3
```

### 3. 如何自定义音色？

在创建 TTS 实例时指定 `voice` 参数：

```typescript
const tts = createTTS({
  provider: 'minimax',
  apiKey: 'your-api-key',
  voice: 'male-qn-qingse',
});
```
