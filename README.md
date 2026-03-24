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
>
> 如需评估服务商的真实性能，建议直接使用服务商官方 SDK 进行测试。

> 生成时间: 2026/3/24 13:22:19

> 环境: Node.js v24.14.0, darwin arm64

## TTS 性能指标

### 场景说明

| 场景 | 说明 |
|------|------|
| 非流式入/流式出 | 完整文本输入，实时音频流输出 |
| 非流式入/非流式出 | 完整文本输入，完整音频返回 |

### 非流式入/流式出

| 服务商 | 模型 | 音色 | 编码格式 | 采样率 (Hz) | 测试次数 | 首次耗时 (ms) | 平均耗时 (ms) | 总耗时 (ms) |
|--------|------|------|----------|-------------|----------|---------------|---------------|------------|
| 通义千问 | cosyvoice-v3-flash | longanyang | pcm | 16000 | 9 | 1551 | 17447 | 15681 |
| 通义千问 | cosyvoice-v3-flash | longanyang | pcm | 24000 | 9 | 1603 | 17194 | 15462 |
| 通义千问 | cosyvoice-v3-flash | longanyang | pcm | 48000 | 9 | 1179 | 16402 | 14711 |
| 通义千问 | cosyvoice-v3-flash | longanyang | opus | 16000 | 9 | 1957 | 15360 | 13871 |
| 通义千问 | cosyvoice-v3-flash | longanyang | opus | 24000 | 9 | 1165 | 17117 | 15344 |
| 通义千问 | cosyvoice-v3-flash | longanyang | opus | 48000 | 9 | *8859* | 16094 | 15290 |
| 通义千问 | cosyvoice-v3-plus | longanyang | pcm | 16000 | 9 | 2064 | 20647 | 18582 |
| 通义千问 | cosyvoice-v3-plus | longanyang | pcm | 24000 | 9 | 2064 | 19485 | 17549 |
| 通义千问 | cosyvoice-v3-plus | longanyang | pcm | 48000 | 9 | 2126 | *20800* | *18725* |
| 通义千问 | cosyvoice-v3-plus | longanyang | opus | 16000 | 9 | 1646 | 20467 | 18376 |
| 通义千问 | cosyvoice-v3-plus | longanyang | opus | 24000 | 9 | 1613 | 16992 | 15283 |
| 通义千问 | cosyvoice-v3-plus | longanyang | opus | 48000 | 9 | 2089 | 15492 | 14003 |
| 通义千问 | cosyvoice-v2 | longyingxiao | pcm | 16000 | 9 | 2589 | 19942 | 18014 |
| 通义千问 | cosyvoice-v2 | longyingxiao | pcm | 24000 | 9 | 2637 | 19554 | 17674 |
| 通义千问 | cosyvoice-v2 | longyingxiao | pcm | 48000 | 9 | 1694 | 17572 | 15807 |
| 通义千问 | cosyvoice-v2 | longyingxiao | opus | 16000 | 9 | 2505 | 14346 | 13030 |
| 通义千问 | cosyvoice-v2 | longyingxiao | opus | 24000 | 9 | 2654 | 16996 | 15402 |
| 通义千问 | cosyvoice-v2 | longyingxiao | opus | 48000 | 9 | 2597 | 19006 | 17183 |
| 通义千问 | cosyvoice-v1 | longwan | pcm | 16000 | 6 | 1694 | 1383 | 1435 |
| 通义千问 | cosyvoice-v1 | longwan | pcm | 24000 | 3 | 1114 | 1346 | 1269 |
| 通义千问 | cosyvoice-v1 | longwan | pcm | 48000 | 3 | 1598 | 1575 | 1583 |
| 通义千问 | cosyvoice-v3-flash | longanyang | pcm | 8000 | 3 | 1772 | 1331 | 1478 |
| 通义千问 | cosyvoice-v3-flash | longanyang | pcm | 22050 | 3 | 1080 | 1581 | 1414 |
| 通义千问 | cosyvoice-v3-flash | longanyang | pcm | 44100 | 3 | 1593 | 1599 | 1597 |
| 通义千问 | cosyvoice-v3-flash | longanyang | opus | 8000 | 3 | 1609 | 1588 | 1595 |
| 通义千问 | cosyvoice-v3-flash | longanyang | opus | 22050 | 3 | **544 🏆** | 1068 | **893 🏆** |
| 通义千问 | cosyvoice-v3-flash | longanyang | opus | 44100 | 3 | 1070 | 1105 | 1093 |
| 通义千问 | cosyvoice-v3-plus | longanyang | pcm | 8000 | 3 | 2054 | 1853 | 1920 |
| 通义千问 | cosyvoice-v3-plus | longanyang | pcm | 22050 | 3 | 2127 | 1871 | 1956 |
| 通义千问 | cosyvoice-v3-plus | longanyang | pcm | 44100 | 3 | 2083 | 1860 | 1934 |
| 通义千问 | cosyvoice-v3-plus | longanyang | opus | 8000 | 3 | 2117 | 1592 | 1767 |
| 通义千问 | cosyvoice-v3-plus | longanyang | opus | 22050 | 3 | 1125 | 1082 | 1096 |
| 通义千问 | cosyvoice-v3-plus | longanyang | opus | 44100 | 3 | 1477 | 1609 | 1565 |
| 通义千问 | cosyvoice-v2 | longyingxiao | pcm | 8000 | 3 | 2672 | 2791 | 2751 |
| 通义千问 | cosyvoice-v2 | longyingxiao | pcm | 22050 | 3 | 1795 | 1863 | 1840 |
| 通义千问 | cosyvoice-v2 | longyingxiao | pcm | 44100 | 3 | 2605 | 2138 | 2294 |
| 通义千问 | cosyvoice-v2 | longyingxiao | opus | 8000 | 3 | 1591 | 2645 | 2293 |
| 通义千问 | cosyvoice-v2 | longyingxiao | opus | 22050 | 3 | 2077 | 1593 | 1754 |
| 通义千问 | cosyvoice-v2 | longyingxiao | opus | 44100 | 3 | 2122 | 2124 | 2123 |
| 通义千问 | cosyvoice-v1 | longwan | pcm | 8000 | 3 | 1579 | 1596 | 1590 |
| 通义千问 | cosyvoice-v1 | longwan | pcm | 22050 | 3 | 1070 | 1335 | 1246 |
| 通义千问 | cosyvoice-v1 | longwan | pcm | 44100 | 3 | 1624 | 1350 | 1441 |
| qwen-realtime | qwen3-tts-instruct-flash-realtime | Cherry | pcm | 8000 | 5 | 1799 | 1379 | 1463 |
| qwen-realtime | qwen3-tts-instruct-flash-realtime | Cherry | pcm | 16000 | 1 | 1159 | 1159 | 1159 |
| qwen-realtime | qwen3-tts-instruct-flash-realtime | Cherry | pcm | 24000 | 1 | 1497 | 1497 | 1497 |
| qwen-realtime | qwen3-tts-instruct-flash-realtime | Cherry | pcm | 48000 | 1 | 1307 | 1307 | 1307 |
| qwen-realtime | qwen3-tts-flash-realtime | Cherry | pcm | 8000 | 1 | 1444 | 1444 | 1444 |
| qwen-realtime | qwen3-tts-flash-realtime | Cherry | pcm | 16000 | 1 | 1084 | 1084 | 1084 |
| qwen-realtime | qwen3-tts-flash-realtime | Cherry | pcm | 24000 | 1 | 1546 | 1546 | 1546 |
| qwen-realtime | qwen3-tts-flash-realtime | Cherry | pcm | 48000 | 1 | 1591 | 1591 | 1591 |
| qwen-realtime | qwen-tts-realtime | Cherry | pcm | 24000 | 5 | 1227 | 1487 | 1435 |
| qwen-realtime | qwen3-tts-instruct-flash-realtime | Cherry | opus | 8000 | 3 | 2014 | 1594 | 1734 |
| qwen-realtime | qwen3-tts-instruct-flash-realtime | Cherry | opus | 16000 | 3 | 1592 | 1138 | 1289 |
| qwen-realtime | qwen3-tts-instruct-flash-realtime | Cherry | opus | 24000 | 3 | 1507 | 1487 | 1494 |
| qwen-realtime | qwen3-tts-instruct-flash-realtime | Cherry | opus | 48000 | 3 | 1264 | 1331 | 1308 |
| qwen-realtime | qwen3-tts-flash-realtime | Cherry | opus | 8000 | 3 | 1238 | 1187 | 1204 |
| qwen-realtime | qwen3-tts-flash-realtime | Cherry | opus | 16000 | 3 | 1517 | 999 | 1172 |
| qwen-realtime | qwen3-tts-flash-realtime | Cherry | opus | 24000 | 3 | 752 | 1082 | 972 |
| qwen-realtime | qwen3-tts-flash-realtime | Cherry | opus | 48000 | 3 | 1006 | **966 🏆** | 979 |

### 能力矩阵

| 提供商 | 协议 | 流式输入 | 流式输出 |
|--------|------|:--------:|:--------:|
| 通义千问 | WebSocket | ❌ | ✅ |
| qwen-realtime | Unknown | ❌ | ✅ |

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
