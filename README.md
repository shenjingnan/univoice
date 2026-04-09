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
- 🌳 **Tree-Shaking 支持** - 按需加载，减少打包体积

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

## 按需加载（Tree-Shaking）

univoice 支持 tree-shaking，你可以按需加载所需的 provider，减少打包体积。

### 方式一：自动注册全部 Provider

适合需要使用多个 provider 的场景：

```typescript
import 'univoice/tts/providers';  // 注册所有 TTS provider
import { createTTS } from 'univoice/tts';

const tts = createTTS({ provider: 'doubao', ... });
```

### 方式二：手动注册单个 Provider（推荐）

只打包需要的 provider，最小化打包体积：

```typescript
import { createTTS, registerTTSProvider } from 'univoice/tts';
import { DoubaoTTS } from 'univoice/tts/providers/doubao';

// 只注册需要的 provider
registerTTSProvider('doubao', DoubaoTTS);

const tts = createTTS({ provider: 'doubao', ... });
```

### 方式三：直接使用 Provider 类

最精简的方式，不使用工厂函数：

```typescript
import { DoubaoTTS } from 'univoice/tts/providers/doubao';

const tts = new DoubaoTTS({
  appId: 'your-app-id',
  accessToken: 'your-access-token',
  // ...
});

const response = await tts.synthesize({ text: '你好' });
```

### 可用导入路径

| 路径 | 说明 |
|------|------|
| `univoice` | 主入口，导出所有 API（不自动注册 provider） |
| `univoice/tts` | TTS 模块入口 |
| `univoice/tts/providers` | 自动注册所有 TTS provider |
| `univoice/asr` | ASR 模块入口 |
| `univoice/asr/providers` | 自动注册所有 ASR provider |

---

## API 文档

### TTS API

#### 创建实例

```typescript
import { createTTS } from 'univoice';

const tts = createTTS({
  provider: 'doubao' | 'openai' | 'minimax' | 'qwen' | 'qwen-realtime' | 'gemini' | 'glm' | 'xfyun',
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
  provider: 'doubao' | 'openai' | 'minimax' | 'qwen' | 'gemini' | 'glm' | 'xfyun',
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

### 能力矩阵

各提供商对输入输出模式的支持情况如下，帮助您根据实际场景选择合适的提供商。

#### ASR 能力矩阵

| 提供商 | 标识符 | 流式输入 | 一次性输入 | 流式输出 | 一次性输出 |
|--------|--------|----------|------------|----------|----------|
| 豆包（火山引擎） | `doubao` | ✅ | ✅ | ✅ | ✅ |
| 通义千问 | `qwen` | ✅ | ✅ | ✅ | ✅ |
| 智谱 GLM | `glm` | ❌ | ✅ | ✅ | ✅ |
| OpenAI | `openai` | 待实现 | 待实现 | 待实现 | 待实现 |
| MiniMax | `minimax` | - | - | - | - |
| Gemini | `gemini` | 待实现 | 待实现 | 待实现 | 待实现 |
| 科大讯飞 | `xfyun` | ✅ | ✅ | ✅ | ✅ |

#### TTS 能力矩阵

| 提供商 | 标识符 | 流式输入 | 一次性输入 | 流式输出 | 一次性输出 |
|--------|--------|----------|------------|----------|----------|
| 豆包（火山引擎） | `doubao` | ✅ | ✅ | ✅ | ✅ |
| 通义千问 | `qwen` | ✅ | ✅ | ✅ | ✅ |
| 智谱 GLM | `glm` | ❌ | ✅ | ✅ | ✅ |
| OpenAI | `openai` | 待实现 | 待实现 | 待实现 | 待实现 |
| MiniMax | `minimax` | ✅ | ✅ | ✅ | ✅ |
| Gemini | `gemini` | 待实现 | 待实现 | 待实现 | 待实现 |
| 科大讯飞 | `xfyun` | ✅ | ✅ | ✅ | ✅ |

#### 能力说明

| 能力 | 说明 |
|------|------|
| **流式输入** | 支持边发边收，如 LLM 流式输出直接转语音、实时音频流识别 |
| **一次性输入** | 一次性发送完整文本/音频 |
| **流式输出** | 结果以流的形式返回，适合实时处理场景 |
| **一次性输出** | 返回完整结果，适合批量处理场景 |

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
  model: 'cosyvoice-v3-flash',
  voice: 'longxiaochun_v3',
  format: 'mp3',
});

const asr = createASR({
  provider: 'qwen',
  apiKey: process.env.QWEN_API_KEY,
  model: 'paraformer-realtime-v2',
  language: 'zh-CN',
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

#### 智谱 GLM

```typescript
const tts = createTTS({
  provider: 'glm',
  apiKey: process.env.GLM_API_KEY,
  model: 'glm-tts',
  voice: 'tongtong', // 可选: xiaochen, chuichui, jam, kazi, douji, luodo, female, male
  format: 'pcm',     // 支持 wav 和 pcm，流式只支持 pcm
});

