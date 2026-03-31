# Doubao ASR 示例

火山引擎 ASR 服务示例代码，基于大模型语音识别。

## 目录结构

```
examples/asr/providers/doubao/
├── stream-in-stream-out.ts              # 流式入/流式出（Opus 解码为 PCM）
├── ogg-opus-stream-in-stream-out.ts     # 流式入/流式出（Ogg Opus 格式）
├── non-stream-in-non-stream-out.ts      # 非流式入/非流式出
└── README.md
```

## 快速开始

```bash
# 流式入/流式出（Opus 解码为 PCM）
npx tsx examples/asr/providers/doubao/stream-in-stream-out.ts

# 流式入/流式出（Ogg Opus 格式，无需本地解码）
npx tsx examples/asr/providers/doubao/ogg-opus-stream-in-stream-out.ts

# 非流式入/非流式出
npx tsx examples/asr/providers/doubao/non-stream-in-non-stream-out.ts
```

## 环境变量

```bash
export DOUBAO_APP_KEY="your-app-key"
export DOUBAO_ACCESS_TOKEN="your-access-token"
```

## 输入输出模式说明

### 流式入/流式出

**场景**: 实时音频流识别，如麦克风输入、实时通话

**特点**:
- 边发边收，实时返回识别片段
- 低延迟，适合交互场景
- 示例中使用 `mockAudioStream` 将音频文件模拟为流

**API**:
```typescript
for await (const chunk of asr.listen(audioStream, { stream: true })) {
  console.log(chunk.text);
}
```

### 非流式入/非流式出

**场景**: 离线音频文件处理

**特点**:
- 一次性返回完整识别结果
- 简单直接，适合批量处理
- 支持分段信息输出

**API**:
```typescript
const result = await asr.listen(audioPath);
console.log(result.text);
```

## 常见问题

### 1. 音频文件从哪里来？

示例代码使用 TTS 生成的音频文件。请先运行 TTS 示例：

```bash
npx tsx examples/tts/providers/doubao/basic.ts
```

这会在 `examples/output/` 目录下生成 `doubao-tts-demo.mp3` 文件。

### 2. 如何指定识别语言？

创建 ASR 实例时指定 `language` 参数：

```typescript
const asr = createASR({
  provider: 'doubao',
  appKey: 'your-app-key',
  accessKey: 'your-access-token',
  language: 'zh-CN', // 中文
});
```

### 3. 流式识别中 "中间结果" 和 "最终结果" 有什么区别？

- **中间结果**: 实时返回的识别片段，可能会随着更多音频输入而变化
- **最终结果**: 句子结束时的最终识别结果，不会再变化

示例输出：
```
[14:30:25.123] [中间] 欢迎
[14:30:25.234] [中间] 欢迎来到
[14:30:25.345] [最终] 欢迎来到杭州！
```
