# 更新日志

本文档记录项目的所有重要变更。

## [0.7.0](https://github.com/shenjingnan/univoice/compare/v0.6.0...v0.7.0) (2026-04-03)

### Features

* **asr:** 内置 Opus 音频转换能力，新增 decodeOpusStream 和 createOggMuxer ([#205](https://github.com/shenjingnan/univoice/issues/205)) ([c8c268b](https://github.com/shenjingnan/univoice/commit/c8c268b14a80762a9e6a83b3a607fc9d0f87a87d))
* **asr:** 支持 ASR 连接预建立，降低首次识别延迟 ([#242](https://github.com/shenjingnan/univoice/issues/242)) ([48458b0](https://github.com/shenjingnan/univoice/commit/48458b00c130a33f359069f7855afa89eb5dbfdc))
* **asr:** 新增 Doubao ASR 连接预建立示例 ([#243](https://github.com/shenjingnan/univoice/issues/243)) ([1d4ba4a](https://github.com/shenjingnan/univoice/commit/1d4ba4a092127706ada24dd380b5c46a57fd77ea))
* **benchmark:** 增强性能指标统计，添加 P50/P95/标准差/吞吐量 ([#185](https://github.com/shenjingnan/univoice/issues/185)) ([d5bf22c](https://github.com/shenjingnan/univoice/commit/d5bf22c2dda25be47e9636c84205be7fcdaa29f5))
* **benchmark:** 新增 GLM ASR 矩阵测试并修复 PCM 格式兼容性 ([#202](https://github.com/shenjingnan/univoice/issues/202)) ([6a4d934](https://github.com/shenjingnan/univoice/commit/6a4d93426054bfe8b8d7ec7a2bca24fe4870ada7))
* **benchmark:** 更新基准测试结果并增强性能指标统计 ([#188](https://github.com/shenjingnan/univoice/issues/188)) ([cc0cfb2](https://github.com/shenjingnan/univoice/commit/cc0cfb2637843e16dd0ab875f0d80c1655031eb5))
* **benchmark:** 添加 ASR 矩阵基准测试支持 ([#194](https://github.com/shenjingnan/univoice/issues/194)) ([183a934](https://github.com/shenjingnan/univoice/commit/183a934a14c1e9b1ce5fded78e6dfeedcd0d42c1))
* **benchmark:** 添加 MiniMax TTS 矩阵基准测试支持 ([#184](https://github.com/shenjingnan/univoice/issues/184)) ([c146bb1](https://github.com/shenjingnan/univoice/commit/c146bb128b0ecffdc3c62b62e4f7933ac62eefa7))
* **benchmark:** 添加 Qwen Realtime TTS 基准测试支持 ([#179](https://github.com/shenjingnan/univoice/issues/179)) ([3b55f64](https://github.com/shenjingnan/univoice/commit/3b55f6467ddec6cf3ab074c9a1f860fc9b6034eb))
* **benchmark:** 添加 Qwen TTS cosyvoice-v1 模型基准测试支持 ([#176](https://github.com/shenjingnan/univoice/issues/176)) ([9e7ab00](https://github.com/shenjingnan/univoice/commit/9e7ab00a9347452be12ec633237eaddd0706970c))
* **benchmark:** 添加 Qwen TTS v3 系列模型基准测试支持 ([#177](https://github.com/shenjingnan/univoice/issues/177)) ([f2b37c6](https://github.com/shenjingnan/univoice/commit/f2b37c6ab91e1151ce301fec8957b5d196b284f4))
* **benchmark:** 添加 Qwen TTS 矩阵测试场景支持 ([#172](https://github.com/shenjingnan/univoice/issues/172)) ([0713e31](https://github.com/shenjingnan/univoice/commit/0713e3164f8461017f3a0aef8abf26ded8cc9051))
* **benchmark:** 添加智谱 GLM TTS 基准测试支持 ([#183](https://github.com/shenjingnan/univoice/issues/183)) ([8b70b1a](https://github.com/shenjingnan/univoice/commit/8b70b1a9912b634e4a15425a772880f9e35982b3))
* **benchmark:** 添加豆包 TTS 基准测试支持 ([#182](https://github.com/shenjingnan/univoice/issues/182)) ([5d9bb95](https://github.com/shenjingnan/univoice/commit/5d9bb9598dba0e118c9884cf1ace5d1f698aa956))
* **benchmark:** 重构基准测试架构并添加 ASR 准确率指标 ([#164](https://github.com/shenjingnan/univoice/issues/164)) ([1849362](https://github.com/shenjingnan/univoice/commit/1849362f305940ba36097af96c387287c7e62e86))
* **doubao:** 为 DoubaoTTS 的 voice 参数添加 IDE 自动补全支持 ([#240](https://github.com/shenjingnan/univoice/issues/240)) ([4564aa2](https://github.com/shenjingnan/univoice/commit/4564aa2d4a0fd8a6bf0a9645c2e0bb897d0148aa))
* **example:** 新增 Doubao seed-tts-1.0 直接实例化示例 ([#221](https://github.com/shenjingnan/univoice/issues/221)) ([aa5c168](https://github.com/shenjingnan/univoice/commit/aa5c168d6efa8f6ded4699e05536261c3e4c7642))
* **example:** 新增 GLM ASR 直接实例化示例 ([#212](https://github.com/shenjingnan/univoice/issues/212)) ([1529e07](https://github.com/shenjingnan/univoice/commit/1529e07be75274bc2aa4177b4e8d2d600df55cbf))
* **example:** 新增 GLM TTS 直接实例化示例 ([#223](https://github.com/shenjingnan/univoice/issues/223)) ([09f30e6](https://github.com/shenjingnan/univoice/commit/09f30e62f10e26ab9c69b9a38557d49e8908bd34))
* **example:** 新增 MiniMax speech-2.8-hd 直接实例化示例 ([#225](https://github.com/shenjingnan/univoice/issues/225)) ([0781ef2](https://github.com/shenjingnan/univoice/commit/0781ef244a778194c4b9828ace8ba52c6d374592))
* **example:** 新增 Minimax TTS 直接实例化示例 ([#226](https://github.com/shenjingnan/univoice/issues/226)) ([198db45](https://github.com/shenjingnan/univoice/commit/198db450cbb521ed2dd10021745c9a9f5d69844a))
* **example:** 新增 Paraformer Realtime 8k v1 直接实例化示例，使用 Opus 数据包 ([#216](https://github.com/shenjingnan/univoice/issues/216)) ([#216](https://github.com/shenjingnan/univoice/issues/216)) ([a167a77](https://github.com/shenjingnan/univoice/commit/a167a7749cdc399f8fc5f8d831b4170ddcbbbcc5))
* **example:** 新增 Paraformer Realtime v1 直接实例化示例，使用 Opus 数据包 ([#215](https://github.com/shenjingnan/univoice/issues/215)) ([7d174d2](https://github.com/shenjingnan/univoice/commit/7d174d215506118c04d5b331598a79638b1a83a9))
* **example:** 新增 Qwen ASR 直接实例化示例，使用 Opus 数据包 ([#214](https://github.com/shenjingnan/univoice/issues/214)) ([18a544d](https://github.com/shenjingnan/univoice/commit/18a544deb4654bb4f1f5fd37db30e97229f467c0))
* **example:** 新增 Qwen CosyVoice v1/v3-flash/v3-plus 直接实例化示例 ([#232](https://github.com/shenjingnan/univoice/issues/232)) ([a0efde7](https://github.com/shenjingnan/univoice/commit/a0efde744d2af1d8442f20915709b98a3d545ca6))
* **example:** 新增 Qwen CosyVoice v2 直接实例化示例 ([#230](https://github.com/shenjingnan/univoice/issues/230)) ([665504c](https://github.com/shenjingnan/univoice/commit/665504c8ee8a5c4fce47638e0f4389d7a5e12d87))
* **example:** 新增 Qwen Realtime TTS 直接实例化示例 ([#234](https://github.com/shenjingnan/univoice/issues/234)) ([ac53f58](https://github.com/shenjingnan/univoice/commit/ac53f585b26046bc126e59885e69577d8ae377d8))
* **glm:** 为 GlmTTS 的 voice 参数添加 IDE 自动补全支持 ([#239](https://github.com/shenjingnan/univoice/issues/239)) ([2e32105](https://github.com/shenjingnan/univoice/commit/2e32105a722977c8054d1ca0b4763f226d714fc2))
* **lint-staged:** 扩展配置支持 JSON 文件并添加 lint 检查 ([#173](https://github.com/shenjingnan/univoice/issues/173)) ([44b3d0f](https://github.com/shenjingnan/univoice/commit/44b3d0fabafc806521001ae29da565ada5e821dd))
* **minimax:** 为 MinimaxTTS 的 voice 参数添加 IDE 自动补全支持 ([#238](https://github.com/shenjingnan/univoice/issues/238)) ([2f9e4b0](https://github.com/shenjingnan/univoice/commit/2f9e4b01fd9e7389b2b77622103310322206a5be))
* **qwen-realtime:** 为 QwenRealtimeTTS 的 voice 参数添加 IDE 自动补全支持 ([#237](https://github.com/shenjingnan/univoice/issues/237)) ([6914438](https://github.com/shenjingnan/univoice/commit/69144383c11991e2fa142bdd8bd63352596d3129))
* **tts:** 为 Qwen CosyVoice 添加音色类型定义及文档 ([#229](https://github.com/shenjingnan/univoice/issues/229)) ([d4c2333](https://github.com/shenjingnan/univoice/commit/d4c2333892282852edbb0d97952b0469d7137f7f))
* **tts:** 新增 Doubao TTS 连接预建立 API 及示例 ([#245](https://github.com/shenjingnan/univoice/issues/245)) ([0c86595](https://github.com/shenjingnan/univoice/commit/0c86595e76c6bbe11fd5797919463acba4dcb5d0))
* **tts:** 新增 TTS 连接预建立 API ([#244](https://github.com/shenjingnan/univoice/issues/244)) ([253e187](https://github.com/shenjingnan/univoice/commit/253e1875644c23ccc95cce633d6b1b2bb5008ff2))
* **tts:** 添加 Qwen 实时语音合成支持 ([#178](https://github.com/shenjingnan/univoice/issues/178)) ([3c242e3](https://github.com/shenjingnan/univoice/commit/3c242e33500210a163443d3eb47d5c73ae674801))

### Bug Fixes

* **asr:** 修复裸 PCM 音频处理失败问题，新增 doubao ASR 矩阵测试 ([#201](https://github.com/shenjingnan/univoice/issues/201)) ([3780ac3](https://github.com/shenjingnan/univoice/commit/3780ac36f86235adaf78cfc9d3760945ccf4493f))
* **doubao:** 统一环境变量命名为 DOUBAO_ACCESS_TOKEN ([#181](https://github.com/shenjingnan/univoice/issues/181)) ([843f58f](https://github.com/shenjingnan/univoice/commit/843f58f42407e638d7a1155cdc28d0771b226e51))
* **examples:** 修复 Qwen TTS PCM 示例模型与音色不兼容问题 ([#171](https://github.com/shenjingnan/univoice/issues/171)) ([7cf6a8d](https://github.com/shenjingnan/univoice/commit/7cf6a8d223eb72b5c4b5de651d28388ae4f378b0))
* **tts:** 修复 CosyVoice v2 流式合成音频数据为 0 的问题 ([#228](https://github.com/shenjingnan/univoice/issues/228)) ([8ce8135](https://github.com/shenjingnan/univoice/commit/8ce813518f9b9e117c023258a560256b4711b853))
* **tts:** 修复 Doubao seed-tts-2.0 示例 voice 参数与服务端 resourceId 不匹配 ([#218](https://github.com/shenjingnan/univoice/issues/218)) ([5a031fe](https://github.com/shenjingnan/univoice/commit/5a031fe43516ed77a39e74fcbf4d8dc55a7cc77b))
* **tts:** 修复 Qwen CosyVoice voice 属性 IDE 自动补全失效的问题 ([#231](https://github.com/shenjingnan/univoice/issues/231)) ([28a0536](https://github.com/shenjingnan/univoice/commit/28a053672b3e5075b780ec6ccb71b2257aea071c))
* 修复依赖安全漏洞 (lodash 代码注入/原型污染, xmldom XML 注入) ([#249](https://github.com/shenjingnan/univoice/issues/249)) ([84bac67](https://github.com/shenjingnan/univoice/commit/84bac67eb6cea3d7f59de94faa5fd17a661aea45))

### Code Refactoring

* **benchmark:** 使用 execFileSync 替代 execSync 提升安全性 ([#170](https://github.com/shenjingnan/univoice/issues/170)) ([a69ccda](https://github.com/shenjingnan/univoice/commit/a69ccdace807cef6664cc8dd56da052f3091d756))
* **benchmark:** 简化矩阵配置文件格式并优化格式化规则 ([#193](https://github.com/shenjingnan/univoice/issues/193)) ([5292575](https://github.com/shenjingnan/univoice/commit/529257542e66442f3a17d0f7a4bf3dc9343c1dc4))
* **benchmark:** 统一使用包名路径导入 univoice 模块 ([#200](https://github.com/shenjingnan/univoice/issues/200)) ([d148543](https://github.com/shenjingnan/univoice/commit/d1485433db93b396a6de317ed2c60f20c06f8610))
* **benchmark:** 重构延迟指标计算方式，改用原始时间戳 ([#186](https://github.com/shenjingnan/univoice/issues/186)) ([dad820a](https://github.com/shenjingnan/univoice/commit/dad820afdc0444e5f44d0caa2782027d185e53a3))
* **benchmark:** 重构矩阵数据结构与加载机制 ([#189](https://github.com/shenjingnan/univoice/issues/189)) ([460874d](https://github.com/shenjingnan/univoice/commit/460874d01588b003292b7da3f55883738aa6a0f0))
* **ci:** 简化发布流程，移除 PR-based 模式 ([#252](https://github.com/shenjingnan/univoice/issues/252)) ([38653ca](https://github.com/shenjingnan/univoice/commit/38653caf13734653d6807b658ba6fe87b92fd096))
* **examples:** 提取项目根目录定位方法，修复 opus 数据包路径引用 ([#204](https://github.com/shenjingnan/univoice/issues/204)) ([87d2b6c](https://github.com/shenjingnan/univoice/commit/87d2b6c45cc20e8e93c2610a21944f146fe4a1af))
* **examples:** 重构 Qwen TTS 示例代码结构 ([#198](https://github.com/shenjingnan/univoice/issues/198)) ([83adbaa](https://github.com/shenjingnan/univoice/commit/83adbaa9e45f0e08ed4f1a9a44534850b8649a14))
* **examples:** 重构示例代码目录结构 ([#197](https://github.com/shenjingnan/univoice/issues/197)) ([2fc9b45](https://github.com/shenjingnan/univoice/commit/2fc9b45837778c7cd646e1f145b6aab4036b247d))
* **example:** 提取 readOpusPackets 到共享工具模块，消除重复代码 ([#208](https://github.com/shenjingnan/univoice/issues/208)) ([b57db84](https://github.com/shenjingnan/univoice/commit/b57db84519fa525ef030df3dcc91ea71fdd96c7d))
* **example:** 移除 Doubao ASR 示例中冗余的 audioFormat 配置 ([#207](https://github.com/shenjingnan/univoice/issues/207)) ([7fcb00d](https://github.com/shenjingnan/univoice/commit/7fcb00d8f726a4753f83b21cab6591a2c92393d6))
* **example:** 重构 mockLLMStream 函数签名，支持自定义输入文本 ([#219](https://github.com/shenjingnan/univoice/issues/219)) ([0b4c21d](https://github.com/shenjingnan/univoice/commit/0b4c21d99d55cbbd2ad6f60b5e592e36d3900639))
* **types:** 为 ASR/TTS Provider 定义专属 Options 类型，实现类型安全路由 ([#209](https://github.com/shenjingnan/univoice/issues/209)) ([1530156](https://github.com/shenjingnan/univoice/commit/1530156585f934a72f7d273db9cfd0e46ad1ca1b))

### Documentation

* **asr:** 新增 Doubao ASR 直接实例化 Opus 流式识别示例 ([#206](https://github.com/shenjingnan/univoice/issues/206)) ([ad51b6c](https://github.com/shenjingnan/univoice/commit/ad51b6c95db2033336637ffe7941f1830a576447))
* **asr:** 新增智谱 GLM ASR 使用指南文档 ([#213](https://github.com/shenjingnan/univoice/issues/213)) ([0ced11a](https://github.com/shenjingnan/univoice/commit/0ced11a3ef17a19e4997f833b99b77e5082a19fb))
* **asr:** 新增豆包 ASR 使用指南文档 ([#210](https://github.com/shenjingnan/univoice/issues/210)) ([35d572e](https://github.com/shenjingnan/univoice/commit/35d572eca299fcbe612dbec09fbfe22839fab854))
* **asr:** 新增通义千问 ASR 使用指南文档 ([#217](https://github.com/shenjingnan/univoice/issues/217)) ([3f04ae1](https://github.com/shenjingnan/univoice/commit/3f04ae1e117c3625f8dc0fadd04e3e342e0f60eb))
* **examples:** 统一为 ffplay 命令添加 -autoexit 参数 ([#220](https://github.com/shenjingnan/univoice/issues/220)) ([b3d47df](https://github.com/shenjingnan/univoice/commit/b3d47df7875ca0a1be5daaa060d2875c937b1243))
* **glm:** 新增 GlmTTS SDK 使用指南文档 ([#224](https://github.com/shenjingnan/univoice/issues/224)) ([35fa1a4](https://github.com/shenjingnan/univoice/commit/35fa1a426aa6f0446a7998759f96a1de90624434))
* **qwen:** 新增 QwenRealtimeTTS 使用指南文档 ([#235](https://github.com/shenjingnan/univoice/issues/235)) ([311e8e7](https://github.com/shenjingnan/univoice/commit/311e8e7d70ef391da7b2c0892c902b50c0c1b4b2))
* **qwen:** 新增 QwenTTS 使用指南文档 ([#233](https://github.com/shenjingnan/univoice/issues/233)) ([ba60a27](https://github.com/shenjingnan/univoice/commit/ba60a27eef3e4beda648b8ab55e7390c52ec1fe2))
* **readme:** 修复性能表格格式 ([#180](https://github.com/shenjingnan/univoice/issues/180)) ([7507dc8](https://github.com/shenjingnan/univoice/commit/7507dc894896ad41c410892bae5bdfe09b64faf5))
* **tts:** 新增 DoubaoTTS 使用指南文档 ([#222](https://github.com/shenjingnan/univoice/issues/222)) ([52ad11d](https://github.com/shenjingnan/univoice/commit/52ad11d0578735687ceb26a677e3fd001bfa8f42))
* 新增豆包、MiniMax、千问语音合成相关文档 ([#241](https://github.com/shenjingnan/univoice/issues/241)) ([c8b4b70](https://github.com/shenjingnan/univoice/commit/c8b4b709b334710305b026d7bfff18f533c5c33a))

# [0.6.0](https://github.com/shenjingnan/univoice/compare/v0.5.0...v0.6.0) (2026-03-19)


### Bug Fixes

* **deps:** 修复 tar 和 undici 安全漏洞 ([#153](https://github.com/shenjingnan/univoice/issues/153)) ([3ec2ec8](https://github.com/shenjingnan/univoice/commit/3ec2ec8f57b3d6bdb5acf5e938f428cc124b67f8))
* **lint-staged:** 修复 pre-commit hook typecheck 问题 ([#158](https://github.com/shenjingnan/univoice/issues/158)) ([9f134b3](https://github.com/shenjingnan/univoice/commit/9f134b3a3ddcd4dc08cb7adb577b16fefe364c66))
* **tts:** 修复 Minimax WebSocket 连接生命周期处理 ([#161](https://github.com/shenjingnan/univoice/issues/161)) ([764341b](https://github.com/shenjingnan/univoice/commit/764341b46bfe0eda5bc1c1efafb04fc1b95eb101))


### Features

* **tts:** 实现 Minimax TTS 提供商 ([#154](https://github.com/shenjingnan/univoice/issues/154)) ([8c6f26f](https://github.com/shenjingnan/univoice/commit/8c6f26f3c989a821fe5a3e3870e81fbdac42e01a))

# [0.5.0](https://github.com/shenjingnan/univoice/compare/v0.4.1...v0.5.0) (2026-03-18)


### Features

* **asr:** 实现 Qwen ASR WebSocket 实时语音识别 ([#140](https://github.com/shenjingnan/univoice/issues/140)) ([b8a9403](https://github.com/shenjingnan/univoice/commit/b8a9403c79cc4c8d9cbcca6443d3c01ce622c5c2))
* **asr:** 添加智谱 GLM ASR 提供商支持 ([#144](https://github.com/shenjingnan/univoice/issues/144)) ([f541513](https://github.com/shenjingnan/univoice/commit/f5415133d7b8adc70299abdf6cf8fced5f4cb323))
* **example:** 添加 Qwen ASR 流式音频输入示例 ([#142](https://github.com/shenjingnan/univoice/issues/142)) ([21c0b66](https://github.com/shenjingnan/univoice/commit/21c0b66b13a3f1b31890f64e20f2793d96d6e846))
* **tts:** 添加智谱 GLM TTS 提供商支持 ([#148](https://github.com/shenjingnan/univoice/issues/148)) ([ba1a11d](https://github.com/shenjingnan/univoice/commit/ba1a11d5ff5eeac5dbb8be6488f8e78fa1f6b10c))

## [0.4.1](https://github.com/shenjingnan/univoice/compare/v0.4.0...v0.4.1) (2026-03-17)

# [0.4.0](https://github.com/shenjingnan/univoice/compare/v0.3.0...v0.4.0) (2026-03-17)


### Bug Fixes

* **tts:** 修复 Qwen TTS 流式输出卡住的问题 ([#132](https://github.com/shenjingnan/univoice/issues/132)) ([1e6f26b](https://github.com/shenjingnan/univoice/commit/1e6f26bb0f53db24431f25c718ca3e491bc0ef69))


### Features

* **asr:** 支持可配置的音频格式和编码 ([#128](https://github.com/shenjingnan/univoice/issues/128)) ([5f752cc](https://github.com/shenjingnan/univoice/commit/5f752ccda892ce0e4e8ee013d82355bf4d0bd597))
* **tts:** 实现 Qwen TTS 基于 WebSocket 的语音合成 ([#131](https://github.com/shenjingnan/univoice/issues/131)) ([0cef446](https://github.com/shenjingnan/univoice/commit/0cef446cf7e33e2c92761066825dc65b3d78e539))
* **tts:** 实现 Qwen TTS 流式输入的边发边收 ([#134](https://github.com/shenjingnan/univoice/issues/134)) ([b33bd8a](https://github.com/shenjingnan/univoice/commit/b33bd8aa39f6d6b8d1a213b44383fd097e001f25))

# [0.3.0](https://github.com/shenjingnan/univoice/compare/v0.3.0-beta.1...v0.3.0) (2026-03-14)

# [0.3.0-beta.1](https://github.com/shenjingnan/univoice/compare/v0.3.0-beta.0...v0.3.0-beta.1) (2026-03-14)

# [0.3.0-beta.0](https://github.com/shenjingnan/univoice/compare/v0.2.0...v0.3.0-beta.0) (2026-03-14)


### Features

* **asr:** 将 Doubao ASR 默认模式改为 streaming ([#108](https://github.com/shenjingnan/univoice/issues/108)) ([2b7cbd1](https://github.com/shenjingnan/univoice/commit/2b7cbd195508c3b266e2d70af2a4a4de6c9a0f98))
* **asr:** 支持流式和非流式两种识别模式 ([#96](https://github.com/shenjingnan/univoice/issues/96)) ([5ce74f6](https://github.com/shenjingnan/univoice/commit/5ce74f68723b7d99c22314b934acb98ba942a7f1))
* **examples:** 添加 ASR listen 流式和非流式模式示例 ([#106](https://github.com/shenjingnan/univoice/issues/106)) ([5be0f12](https://github.com/shenjingnan/univoice/commit/5be0f12cd3b820901c02fbfd8c954fcb597a0fe0))
* **examples:** 添加 OGG 到 Opus 数据包转换示例 ([#110](https://github.com/shenjingnan/univoice/issues/110)) ([612c90e](https://github.com/shenjingnan/univoice/commit/612c90ee52c4867c245287b5cd348355abea83eb))
* **examples:** 添加 OGG 文件 ASR 识别示例 ([#116](https://github.com/shenjingnan/univoice/issues/116)) ([9b9bc67](https://github.com/shenjingnan/univoice/commit/9b9bc67269cd790942c58b8e1bf31b9371bcec8c))
* **examples:** 添加 Opus 数据包合并为 OGG 文件功能 ([#119](https://github.com/shenjingnan/univoice/issues/119)) ([78d6a97](https://github.com/shenjingnan/univoice/commit/78d6a97e55c347f3b9ee39bfc9d96a14aeab4b50))
* **examples:** 添加 Opus 数据包转 ASR 示例 ([#112](https://github.com/shenjingnan/univoice/issues/112)) ([d63f456](https://github.com/shenjingnan/univoice/commit/d63f4569468caf14d5d3b329e778e6a312daf943))
* **tts:** 重构 speak 方法支持流式/非流式统一接口 ([#103](https://github.com/shenjingnan/univoice/issues/103)) ([091725d](https://github.com/shenjingnan/univoice/commit/091725dd738eb03eadfb162614ad38ae54c9bbcc))
* 支持 Tree-Shaking 按需加载 ([#107](https://github.com/shenjingnan/univoice/issues/107)) ([e282244](https://github.com/shenjingnan/univoice/commit/e282244a12c63ac246b81b8795a64f1d9c27651a))

# [0.2.0](https://github.com/shenjingnan/univoice/compare/v0.1.0...v0.2.0) (2026-03-11)


### Bug Fixes

* **deps:** 修复 lodash 安全漏洞并升级 release-it ([#91](https://github.com/shenjingnan/univoice/issues/91)) ([3901a2f](https://github.com/shenjingnan/univoice/commit/3901a2ff7d491d6fbc3ad669fd8695ab40351498))


### Features

* **asr:** streamFrom 支持音频文件路径输入 ([#87](https://github.com/shenjingnan/univoice/issues/87)) ([11a63fb](https://github.com/shenjingnan/univoice/commit/11a63fb1dec26da882b656ca1109762fc2bed67f))
* **asr:** 实现豆包 ASR 提供商 ([#78](https://github.com/shenjingnan/univoice/issues/78)) ([8f9c723](https://github.com/shenjingnan/univoice/commit/8f9c7232fe2d45c617fdc439c74f4d26a9eebff7))
* **asr:** 添加 stream 流式识别方法 ([#80](https://github.com/shenjingnan/univoice/issues/80)) ([74fb883](https://github.com/shenjingnan/univoice/commit/74fb883e59f97d9be6f2ddaa5337841c29f14dd8))
* **asr:** 添加 streamFrom 流式输入识别方法 ([#83](https://github.com/shenjingnan/univoice/issues/83)) ([cc21c3a](https://github.com/shenjingnan/univoice/commit/cc21c3afd20aa1f1aa670a59a7f62834a3e57006))
* **examples:** 添加 TTS 流式分块保存示例 ([#81](https://github.com/shenjingnan/univoice/issues/81)) ([9aa23cf](https://github.com/shenjingnan/univoice/commit/9aa23cf49b31399cbc6534f8fa03c11dcd0a05e1))

# [0.1.1](https://github.com/shenjingnan/univoice/compare/v0.1.0...v0.1.1) (2026-03-11)


### Refactor

* **asr:** 将 streamFrom 方法重命名为 listen ([#94](https://github.com/shenjingnan/univoice/issues/94)) ([xxxxxxx](https://github.com/shenjingnan/univoice/commit/xxxxxxx))
  - 将 ASR 模块中的 `streamFrom` 方法重命名为 `listen`
  - 更新所有提供商实现、测试文件和示例代码
  - 更新 README 文档中的 API 说明

# [0.1.0](https://github.com/shenjingnan/univoice/compare/v0.1.0-beta.4...v0.1.0) (2026-03-06)


### Features

* **examples:** 为 OpenAI 流式示例添加输出保存功能 ([#64](https://github.com/shenjingnan/univoice/issues/64)) ([1f12b71](https://github.com/shenjingnan/univoice/commit/1f12b7127e2c6686e7e8a2b636c89c87fb611db3))
* **examples:** 添加 OpenAI SDK 流式请求示例 ([#60](https://github.com/shenjingnan/univoice/issues/60)) ([18dde3a](https://github.com/shenjingnan/univoice/commit/18dde3aa16ac42898a48e89a4f0b307340b461d7))
* **tts:** streamFrom 方法支持字符串输入 ([#56](https://github.com/shenjingnan/univoice/issues/56)) ([7b0a497](https://github.com/shenjingnan/univoice/commit/7b0a497d698f11122a1670a035851cbe5a1980af))
* **tts:** streamFrom 方法返回 AsyncIterable ([#57](https://github.com/shenjingnan/univoice/issues/57)) ([d60f772](https://github.com/shenjingnan/univoice/commit/d60f772b9f9479fc9915721363c4b093715f9479))
* **tts:** 支持 OpenAI 流式输出直接转换为语音 ([#65](https://github.com/shenjingnan/univoice/issues/65)) ([a8da10f](https://github.com/shenjingnan/univoice/commit/a8da10f708b814eb2bf5667fe74d3d693f2e42e3))
* **tts:** 添加 TTS 流式输入 API ([#55](https://github.com/shenjingnan/univoice/issues/55)) ([42eb4e5](https://github.com/shenjingnan/univoice/commit/42eb4e5079ca86e2efa7dc59d34dd14057000028))
* **tts:** 添加 TTS 流式输出功能 ([#53](https://github.com/shenjingnan/univoice/issues/53)) ([29b5eb1](https://github.com/shenjingnan/univoice/commit/29b5eb1781d29b9728ac153829af76f8fb366c8f))

# [0.1.0-beta.4](https://github.com/shenjingnan/univoice/compare/v0.1.0-beta.3...v0.1.0-beta.4) (2026-03-04)

# [0.1.0-beta.3](https://github.com/shenjingnan/univoice/compare/v0.1.0-beta.2...v0.1.0-beta.3) (2026-03-04)

# Changelog

All notable changes to this project will be documented in this file.

# [0.1.0-beta.2](https://github.com/shenjingnan/univoice/compare/v0.1.0-beta.1...v0.1.0-beta.2) (2026-03-04)

# [0.1.0-beta.1](https://github.com/shenjingnan/univoice/compare/v0.1.0-beta.0...v0.1.0-beta.1) (2026-03-04)


### Bug Fixes

* 合并工作流解决 publish.yml 未触发问题 ([f613e2b](https://github.com/shenjingnan/univoice/commit/f613e2b43c3df677ba367209ddd030d7c3c387ac))

# 0.1.0-beta.0 (2026-03-03)


### Bug Fixes

* 修复 Dependabot 包管理工具配置 ([#22](https://github.com/shenjingnan/univoice/issues/22)) ([885c206](https://github.com/shenjingnan/univoice/commit/885c20661700d2cf4c803b52379be0279d263916))
* 修复 Dependabot 配置 ([#20](https://github.com/shenjingnan/univoice/issues/20)) ([f1ca88e](https://github.com/shenjingnan/univoice/commit/f1ca88e7117b85bf85f8331bf6cc936af451e038))
* 修复 Dependabot 配置格式 ([#21](https://github.com/shenjingnan/univoice/issues/21)) ([02edfe4](https://github.com/shenjingnan/univoice/commit/02edfe46f2a6cff576442206f3a1ee4fa2935b46))


### Features

* disable any type to improve type safety ([#6](https://github.com/shenjingnan/univoice/issues/6)) ([89afd28](https://github.com/shenjingnan/univoice/commit/89afd28051cf8a7c87f2e060f9ddf8b9fbc08398))
* initialize UniVoice project with TTS and ASR modules ([6dc1324](https://github.com/shenjingnan/univoice/commit/6dc1324aa9fa567849a8bb6c1c0730fc1b8b312c))
* **tts:** 实现火山引擎 WebSocket 双向流式 TTS 协议 ([#35](https://github.com/shenjingnan/univoice/issues/35)) ([6d1b5c5](https://github.com/shenjingnan/univoice/commit/6d1b5c5e6dc4b1fc53f1c308edc62635cbbf2303))
* 使用 tsup 替换 tsc 打包方案 ([#33](https://github.com/shenjingnan/univoice/issues/33)) ([de561f9](https://github.com/shenjingnan/univoice/commit/de561f97a5a25ec7933fa037a375db06cbac16ef))
* 完善发布流程支持自动化 NPM 发布 ([#38](https://github.com/shenjingnan/univoice/issues/38)) ([c16b275](https://github.com/shenjingnan/univoice/commit/c16b27537c0bbebc5413f7decd9a4dfe74e489f1))
