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

#### TTS 能力矩阵

| 提供商 | 标识符 | 流式输入 | 一次性输入 | 流式输出 | 一次性输出 |
|--------|--------|----------|------------|----------|----------|
| 豆包（火山引擎） | `doubao` | ✅ | ✅ | ✅ | ✅ |
| 通义千问 | `qwen` | ✅ | ✅ | ✅ | ✅ |
| 智谱 GLM | `glm` | ❌ | ✅ | ✅ | ✅ |
| OpenAI | `openai` | 待实现 | 待实现 | 待实现 | 待实现 |
| MiniMax | `minimax` | ✅ | ✅ | ✅ | ✅ |
| Gemini | `gemini` | 待实现 | 待实现 | 待实现 | 待实现 |

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

> 生成时间: 2026/3/24 20:30:39

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
| 通义千问 | cosyvoice-v3-flash | longanyang | pcm | 16000 | 9 | 1323 | 69 | 9972 | 36205 | 14302 | 100.6 |
| 通义千问 | cosyvoice-v3-flash | longanyang | pcm | 24000 | 9 | 1648 | 53 | 10167 | 35128 | 13761 | 102.1 |
| 通义千问 | cosyvoice-v3-flash | longanyang | pcm | 48000 | 9 | 1268 | 23 | 9950 | 33574 | 13101 | 107.3 |
| 通义千问 | cosyvoice-v3-flash | longanyang | opus | 16000 | 9 | 1099 | 18 | 8377 | 32002 | 12885 | 113.8 |
| 通义千问 | cosyvoice-v3-flash | longanyang | opus | 24000 | 9 | 1164 | 19 | 9982 | 37679 | 14223 | 102.8 |
| 通义千问 | cosyvoice-v3-flash | longanyang | opus | 48000 | 9 | 1667 | 31 | 8859 | 33094 | 12642 | 103.2 |
| 通义千问 | cosyvoice-v3-plus | longanyang | pcm | 16000 | 9 | 1315 | 91 | 12061 | 42019 | 16883 | 84.9 |
| 通义千问 | cosyvoice-v3-plus | longanyang | pcm | 24000 | 9 | 1409 | 62 | 12277 | 40933 | 15378 | 89.9 |
| 通义千问 | cosyvoice-v3-plus | longanyang | pcm | 48000 | 9 | 1301 | 32 | *12575* | 44579 | 17147 | 84.3 |
| 通义千问 | cosyvoice-v3-plus | longanyang | opus | 16000 | 9 | 1277 | 24 | 12100 | 42431 | 16950 | 85.9 |
| 通义千问 | cosyvoice-v3-plus | longanyang | opus | 24000 | 9 | 1313 | 22 | 12084 | 42501 | 15077 | 103.3 |
| 通义千问 | cosyvoice-v3-plus | longanyang | opus | 48000 | 9 | 1143 | 25 | 10506 | 42858 | 13780 | 112.7 |
| 通义千问 | cosyvoice-v2 | longyingxiao | pcm | 16000 | 9 | 1799 | 73 | 10529 | *46054* | *17221* | 87.6 |
| 通义千问 | cosyvoice-v2 | longyingxiao | pcm | 24000 | 9 | 2045 | 52 | 10086 | 45010 | 16707 | 89.3 |
| 通义千问 | cosyvoice-v2 | longyingxiao | pcm | 48000 | 9 | 1924 | 26 | 9963 | 42351 | 14781 | 99.8 |
| 通义千问 | cosyvoice-v2 | longyingxiao | opus | 16000 | 9 | 1795 | 20 | 8961 | 41240 | 13542 | **121.1 🏆** |
| 通义千问 | cosyvoice-v2 | longyingxiao | opus | 24000 | 9 | 1731 | 17 | 9441 | 40290 | 15667 | 102.5 |
| 通义千问 | cosyvoice-v2 | longyingxiao | opus | 48000 | 9 | 1970 | 24 | 11013 | 41495 | 15189 | 91.8 |
| 通义千问 | cosyvoice-v1 | longwan | pcm | 16000 | 6 | 1149 | 41 | 1545 | 1694 | 228 | 25.1 |
| 通义千问 | cosyvoice-v1 | longwan | pcm | 24000 | 3 | 1214 | 5 | 1114 | 1607 | 240 | 14.2 |
| 通义千问 | cosyvoice-v1 | longwan | pcm | 48000 | 3 | 1074 | 25 | 1598 | 1601 | 24 | 11.4 |
| 通义千问 | cosyvoice-v3-flash | longanyang | pcm | 8000 | 3 | 1059 | 105 | 1591 | 1772 | 297 | 12.2 |
| 通义千问 | cosyvoice-v3-flash | longanyang | pcm | 22050 | 3 | 911 | 46 | 1572 | 1589 | 236 | 12.7 |
| 通义千问 | cosyvoice-v3-flash | longanyang | pcm | 44100 | 3 | 1207 | 19 | 1593 | 1979 | 311 | 11.3 |
| 通义千问 | cosyvoice-v3-flash | longanyang | opus | 8000 | 3 | 1058 | 19 | 1597 | 1609 | 12 | 11.3 |
| 通义千问 | cosyvoice-v3-flash | longanyang | opus | 22050 | 3 | **0 🏆** | **0 🏆** | 1009 | 1126 | 251 | 20.2 |
| 通义千问 | cosyvoice-v3-flash | longanyang | opus | 44100 | 3 | 0 | 0 | 1075 | 1135 | 30 | 16.5 |
| 通义千问 | cosyvoice-v3-plus | longanyang | pcm | 8000 | 3 | 1267 | 163 | 2054 | 2082 | 210 | 9.4 |
| 通义千问 | cosyvoice-v3-plus | longanyang | pcm | 22050 | 3 | 1407 | 50 | 2049 | 2127 | 189 | 9.2 |
| 通义千问 | cosyvoice-v3-plus | longanyang | pcm | 44100 | 3 | 1276 | 33 | 2080 | 2083 | 209 | 9.3 |
| 通义千问 | cosyvoice-v3-plus | longanyang | opus | 8000 | 3 | 1409 | 12 | 2089 | 2117 | 475 | 10.2 |
| 通义千问 | cosyvoice-v3-plus | longanyang | opus | 22050 | 3 | 0 | 0 | 1125 | 1391 | 253 | 16.4 |
| 通义千问 | cosyvoice-v3-plus | longanyang | opus | 44100 | 3 | 0 | 0 | 1586 | 1631 | 65 | 11.5 |
| 通义千问 | cosyvoice-v2 | longyingxiao | pcm | 8000 | 3 | *2292* | 115 | 2672 | 2970 | 157 | 6.5 |
| 通义千问 | cosyvoice-v2 | longyingxiao | pcm | 22050 | 3 | 1459 | 38 | 1795 | 2612 | 612 | 9.8 |
| 通义千问 | cosyvoice-v2 | longyingxiao | pcm | 44100 | 3 | 1738 | 29 | 2605 | 2628 | 457 | 7.8 |
| 通义千问 | cosyvoice-v2 | longyingxiao | opus | 8000 | 3 | 1913 | 14 | 2634 | 2655 | 497 | 7.8 |
| 通义千问 | cosyvoice-v2 | longyingxiao | opus | 22050 | 3 | 0 | 0 | 2077 | 2187 | 536 | 10.3 |
| 通义千问 | cosyvoice-v2 | longyingxiao | opus | 44100 | 3 | 0 | 0 | 2122 | 2129 | 5 | 8.5 |
| 通义千问 | cosyvoice-v1 | longwan | pcm | 8000 | 3 | 1135 | 114 | 1587 | 1604 | 10 | 11.3 |
| 通义千问 | cosyvoice-v1 | longwan | pcm | 22050 | 3 | 1047 | 22 | 1131 | 1538 | 208 | 14.4 |
| 通义千问 | cosyvoice-v1 | longwan | pcm | 44100 | 3 | 1079 | 20 | 1550 | 1624 | 208 | 12.5 |
| qwen-realtime | qwen3-tts-instruct-flash-realtime | Cherry | pcm | 8000 | 5 | 1054 | 93 | 1443 | 1799 | 307 | 20.5 |
| qwen-realtime | qwen3-tts-instruct-flash-realtime | Cherry | pcm | 16000 | 1 | 895 | 88 | 1159 | 1159 | **0 🏆** | 5.2 |
| qwen-realtime | qwen3-tts-instruct-flash-realtime | Cherry | pcm | 24000 | 1 | 1168 | 82 | 1497 | 1497 | 0 | 4.0 |
| qwen-realtime | qwen3-tts-instruct-flash-realtime | Cherry | pcm | 48000 | 1 | 713 | 149 | 1307 | 1307 | 0 | 4.6 |
| qwen-realtime | qwen3-tts-flash-realtime | Cherry | pcm | 8000 | 1 | 1406 | 10 | 1444 | 1444 | 0 | 4.2 |
| qwen-realtime | qwen3-tts-flash-realtime | Cherry | pcm | 16000 | 1 | 1033 | 13 | 1084 | 1084 | 0 | 5.5 |
| qwen-realtime | qwen3-tts-flash-realtime | Cherry | pcm | 24000 | 1 | 923 | 156 | 1546 | 1546 | 0 | 3.9 |
| qwen-realtime | qwen3-tts-flash-realtime | Cherry | pcm | 48000 | 1 | 1099 | 123 | 1591 | 1591 | 0 | *3.8* |
| qwen-realtime | qwen-tts-realtime | Cherry | pcm | 24000 | 5 | 1063 | 96 | 1433 | 1611 | 147 | 20.9 |
| qwen-realtime | qwen3-tts-instruct-flash-realtime | Cherry | opus | 8000 | 3 | 1153 | 24 | 1602 | 2014 | 198 | 10.4 |
| qwen-realtime | qwen3-tts-instruct-flash-realtime | Cherry | opus | 16000 | 3 | 876 | 18 | 1403 | 1592 | 304 | 14.0 |
| qwen-realtime | qwen3-tts-instruct-flash-realtime | Cherry | opus | 24000 | 3 | 1309 | 7 | 1507 | 1605 | 97 | 12.1 |
| qwen-realtime | qwen3-tts-instruct-flash-realtime | Cherry | opus | 48000 | 3 | 1059 | 11 | 1264 | 1814 | 396 | 13.8 |
| qwen-realtime | qwen3-tts-flash-realtime | Cherry | opus | 8000 | 3 | 1064 | 7 | 1238 | 1262 | 66 | 15.0 |
| qwen-realtime | qwen3-tts-flash-realtime | Cherry | opus | 16000 | 3 | 1024 | 6 | 1106 | 1517 | 259 | 15.4 |
| qwen-realtime | qwen3-tts-flash-realtime | Cherry | opus | 24000 | 3 | 808 | 7 | 1030 | 1134 | 161 | 18.5 |
| qwen-realtime | qwen3-tts-flash-realtime | Cherry | opus | 48000 | 3 | 841 | 6 | 1006 | 1081 | 96 | 18.4 |
| 豆包 | seed-tts-1.0 | zh_male_lengkugege_emo_v2_mars_bigtts | pcm | 8000 | 3 | 1334 | 56 | 1652 | 1970 | 379 | 11.5 |
| 豆包 | seed-tts-1.0 | zh_male_lengkugege_emo_v2_mars_bigtts | pcm | 16000 | 3 | 1841 | 18 | 2028 | 2102 | 219 | 9.4 |
| 豆包 | seed-tts-1.0 | zh_male_lengkugege_emo_v2_mars_bigtts | pcm | 24000 | 3 | 1124 | 86 | 1499 | 1527 | 183 | 13.0 |
| 豆包 | seed-tts-1.0 | zh_male_lengkugege_emo_v2_mars_bigtts | pcm | 48000 | 3 | 1537 | 22 | 1594 | 1685 | 43 | 11.1 |
| 豆包 | seed-tts-1.0 | zh_male_lengkugege_emo_v2_mars_bigtts | ogg_opus | 8000 | 3 | 1322 | 19 | 1531 | 1615 | 247 | 12.9 |
| 豆包 | seed-tts-1.0 | zh_male_lengkugege_emo_v2_mars_bigtts | ogg_opus | 16000 | 3 | 1022 | 59 | 1108 | 1524 | 199 | 14.5 |
| 豆包 | seed-tts-1.0 | zh_male_lengkugege_emo_v2_mars_bigtts | ogg_opus | 24000 | 3 | 1014 | 12 | 1081 | 1239 | 157 | 17.0 |
| 豆包 | seed-tts-1.0 | zh_male_lengkugege_emo_v2_mars_bigtts | ogg_opus | 48000 | 3 | 1051 | 50 | 1241 | 1603 | 285 | 14.4 |
| 豆包 | seed-tts-2.0 | zh_female_vv_uranus_bigtts | pcm | 8000 | 3 | 1125 | 62 | 1510 | 1522 | 205 | 13.1 |
| 豆包 | seed-tts-2.0 | zh_female_vv_uranus_bigtts | pcm | 16000 | 3 | 1050 | 126 | 1590 | 1656 | 50 | 11.3 |
| 豆包 | seed-tts-2.0 | zh_female_vv_uranus_bigtts | pcm | 24000 | 3 | 1064 | 127 | 1601 | 1647 | 253 | 12.5 |
| 豆包 | seed-tts-2.0 | zh_female_vv_uranus_bigtts | pcm | 48000 | 3 | 1178 | 62 | 1567 | 1569 | 204 | 12.6 |
| 豆包 | seed-tts-2.0 | zh_female_vv_uranus_bigtts | ogg_opus | 8000 | 3 | 990 | 56 | 1163 | 1543 | 252 | 14.8 |
| 豆包 | seed-tts-2.0 | zh_female_vv_uranus_bigtts | ogg_opus | 16000 | 3 | 999 | 42 | 1065 | 1466 | 216 | 15.4 |
| 豆包 | seed-tts-2.0 | zh_female_vv_uranus_bigtts | ogg_opus | 24000 | 3 | 1072 | 19 | 1094 | 1283 | 96 | 15.7 |
| 豆包 | seed-tts-2.0 | zh_female_vv_uranus_bigtts | ogg_opus | 48000 | 3 | 927 | 86 | 1221 | 1601 | 250 | 14.2 |
| 智谱 GLM | glm-tts | tongtong | pcm | 24000 | 3 | 1086 | *174* | 1074 | 1650 | 276 | 14.3 |
| MiniMax | speech-2.8-hd | male-qn-qingse | pcm | 8000 | 3 | 924 | 3 | 1027 | 1349 | 334 | 18.5 |
| MiniMax | speech-2.8-hd | male-qn-qingse | pcm | 16000 | 3 | 1204 | 8 | 1120 | 2082 | 469 | 12.7 |
| MiniMax | speech-2.8-hd | male-qn-qingse | pcm | 22050 | 3 | 1153 | 3 | 1144 | 1603 | 234 | 14.1 |
| MiniMax | speech-2.8-hd | male-qn-qingse | pcm | 24000 | 3 | 825 | 9 | 1525 | 1536 | 425 | 14.6 |
| MiniMax | speech-2.8-hd | male-qn-qingse | pcm | 32000 | 3 | 982 | 18 | 1600 | 2637 | 494 | 9.3 |
| MiniMax | speech-2.8-hd | male-qn-qingse | pcm | 44100 | 3 | 686 | 23 | 2035 | 3193 | 668 | 7.9 |
| MiniMax | speech-2.8-turbo | male-qn-qingse | pcm | 8000 | 3 | 1096 | 14 | 1298 | 1658 | 268 | 13.6 |
| MiniMax | speech-2.8-turbo | male-qn-qingse | pcm | 16000 | 3 | 894 | 4 | 953 | 1413 | 311 | 17.9 |
| MiniMax | speech-2.8-turbo | male-qn-qingse | pcm | 22050 | 3 | 1123 | 8 | 1571 | 1614 | 245 | 12.7 |
| MiniMax | speech-2.8-turbo | male-qn-qingse | pcm | 24000 | 3 | 850 | 9 | 1122 | 1549 | 225 | 14.6 |
| MiniMax | speech-2.8-turbo | male-qn-qingse | pcm | 32000 | 3 | 977 | 2 | 1078 | 1096 | 9 | 16.6 |
| MiniMax | speech-2.8-turbo | male-qn-qingse | pcm | 44100 | 3 | 981 | 6 | 1447 | 1807 | 279 | 12.3 |
| MiniMax | speech-2.6-hd | male-qn-qingse | pcm | 8000 | 3 | 985 | 17 | 1110 | 1414 | 158 | 15.1 |
| MiniMax | speech-2.6-hd | male-qn-qingse | pcm | 16000 | 3 | 781 | 4 | 976 | **1033 🏆** | 158 | 20.1 |
| MiniMax | speech-2.6-hd | male-qn-qingse | pcm | 22050 | 3 | 981 | 7 | 1092 | 1516 | 210 | 14.8 |
| MiniMax | speech-2.6-hd | male-qn-qingse | pcm | 24000 | 3 | 1073 | 14 | 1599 | 1601 | 7 | 11.3 |
| MiniMax | speech-2.6-hd | male-qn-qingse | pcm | 32000 | 3 | 1048 | 12 | 1618 | 1629 | 17 | 11.2 |
| MiniMax | speech-2.6-hd | male-qn-qingse | pcm | 44100 | 3 | 1020 | 8 | 1588 | 1607 | 24 | 11.4 |
| MiniMax | speech-2.6-turbo | male-qn-qingse | pcm | 8000 | 3 | 687 | 2 | **539 🏆** | 1072 | 252 | 25.1 |
| MiniMax | speech-2.6-turbo | male-qn-qingse | pcm | 16000 | 3 | 636 | 4 | 590 | 1038 | 215 | 24.5 |
| MiniMax | speech-2.6-turbo | male-qn-qingse | pcm | 22050 | 3 | 995 | 7 | 1100 | 1525 | 214 | 14.7 |
| MiniMax | speech-2.6-turbo | male-qn-qingse | pcm | 24000 | 3 | 1346 | 17 | 1152 | 3612 | 1171 | 9.2 |
| MiniMax | speech-2.6-turbo | male-qn-qingse | pcm | 32000 | 3 | 947 | 13 | 1118 | 2638 | 723 | 11.1 |
| MiniMax | speech-2.6-turbo | male-qn-qingse | pcm | 44100 | 3 | 954 | 18 | 1637 | 3159 | 739 | 8.5 |
| MiniMax | speech-02-hd | male-qn-qingse | pcm | 8000 | 3 | 968 | 7 | 1052 | 1079 | 21 | 17.1 |
| MiniMax | speech-02-hd | male-qn-qingse | pcm | 16000 | 3 | 984 | 11 | 1122 | 1669 | 283 | 14.1 |
| MiniMax | speech-02-hd | male-qn-qingse | pcm | 22050 | 3 | 968 | 3 | 1059 | 1103 | 46 | 17.1 |
| MiniMax | speech-02-hd | male-qn-qingse | pcm | 24000 | 3 | 978 | 7 | 1087 | 1496 | 198 | 14.8 |
| MiniMax | speech-02-hd | male-qn-qingse | pcm | 32000 | 3 | 1193 | 6 | 1112 | 2175 | 510 | 12.4 |
| MiniMax | speech-02-hd | male-qn-qingse | pcm | 44100 | 3 | 979 | 9 | 1549 | 1672 | 67 | 11.4 |
| MiniMax | speech-02-turbo | male-qn-qingse | pcm | 8000 | 3 | 674 | 3 | 557 | 1066 | 248 | 25.1 |
| MiniMax | speech-02-turbo | male-qn-qingse | pcm | 16000 | 3 | 668 | 3 | 557 | 1085 | 249 | 24.6 |
| MiniMax | speech-02-turbo | male-qn-qingse | pcm | 22050 | 3 | 974 | 3 | 1075 | 1096 | 11 | 16.7 |
| MiniMax | speech-02-turbo | male-qn-qingse | pcm | 24000 | 3 | 983 | 11 | 1511 | 1597 | 237 | 13.0 |
| MiniMax | speech-02-turbo | male-qn-qingse | pcm | 32000 | 3 | 1017 | 6 | 1090 | 1656 | 270 | 14.1 |
| MiniMax | speech-02-turbo | male-qn-qingse | pcm | 44100 | 3 | 1010 | 9 | 1622 | 1675 | 61 | 11.2 |
| MiniMax | speech-01-hd | male-qn-qingse | pcm | 8000 | 3 | 1021 | 16 | 1101 | 1468 | 173 | 14.7 |
| MiniMax | speech-01-hd | male-qn-qingse | pcm | 16000 | 3 | 996 | 12 | 1120 | 1567 | 229 | 14.5 |
| MiniMax | speech-01-hd | male-qn-qingse | pcm | 22050 | 3 | 957 | 3 | 1078 | 1499 | 354 | 16.8 |
| MiniMax | speech-01-hd | male-qn-qingse | pcm | 24000 | 3 | 1002 | 3 | 1083 | 1150 | 38 | 16.4 |
| MiniMax | speech-01-hd | male-qn-qingse | pcm | 32000 | 3 | 1153 | 9 | 1561 | 2015 | 376 | 11.6 |
| MiniMax | speech-01-hd | male-qn-qingse | pcm | 44100 | 3 | 1001 | 17 | 1634 | 3089 | 692 | 8.5 |
| MiniMax | speech-01-turbo | male-qn-qingse | pcm | 8000 | 3 | 1029 | 5 | 1091 | 1115 | 22 | 16.5 |
| MiniMax | speech-01-turbo | male-qn-qingse | pcm | 16000 | 3 | 1027 | 14 | 1500 | 1588 | 199 | 12.8 |
| MiniMax | speech-01-turbo | male-qn-qingse | pcm | 22050 | 3 | 991 | 3 | 1086 | 1093 | 20 | 16.7 |
| MiniMax | speech-01-turbo | male-qn-qingse | pcm | 24000 | 3 | 986 | 6 | 1063 | 1524 | 218 | 14.8 |
| MiniMax | speech-01-turbo | male-qn-qingse | pcm | 32000 | 3 | 1048 | 9 | 1591 | 1597 | 207 | 12.4 |
| MiniMax | speech-01-turbo | male-qn-qingse | pcm | 44100 | 3 | 748 | 2 | 920 | 1081 | 177 | 20.4 |

### 能力矩阵

| 提供商 | 协议 | 流式输入 | 流式输出 |
|--------|------|:--------:|:--------:|
| 通义千问 | WebSocket | ❌ | ✅ |
| qwen-realtime | Unknown | ❌ | ✅ |
| 豆包 | WebSocket | ❌ | ✅ |
| 智谱 GLM | HTTP | ❌ | ✅ |
| MiniMax | WebSocket | ❌ | ✅ |

---

*数据更新于: 2026-03-24*

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
- [智谱 AI](https://open.bigmodel.cn/)
