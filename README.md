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

An open-source Dynamic Workflow runtime that keeps orchestration in TypeScript
and delegates semantic work to replaceable Agent runtimes.

The default `agent()` implementation runs a complete Codex CLI Agent Loop.
The package is published as `@deer-flow/workflow`; the executable remains
`deer-workflow`.

## Index

- [Relationship with DeerFlow](#relationship-with-deerflow)
- [Prerequisite](#prerequisite)
- [Project scripts](#project-scripts)
- [Git commit quality gate](#git-commit-quality-gate)
- [Examples](#examples)
- [Flow controls](#flow-controls)
- [Workflow events and Runner](#workflow-events-and-runner)
- [Logging](#logging)
- [Bring Your Own Coding Agent](#bring-your-own-coding-agent)

## Relationship with DeerFlow

`deer-workflow` is a pilot project within **DeerFlow 3.0**, also known as
**DeerWork**.

It grows out of
[DeerFlow](https://github.com/bytedance/deer-flow), the open-source SuperAgent
harness with approximately 78,000 GitHub stars. DeerFlow provides the broader
vision for long-running agents, skills, tools, memory, sandboxes, and
sub-agents. This repository isolates one part of that next-generation
architecture: generating and executing Dynamic Workflows with deterministic
TypeScript control flow and replaceable Agent runtimes.

As a pilot project, the APIs and runtime behavior are intentionally
experimental. The goal is to validate the Dynamic Workflow design in a small,
focused codebase as part of the broader DeerWork architecture effort.

## Prerequisite

The default Agent runtime requires
[Codex CLI](https://github.com/openai/codex) to be installed and available as
the `codex` command:

```bash
curl -fsSL https://chatgpt.com/codex/install.sh | sh
codex login
```

Verify the installation before running `deer-workflow`:

```bash
codex --version
```

Then install and run this project:

```bash
bun install
bun run dev -- agent "Inspect this repository and summarize its structure."
```

## Project scripts

The project commands are defined in the root `package.json`:

| Script                  | Description                                                        |
| ----------------------- | ------------------------------------------------------------------ |
| `bun run dev -- <args>` | Run the CLI directly from `src/cli.ts`.                            |
| `bun run lint`          | Check JavaScript and TypeScript with ESLint.                       |
| `bun run lint:fix`      | Apply safe ESLint fixes.                                           |
| `bun run format`        | Format supported files with Prettier.                              |
| `bun run format:check`  | Check formatting without changing files.                           |
| `bun run lint:staged`   | Check and format files currently staged by Git.                    |
| `bun run prepare`       | Install the repository-managed Husky hooks.                        |
| `bun test`              | Run all tests under `tests/`.                                      |
| `bun run typecheck`     | Type-check the source code and tests without emitting build files. |
| `bun run check`         | Run type-checking, linting, formatting checks, and tests.          |

Before opening a pull request, run:

```bash
bun run check
```

## Git commit quality gate

Husky installs a `pre-commit` hook through the `prepare` script. Before every
commit, the hook runs `lint-staged` against only the files in Git's staging
area:

- JavaScript and TypeScript files run through ESLint fixes and Prettier.
- JSON, Markdown, and YAML files run through Prettier.
- The complete TypeScript project runs through `bun run typecheck`.

`lint-staged` creates a temporary Git stash by default before modifying staged
files. If a task fails, it restores the original state and blocks the commit.
Type checking then validates the complete project because checking isolated
files would lose the repository's `tsconfig.json` context.

## Examples

- [Deep Research](./src/examples/deep-research/README.md) demonstrates
  planning, parallel source-backed research, and structured synthesis.
- [Blog Writer](./src/examples/blog-writer/README.md) demonstrates an outline,
  per-section Draft/Review Pipeline, and final article assembly.

## Flow controls

`parallel()` runs a group of tasks concurrently and waits for all of them at a
Barrier. `pipeline()` lets each item advance through its stages independently.
An individual failure becomes `null` without cancelling sibling work.

```typescript
import { parallel, pipeline } from "@deer-flow/workflow/flow";

const checks = await parallel([
  () => runLint(),
  () => runTypecheck(),
  () => runTests(),
]);

const repaired = await pipeline(
  checks.filter((check) => check !== null),
  (check) => diagnose(check),
  (diagnosis, original) => repair(original, diagnosis),
  (repairResult) => verify(repairResult),
);
```

`workflow()` loads a Workflow module and injects its arguments and execution
context. `phase()` names the current progress group. A Workflow module exports
its handler as either `default` or `run`:

```typescript
// workflows/release.ts
import { parallel, phase } from "@deer-flow/workflow/flow";

export default async function release(args: { version: string }) {
  phase("Build");
  return parallel([
    () => build("macos", args.version),
    () => build("linux", args.version),
    () => build("windows", args.version),
  ]);
}
```

Run it from another Workflow or from the host application:

```typescript
import { workflow } from "@deer-flow/workflow/flow";

const artifacts = await workflow(
  { scriptPath: "./workflows/release.ts" },
  { version: "3.0.0" },
);
```

Nested paths resolve relative to the parent Workflow module. One level of
Workflow nesting is supported.

## Workflow events and Runner

`WorkflowRunner` exposes execution progress as a typed event stream. Its
default writer prints one compact JSON object per line to stdout, making the
stream easy to consume from a CLI parent process without parsing human-oriented
text.

```typescript
import { WorkflowRunner } from "@deer-flow/workflow/runner";

const runner = new WorkflowRunner();

try {
  const artifacts = await runner.run(
    { scriptPath: "./workflows/release.ts" },
    { version: "3.0.0" },
  );
} finally {
  runner.dispose();
}
```

The event protocol currently includes:

| Event                  | Meaning                                            |
| ---------------------- | -------------------------------------------------- |
| `workflow:start`       | A Workflow invocation is about to load and run.    |
| `workflow:end`         | The invocation completed successfully.             |
| `workflow:error`       | The invocation failed; includes a JSON-safe error. |
| `workflow:phase:start` | `phase()` entered a named phase.                   |
| `workflow:phase:end`   | A phase completed or was closed by a transition.   |
| `log`                  | `log()` emitted a progress message.                |

Every event contains `sequence`, `timestamp`, `workflowId`, `depth`, and
`scriptPath`. Nested Workflow events also contain `parentWorkflowId`. End and
error events report `durationMs`; phase and log events carry the active phase.
Arguments and return values are deliberately excluded so telemetry does not
accidentally expose large or sensitive application data.

Example JSON Lines:

```json
{"type":"workflow:start","workflowId":"…","depth":0,"scriptPath":"/app/release.ts","sequence":1,"timestamp":"2026-07-26T08:00:00.000Z"}
{"type":"workflow:phase:start","workflowId":"…","depth":0,"scriptPath":"/app/release.ts","phase":"Build","sequence":2,"timestamp":"2026-07-26T08:00:00.010Z"}
{"type":"log","workflowId":"…","depth":0,"scriptPath":"/app/release.ts","message":"Building macOS artifact","phase":"Build","sequence":3,"timestamp":"2026-07-26T08:00:00.020Z"}
```

Pass a custom `logWriter` to redirect the same JSON Lines to a file, socket, UI,
or Journal. Subscribe to `runner.events` when code should consume typed event
objects before serialization:

```typescript
const lines: string[] = [];
const runner = new WorkflowRunner({
  logWriter: (line) => lines.push(line),
});

const unsubscribe = runner.on((event) => {
  progressView.update(event);
});
```

## Logging

`log()` emits Workflow progress without writing to stdout. By default, messages
go to stderr so CLI results and JSON output remain machine-readable:

```typescript
import { log } from "@deer-flow/workflow/logging";

log("Running repository checks");
```

Hosts can install an async-local Log Sink to send the same messages to a
progress view, Journal, or test collector:

```typescript
import { log, withLogSink } from "@deer-flow/workflow/logging";

await withLogSink(
  (message) => progressView.append(message),
  async () => {
    log("Research started");
    await runResearch();
    log("Research finished");
  },
);
```

Inside `WorkflowRunner.run()`, the Runner replaces that default sink and turns
each `log()` call into a JSON `log` event. Outside a Runner, the stderr behavior
is unchanged.

```typescript
import { agent } from "@deer-flow/workflow/agents";

const result = await agent<{
  ok: boolean;
  issues: string[];
}>("Run the repository checks and report failures.", {
  cwd: process.cwd(),
  sandbox: "read-only",
  schema: {
    type: "object",
    properties: {
      ok: { type: "boolean" },
      issues: {
        type: "array",
        items: { type: "string" },
      },
    },
    required: ["ok", "issues"],
    additionalProperties: false,
  },
});
```

## Bring Your Own Coding Agent

Codex CLI is the default implementation, not a hard dependency of the
architecture. The `Agent` interface is intentionally vendor-neutral so other
Coding Agents can be integrated without changing the workflow runtime.

Contributions for Claude Code, Gemini CLI, OpenCode, or other Coding Agent
adapters are very welcome. Add a new adapter under `src/agents`, implement the
shared `Agent` interface, cover text and JSON Schema output with tests, and open
a pull request.
