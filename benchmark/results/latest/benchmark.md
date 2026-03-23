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

> 生成时间: 2026/3/23 21:03:13

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
| 通义千问 | cosyvoice-v3-flash | longanyang | opus | 22050 | 3 | **544 🏆** | **1068 🏆** | **893 🏆** |
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

### 能力矩阵

| 提供商 | 协议 | 流式输入 | 流式输出 |
|--------|------|:--------:|:--------:|
| 通义千问 | WebSocket | ❌ | ✅ |

---

*数据更新于: 2026-03-23*