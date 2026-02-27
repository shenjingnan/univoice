# univoice 项目指南

## 项目概述

**univoice** 是一个统一的 TTS（文字转语音）和 ASR（语音识别）SDK，支持多种语音服务提供商。

- **版本**: 0.0.1
- **许可证**: MIT
- **Node.js 版本**: >=20.0.0
- **包管理器**: pnpm 10.30.3

## 语言约定

本项目的核心维护者和主要使用者均为中国人，因此**优先使用中文**：

- **文档**: 中文
- **代码注释**: 中文
- **提交 PR 的标题和改动说明**: 中文
- **README 及各类说明文档**: 中文

使用中文能够更好地持续维护和迭代当前项目。

## 技术栈

| 技术 | 版本 |
|------|------|
| TypeScript | ^5.7.0 |
| Vitest | ^3.0.0 |
| Biome | ^1.9.0 |
| release-it | ^18.0.0 |

## 目录结构

```
src/
├── index.ts           # 主入口
├── tts/               # TTS 模块
│   ├── base.ts        # BaseTTS 抽象类
│   ├── factory.ts     # 工厂函数
│   ├── utils/         # 工具函数 (collect, play, save, tee)
│   └── providers/     # 提供商实现 (doubao, minimax, qwen, openai, gemini)
└── asr/               # ASR 模块
    ├── base.ts        # BaseASR 抽象类
    ├── factory.ts     # 工厂函数
    ├── utils/         # 工具函数 (collect, save)
    └── providers/     # 提供商实现 (doubao, minimax, qwen, openai, gemini)
types/                  # 类型定义
tests/                  # 测试文件
docs/                   # 文档站点 (Next.js)
examples/               # 示例代码
```

## 代码规范

### TypeScript 配置

- **目标**: ES2022
- **严格模式**: 启用
- **禁止 any**: `noImplicitAny: true`， Biome 规则 `noExplicitAny: error`

### Biome 配置

- **缩进**: 2 空格
- **行宽**: 100 字符
- **引号**: 单引号
- **尾随逗号**: es5

### 路径别名

- `@/*` → `src/*`
- `@/types/*` → ` 开发命令

```types/*`

##bash
# 构建
pnpm build

# 开发模式（监听）
pnpm dev

# 测试
pnpm test
pnpm test:run

# 代码检查
pnpm lint
pnpm lint:fix

# 格式化
pnpm format

# 拼写检查
pnpm spell

# 发布
pnpm release
pnpm release:dry
```

## 质量检查

在提交代码前，确保通过以下检查：

1. **类型检查**: `pnpm build` (tsc 编译)
2. **代码风格**: `pnpm lint`
3. **测试**: `pnpm test`

## 架构特点

- **工厂模式**: 使用工厂函数动态创建 TTS/ASR 提供商
- **插件化架构**: 通过 `registerTTSProvider` / `registerASRProvider` 注册新提供商
- **统一 API**: TTS 使用 `synthesize()`，ASR 使用 `recognize()`

## 可用技能

项目配置了以下 Claude Code 技能：

- **dev-workflow-checker**: 开发流程检查，确保代码修改后执行必要的质量检查
- **practical-development-validator**: 务实开发原则检查，避免过度设计
- **fix-audit**: 依赖安全审计

## TTS 提供商

支持以下 TTS 服务提供商：

- doubao
- minimax
- qwen
- openai
- gemini

## ASR 提供商

支持以下 ASR 服务提供商：

- doubao
- minimax
- qwen
- openai
- gemini
