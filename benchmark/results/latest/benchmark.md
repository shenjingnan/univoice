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

> 生成时间: 2026/3/23 20:20:09

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
| 通义千问 | cosyvoice-v1 | longwan | pcm | 24000 | 3 | **1114 🏆** | **1346 🏆** | **1269 🏆** |
| 通义千问 | cosyvoice-v1 | longwan | pcm | 48000 | 3 | 1598 | 1575 | 1583 |

### 能力矩阵

| 提供商 | 协议 | 流式输入 | 流式输出 |
|--------|------|:--------:|:--------:|
| 通义千问 | WebSocket | ❌ | ✅ |

---

*数据更新于: 2026-03-23*