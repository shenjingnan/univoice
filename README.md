<br />
<div align="center">
  <img style="height: 80px;" src="https://raw.githubusercontent.com/shenjingnan/univoice/main/docs/public/images/logo.png" alt="univoice logo" />
</div>
<br />

<div align="center">

[![npm version](https://img.shields.io/npm/v/univoice.svg)](https://www.npmjs.com/package/univoice)
[![npm downloads](https://img.shields.io/npm/dm/univoice.svg)](https://www.npmjs.com/package/univoice)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![codecov](https://codecov.io/gh/shenjingnan/univoice/branch/main/graph/badge.svg)](https://codecov.io/gh/shenjingnan/univoice)

**统一的 TTS（文字转语音）和 ASR（语音识别）SDK**

[快速开始](#快速开始) · [API 文档](#api-文档) · [支持的提供商](#支持的提供商)

</div>

---

## 简介

**univoice** 是一个统一的语音处理 SDK，提供统一的 API 来调用多种 TTS（文字转语音）和 ASR（语音识别）服务提供商。

### 核心特性

- 🎯 **统一 API** - 一套 API 调用多种语音服务提供商
- 🔄 **流式支持** - TTS 支持流式输入和输出，适合 LLM 流式输出场景
- 🚀 **边发边收** - LLM 流式输出可直接转换为语音，显著降低首字延迟
- 🔌 **插件化架构** - 轻松扩展支持新的语音服务提供商
- 📦 **TypeScript 优先** - 完整的类型定义支持

### 适用场景

- AI 助手语音交互
- 有声书/播客生成
- 客服语音系统
- 实时语音翻译
- 语音消息应用

---

## 安装

```bash
# 使用 pnpm
pnpm add univoice

# 使用 npm
npm install univoice

# 使用 yarn
yarn add univoice
```

### 环境要求

- Node.js >= 20.0.0

---

## 快速开始

### TTS（文字转语音）

#### 非流式合成

最简单的使用方式，适合已知完整文本的场景：

```typescript
import { createTTS } from 'univoice';

const tts = createTTS({
  provider: 'doubao',
  appId: 'your-app-id',
  accessToken: 'your-access-token',
  voice: 'zh_female_tianmeixiaoyuan_moon_bigtts',
  format: 'mp3',
});

const response = await tts.synthesize({
  text: '欢迎来到杭州！',
});

console.log(`音频格式: ${response.format}`);
console.log(`音频大小: ${response.audio.length} bytes`);
```

#### 流式合成

适合流式输入场景，支持两种输入模式：

```typescript
import { createTTS } from 'univoice';

const tts = createTTS({
  provider: 'doubao',
  appId: 'your-app-id',
  accessToken: 'your-access-token',
  voice: 'zh_female_tianmeixiaoyuan_moon_bigtts',
  format: 'pcm',
  sampleRate: 24000,
});

// 方式一：字符串输入
const text = '欢迎来到龙井村。这里是西湖龙井茶的原产地。';
for await (const { audioChunk } of tts.speak(text)) {
  console.log('收到音频块:', audioChunk.length);
}

// 方式二：流式文本输入（如 Generator）
async function* textGenerator() {
  yield '你好，';
  yield '世界！';
}
for await (const { audioChunk } of tts.speak(textGenerator())) {
  console.log('收到音频块:', audioChunk.length);
}
```

#### LLM 流式输出转语音（核心特性）

将 LLM 的流式输出直接转换为语音，实现边发边收，显著降低首字延迟：

```typescript
import OpenAI from 'openai';
import { createTTS } from 'univoice';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const tts = createTTS({
  provider: 'doubao',
  appId: 'your-app-id',
  accessToken: 'your-access-token',
  voice: 'zh_female_tianmeixiaoyuan_moon_bigtts',
  format: 'pcm',
  sampleRate: 24000,
});

// 创建 OpenAI 流式请求
const openaiStream = await openai.chat.completions.stream({
  model: 'gpt-4o-mini',
  messages: [{ role: 'user', content: '请介绍 TypeScript' }],
  stream: true,
});

// 直接将 OpenAI stream 传入 TTS speak
const chunks: Uint8Array[] = [];
for await (const { audioChunk } of tts.speak(openaiStream)) {
  chunks.push(audioChunk);
  console.log('收到音频块');
}

// 保存音频
import { writeFileSync } from 'node:fs';
const buffer = Buffer.concat(chunks.map(c => Buffer.from(c)));
writeFileSync('output.pcm', buffer);
```

#### 保存音频

使用工具函数快速保存音频：

```typescript
import { createTTS, saveAudio } from 'univoice';

const tts = createTTS({ /* config */ });

// 直接保存流式输出
await saveAudio('output.pcm', tts.speak('你好，世界！'));

// 保存非流式输出
import { saveTTSResponse } from 'univoice';
const response = await tts.synthesize({ text: '你好' });
const filepath = await saveTTSResponse(response);
console.log(`已保存到: ${filepath}`);
```

### ASR（语音识别）

```typescript
import { createASR } from 'univoice';
import { readFileSync } from 'node:fs';

const asr = createASR({
  provider: 'openai',
  apiKey: 'your-api-key',
  model: 'whisper-1',
});

const audioBuffer = readFileSync('audio.mp3');

// 流式识别
for await (const chunk of asr.listen(audioBuffer)) {
  console.log(`识别文本: ${chunk.text}`);
  if (chunk.isFinal) {
    console.log('识别完成');
  }
}
```

---

## API 文档

### TTS API

#### 创建实例

```typescript
import { createTTS } from 'univoice';

const tts = createTTS({
  provider: 'doubao' | 'openai' | 'minimax' | 'qwen' | 'gemini',
  // 通用配置
  apiKey?: string,
  baseUrl?: string,
  model?: string,
  voice?: string,
  format?: 'mp3' | 'wav' | 'ogg' | 'flac' | 'pcm',
  speed?: number,
  volume?: number,
  pitch?: number,
  language?: string,
  // doubao 专用
  appId?: string,
  accessToken?: string,
  resourceId?: string,
  sampleRate?: number,
});
```

#### 方法

| 方法 | 说明 | 返回类型 |
|------|------|----------|
| `tts.synthesize(request)` | 非流式合成 | `Promise<TTSResponse>` |
| `tts.speak(input)` | 流式合成 | `AsyncIterable<TTSStreamChunk>` |
| `tts.listVoices?()` | 列出可用声音 | `Promise<TTSVoice[]>` |

#### 工具函数

| 函数 | 说明 |
|------|------|
| `saveTTSResponse(response, options)` | 保存 TTS 响应到文件 |
| `saveAudio(filename, stream)` | 保存流式音频到文件 |
| `collectAudio(response, options)` | 收集音频数据 |
| `playAudio(response, options)` | 播放音频 |
| `teeAudio(response, options)` | 同时保存和播放 |

### ASR API

#### 创建实例

```typescript
import { createASR } from 'univoice';

const asr = createASR({
  provider: 'doubao' | 'openai' | 'minimax' | 'qwen' | 'gemini',
  apiKey?: string,
  baseUrl?: string,
  model?: string,
  language?: string,
  prompt?: string,
  responseFormat?: 'json' | 'text' | 'srt' | 'vtt' | 'verbose_json',
});
```

#### 方法

| 方法 | 说明 | 返回类型 |
|------|------|----------|
| `asr.listen(audio)` | 流式语音识别 | `AsyncIterable<ASRStreamChunk>` |

#### 工具函数

| 函数 | 说明 |
|------|------|
| `saveText(text, options)` | 保存识别文本到文件 |
| `collectText(response, options)` | 收集识别结果 |

---

## 支持的提供商

### TTS 提供商

| 提供商 | 标识符 | 流式支持 |
|--------|--------|----------|
| 豆包（火山引擎） | `doubao` | ✅ |
| OpenAI | `openai` | ❌ |
| MiniMax | `minimax` | ✅ |
| 通义千问 | `qwen` | ✅ |
| Gemini | `gemini` | ❌ |

### ASR 提供商

| 提供商 | 标识符 |
|--------|--------|
| 豆包（火山引擎） | `doubao` |
| OpenAI | `openai` |
| MiniMax | `minimax` |
| 通义千问 | `qwen` |
| Gemini | `gemini` |

### 配置示例

#### 豆包（火山引擎）

```typescript
const tts = createTTS({
  provider: 'doubao',
  appId: process.env.DOUBAO_APP_ID,
  accessToken: process.env.DOUBAO_ACCESS_TOKEN,
  voice: 'zh_female_tianmeixiaoyuan_moon_bigtts',
  resourceId: 'seed-tts-2.0',
  format: 'mp3',
  sampleRate: 24000,
});
```

#### OpenAI

```typescript
const tts = createTTS({
  provider: 'openai',
  apiKey: process.env.OPENAI_API_KEY,
  model: 'tts-1',
  voice: 'alloy',
  speed: 1.0,
});

const asr = createASR({
  provider: 'openai',
  apiKey: process.env.OPENAI_API_KEY,
  model: 'whisper-1',
  language: 'zh',
});
```

#### MiniMax

```typescript
const tts = createTTS({
  provider: 'minimax',
  apiKey: process.env.MINIMAX_API_KEY,
  groupId: process.env.MINIMAX_GROUP_ID,
  voice: 'female-tianmei',
  format: 'mp3',
});
```

#### 通义千问

```typescript
const tts = createTTS({
  provider: 'qwen',
  apiKey: process.env.QWEN_API_KEY,
  model: 'cosyvoice-v1',
  voice: 'longxiaochun',
  format: 'mp3',
});
```

#### Gemini

```typescript
const tts = createTTS({
  provider: 'gemini',
  apiKey: process.env.GEMINI_API_KEY,
  voice: 'Kore',
  language: 'zh-CN',
});
```

---

## 开发指南

### 本地开发

```bash
# 克隆仓库
git clone https://github.com/shenjingnan/univoice.git
cd univoice

# 安装依赖
pnpm install

# 构建项目
pnpm build

# 运行测试
pnpm test

# 代码检查
pnpm lint

# 格式化代码
pnpm format
```

### 添加新提供商

1. 在 `src/tts/providers/` 或 `src/asr/providers/` 创建新文件
2. 继承 `BaseTTS` 或 `BaseASR` 类
3. 实现必要的方法
4. 在文件末尾调用 `registerTTSProvider()` 或 `registerASRProvider()`

```typescript
// src/tts/providers/my-provider.ts
import { BaseTTS, registerTTSProvider } from '@/tts/index';
import type { TTSOptions, TTSRequest, TTSResponse } from '@/types/tts';

class MyTTS extends BaseTTS {
  constructor(options: TTSOptions) {
    super(options);
  }

  async synthesize(request: TTSRequest): Promise<TTSResponse> {
    // 实现合成逻辑
    return {
      audio: Buffer.from('...'),
      format: 'mp3',
    };
  }
}

registerTTSProvider('my-provider', (options) => new MyTTS(options));
```

### 项目结构

```
src/
├── index.ts           # 主入口，导出所有公开 API
├── tts/               # TTS 模块
│   ├── base.ts        # BaseTTS 抽象类
│   ├── factory.ts     # 工厂函数
│   ├── utils/         # 工具函数
│   │   ├── save.ts    # 保存音频
│   │   ├── collect.ts # 收集音频
│   │   ├── play.ts    # 播放音频
│   │   └── tee.ts     # 同时保存和播放
│   └── providers/     # 提供商实现
│       ├── doubao.ts
│       ├── openai.ts
│       ├── minimax.ts
│       ├── qwen.ts
│       └── gemini.ts
├── asr/               # ASR 模块
│   ├── base.ts        # BaseASR 抽象类
│   ├── factory.ts     # 工厂函数
│   ├── utils/         # 工具函数
│   └── providers/     # 提供商实现
└── types/             # 类型定义
    ├── tts.ts         # TTS 相关类型
    ├── asr.ts         # ASR 相关类型
    └── llm-stream.ts  # LLM 流式输出类型
```

---

## 许可证

[Apache-2.0](LICENSE)

---

## 贡献

欢迎提交 Issue 和 Pull Request！

---

## 致谢

感谢以下语音服务提供商：
- [火山引擎](https://www.volcengine.com/)
- [OpenAI](https://openai.com/)
- [MiniMax](https://www.minimaxi.com/)
- [阿里云通义千问](https://tongyi.aliyun.com/)
- [Google Gemini](https://ai.google.dev/)