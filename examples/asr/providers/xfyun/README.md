# 科大讯飞 ASR 示例

科大讯飞 IAT（语音听写）服务示例代码，基于 WebSocket 实时语音识别。

## 目录结构

```
examples/asr/providers/xfyun/
├── stream-in-stream-out.ts    # 流式入/流式出（Opus 解码为 PCM）
└── README.md
```

## 快速开始

```bash
# 流式入/流式出（Opus 解码为 PCM）
npx tsx examples/asr/providers/xfyun/stream-in-stream-out.ts
```

## 环境变量

```bash
export XFYUN_APP_ID="your-app-id"
export XFYUN_API_KEY="your-api-key"
export XFYUN_API_SECRET="your-api-secret"
```

## 输入输出模式说明

### 流式入/流式出

**场景**: 实时音频流识别，如麦克风输入、实时通话

**特点**:
- 边发边收，实时返回识别片段
- 低延迟，适合交互场景
- 使用 Opus 数据包解码为 PCM（16kHz, 16bit, 单声道）模拟实时音频流
- 科大讯飞 IAT 使用 WebSocket 协议，音频时长不超过 60 秒

**API**:
```typescript
for await (const chunk of asr.listen(audioStream, { stream: true })) {
  console.log(chunk.text);
}
```

## 常见问题

### 1. 音频数据从哪里来？

示例代码使用 `examples/assets/16khz_opus_60ms_opus-packets` 目录中的 Opus 数据包，通过 `decodeOpusStream` 解码为 PCM 音频流。

### 2. 如何指定识别语言？

创建 ASR 实例时指定 `language` 参数：

```typescript
const asr = createASR({
  provider: 'xfyun',
  appId: 'your-app-id',
  apiKey: 'your-api-key',
  apiSecret: 'your-api-secret',
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
