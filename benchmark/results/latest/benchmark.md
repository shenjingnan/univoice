# Univoice 性能基准测试报告

> 生成时间: 2026/3/23 16:07:24

> 环境: Node.js v24.14.0, darwin arm64

## TTS 性能指标

### 场景说明

| 场景 | 说明 |
|------|------|
| 流式入/流式出 | 实时文本流输入，实时音频流输出 |
| 流式入/流式出（普通文本） | 实时文本流输入（普通文本），实时音频流输出 |
| 非流式入/非流式出 | 完整文本输入，完整音频返回 |
| 非流式入/流式出 | 完整文本输入，实时音频流输出 |

### 综合性能指标

| TTS | 场景 | 协议 | 首次耗时 | 平均耗时 | 平均每字符延迟 | 成功率 |
|-----|------|------|---------|---------|---------------|--------|
| 通义千问 | matrix | WebSocket | 1551 | 1867 | N/A | 100% |
| 通义千问 | matrix | WebSocket | 9927 | 9982 | N/A | 100% |
| 通义千问 | matrix | WebSocket | 36205 | 34875 | N/A | 100% |
| 通义千问 | matrix | WebSocket | 1603 | 2014 | N/A | 100% |
| 通义千问 | matrix | WebSocket | 10167 | 10211 | N/A | 100% |
| 通义千问 | matrix | WebSocket | 34191 | 34374 | N/A | 100% |
| 通义千问 | matrix | WebSocket | 1179 | 1784 | N/A | 100% |
| 通义千问 | matrix | WebSocket | 9892 | 10023 | N/A | 100% |
| 通义千问 | matrix | WebSocket | 33027 | 32342 | N/A | 100% |
| 通义千问 | matrix | WebSocket | 1957 | **1367 🏆** | N/A | 100% |
| 通义千问 | matrix | WebSocket | 8360 | 8408 | N/A | 100% |
| 通义千问 | matrix | WebSocket | 31817 | 31577 | N/A | 100% |
| 通义千问 | matrix | WebSocket | **1165 🏆** | 1805 | N/A | 100% |
| 通义千问 | matrix | WebSocket | 10499 | 9198 | N/A | 100% |
| 通义千问 | matrix | WebSocket | 32049 | 36190 | N/A | 100% |
| 通义千问 | matrix | WebSocket | 8859 | 1856 | N/A | 100% |
| 通义千问 | matrix | WebSocket | 8426 | 9204 | N/A | 100% |
| 通义千问 | matrix | WebSocket | 33016 | 32595 | N/A | 100% |
| 通义千问 | matrix | WebSocket | 2064 | 2073 | N/A | 100% |
| 通义千问 | matrix | WebSocket | 11574 | 12071 | N/A | 100% |
| 通义千问 | matrix | WebSocket | 41973 | 41671 | N/A | 100% |
| 通义千问 | matrix | WebSocket | 2064 | 1884 | N/A | 100% |
| 通义千问 | matrix | WebSocket | 12985 | 12126 | N/A | 100% |
| 通义千问 | matrix | WebSocket | 39859 | 37508 | N/A | 100% |
| 通义千问 | matrix | WebSocket | 2126 | 1586 | N/A | 100% |
| 通义千问 | matrix | WebSocket | 11556 | 12595 | N/A | 100% |
| 通义千问 | matrix | WebSocket | 41009 | 42738 | N/A | 100% |
| 通义千问 | matrix | WebSocket | 1646 | 1824 | N/A | 100% |
| 通义千问 | matrix | WebSocket | 12100 | 11558 | N/A | 100% |
| 通义千问 | matrix | WebSocket | 41479 | 41698 | N/A | 100% |
| 通义千问 | matrix | WebSocket | 1613 | 1817 | N/A | 100% |
| 通义千问 | matrix | WebSocket | 12155 | 11798 | N/A | 100% |
| 通义千问 | matrix | WebSocket | 41946 | 27303 | N/A | 100% |
| 通义千问 | matrix | WebSocket | 2089 | 1624 | N/A | 100% |
| 通义千问 | matrix | WebSocket | 12008 | 11296 | N/A | 100% |
| 通义千问 | matrix | WebSocket | 33702 | 26194 | N/A | 100% |
| 通义千问 | matrix | WebSocket | 2589 | 1855 | N/A | 100% |
| 通义千问 | matrix | WebSocket | 10529 | 10284 | N/A | 100% |
| 通义千问 | matrix | WebSocket | *46054* | 39338 | N/A | 100% |
| 通义千问 | matrix | WebSocket | 2637 | 1859 | N/A | 100% |
| 通义千问 | matrix | WebSocket | 9483 | 10764 | N/A | 100% |
| 通义千问 | matrix | WebSocket | 35232 | *43235* | N/A | 100% |
| 通义千问 | matrix | WebSocket | 1694 | 2847 | N/A | 100% |
| 通义千问 | matrix | WebSocket | 9981 | 9128 | N/A | 100% |
| 通义千问 | matrix | WebSocket | 42351 | 32145 | N/A | 100% |
| 通义千问 | matrix | WebSocket | 2505 | 2637 | N/A | 100% |
| 通义千问 | matrix | WebSocket | 8961 | 10747 | N/A | 100% |
| 通义千问 | matrix | WebSocket | 41240 | 18900 | N/A | 100% |
| 通义千问 | matrix | WebSocket | 2654 | 1864 | N/A | 100% |
| 通义千问 | matrix | WebSocket | 9441 | 5830 | N/A | 100% |
| 通义千问 | matrix | WebSocket | 40290 | 35425 | N/A | 100% |
| 通义千问 | matrix | WebSocket | 2597 | 2913 | N/A | 100% |
| 通义千问 | matrix | WebSocket | 11013 | 10500 | N/A | 100% |
| 通义千问 | matrix | WebSocket | 37284 | 38465 | N/A | 100% |

### 能力矩阵

| 提供商 | 协议 | 流式输入 | 流式输出 |
|--------|------|:--------:|:--------:|
| 通义千问 | WebSocket | ❌ | ❌ |

---

*数据更新于: 2026-03-23*