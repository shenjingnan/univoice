# 示例代码

本目录包含 univoice SDK 的使用示例，演示 TTS（文字转语音）和 LLM 流式输出转语音等功能。

## 环境配置

运行示例前，需要在项目根目录创建 `.env` 文件：

```bash
# 火山引擎 Doubao TTS 配置
DOUBAO_APP_KEY=your_app_id
DOUBAO_ACCESS_TOKEN=your_access_token
DOUBAO_VOICE_TYPE=zh_female_tianmeixiaoyuan_moon_bigtts

# Minimax TTS 配置
MINIMAX_API_KEY=your_api_key

# OpenAI 配置（用于 LLM 示例）
OPENAI_API_KEY=your_api_key
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o-mini
```

## 示例列表

### Doubao TTS 示例

| 文件 | 说明 | 输出格式 |
|------|------|----------|
| [doubao-tts-demo.ts](./doubao-tts-demo.ts) | 基础 TTS 合成示例 | MP3 |
| [doubao-tts-speak-collect.ts](./doubao-tts-speak-collect.ts) | 流式音频收集示例 | PCM |
| [doubao-tts-speak-string.ts](./doubao-tts-speak-string.ts) | 字符串输入模式示例 | PCM |
| [doubao-tts-stream-direct.ts](./doubao-tts-stream-direct.ts) | 直接流式保存示例 | PCM |

### Minimax TTS 示例

| 文件 | 说明 | 输出格式 |
|------|------|----------|
| [minimax-tts-speak-non-stream.ts](./minimax-tts-speak-non-stream.ts) | 非流式输出示例 | MP3 |
| [minimax-tts-speak-string.ts](./minimax-tts-speak-string.ts) | 字符串输入 + 流式输出 | MP3 |
| [minimax-tts-speak-stream-input.ts](./minimax-tts-speak-stream-input.ts) | 流式输入 + 流式输出 | MP3 |
| [minimax-tts-speak-collect.ts](./minimax-tts-speak-collect.ts) | 流式输入 + 非流式输出 | MP3 |

### 其他示例

| 文件 | 说明 | 输出格式 |
|------|------|----------|
| [llm-to-tts-demo.ts](./llm-to-tts-demo.ts) | LLM 流转语音示例 | PCM |
| [openai-stream-demo.ts](./openai-stream-demo.ts) | OpenAI 流式调试示例 | JSONL |

## 详细说明

### doubao-tts-demo.ts

基础 TTS 合成示例，演示如何使用 `synthesize()` 方法合成语音。

**核心功能：**
- 使用 `createTTS()` 创建 TTS 实例
- 调用 `synthesize()` 方法合成完整文本
- 保存为 MP3 格式音频文件

**适用场景：** 已知完整文本内容，需要一次性合成语音。

### doubao-tts-speak-collect.ts

流式音频收集示例，演示如何使用 `speak()` 方法收集音频块。

**核心功能：**
- 使用 `speak()` 方法流式获取音频
- 通过 `for await...of` 遍历音频块
- 使用 `saveAudio()` 工具函数保存音频

**适用场景：** 需要实时处理音频块或监控合成进度。

### doubao-tts-speak-string.ts

字符串输入模式示例，演示 `speak(string)` 的用法。

**核心功能：**
- 直接传入字符串而非流式输入
- 输出首字延迟统计信息
- 演示性能监控最佳实践

**适用场景：** 已知完整文本，但希望获得流式输出的低延迟体验。

### doubao-tts-stream-direct.ts

直接流式保存示例，演示最简单的流式保存方式。

**核心功能：**
- 使用 `saveAudio()` 直接保存流
- 无需手动收集音频块

**适用场景：** 快速保存音频，无需处理中间过程。

### llm-to-tts-demo.ts

LLM 流转语音示例，演示如何将 OpenAI 流式输出直接转为语音。

**核心功能：**
- 将 OpenAI 流式输出传入 `speak()` 方法
- 实现实时语音合成
- 输出首字延迟和性能统计

