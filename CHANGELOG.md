# 更新日志

本文档记录项目的所有重要变更。

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
