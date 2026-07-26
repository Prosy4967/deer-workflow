# Deer Workflow

[English: README](../README.md) ·
[Guide](./index.md) ·
[API](./api.md) |
[简体中文：README](../README.zh-CN.md) ·
[快速入门](./index.zh-CN.md) ·
[API](./api.zh-CN.md)

Deer Workflow is a pilot project for DeerFlow 3.0, also known as DeerWork. It
keeps stable, repeatable control flow in TypeScript and delegates work that
requires semantic understanding or judgment to replaceable Coding Agents.

The project currently provides four groups of capabilities:

- `agent()` runs a complete Agent Loop using Codex CLI by default.
- `parallel()` and `pipeline()` coordinate concurrent tasks and processing
  stages.
- `workflow()`, `phase()`, and `log()` load Workflow modules and report
  execution progress.
- `WorkflowRunner` converts execution into a JSON event stream for CLIs, user
  interfaces, and Journals.
- `deer-workflow create` asks Codex to apply the bundled Workflow Creator Skill
  to a user's orchestration request.

See the [API Reference](./api.md) for complete signatures and behavior.
The bundled [Workflow Creator Skill](../skills/workflow-creator/SKILL.md)
teaches Coding Agents to generate modules against this implemented contract.

## Install the CLI

Install Bun and the Codex CLI used by the default Agent runtime:

```bash
npm install -g @openai/codex
codex login
codex --version
```

Codex CLI and Codex Desktop are separate installations. The Desktop app does
not provide the `codex` executable required by the default Agent runtime. When
the command is missing, Deer Workflow prints these installation steps before
any Agent process starts.

Until the first npm release, install `deer-workflow` globally from GitHub:

```bash
bun install --global git+https://github.com/deerwork-ai/deer-workflow.git
deer-workflow --help
```

After `@deer-work-ai/workflow` is published to npm, install a released version
with:

```bash
bun install --global @deer-work-ai/workflow
```

Bare `bun install` does not install the CLI globally. It installs local
dependencies when run inside a project and belongs to the development setup
described below.

Codex CLI is the default implementation, not an architectural dependency.
Other Coding Agents can be integrated by implementing the `Agent` interface.

## Write your first Workflow

A Workflow is a TypeScript module that exports either a default function or a
named `run()` function. APIs are ordinary ESM imports; the runtime does not
inject `agent()`, `parallel()`, or other functions into the handler:

```typescript
// workflows/research.ts
import { agent, log, parallel, phase } from "@deer-work-ai/workflow";

export const meta = {
  name: "topic-research",
  description: "Researches topics in parallel and synthesizes a report.",
  phases: [{ title: "Research" }, { title: "Synthesis" }],
};

interface ResearchInput {
  topics: string[];
}

export default async function research(args: ResearchInput) {
  phase("Research");
  log(`Researching ${args.topics.length} topics`);

  const findings = await parallel(
    args.topics.map(
      (topic) => () =>
        agent(`Research this topic and summarize the findings: ${topic}`, {
          sandbox: "read-only",
        }),
    ),
  );
  const completed = findings.filter(
    (finding): finding is string => finding !== null,
  );

  phase("Synthesis");
  return agent(
    `Synthesize these findings into a concise report:\n${JSON.stringify(
      completed,
    )}`,
    { sandbox: "read-only" },
  );
}
```

`phase()` marks an observable section of work. Entering a new phase
automatically ends the previous one. Any active phase is also ended when the
Workflow succeeds or fails.

`meta` gives generated Workflows a stable name, description, and declared phase
list. Its phase titles should exactly match `phase()` calls. The current Runner
accepts but does not yet consume this export.

## Create a Workflow

Generate a module by describing the desired orchestration:

```bash
deer-workflow create \
  "Research independent angles in parallel, verify claims, and synthesize a report" \
  > workflow.ts
```

`create` explicitly points Codex to the bundled
`skills/workflow-creator/SKILL.md`, appends the user prompt, and returns raw
source on stdout. It also accepts the prompt from stdin. The generated module
is not executed automatically.