**适用场景：** AI 对话、语音助手等需要实时响应的场景。

### openai-stream-demo.ts

OpenAI 流式调试示例，用于调试流式返回数据。

**核心功能：**
- 捕获 OpenAI 流式响应的每个 chunk
- 保存为 JSONL 格式便于分析
- 控制台输出详细的 chunk 信息

**适用场景：** 调试 OpenAI 流式响应，分析数据格式。

### Minimax TTS 示例

#### minimax-tts-speak-non-stream.ts

非流式输出示例，演示 `speak(text)` 获取完整音频的用法。

**核心功能：**
- 使用 `speak(string)` 获取完整音频
- 等待所有音频数据返回后再输出
- 保存为 MP3 格式

**适用场景：** 已知完整文本，需要一次性获取完整音频。

#### minimax-tts-speak-string.ts

字符串输入 + 流式输出示例，演示 `speak(text, { stream: true })` 的用法。

**核心功能：**
- 字符串输入，流式音频输出
- 实时接收音频块，降低首字延迟
- 输出首字延迟统计信息

**适用场景：** 已知完整文本，但希望获得流式输出的低延迟体验。

#### minimax-tts-speak-stream-input.ts

流式输入 + 流式输出示例，演示 `speak(textStream, { stream: true })` 的用法。

**核心功能：**
- 文本流输入（模拟 LLM 流式输出）
- 实时流式音频输出
- 边发边收，首字延迟最低

**适用场景：** LLM 对话、语音助手等需要实时响应的场景。

#### minimax-tts-speak-collect.ts

流式输入 + 非流式输出示例，演示 `speak(textStream)` 获取完整音频的用法。

**核心功能：**
- 文本流输入（模拟 LLM 流式输出）
- 等待完整音频后一次性返回
- 适用于需要完整音频数据的场景

**适用场景：** 接收流式文本，但需要保存完整音频文件或进行二次处理。

## 运行方式

```bash
# Doubao TTS 示例
pnpm tsx examples/doubao-tts-demo.ts
pnpm tsx examples/doubao-tts-speak-collect.ts
pnpm tsx examples/doubao-tts-speak-string.ts
pnpm tsx examples/doubao-tts-stream-direct.ts

# Minimax TTS 示例
pnpm tsx examples/minimax-tts-speak-non-stream.ts
pnpm tsx examples/minimax-tts-speak-string.ts
pnpm tsx examples/minimax-tts-speak-stream-input.ts
pnpm tsx examples/minimax-tts-speak-collect.ts

# 其他示例
pnpm tsx examples/llm-to-tts-demo.ts
pnpm tsx examples/openai-stream-demo.ts
```

## 输出文件

所有示例的输出文件保存在 `examples/output/` 目录：

```
examples/output/
├── doubao-tts-demo.mp3                     # Doubao MP3 格式音频
├── doubao-tts-speak-collect.pcm            # Doubao PCM 格式音频
├── doubao-tts-speak-string.pcm             # Doubao PCM 格式音频
├── doubao-tts-stream-direct.pcm            # Doubao PCM 格式音频
├── minimax-tts-speak-non-stream.mp3        # Minimax MP3 格式音频
├── minimax-tts-speak-string.mp3            # Minimax MP3 格式音频
├── minimax-tts-speak-stream-input.mp3      # Minimax MP3 格式音频
├── minimax-tts-speak-collect.mp3           # Minimax MP3 格式音频
├── llm-to-tts-demo.pcm                     # LLM 转 TTS PCM 格式音频
└── openai-stream-*.jsonl                   # OpenAI 流式数据
```

### 播放 PCM 音频

PCM 格式需要指定采样率和格式参数：

```bash
# 24000 Hz, 16-bit, mono
ffplay -f s16le -ar 24000 examples/output/doubao-tts-speak-collect.pcm
```

### 播放 MP3 音频

MP3 格式可直接播放：

```bash
ffplay examples/output/doubao-tts-demo.mp3
```
