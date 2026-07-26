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

An open-source Dynamic Workflow runtime that combines deterministic TypeScript
orchestration with replaceable Agent runtimes.

`deer-workflow` is a pilot project for **DeerFlow 3.0**, also known as
**DeerWork**. The package is published as `@deer-flow/workflow`; the executable
is named `deer-workflow`.

## Index

- [How to use](#how-to-use)
- [How to develop](#how-to-develop)

## How to use

### Prerequisites

Install [Bun](https://bun.sh) and
[Codex CLI](https://github.com/openai/codex), then sign in:

```bash
npm install -g @openai/codex
codex login
codex --version
```

Codex CLI and Codex Desktop are separate installations. Installing the Desktop
app does not install the `codex` terminal command.

### Try from source

Install this repository:

```bash
bun install
```

Run a Workflow with inline JSON input:

```bash
bun run dev -- run ./src/examples/deep-research/workflow.ts \
  --input '{"question":"How are Agent Skills and Dynamic Workflows evolving?"}'
```

After installing the package globally, use the same command through the
executable:

```bash
deer-workflow run ./workflow.ts --input '{"question":"Your question"}'
```

### Examples

- [Deep Research](./src/examples/deep-research/README.md)
- [Blog Writer](./src/examples/blog-writer/README.md)

### Learn more

- [Getting Started](./docs/index.md)
- [API Reference](./docs/api.md)
- [中文文档](./docs/index.zh-CN.md)

The API Reference covers Agents, Flow Controls, Workflow Events, Logging,
Runner behavior, JSON Schema output, and programmatic usage.

## How to develop

### Set up

Install dependencies and repository-managed Git hooks:

```bash
bun install
```

### Validate changes

Run the complete quality gate before submitting changes:

```bash
bun run check
```

### Contribute an Agent integration

Codex CLI is the default Agent runtime, not an architectural dependency.
Contributions for other Coding Agent integrations are welcome.
