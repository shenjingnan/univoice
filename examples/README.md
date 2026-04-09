# 示例代码

本目录包含 univoice SDK 的使用示例，演示 TTS（文字转语音）和 ASR（语音识别）等功能。

## 目录结构

```
examples/
├── utils/                      # 公共工具函数
│   ├── common.ts               # 通用工具（配置获取、时间戳等）
│   ├── ogg-to-opus-packets.ts  # OGG 转 Opus 数据包
│   ├── opus-packets-to-ogg.ts  # Opus 数据包转 OGG
│   └── ...
│
├── tts/                        # TTS 示例
│   ├── basic/                  # 基础用法
│   │   ├── speak-string.ts     # 字符串输入
│   │   └── speak-stream.ts     # 流式输入
│   │
│   ├── advanced/               # 高级用法
│   │   └── llm-to-tts.ts       # LLM + TTS 集成
│   │
│   └── providers/              # 提供商特定示例
│       ├── doubao/             # 火山引擎
│       │   ├── basic.ts
│       │   ├── seed-v1.ts
│       │   └── pcm-output.ts
│       ├── qwen/               # 阿里云
│       │   ├── basic.ts
│       │   ├── realtime.ts
│       │   └── opus-output.ts
│       ├── minimax/            # Minimax
│       │   └── basic.ts
│       └── glm/                # 智谱 AI
│           └── basic.ts
│
├── asr/                        # ASR 示例
│   ├── basic/                  # 基础用法
│   │   ├── listen-stream.ts    # 流式识别
│   │   └── listen-non-stream.ts
│   │
│   ├── advanced/               # 高级用法
│   │   ├── ogg-to-asr.ts
│   │   └── opus-packets-to-asr.ts
│   │
│   └── providers/              # 提供商特定示例
│       ├── doubao/
│       ├── qwen/
│       ├── glm/
│       └── openai/
│
└── audio/                      # 音频处理工具示例
    ├── ogg-to-opus-packets.ts
    └── opus-packets-to-ogg.ts
```

## 环境配置

运行示例前，需要在项目根目录创建 `.env` 文件：

```bash
# 火山引擎 Doubao 配置
DOUBAO_APP_KEY=your_app_id
DOUBAO_ACCESS_TOKEN=your_access_token
DOUBAO_VOICE_TYPE=zh_female_tianmeixiaoyuan_moon_bigtts

# 阿里云 Qwen 配置
QWEN_API_KEY=your_api_key

# Minimax 配置
MINIMAX_API_KEY=your_api_key

# 智谱 AI GLM 配置
GLM_API_KEY=your_api_key

# OpenAI 配置（用于 LLM 示例）
OPENAI_API_KEY=your_api_key
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_TTS_MODEL=gpt-4o-mini
OPENAI_ASR_MODEL=whisper-1
```

## 快速开始

### TTS 基础示例

```bash
# 字符串输入（支持多提供商）
pnpm tsx examples/tts/basic/speak-string.ts doubao
pnpm tsx examples/tts/basic/speak-string.ts qwen
pnpm tsx examples/tts/basic/speak-string.ts minimax

# 流式输入（模拟 LLM 输出）
pnpm tsx examples/tts/basic/speak-stream.ts doubao
```

### TTS 提供商示例

```bash
# Doubao
pnpm tsx examples/tts/providers/doubao/basic.ts
pnpm tsx examples/tts/providers/doubao/seed-v1.ts

# Qwen
pnpm tsx examples/tts/providers/qwen/basic.ts
pnpm tsx examples/tts/providers/qwen/realtime.ts

# Minimax
pnpm tsx examples/tts/providers/minimax/basic.ts

# GLM
pnpm tsx examples/tts/providers/glm/basic.ts
```

### ASR 基础示例

```bash
# 流式识别
pnpm tsx examples/asr/basic/listen-stream.ts

# 非流式识别
pnpm tsx examples/asr/basic/listen-non-stream.ts
```

### ASR 提供商示例

```bash
# Doubao
pnpm tsx examples/asr/providers/doubao/basic.ts
pnpm tsx examples/asr/providers/doubao/stream.ts

# Qwen
pnpm tsx examples/asr/providers/qwen/basic.ts

# GLM
pnpm tsx examples/asr/providers/glm/basic.ts
```

### 音频处理示例

```bash
# OGG 转 Opus 数据包
pnpm tsx examples/audio/ogg-to-opus-packets.ts

# Opus 数据包合并为 OGG
pnpm tsx examples/audio/opus-packets-to-ogg.ts
```

## 示例说明

### TTS 示例

#### tts/basic/speak-string.ts

字符串输入示例，演示 `speak(string)` 的用法。

**核心功能：**
- 直接传入字符串而非流式输入
- 支持多提供商（doubao、qwen、minimax）
- 输出首字延迟统计信息

**适用场景：** 已知完整文本，但希望获得流式输出的低延迟体验。

#### tts/basic/speak-stream.ts

流式输入示例，演示 `speak(textStream, { stream: true })` 的用法。

**核心功能：**
- 文本流输入（模拟 LLM 流式输出）
- 实时流式音频输出
- 边发边收，首字延迟最低

**适用场景：** LLM 对话、语音助手等需要实时响应的场景。

#### tts/advanced/llm-to-tts.ts

LLM 流转语音示例，演示如何将 OpenAI 流式输出直接转为语音。

**核心功能：**
- 将 OpenAI 流式输出传入 `speak()` 方法
- 实现实时语音合成
- 输出首字延迟和性能统计

**适用场景：** AI 对话、语音助手等需要实时响应的场景。

### ASR 示例

#### asr/basic/listen-stream.ts

流式识别示例，演示 `asr.listen(audioPath, { stream: true })` 的用法。

**核心功能：**
- 输入完整音频，实时返回识别片段
- 适合长音频，可以更早看到识别结果
- 显示中间和最终结果

**适用场景：** 需要实时显示识别进度的场景。

#### asr/basic/listen-non-stream.ts

非流式识别示例，演示 `asr.listen(audioPath)` 的用法。

**核心功能：**
- 输入完整音频，等待识别完成
- 返回完整识别结果

**适用场景：** 需要完整识别结果的场景。

## 输出文件

所有示例的输出文件保存在 `examples/output/` 目录：

```
examples/output/
├── doubao-tts-demo.mp3
├── qwen-tts-demo.mp3
├── speak-string-doubao.pcm
├── speak-string-qwen.mp3
└── ...
```

### 播放 PCM 音频

PCM 格式需要指定采样率和格式参数：

```bash
# 24000 Hz, 16-bit, mono
ffplay -autoexit -f s16le -ar 24000 examples/output/speak-string-doubao.pcm
```

### 播放 MP3/OGG 音频

MP3/OGG 格式可直接播放：

```bash
ffplay -autoexit examples/output/qwen-tts-demo.mp3
ffplay -autoexit examples/output/merged-from-opus-packets.ogg
```