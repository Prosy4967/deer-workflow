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
  - [Create a Workflow](#create-a-workflow)
  - [Run a Workflow](#run-a-workflow)
  - [Other Agents / Harnesses](#other-agents--harnesses)
  - [Examples](#examples)
- [How to develop](#how-to-develop)
  - [Development documentation](#development-documentation)
  - [Set up](#set-up)
  - [Validate changes](#validate-changes)
  - [Contribute an Agent / Harness integration](#contribute-an-agent--harness-integration)
  - [License](#license)

# How to use

## Prerequisites

- Install [Bun](https://bun.sh). Bun is a fast, Node.js-compatible JavaScript
  runtime and toolkit; see its
  [installation guide](https://bun.sh/docs/installation).
- Install and sign in to [Codex CLI](https://github.com/openai/codex), the
  default Agent runtime, or
  [Claude Code CLI](https://claude.com/product/claude-code). When using Claude
  Code, pass `--agent claude` to `deer-workflow create`.

## Install the CLI

Install the released CLI from npm:

```bash
bun install --global @deerwork-ai/deer-workflow
deer-workflow --help
```

Running `bun install` without `--global` only installs dependencies for the
current project. It does not install the `deer-workflow` command globally.

## Create a Workflow

Deer Workflow uses
[a bundled `workflow-creator` Skill](./skills/workflow-creator/) to turn a user
prompt into a runnable TypeScript Workflow script through a Coding Agent.
`deer-workflow create` uses Codex by default and writes the generated source to
stdout:

```bash
deer-workflow create \
  "Research several independent angles, verify the findings, and synthesize a report" \
  > workflow.ts
```

Here's an example of the generated `workflow.ts`:

```typescript
import {
  agent,
  log,
  parallel,
  phase,
  pipeline,
} from "@deerwork-ai/deer-workflow";

export const meta = {
  name: "topic-report",
  description: "Researches topics and turns the findings into edited sections.",
  phases: [{ title: "Research" }, { title: "Draft" }],
  exampleArgs: { topics: ["Agent Skills", "Dynamic Workflows"] },
};

export default async function run(args: { topics: string[] }) {
  phase("Research");
  log(`Researching ${args.topics.length} topics`);

  const findings = await parallel(
    args.topics.map(
      (topic) => () =>
        agent(`Research and summarize: ${topic}`, {
          sandbox: "read-only",
        }),
    ),
  );
  const completed = findings.filter(
    (finding): finding is string => finding !== null,
  );

  phase("Draft");
  const sections = await pipeline(
    completed,
    (finding) => agent(`Draft a section:\n${finding}`),
    (draft) => agent(`Edit for clarity:\n${draft}`),
  );
  const edited = sections.filter(
    (section): section is string => section !== null,
  );
  log(`Completed ${edited.length} sections`);

  return edited.join("\n\n");
}
```

Alternatively, install the
[bundled Skill](./skills/workflow-creator/) for your Agents, then ask any Agent
that supports Agent Skills to create a Workflow:

```bash
deer-workflow skill install
```

The command copies the Skill into existing `~/.agents/skills` and
`~/.claude/skills` directories and reports which destinations it changed or
skipped.

## Run a Workflow

```bash
deer-workflow run ./workflow.ts \
  --input '{"topics":["Agent Skills","Dynamic Workflows"]}'
```

### Run in TUI Mode

Interactive runs show `meta.phases` and rendered Markdown logs in a live
two-pane TUI, together with the Workflow name, module path, working directory,
and an animated highlight on the active phase. In the default mode, redirected
stderr remains JSONL for automation.

### Run in Event Streaming Mode

Use `--print` / `-p` when running on servers or in automation such as CI/CD,
task queues, process pipelines, and event collectors. It exposes a stable
stdout Event Stream with one JSON event per line:

```bash
deer-workflow run ./workflow.ts --print \
  --input '{"topics":["Agent Skills","Dynamic Workflows"]}'
```

## Other Agents / Harnesses

The `agent()` helper and `create` command use the Codex harness by default.
Claude Code is also included as a built-in harness. Select it for Workflow
generation with:

```bash
deer-workflow create --agent claude "Describe the Workflow"
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

## Contribute an Agent / Harness integration

Codex CLI is the default Agent runtime, not an architectural dependency.
`ClaudeAgent` (Claude Code CLI) ships as another built-in harness;
contributions for other Agent and Harness integrations are welcome.

## License

This project is licensed under the [MIT License](./LICENSE).
