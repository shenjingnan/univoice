# 更新日志

本文档记录项目的所有重要变更。

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
