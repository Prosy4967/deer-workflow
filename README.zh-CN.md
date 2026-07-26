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

`deer-workflow` 是 **DeerFlow 3.0**（即 **DeerWork**）的试点项目。包名为
`@deer-flow/workflow`，命令行名称为 `deer-workflow`。

## 目录

- [如何使用](#如何使用)
  - [前置条件](#前置条件)
  - [安装命令行](#安装命令行)
  - [运行 Agent](#运行-agent)
  - [创建 Workflow](#创建-workflow)
  - [运行 Workflow](#运行-workflow)
  - [示例](#示例)
- [如何开发](#如何开发)
  - [开发文档](#开发文档)
  - [初始化开发环境](#初始化开发环境)
  - [验证修改](#验证修改)
  - [贡献 Agent 集成](#贡献-agent-集成)

# 如何使用

## 前置条件

安装 [Bun](https://bun.sh) 和
[Codex CLI](https://github.com/openai/codex)，然后登录：

```bash
npm install -g @openai/codex
codex login
codex --version
```

Codex CLI 与 Codex Desktop 是两个独立安装。安装 Desktop 应用不会同时安装
终端中的 `codex` 命令。

## 安装命令行

在首个 npm 版本发布前，直接从 GitHub 全局安装当前版本：

```bash
bun install --global git+https://github.com/deer-flow/deer-workflow.git
deer-workflow --help
```

`@deer-flow/workflow` 发布到 npm 后，可用下面的命令安装正式版本：

```bash
bun install --global @deer-flow/workflow
```

不带 `--global` 的 `bun install` 只会安装当前项目的本地依赖，不会在全局安装
`deer-workflow` 命令。

## 运行 Agent

```bash
deer-workflow agent "Inspect this repository"
```

## 创建 Workflow

描述需要的编排逻辑。该命令会让 Codex 执行内置的 `workflow-creator` Skill，并
将生成的源码写入 stdout：

```bash
deer-workflow create \
  "并行研究多个独立角度，验证研究结果，最后汇编成报告" \
  > workflow.ts
```

## 运行 Workflow

```bash
deer-workflow run ./workflow.ts --input '{"question":"你的问题"}'
```

## 示例

运行 [Deep Research](./examples/deep-research/README.zh-CN.md)：

```bash
deer-workflow run ./examples/deep-research/workflow.ts \
  --input '{"question":"Agent Skills 与 Dynamic Workflows 正在如何演进？"}'
```

运行 [Blog Writer](./examples/blog-writer/README.zh-CN.md)：

```bash
deer-workflow run ./examples/blog-writer/workflow.ts \
  --input '{"topic":"Dynamic Workflow","audience":"Agent Builder"}'
```

这些路径指向本仓库内的文件，请先克隆或下载仓库再运行。

# 如何开发

## 开发文档

- [快速入门](./docs/index.zh-CN.md)
- [API 参考](./docs/api.zh-CN.md)
- [Workflow Creator Skill](./skills/workflow-creator/SKILL.md)
- [English Documentation](./docs/index.md)

Agents、Flow Controls、Workflow Events、Logging、Runner 行为、JSON Schema
输出和编程调用方式请详见 API 文档。

## 初始化开发环境

克隆仓库，然后安装本地依赖和仓库管理的 Git Hooks：

```bash
git clone https://github.com/deer-flow/deer-workflow.git
cd deer-workflow
bun install
```

开发时直接从源码运行 CLI：

```bash
bun run dev -- --help
```

## 验证修改

提交修改前运行完整门禁：

```bash
bun run check
```

## 贡献 Agent 集成

Codex CLI 是默认 Agent Runtime，但不是架构上的硬依赖。欢迎贡献其他 Coding
Agent 集成。
