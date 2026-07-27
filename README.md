# deer-workflow

[English: README](./README.md) ·
[Guide](./docs/index.md) ·
[API](./docs/api.md) |
[简体中文：README](./README.zh-CN.md) ·
[快速入门](./docs/index.zh-CN.md) ·
[API](./docs/api.zh-CN.md)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![npm](https://img.shields.io/npm/v/@deerwork-ai/deer-workflow)](https://www.npmjs.com/package/@deerwork-ai/deer-workflow)
[![Bun](https://img.shields.io/badge/runtime-Bun-f9f1e1?logo=bun&logoColor=000000)](https://bun.sh)
[![TypeScript](https://img.shields.io/badge/language-TypeScript-3178c6?logo=typescript&logoColor=ffffff)](https://www.typescriptlang.org)
[![Codex CLI](https://img.shields.io/badge/default_agent-Codex_CLI-000000?logo=openai&logoColor=ffffff)](https://github.com/openai/codex)
[![DeerFlow Stars](https://img.shields.io/github/stars/bytedance/deer-flow?label=DeerFlow%20Stars&logo=github)](https://github.com/bytedance/deer-flow)
[![GitHub Stars](https://img.shields.io/github/stars/deerwork-ai/deer-workflow?style=flat&logo=github)](https://github.com/deerwork-ai/deer-workflow)

An open-source Dynamic Workflow runtime that combines deterministic TypeScript
orchestration with replaceable Agent runtimes.

`deer-workflow` is a pilot project for
[**DeerFlow 3.0**](https://github.com/bytedance/deer-flow), also known as
**DeerWork**. The package name is `@deerwork-ai/deer-workflow`; the executable is
named `deer-workflow`.

## Index

- [How to use](#how-to-use)
  - [Prerequisites](#prerequisites)
  - [Install the CLI](#install-the-cli)
  - [Run an Agent](#run-an-agent)
    - [Use Claude Code CLI instead of Codex](#use-claude-code-cli-instead-of-codex)
  - [Create a Workflow](#create-a-workflow)
  - [Run a Workflow](#run-a-workflow)
  - [Examples](#examples)
- [How to develop](#how-to-develop)
  - [Development documentation](#development-documentation)
  - [Set up](#set-up)
  - [Validate changes](#validate-changes)
  - [Contribute an Agent integration](#contribute-an-agent-integration)
  - [License](#license)

# How to use

## Prerequisites

Install [Bun](https://bun.sh) and
[Codex CLI](https://github.com/openai/codex), then sign in:

[Bun](https://bun.sh) is a fast, Node.js-compatible JavaScript runtime and
toolkit; see its [installation guide](https://bun.sh/docs/installation).

```bash
npm install -g @openai/codex
codex login
codex --version
```

Codex CLI and Codex Desktop are separate installations. Installing the Desktop
app does not install the `codex` terminal command.

## Install the CLI

Install the released CLI from npm:

```bash
bun install --global @deerwork-ai/deer-workflow
deer-workflow --help
```

Running `bun install` without `--global` only installs dependencies for the
current project. It does not install the `deer-workflow` command globally.

## Run an Agent

```bash
deer-workflow agent "Inspect this repository"
```

### Use Claude Code CLI instead of Codex

The `agent()` helper and the `deer-workflow agent` command use `CodexAgent` by
default. To run on [Claude Code CLI](https://docs.claude.com/en/docs/claude-code)
instead, install it and sign in:

```bash
npm install -g @anthropic-ai/claude-code
claude auth login
claude --version
```

Then use `ClaudeAgent` directly in place of the default `agent` export:

```typescript
import { ClaudeAgent } from "@deerwork-ai/deer-workflow/agents";

const runtime = new ClaudeAgent({ model: "sonnet" });
const result = await runtime.run("Inspect this repository.");
```

See [`ClaudeAgent` in the API Reference](./docs/api.md#claudeagent) for
sandbox, model, and structured-output options.

## Create a Workflow

Describe the orchestration you need. The command runs the bundled
`workflow-creator` Skill through Codex and writes generated source to stdout:

```bash
deer-workflow create \
  "Research several independent angles, verify the findings, and synthesize a report" \
  > workflow.ts
```

Alternatively, install the bundled Skill for your Agents, then ask any Agent
that supports Agent Skills to create a Workflow:

```bash
deer-workflow skill install
```

The command copies the Skill into existing `~/.agents/skills` and
`~/.claude/skills` directories and reports which destinations it changed or
skipped.

## Run a Workflow

```bash
deer-workflow run ./workflow.ts --input '{"question":"Why has Neo Labs recently emerged as a new force in AI?"}'
```

Interactive runs show `meta.phases` and rendered Markdown logs in a live
two-pane TUI, together with the Workflow name, module path, working directory,
and an animated highlight on the active phase. In the default mode, redirected
stderr remains JSONL for automation.

Use `--print` / `-p` when running on servers or in automation such as CI/CD,
task queues, process pipelines, and event collectors. It exposes a stable
stdout Event Stream with one JSON event per line:

```bash
deer-workflow run ./workflow.ts --print \
  --input '{"question":"Why has Neo Labs recently emerged as a new force in AI?"}'
```

## Examples

Run [Deep Research](./examples/deep-research/README.md):

```bash
deer-workflow run ./examples/deep-research/workflow.ts \
  --input '{"question":"How are Agent Skills and Dynamic Workflows evolving?","outputPath":"./report.html"}'
```

Run [Blog Writer](./examples/blog-writer/README.md):

```bash
deer-workflow run ./examples/blog-writer/workflow.ts \
  --input '{"topic":"The Emerging Trends of Neo Labs","audience":"Agent builders"}'
```

These paths refer to files in this repository. Clone or download the repository
before running them.

# How to develop

## Development documentation

- [Getting Started](./docs/index.md)
- [API Reference](./docs/api.md)
- [Workflow Creator Skill](./skills/workflow-creator/SKILL.md)
- [中文开发文档](./docs/index.zh-CN.md)

The API Reference covers Agents, Flow Controls, Workflow Events, Logging,
Runner behavior, JSON Schema output, and programmatic usage.

## Set up

Clone the repository, then install its local dependencies and Git hooks:

```bash
git clone https://github.com/deerwork-ai/deer-workflow.git
cd deer-workflow
bun install
```

Run the CLI directly from source while developing:

```bash
bun run dev -- --help
```

## Validate changes

Run the complete quality gate before submitting changes:

```bash
bun run check
```

## Contribute an Agent integration

Codex CLI is the default Agent runtime, not an architectural dependency.
`ClaudeAgent` (Claude Code CLI) ships as a built-in alternative; contributions
for other Coding Agent integrations are welcome.

## License

This project is licensed under the [MIT License](./LICENSE).
