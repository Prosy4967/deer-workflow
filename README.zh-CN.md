# deer-workflow

[English: README](./README.md) ·
[Guide](./docs/index.md) ·
[API](./docs/api.md) |
[简体中文：README](./README.zh-CN.md) ·
[快速入门](./docs/index.zh-CN.md) ·
[API](./docs/api.zh-CN.md)

[![Bun](https://img.shields.io/badge/runtime-Bun-f9f1e1?logo=bun&logoColor=000000)](https://bun.sh)
[![TypeScript](https://img.shields.io/badge/language-TypeScript-3178c6?logo=typescript&logoColor=ffffff)](https://www.typescriptlang.org)
[![Codex CLI](https://img.shields.io/badge/default_agent-Codex_CLI-000000?logo=openai&logoColor=ffffff)](https://github.com/openai/codex)
[![DeerFlow Stars](https://img.shields.io/github/stars/bytedance/deer-flow?label=DeerFlow%20Stars&logo=github)](https://github.com/bytedance/deer-flow)
[![GitHub Stars](https://img.shields.io/github/stars/deer-flow/deer-workflow?style=flat&logo=github)](https://github.com/deer-flow/deer-workflow)

一个开源的 Dynamic Workflow Runtime：用确定性的 TypeScript 编排组织可替换的
Agent Runtime。

`deer-workflow` 是 **DeerFlow 3.0**（即 **DeerWork**）的试点项目。发布包名为
`@deer-flow/workflow`，命令行名称为 `deer-workflow`。

## 目录

- [如何使用](#如何使用)
- [如何开发](#如何开发)

## 如何使用

### 前置条件

安装 [Bun](https://bun.sh) 和
[Codex CLI](https://github.com/openai/codex)，然后登录：

```bash
npm install -g @openai/codex
codex login
codex --version
```

Codex CLI 与 Codex Desktop 是两个独立安装。安装 Desktop 应用不会同时安装
终端中的 `codex` 命令。

### 从源码试用

安装仓库依赖：

```bash
bun install
```

通过内联 JSON Input 运行一个 Workflow：

```bash
bun run dev -- run ./src/examples/deep-research/workflow.ts \
  --input '{"question":"Agent Skills 与 Dynamic Workflows 正在如何演进？"}'
```

全局安装包之后，可以直接使用命令行：

```bash
deer-workflow run ./workflow.ts --input '{"question":"你的问题"}'
```

### 示例

运行 [Deep Research](./src/examples/deep-research/README.zh-CN.md)：

```bash
bun run dev -- run ./src/examples/deep-research/workflow.ts \
  --input '{"question":"Agent Skills 与 Dynamic Workflows 正在如何演进？"}'
```

运行 [Blog Writer](./src/examples/blog-writer/README.zh-CN.md)：

```bash
bun run dev -- run ./src/examples/blog-writer/workflow.ts \
  --input '{"topic":"Dynamic Workflow","audience":"Agent Builder"}'
```

全局安装包后，将命令开头的 `bun run dev --` 替换为 `deer-workflow` 即可。

### 深入了解

- [快速入门](./docs/index.zh-CN.md)
- [API 参考](./docs/api.zh-CN.md)
- [English Documentation](./docs/index.md)

Agents、Flow Controls、Workflow Events、Logging、Runner 行为、JSON Schema
输出和编程调用方式请详见 API 文档。

## 如何开发

### 初始化开发环境

安装依赖和仓库管理的 Git Hooks：

```bash
bun install
```

### 验证修改

提交修改前运行完整门禁：

```bash
bun run check
```

### 贡献 Agent 集成

Codex CLI 是默认 Agent Runtime，但不是架构上的硬依赖。欢迎贡献其他 Coding
Agent 集成。
