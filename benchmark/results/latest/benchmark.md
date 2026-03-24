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

> 生成时间: 2026/3/24 17:30:32

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
| 通义千问 | cosyvoice-v3-flash | longanyang | opus | 22050 | 3 | **544 🏆** | 1068 | 893 |
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
| qwen-realtime | qwen3-tts-flash-realtime | Cherry | opus | 48000 | 3 | 1006 | 966 | 979 |
| 豆包 | seed-tts-1.0 | zh_male_lengkugege_emo_v2_mars_bigtts | pcm | 8000 | 3 | 1970 | 1354 | 1559 |
| 豆包 | seed-tts-1.0 | zh_male_lengkugege_emo_v2_mars_bigtts | pcm | 16000 | 3 | 2028 | 1853 | 1911 |
| 豆包 | seed-tts-1.0 | zh_male_lengkugege_emo_v2_mars_bigtts | pcm | 24000 | 3 | 1125 | 1513 | 1384 |
| 豆包 | seed-tts-1.0 | zh_male_lengkugege_emo_v2_mars_bigtts | pcm | 48000 | 3 | 1685 | 1593 | 1624 |
| 豆包 | seed-tts-1.0 | zh_male_lengkugege_emo_v2_mars_bigtts | ogg_opus | 8000 | 3 | 1615 | 1293 | 1400 |
| 豆包 | seed-tts-1.0 | zh_male_lengkugege_emo_v2_mars_bigtts | ogg_opus | 16000 | 3 | 1524 | 1103 | 1243 |
| 豆包 | seed-tts-1.0 | zh_male_lengkugege_emo_v2_mars_bigtts | ogg_opus | 24000 | 3 | 856 | 1160 | 1059 |
| 豆包 | seed-tts-1.0 | zh_male_lengkugege_emo_v2_mars_bigtts | ogg_opus | 48000 | 3 | 906 | 1422 | 1250 |
| 豆包 | seed-tts-2.0 | zh_female_vv_uranus_bigtts | pcm | 8000 | 3 | 1082 | 1516 | 1371 |
| 豆包 | seed-tts-2.0 | zh_female_vv_uranus_bigtts | pcm | 16000 | 3 | 1656 | 1562 | 1593 |
| 豆包 | seed-tts-2.0 | zh_female_vv_uranus_bigtts | pcm | 24000 | 3 | 1601 | 1368 | 1446 |
| 豆包 | seed-tts-2.0 | zh_female_vv_uranus_bigtts | pcm | 48000 | 3 | 1569 | 1352 | 1424 |
| 豆包 | seed-tts-2.0 | zh_female_vv_uranus_bigtts | ogg_opus | 8000 | 3 | 933 | 1353 | 1213 |
| 豆包 | seed-tts-2.0 | zh_female_vv_uranus_bigtts | ogg_opus | 16000 | 3 | 1065 | 1216 | 1165 |
| 豆包 | seed-tts-2.0 | zh_female_vv_uranus_bigtts | ogg_opus | 24000 | 3 | 1283 | 1081 | 1148 |
| 豆包 | seed-tts-2.0 | zh_female_vv_uranus_bigtts | ogg_opus | 48000 | 3 | 994 | 1411 | 1272 |
| 智谱 GLM | glm-tts | tongtong | pcm | 24000 | 3 | 1650 | 1065 | 1260 |
| MiniMax | speech-2.8-hd | male-qn-qingse | pcm | 8000 | 3 | 1349 | 782 | 971 |
| MiniMax | speech-2.8-hd | male-qn-qingse | pcm | 16000 | 3 | 1120 | 1570 | 1420 |
| MiniMax | speech-2.8-hd | male-qn-qingse | pcm | 22050 | 3 | 1144 | 1340 | 1274 |
| MiniMax | speech-2.8-hd | male-qn-qingse | pcm | 24000 | 3 | 1525 | 1083 | 1230 |
| MiniMax | speech-2.8-hd | male-qn-qingse | pcm | 32000 | 3 | 1600 | 2109 | 1939 |
| MiniMax | speech-2.8-hd | male-qn-qingse | pcm | 44100 | 3 | 2035 | 2403 | 2280 |
| MiniMax | speech-2.8-turbo | male-qn-qingse | pcm | 8000 | 3 | 1658 | 1151 | 1320 |
| MiniMax | speech-2.8-turbo | male-qn-qingse | pcm | 16000 | 3 | 1413 | 805 | 1007 |
| MiniMax | speech-2.8-turbo | male-qn-qingse | pcm | 22050 | 3 | 1074 | 1593 | 1420 |
| MiniMax | speech-2.8-turbo | male-qn-qingse | pcm | 24000 | 3 | 1549 | 1078 | 1235 |
| MiniMax | speech-2.8-turbo | male-qn-qingse | pcm | 32000 | 3 | 1075 | 1087 | 1083 |
| MiniMax | speech-2.8-turbo | male-qn-qingse | pcm | 44100 | 3 | 1124 | 1627 | 1459 |
| MiniMax | speech-2.6-hd | male-qn-qingse | pcm | 8000 | 3 | 1414 | 1083 | 1193 |
| MiniMax | speech-2.6-hd | male-qn-qingse | pcm | 16000 | 3 | 976 | 853 | 894 |
| MiniMax | speech-2.6-hd | male-qn-qingse | pcm | 22050 | 3 | 1092 | 1285 | 1220 |
| MiniMax | speech-2.6-hd | male-qn-qingse | pcm | 24000 | 3 | 1585 | 1600 | 1595 |
| MiniMax | speech-2.6-hd | male-qn-qingse | pcm | 32000 | 3 | 1618 | 1609 | 1612 |
| MiniMax | speech-2.6-hd | male-qn-qingse | pcm | 44100 | 3 | 1588 | 1579 | 1582 |
| MiniMax | speech-2.6-turbo | male-qn-qingse | pcm | 8000 | 3 | 1072 | **538 🏆** | **716 🏆** |
| MiniMax | speech-2.6-turbo | male-qn-qingse | pcm | 16000 | 3 | 590 | 806 | 734 |
| MiniMax | speech-2.6-turbo | male-qn-qingse | pcm | 22050 | 3 | 1100 | 1286 | 1224 |
| MiniMax | speech-2.6-turbo | male-qn-qingse | pcm | 24000 | 3 | 1152 | 2358 | 1956 |
| MiniMax | speech-2.6-turbo | male-qn-qingse | pcm | 32000 | 3 | 2638 | 1105 | 1616 |
| MiniMax | speech-2.6-turbo | male-qn-qingse | pcm | 44100 | 3 | 1637 | 2354 | 2115 |
| MiniMax | speech-02-hd | male-qn-qingse | pcm | 8000 | 3 | 1052 | 1054 | 1053 |
| MiniMax | speech-02-hd | male-qn-qingse | pcm | 16000 | 3 | 1669 | 1075 | 1273 |
| MiniMax | speech-02-hd | male-qn-qingse | pcm | 22050 | 3 | 991 | 1081 | 1051 |
| MiniMax | speech-02-hd | male-qn-qingse | pcm | 24000 | 3 | 1066 | 1292 | 1216 |
| MiniMax | speech-02-hd | male-qn-qingse | pcm | 32000 | 3 | 2175 | 1094 | 1454 |
| MiniMax | speech-02-hd | male-qn-qingse | pcm | 44100 | 3 | 1549 | 1594 | 1579 |
| MiniMax | speech-02-turbo | male-qn-qingse | pcm | 8000 | 3 | 1066 | 542 | 716 |
| MiniMax | speech-02-turbo | male-qn-qingse | pcm | 16000 | 3 | 556 | 821 | 733 |
| MiniMax | speech-02-turbo | male-qn-qingse | pcm | 22050 | 3 | 1096 | 1073 | 1081 |
| MiniMax | speech-02-turbo | male-qn-qingse | pcm | 24000 | 3 | 1057 | 1554 | 1388 |
| MiniMax | speech-02-turbo | male-qn-qingse | pcm | 32000 | 3 | 1656 | 1083 | 1274 |
| MiniMax | speech-02-turbo | male-qn-qingse | pcm | 44100 | 3 | 1622 | 1602 | 1608 |
| MiniMax | speech-01-hd | male-qn-qingse | pcm | 8000 | 3 | 1468 | 1101 | 1223 |
| MiniMax | speech-01-hd | male-qn-qingse | pcm | 16000 | 3 | 1567 | 1085 | 1246 |
| MiniMax | speech-01-hd | male-qn-qingse | pcm | 22050 | 3 | 1078 | 1066 | 1070 |
| MiniMax | speech-01-hd | male-qn-qingse | pcm | 24000 | 3 | 1083 | 1105 | 1098 |
| MiniMax | speech-01-hd | male-qn-qingse | pcm | 32000 | 3 | 2015 | 1328 | 1557 |
| MiniMax | speech-01-hd | male-qn-qingse | pcm | 44100 | 3 | 1607 | 2362 | 2110 |
| MiniMax | speech-01-turbo | male-qn-qingse | pcm | 8000 | 3 | 1062 | 1103 | 1089 |
| MiniMax | speech-01-turbo | male-qn-qingse | pcm | 16000 | 3 | 1500 | 1359 | 1406 |
| MiniMax | speech-01-turbo | male-qn-qingse | pcm | 22050 | 3 | 1086 | 1071 | 1076 |
| MiniMax | speech-01-turbo | male-qn-qingse | pcm | 24000 | 3 | 1062 | 1294 | 1216 |
| MiniMax | speech-01-turbo | male-qn-qingse | pcm | 32000 | 3 | 1591 | 1376 | 1448 |
| MiniMax | speech-01-turbo | male-qn-qingse | pcm | 44100 | 3 | 1081 | 786 | 884 |

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