const asr = createASR({
  provider: 'glm',
  apiKey: process.env.GLM_API_KEY,
  model: 'glm-asr-2512',
  hotwords: ['人工智能', '机器学习'], // 可选：热词列表，提高特定词汇识别准确率
  context: '这是一段技术演讲',        // 可选：上下文文本，用于长文本场景优化
});
```

#### 科大讯飞

```typescript
const tts = createTTS({
  provider: 'xfyun',
  appId: process.env.XFYUN_APP_ID,
  apiSecret: process.env.XFYUN_API_SECRET,
  apiKey: process.env.XFYUN_API_KEY,
  voice: 'x5_lingxiaoxuan_flow',
  model: 'super-human-tts',
  format: 'pcm',
  sampleRate: 16000,
});

const asr = createASR({
  provider: 'xfyun',
  appId: process.env.XFYUN_APP_ID,
  apiSecret: process.env.XFYUN_API_SECRET,
  apiKey: process.env.XFYUN_API_KEY,
  language: 'zh-CN',
});
```

---

<!-- PERFORMANCE_TABLE_START -->

# Univoice 性能基准测试报告

> ⚠️ **重要说明**
>
> 本报告仅反映在使用 **univoice** 时不同服务商和模型之间的**相对性能差异**，仅供参考，不代表服务商和模型的绝对性能。
>
> 实际测试结果受多种因素影响，包括但不限于：
> - 网络波动与延迟
> - 测试环境与地理位置
> - univoice 的实现方式
> - 服务商当前的负载情况
> - 服务商对模型的迭代
>
> 如需评估服务商的真实性能，建议直接使用服务商官方 SDK 进行测试。

> 生成时间: 2026/4/9 20:47:20

> 环境: Node.js v24.14.0, darwin arm64

## TTS 性能指标

### 场景说明

| 场景 | 说明 |
|------|------|
| 非流式入/流式出 | 完整文本输入，实时音频流输出 |
| 非流式入/非流式出 | 完整文本输入，完整音频返回 |

### 指标说明

| 指标 | 含义 | 计算方法 | 作用 |
|------|------|----------|------|
| 首包延迟 | 从发送请求到收到第一个音频块的时间 | 所有测试首包延迟的平均值 | 反映 TTS 服务的响应速度 |
| 平均间隔 | 稳定状态下平均每个 chunk 的间隔时间 | (总耗时 - 首包延迟) / (chunk数 - 1) 的平均值 | 反映 TTS 服务吐数据块的节奏 |
| P50 | 中位数，50% 请求低于此值 | 所有耗时排序后取中位数 | 反映典型请求的性能 |
| P95 | 95% 请求低于此值 | 所有耗时排序后取第95百分位 | 评估尾部延迟，了解最坏情况 |
| 标准差 | 延迟的离散程度 | 各耗时与平均值差值的平方的均值的平方根 | 值越小性能越稳定 |
| 吞吐量 | 每秒处理的字符数 | 文本长度 / 平均耗时(秒) | 值越大处理效率越高 |

### 非流式入/流式出

| 服务商 | 模型 | 音色 | 编码格式 | 采样率 (Hz) | 测试次数 | 首包延迟 (ms) | 平均间隔 (ms) | P50 (ms) | P95 (ms) | 标准差 (ms) | 吞吐量 (chars/s) |
|--------|------|------|----------|-------------|----------|---------------|---------------|----------|----------|-------------|-----------------|
| 通义千问 | cosyvoice-v3-flash | longanyang | pcm | 8000 | 6 | 624 | 118 | 8726 | 10184 | 838 | 64.1 |
| 通义千问 | cosyvoice-v3-flash | longanyang | pcm | 16000 | 6 | 556 | 64 | 8586 | 9838 | 3129 | 77.1 |
| 通义千问 | cosyvoice-v3-flash | longanyang | pcm | 22050 | 6 | 573 | 57 | 8328 | 11354 | 1178 | 65.2 |
| 通义千问 | cosyvoice-v3-flash | longanyang | pcm | 24000 | 6 | 704 | 67 | 11027 | 12958 | 1619 | 54.0 |
| 通义千问 | cosyvoice-v3-flash | longanyang | pcm | 44100 | 6 | 532 | 27 | 8558 | 10379 | 3168 | 76.3 |
| 通义千问 | cosyvoice-v3-flash | longanyang | pcm | 48000 | 6 | 578 | 27 | 8588 | 9112 | 443 | 67.5 |
| 通义千问 | cosyvoice-v3-flash | longanyang | opus | 8000 | 9 | 729 | 23 | 8813 | 12104 | 1307 | 92.0 |
| 通义千问 | cosyvoice-v3-flash | longanyang | opus | 16000 | 9 | 760 | 23 | 8797 | 13435 | 3442 | 94.0 |
| 通义千问 | cosyvoice-v3-flash | longanyang | opus | 22050 | 18 | 测试失败 | - | - | - | - | - |
| 通义千问 | cosyvoice-v3-flash | longanyang | opus | 24000 | 9 | 821 | 20 | 8368 | 13894 | 3968 | 105.0 |
| 通义千问 | cosyvoice-v3-flash | longanyang | opus | 44100 | 6 | 测试失败 | - | - | - | - | - |
| 通义千问 | cosyvoice-v3-flash | longanyang | opus | 48000 | 12 | 662 | 21 | 8402 | *17053* | 4134 | 136.8 |
| 通义千问 | cosyvoice-v3-plus | longanyang | pcm | 8000 | 6 | 839 | 153 | 11754 | 11923 | 517 | 49.3 |
| 通义千问 | cosyvoice-v3-plus | longanyang | pcm | 16000 | 6 | 792 | 81 | 11509 | 12051 | 4063 | 59.6 |
| 通义千问 | cosyvoice-v3-plus | longanyang | pcm | 22050 | 6 | 832 | 69 | 10916 | 11902 | 1025 | 52.8 |
| 通义千问 | cosyvoice-v3-plus | longanyang | pcm | 24000 | 6 | 868 | 75 | 11809 | 12117 | 195 | 48.2 |
| 通义千问 | cosyvoice-v3-plus | longanyang | pcm | 44100 | 6 | 801 | 34 | 11631 | 11973 | 3981 | 59.3 |
| 通义千问 | cosyvoice-v3-plus | longanyang | pcm | 48000 | 6 | 868 | 37 | *11900* | 13024 | 882 | 48.6 |
| 通义千问 | cosyvoice-v3-plus | longanyang | opus | 8000 | 9 | 1063 | 30 | 11896 | 12627 | 331 | 71.7 |
| 通义千问 | cosyvoice-v3-plus | longanyang | opus | 16000 | 9 | 902 | 22 | 11514 | 12601 | 4307 | 93.2 |
| 通义千问 | cosyvoice-v3-plus | longanyang | opus | 22050 | 9 | 测试失败 | - | - | - | - | - |
| 通义千问 | cosyvoice-v3-plus | longanyang | opus | 24000 | 9 | 819 | 17 | 11060 | 11858 | 5180 | 122.9 |
| 通义千问 | cosyvoice-v3-plus | longanyang | opus | 44100 | 9 | 测试失败 | - | - | - | - | - |
| 通义千问 | cosyvoice-v3-plus | longanyang | opus | 48000 | 9 | 846 | 17 | 11501 | 12383 | *5206* | 118.3 |
| 通义千问 | cosyvoice-v2 | longyingxiao | pcm | 8000 | 6 | 1602 | 99 | 9461 | 12421 | 3538 | 66.8 |
| 通义千问 | cosyvoice-v2 | longyingxiao | pcm | 16000 | 6 | 1575 | 67 | 9929 | 11489 | 3463 | 65.0 |
| 通义千问 | cosyvoice-v2 | longyingxiao | pcm | 22050 | 6 | 1299 | 49 | 9829 | 11190 | 3612 | 67.4 |
| 通义千问 | cosyvoice-v2 | longyingxiao | pcm | 24000 | 6 | 1673 | 60 | 10435 | 11589 | 875 | 54.7 |
| 通义千问 | cosyvoice-v2 | longyingxiao | pcm | 44100 | 6 | 1299 | 32 | 9563 | 11176 | 917 | 59.3 |
| 通义千问 | cosyvoice-v2 | longyingxiao | pcm | 48000 | 6 | *1700* | 30 | 10863 | 12202 | 1336 | 53.8 |
| 通义千问 | cosyvoice-v2 | longyingxiao | opus | 8000 | 6 | 920 | 16 | 8183 | 12148 | 4475 | 85.7 |
| 通义千问 | cosyvoice-v2 | longyingxiao | opus | 16000 | 6 | 1141 | 15 | 9283 | 10047 | 4008 | 84.3 |
| 通义千问 | cosyvoice-v2 | longyingxiao | opus | 22050 | 6 | 测试失败 | - | - | - | - | - |
| 通义千问 | cosyvoice-v2 | longyingxiao | opus | 24000 | 6 | 1443 | 20 | 9942 | 11236 | 3302 | 64.7 |
| 通义千问 | cosyvoice-v2 | longyingxiao | opus | 44100 | 6 | 测试失败 | - | - | - | - | - |
| 通义千问 | cosyvoice-v2 | longyingxiao | opus | 48000 | 6 | 1085 | 19 | 9183 | 10977 | 3316 | 70.5 |
| 通义千问 | cosyvoice-v1 | longwan | pcm | 8000 | 6 | 675 | 114 | 6465 | 6533 | 220 | 89.6 |
| 通义千问 | cosyvoice-v1 | longwan | pcm | 16000 | 6 | 728 | 58 | 6363 | 6776 | 199 | 88.9 |
| 通义千问 | cosyvoice-v1 | longwan | pcm | 22050 | 6 | 681 | 43 | 6336 | 7031 | 303 | 88.2 |
| 通义千问 | cosyvoice-v1 | longwan | pcm | 24000 | 6 | 694 | 39 | 6246 | 7566 | 551 | 87.8 |
| 通义千问 | cosyvoice-v1 | longwan | pcm | 44100 | 6 | 1029 | 23 | 6641 | 10311 | 1427 | 79.5 |
| 通义千问 | cosyvoice-v1 | longwan | pcm | 48000 | 6 | 661 | 20 | 6626 | 6753 | 219 | 87.3 |
| qwen-realtime | qwen3-tts-instruct-flash-realtime | Cherry | pcm | 8000 | 9 | 815 | 127 | 6269 | 7875 | 745 | 132.4 |
| qwen-realtime | qwen3-tts-instruct-flash-realtime | Cherry | pcm | 16000 | 6 | 903 | 123 | 6208 | 6887 | 337 | 91.3 |
| qwen-realtime | qwen3-tts-instruct-flash-realtime | Cherry | pcm | 24000 | 4 | 961 | 122 | 6331 | 6854 | 512 | 60.9 |
| qwen-realtime | qwen3-tts-instruct-flash-realtime | Cherry | pcm | 48000 | 3 | 1274 | 121 | 6379 | 6867 | 415 | 44.8 |
| qwen-realtime | qwen3-tts-instruct-flash-realtime | Cherry | opus | 8000 | 6 | 1039 | 16 | 6191 | 7811 | 680 | 87.9 |
| qwen-realtime | qwen3-tts-instruct-flash-realtime | Cherry | opus | 16000 | 4 | 1101 | 16 | 6600 | 6928 | 273 | 57.4 |
| qwen-realtime | qwen3-tts-instruct-flash-realtime | Cherry | opus | 24000 | 3 | 1078 | 16 | 6665 | 7372 | 446 | *42.0* |
| qwen-realtime | qwen3-tts-instruct-flash-realtime | Cherry | opus | 48000 | 3 | 941 | 16 | 6339 | 6852 | 346 | 44.5 |
| qwen-realtime | qwen3-tts-flash-realtime | Cherry | pcm | 8000 | 3 | 494 | 81 | 3877 | 3883 | 91 | 74.7 |
| qwen-realtime | qwen3-tts-flash-realtime | Cherry | pcm | 16000 | 3 | 489 | 85 | 3923 | 4608 | 355 | 69.3 |
| qwen-realtime | qwen3-tts-flash-realtime | Cherry | pcm | 24000 | 3 | 450 | 82 | 3951 | 4131 | 125 | 71.8 |
| qwen-realtime | qwen3-tts-flash-realtime | Cherry | pcm | 48000 | 3 | 570 | 79 | 3859 | 3861 | 73 | 74.8 |
| qwen-realtime | qwen3-tts-flash-realtime | Cherry | opus | 8000 | 3 | 508 | 10 | 3918 | 3987 | 136 | 73.9 |
| qwen-realtime | qwen3-tts-flash-realtime | Cherry | opus | 16000 | 3 | 501 | 11 | 3786 | 3846 | 68 | 75.6 |
| qwen-realtime | qwen3-tts-flash-realtime | Cherry | opus | 24000 | 3 | 473 | 10 | 3899 | 4131 | 124 | 72.0 |
| qwen-realtime | qwen3-tts-flash-realtime | Cherry | opus | 48000 | 3 | 457 | 10 | 3807 | 4134 | 176 | 73.3 |
| qwen-realtime | qwen-tts-realtime | Cherry | pcm | 24000 | 3 | 667 | 63 | 4585 | 4897 | 169 | 61.1 |
| 豆包 | seed-tts-1.0 | zh_male_lengkugege_emo_v2_mars_bigtts | pcm | 8000 | 3 | 679 | 62 | 3082 | 3373 | 156 | 90.3 |
| 豆包 | seed-tts-1.0 | zh_male_lengkugege_emo_v2_mars_bigtts | pcm | 16000 | 3 | 710 | 61 | 3224 | 3297 | 35 | 87.8 |
| 豆包 | seed-tts-1.0 | zh_male_lengkugege_emo_v2_mars_bigtts | pcm | 24000 | 3 | 935 | 112 | 3531 | 9650 | 2997 | 52.6 |
| 豆包 | seed-tts-1.0 | zh_male_lengkugege_emo_v2_mars_bigtts | pcm | 48000 | 3 | 760 | 61 | 3181 | 3397 | 151 | 89.0 |
| 豆包 | seed-tts-1.0 | zh_male_lengkugege_emo_v2_mars_bigtts | ogg_opus | 8000 | 3 | 827 | 60 | 3146 | 3722 | 318 | 86.8 |
| 豆包 | seed-tts-1.0 | zh_male_lengkugege_emo_v2_mars_bigtts | ogg_opus | 16000 | 3 | 653 | 62 | 3254 | 3461 | 231 | 88.9 |
| 豆包 | seed-tts-1.0 | zh_male_lengkugege_emo_v2_mars_bigtts | ogg_opus | 24000 | 3 | 670 | 102 | 3429 | 7919 | 2209 | 59.3 |
| 豆包 | seed-tts-1.0 | zh_male_lengkugege_emo_v2_mars_bigtts | ogg_opus | 48000 | 3 | 698 | 65 | 3217 | 3603 | 200 | 85.8 |
| 豆包 | seed-tts-2.0 | zh_female_vv_uranus_bigtts | pcm | 8000 | 3 | 491 | 65 | 3810 | 3859 | 29 | 74.6 |
| 豆包 | seed-tts-2.0 | zh_female_vv_uranus_bigtts | pcm | 16000 | 3 | 500 | 66 | 3752 | 3832 | 43 | 75.5 |
| 豆包 | seed-tts-2.0 | zh_female_vv_uranus_bigtts | pcm | 24000 | 3 | 510 | 65 | 3760 | 3783 | 50 | 76.3 |
| 豆包 | seed-tts-2.0 | zh_female_vv_uranus_bigtts | pcm | 48000 | 3 | 560 | 64 | 3770 | 3835 | 43 | 75.4 |
| 豆包 | seed-tts-2.0 | zh_female_vv_uranus_bigtts | ogg_opus | 8000 | 3 | 511 | 65 | 3733 | 3798 | 70 | 76.6 |
| 豆包 | seed-tts-2.0 | zh_female_vv_uranus_bigtts | ogg_opus | 16000 | 3 | 509 | 65 | 3740 | 3761 | 52 | 76.7 |
| 豆包 | seed-tts-2.0 | zh_female_vv_uranus_bigtts | ogg_opus | 24000 | 3 | 514 | 66 | 3810 | 3837 | 41 | 75.1 |
| 豆包 | seed-tts-2.0 | zh_female_vv_uranus_bigtts | ogg_opus | 48000 | 3 | 476 | 64 | 3631 | 3839 | 125 | 77.7 |
| MiniMax | speech-2.8-hd | male-qn-qingse | pcm | 8000 | 3 | 399 | 10 | 2496 | 2728 | 112 | 110.9 |
| MiniMax | speech-2.8-hd | male-qn-qingse | pcm | 16000 | 3 | 431 | 6 | 2533 | 2989 | 295 | 109.6 |
| MiniMax | speech-2.8-hd | male-qn-qingse | pcm | 22050 | 3 | 458 | 3 | 2203 | 2379 | 88 | 126.4 |
| MiniMax | speech-2.8-hd | male-qn-qingse | pcm | 24000 | 3 | 453 | 3 | 2281 | 3109 | 436 | 114.0 |
| MiniMax | speech-2.8-hd | male-qn-qingse | pcm | 32000 | 3 | 490 | 3 | 2781 | 2945 | 288 | 107.0 |
| MiniMax | speech-2.8-hd | male-qn-qingse | pcm | 44100 | 3 | 465 | 2 | 2323 | 2410 | 61 | 122.2 |
| MiniMax | speech-2.8-turbo | male-qn-qingse | pcm | 8000 | 3 | **374 🏆** | 8 | **1890 🏆** | **2051 🏆** | 88 | **147.8 🏆** |
| MiniMax | speech-2.8-turbo | male-qn-qingse | pcm | 16000 | 3 | 419 | 5 | 2528 | 2876 | 367 | 115.7 |
| MiniMax | speech-2.8-turbo | male-qn-qingse | pcm | 22050 | 3 | 386 | 3 | 2188 | 2298 | 80 | 129.8 |
| MiniMax | speech-2.8-turbo | male-qn-qingse | pcm | 24000 | 3 | 486 | 3 | 2483 | 2679 | 156 | 114.6 |
| MiniMax | speech-2.8-turbo | male-qn-qingse | pcm | 32000 | 3 | 395 | 2 | 2382 | 2453 | 169 | 123.9 |
| MiniMax | speech-2.8-turbo | male-qn-qingse | pcm | 44100 | 3 | 447 | 2 | 2398 | 2489 | 213 | 124.2 |
| MiniMax | speech-2.6-hd | male-qn-qingse | pcm | 8000 | 3 | 484 | 12 | 2552 | 2889 | 174 | 107.7 |
| MiniMax | speech-2.6-hd | male-qn-qingse | pcm | 16000 | 3 | 708 | 6 | 2824 | 3097 | 214 | 100.6 |
| MiniMax | speech-2.6-hd | male-qn-qingse | pcm | 22050 | 3 | 554 | 4 | 2581 | 3188 | 296 | 102.9 |
| MiniMax | speech-2.6-hd | male-qn-qingse | pcm | 24000 | 3 | 522 | 4 | 2799 | 2902 | 156 | 103.9 |
| MiniMax | speech-2.6-hd | male-qn-qingse | pcm | 32000 | 3 | 490 | 3 | 2526 | 2707 | 164 | 113.4 |
| MiniMax | speech-2.6-hd | male-qn-qingse | pcm | 44100 | 3 | 588 | 2 | 2821 | 2943 | 167 | 102.9 |
| MiniMax | speech-2.6-turbo | male-qn-qingse | pcm | 8000 | 3 | 479 | 9 | 2201 | 2225 | 53 | 131.0 |
| MiniMax | speech-2.6-turbo | male-qn-qingse | pcm | 16000 | 3 | 511 | 5 | 2203 | 2574 | 196 | 123.9 |
| MiniMax | speech-2.6-turbo | male-qn-qingse | pcm | 22050 | 3 | 458 | 4 | 2157 | 2740 | 318 | 124.0 |
| MiniMax | speech-2.6-turbo | male-qn-qingse | pcm | 24000 | 3 | 450 | 3 | 1990 | 2484 | 235 | 132.4 |
| MiniMax | speech-2.6-turbo | male-qn-qingse | pcm | 32000 | 3 | 526 | 3 | 2291 | 2415 | 86 | 123.7 |
| MiniMax | speech-2.6-turbo | male-qn-qingse | pcm | 44100 | 3 | 476 | 2 | 2037 | 2113 | 79 | 140.9 |
| MiniMax | speech-02-hd | male-qn-qingse | pcm | 8000 | 3 | 490 | 15 | 2680 | 3387 | 1141 | 126.5 |
| MiniMax | speech-02-hd | male-qn-qingse | pcm | 16000 | 3 | 497 | 6 | 2485 | 2625 | 90 | 113.7 |
| MiniMax | speech-02-hd | male-qn-qingse | pcm | 22050 | 3 | 519 | 4 | 2674 | 2795 | 154 | 108.3 |
| MiniMax | speech-02-hd | male-qn-qingse | pcm | 24000 | 3 | 528 | 4 | 2785 | 3025 | 116 | 99.6 |
| MiniMax | speech-02-hd | male-qn-qingse | pcm | 32000 | 3 | 610 | 3 | 2816 | 3432 | 303 | 94.8 |
| MiniMax | speech-02-hd | male-qn-qingse | pcm | 44100 | 3 | 555 | 2 | 2837 | 3231 | 197 | 96.5 |
| MiniMax | speech-02-turbo | male-qn-qingse | pcm | 8000 | 3 | 429 | 10 | 1979 | 2730 | 370 | 129.1 |
| MiniMax | speech-02-turbo | male-qn-qingse | pcm | 16000 | 3 | 456 | 5 | 2026 | 2761 | 431 | 131.0 |
| MiniMax | speech-02-turbo | male-qn-qingse | pcm | 22050 | 3 | 418 | 4 | 2563 | 2919 | 349 | 113.2 |
| MiniMax | speech-02-turbo | male-qn-qingse | pcm | 24000 | 3 | 862 | 4 | 2714 | 2877 | 277 | 109.4 |
| MiniMax | speech-02-turbo | male-qn-qingse | pcm | 32000 | 3 | 424 | 2 | 1995 | 2120 | 75 | 141.2 |
| MiniMax | speech-02-turbo | male-qn-qingse | pcm | 44100 | 3 | 436 | 2 | 2244 | 2815 | 270 | 117.1 |
| MiniMax | speech-01-hd | male-qn-qingse | pcm | 8000 | 3 | 484 | 10 | 2247 | 2306 | 30 | 125.9 |
| MiniMax | speech-01-hd | male-qn-qingse | pcm | 16000 | 3 | 505 | 6 | 2531 | 2559 | 46 | 113.4 |
| MiniMax | speech-01-hd | male-qn-qingse | pcm | 22050 | 3 | 464 | 4 | 2375 | 2483 | 227 | 125.5 |
| MiniMax | speech-01-hd | male-qn-qingse | pcm | 24000 | 3 | 538 | 4 | 2325 | 2856 | 266 | 114.8 |
| MiniMax | speech-01-hd | male-qn-qingse | pcm | 32000 | 3 | 590 | 3 | 2548 | 2634 | 143 | 114.3 |
| MiniMax | speech-01-hd | male-qn-qingse | pcm | 44100 | 3 | 592 | 2 | 2432 | 2509 | 136 | 119.9 |
| MiniMax | speech-01-turbo | male-qn-qingse | pcm | 8000 | 3 | 427 | 10 | 2146 | 2243 | 72 | 132.4 |
| MiniMax | speech-01-turbo | male-qn-qingse | pcm | 16000 | 3 | 516 | 4 | 1965 | 2055 | 59 | 144.1 |
| MiniMax | speech-01-turbo | male-qn-qingse | pcm | 22050 | 3 | 465 | 4 | 2088 | 2247 | 119 | 135.9 |
| MiniMax | speech-01-turbo | male-qn-qingse | pcm | 24000 | 3 | 471 | 3 | 2048 | 2201 | 74 | 135.9 |
| MiniMax | speech-01-turbo | male-qn-qingse | pcm | 32000 | 3 | 490 | 2 | 2101 | 2148 | 99 | 138.6 |
| MiniMax | speech-01-turbo | male-qn-qingse | pcm | 44100 | 3 | 448 | **2 🏆** | 1920 | 2100 | 99 | 145.2 |
| 智谱 GLM | glm-tts | tongtong | pcm | 24000 | 3 | 861 | *542* | 5037 | 5614 | 296 | 54.8 |
| 小米 Mimo | mimo-v2-tts | default_zh | pcm | 24000 | - | 未测试 | - | - | - | - | - |
| 科大讯飞 | super-human-tts | x5_lingxiaoxuan_flow | pcm | 8000 | 3 | 543 | 17 | 2704 | 2897 | 119 | 104.1 |
| 科大讯飞 | super-human-tts | x5_lingxiaoxuan_flow | pcm | 16000 | 3 | 511 | 17 | 2629 | 2721 | 51 | 107.5 |
| 科大讯飞 | super-human-tts | x5_lingxiaoxuan_flow | pcm | 24000 | 3 | 592 | 16 | 2690 | 2709 | **28 🏆** | 106.3 |

## ASR 性能指标

### 场景说明

| 场景 | 说明 |
|------|------|
| 流式入/流式出 | 实时音频流输入，实时识别结果输出 |
| 非流式入/非流式出 | 完整音频输入，完整结果返回 |
| 非流式入/流式出 | 完整音频输入，实时识别结果输出 |

> **注意**：标记 `*` 的场景使用 WebSocket 流式传输后聚合结果，并非原生非流式。

### 指标说明

| 指标 | 含义 | 计算方法 | 作用 |
|------|------|----------|------|
| 首包延迟 | 从发送请求到收到第一个识别结果的时间 | 所有测试首包延迟的平均值 | 反映 ASR 服务的响应速度 |
| 平均间隔 | 稳定状态下平均每个 chunk 的间隔时间 | (总耗时 - 首包延迟) / (chunk数 - 1) 的平均值 | 反映 ASR 服务吐识别结果的节奏 |
| P50 | 中位数，50% 请求低于此值 | 所有耗时排序后取中位数 | 反映典型请求的性能 |
| P95 | 95% 请求低于此值 | 所有耗时排序后取第95百分位 | 评估尾部延迟，了解最坏情况 |
| 标准差 | 延迟的离散程度 | 各耗时与平均值差值的平方的均值的平方根 | 值越小性能越稳定 |
| RTF | 实时因子，处理时间与音频时长的比值 | 处理耗时 / 音频时长 | 值越小效率越高，<1 表示快于实时 |
| 准确率 | 识别正确的字符比例 | 正确字符数 / 总字符数 | 值越高识别越准确 |
| CER | 字符错误率，需编辑操作的字符比例 | (替换+删除+插入) / 总字符数 | 值越低识别越准确 |

### 非流式入/流式出

| 服务商 | 模型 | 语言 | 输入格式 | 采样率 (Hz) | 测试次数 | 首包延迟 (ms) | 平均间隔 (ms) | P50 (ms) | P95 (ms) | 标准差 (ms) | RTF |
|--------|------|------|----------|-------------|----------|---------------|---------------|----------|----------|-------------|-----|
| 通义千问 | paraformer-realtime-v2 | zh-CN | pcm | 16000 | 3 | 978 | 82 | 685 | 2085 | *666* | *1.32* |
| 通义千问 | paraformer-realtime-v1 | zh-CN | pcm | 16000 | 3 | **439 🏆** | **29 🏆** | **498 🏆** | **509 🏆** | **10 🏆** | 0.57 |
| 豆包 | bigmodel | zh-CN | pcm | 16000 | 3 | 513 | 69 | 904 | 960 | 107 | 0.99 |
| 科大讯飞 | iat | zh-CN | pcm | 16000 | 3 | *1551* | *927* | *2835* | *2948* | 587 | **0.12 🏆** |

---

*数据更新于: 2026-04-09*

<!-- PERFORMANCE_TABLE_END -->

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
4. 导出 Provider 类

```typescript
// src/tts/providers/my-provider.ts
import { BaseTTS } from '@/tts/index';
import type { TTSOptions, TTSRequest, TTSResponse } from '@/types/tts';