## Run a Workflow

Use the CLI when starting a Workflow from a shell:

```bash
deer-workflow run ./examples/deep-research/workflow.ts \
  --input '{"question":"How are Agent Skills and Dynamic Workflows evolving?"}'
```

The result uses stdout, while Workflow events use stderr as JSON Lines. Use
`--input-file` or stdin when inline JSON is inconvenient. `--input` takes
precedence over stdin, as does `--input-file`; `--input` and `--input-file`
cannot be combined.

Use `WorkflowRunner` when starting the same Workflow from a host application:

```typescript
import { WorkflowRunner } from "@deer-work-ai/workflow/runner";

const runner = new WorkflowRunner();

try {
  const report = await runner.run<string>("./workflows/research.ts", {
    topics: ["Agent Skills", "Dynamic Workflow"],
  });
} finally {
  runner.dispose();
}
```

A standalone Runner calls `console.log()` once per event by default and writes
JSON Lines to stdout. The CLI overrides this destination to stderr so its
stdout contains only the final result:

```json
{"type":"workflow:start","workflowId":"…","depth":0,"scriptPath":"/project/workflows/research.ts","sequence":1,"timestamp":"2026-07-26T08:00:00.000Z"}
{"type":"workflow:phase:start","workflowId":"…","depth":0,"scriptPath":"/project/workflows/research.ts","phase":"Research","sequence":2,"timestamp":"2026-07-26T08:00:00.010Z"}
{"type":"log","workflowId":"…","depth":0,"scriptPath":"/project/workflows/research.ts","phase":"Research","message":"Researching 2 topics","sequence":3,"timestamp":"2026-07-26T08:00:00.020Z"}
```

The event protocol includes:

- `workflow:start`
- `workflow:end`
- `workflow:error`
- `workflow:phase:start`
- `workflow:phase:end`
- `log`

Workflow arguments and return values are excluded by default so event streams
do not accidentally expose large or sensitive application data.

## Use a custom destination

`logWriter` receives one serialized JSON line per call:

```typescript
const lines: string[] = [];
const runner = new WorkflowRunner({
  logWriter: (line) => lines.push(line),
});
```

Subscribe directly when your application needs typed events:

```typescript
const unsubscribe = runner.on((event) => {
  progressView.update(event);
});

await runner.run("./workflows/research.ts");
unsubscribe();
runner.dispose();
```

One Runner can execute multiple Workflows concurrently. Async contexts remain
isolated, while all events share a monotonically increasing `sequence` that
lets the host reconstruct the observed order.

## Examples

- [Deep Research](../examples/deep-research/README.md) uses `parallel()` to
  investigate independent angles before a structured synthesis.
- [Blog Writer](../examples/blog-writer/README.md) uses `pipeline()` to
  draft and review each section independently.

## Development quality gate

Clone the repository and run `bun install` inside it. This installs local
development dependencies, runs the `prepare` script, and installs the Husky
pre-commit hook:

```bash
git clone https://github.com/deerwork-ai/deer-workflow.git
cd deer-workflow
bun install
```

Each commit first runs ESLint and Prettier against Git-staged files through
`lint-staged`, then type-checks the complete TypeScript project. Lint-staged
uses its default temporary stash and rollback behavior to protect partially
staged work.

## Project commands

| Command                 | Purpose                                        |
| ----------------------- | ---------------------------------------------- |
| `bun run dev -- <args>` | Run the CLI directly.                          |
| `bun run lint`          | Check JavaScript and TypeScript with ESLint.   |
| `bun run lint:fix`      | Apply safe ESLint fixes.                       |
| `bun run format`        | Format supported files with Prettier.          |
| `bun run format:check`  | Check formatting without modifying files.      |
| `bun run lint:staged`   | Check and format Git-staged files.             |
| `bun run prepare`       | Install the repository-managed Husky hooks.    |
| `bun test`              | Run all tests under `tests/`.                  |
| `bun run typecheck`     | Run TypeScript type checking.                  |
| `bun run check`         | Run every type, style, format, and test check. |