export class MyTTS extends BaseTTS {
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
```

然后在 `src/tts/providers/index.ts` 中添加自动注册：

```typescript
import { MyTTS } from './my-provider';
import { registerTTSProvider } from '../index';

registerTTSProvider('my-provider', MyTTS);
```

### 项目结构

```
src/
├── index.ts           # 主入口，导出所有公开 API
├── tts/               # TTS 模块
│   ├── base.ts        # BaseTTS 抽象类
│   ├── factory.ts     # 工厂函数
│   ├── protocols/     # 协议实现
│   │   ├── volcengine.ts
│   │   ├── dashscope.ts
│   │   ├── dashscope-realtime.ts
│   │   ├── minimax.ts
│   │   └── xfyun.ts
│   ├── utils/         # 工具函数
│   │   ├── save.ts
│   │   ├── save-audio.ts
│   │   ├── collect.ts
│   │   ├── play.ts
│   │   └── tee.ts
│   └── providers/     # 提供商实现
│       ├── doubao.ts
│       ├── openai.ts
│       ├── minimax.ts
│       ├── qwen.ts
│       ├── qwen-realtime.ts
│       ├── gemini.ts
│       ├── glm.ts
│       └── xfyun.ts
├── asr/               # ASR 模块
│   ├── base.ts        # BaseASR 抽象类
│   ├── factory.ts     # 工厂函数
│   ├── protocols/     # 协议实现
│   │   ├── dashscope.ts
│   │   ├── sauc.ts
│   │   └── xfyun.ts
│   ├── utils/         # 工具函数
│   │   ├── audio.ts
│   │   ├── collect.ts
│   │   ├── save.ts
│   │   ├── ogg-muxer.ts
│   │   └── opus-decode.ts
│   └── providers/     # 提供商实现
│       ├── doubao.ts
│       ├── openai.ts
│       ├── minimax.ts
│       ├── qwen.ts
│       ├── gemini.ts
│       ├── glm.ts
│       └── xfyun.ts
└── types/             # 类型定义
    ├── index.ts
    ├── tts.ts
    ├── asr.ts
    ├── llm-stream.ts
    └── voices/
        ├── doubao.ts
        ├── minimax.ts
        ├── qwen.ts
        └── glm.ts
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
- [智谱 AI](https://open.bigmodel.cn/)
- [科大讯飞](https://www.xfyun.cn/)
