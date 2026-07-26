---
name: workflow-creator
description: Create or revise runnable Deer Workflow orchestration modules from a user's task description. Use this skill whenever the user asks to turn a repeatable multi-step task into a Workflow, generate a deer-workflow script, coordinate several Agent Loops with parallel or pipeline, or repair a Workflow that assumes APIs are globally injected.
---

# Deer Workflow Creator

Translate the user's task into one complete, runnable Deer Workflow ESM module.
The module coordinates work; it does not pretend that Deer Workflow injects
functions into its global scope.

## Establish the target

Infer these decisions from the request and existing repository context:

- The input object accepted by the Workflow.
- The final value returned to the caller.
- The phases visible in lifecycle events.
- Which operations are deterministic coordination and which require an Agent
  Loop's judgment or tools.
- Whether work is independent fan-out, an item-by-item pipeline, or a global
  stage followed by another fan-out.

Ask a question only when a missing answer would materially change whether the
Workflow reads or modifies user data. Otherwise make the smallest reasonable
assumption and state it in a short code comment.

## Read the actual contract

Read [references/api.md](references/api.md) before generating code. It is the
source of truth for the currently implemented API.

Read [references/patterns.md](references/patterns.md) when the request involves
concurrency, multiple Agent calls, structured output, verification, file
changes, or nested Workflows.

The essential runtime model is:

- Import APIs explicitly from `@deer-flow/workflow`.
- Export an `async` handler as `default` or as named `run`.
- Receive caller input as the handler's first argument.
- Optionally receive the Workflow execution context as the second argument.
- Let `WorkflowRunner` provide lifecycle, phase, event, and logging context
  through async-local state.

Do not generate the older destructured-injection signature:

```ts
export default async function ({ agent, parallel, args }) {}
```

Do not generate `meta`, `budget`, `label`, `phase`, or `isolation` features that
the runtime does not implement.

## Design the Workflow

Keep repeatable mechanics in code and delegate semantic decisions to
`agent()`. Examples of mechanics include mapping, exact filtering, counting,
deduplication by stable keys, ordering, and threshold checks. Examples of
semantic work include research, planning, drafting, classification, review,
and adjudication.

Choose the smallest orchestration primitive that expresses the dependency:

- Use ordinary sequential `await` when the next operation depends on the whole
  previous result.
- Use `parallel()` for independent lazy tasks that share a barrier.
- Use `pipeline()` when every item independently passes through the same
  ordered stages.
- Use separate calls with plain TypeScript between them when a stage must see
  every item, such as global ranking, clustering, or deduplication.
- Use `workflow()` only to compose an existing Workflow; nesting is limited to
  one child level.

Set `phase()` once before concurrent work. Never change the global phase from
inside a `parallel()` task or `pipeline()` stage because concurrent branches
share the Workflow execution context.

Use `log()` only for concise progress facts and major transitions.

## Define Agent boundaries

Treat `agent()` as a complete tool-using ReAct-style Agent Loop backed by Codex
CLI by default, not as a single prompt completion.

Make every prompt self-contained. Include the task, scope, relevant prior
results, constraints, and expected outcome. An Agent does not automatically
inherit prose from another Agent call.

Use `schema` whenever code will inspect an Agent's result. Pair the schema with
a TypeScript output type and set `additionalProperties: false` for closed
objects. Free text is suitable only when no downstream code needs to parse it.

Select the least permissive sandbox that can complete the task:

- `read-only` for research, inspection, planning, and writing returned content.
- `workspace-write` when the Agent must edit files in its working directory.
- `danger-full-access` only when the user explicitly authorizes capabilities
  that require it.

Set `cwd` when the task depends on a particular repository or directory.
Never interpolate untrusted data into shell commands in Workflow code; describe
the intended operation in the Agent prompt instead.

An ordinary failed `agent()` call throws. A rejected task inside `parallel()`
or a failed item inside `pipeline()` becomes `null`. Filter or check nullable
results before using them, and decide whether partial completion is acceptable.

For findings, audits, or high-stakes review, have a separate Agent independently
verify each candidate. Do not ask the Agent that produced a finding to approve
its own work.

## Produce the module

Use TypeScript by default because this repository is strict TypeScript. Use
plain JavaScript only when the user explicitly requests `.js`.

When a destination path is given, write the module there. Otherwise return
exactly one fenced code block containing the complete module, with no tutorial
before or after it unless the user asks for an explanation.

The module should normally follow this shape:

```ts
import {
  agent,
  log,
  parallel,
  phase,
  pipeline,
  workflow,
} from "@deer-flow/workflow";

interface WorkflowInput {
  // Input fields
}

interface WorkflowOutput {
  // Result fields
}

export default async function run(
  input: WorkflowInput,
): Promise<WorkflowOutput> {
  // Orchestration
}
```

Import only the APIs actually used. Keep local types near the module unless the
repository's conventions require a sibling `types.ts`.

The handler's returned value is the CLI result written to stdout. Logs and
lifecycle events belong on stderr through `WorkflowRunner`; do not mix progress
text into the final result.

## Validate

Before handing off a generated file:

1. Confirm every imported API exists in [references/api.md](references/api.md).
2. Confirm the handler is exported as `default` or named `run`.
3. Confirm the handler reads input directly rather than from a fictional
   injected `args`.
4. Confirm every `parallel()` entry is a zero-argument function.
5. Confirm the first `pipeline()` stage receives the original item.
6. Confirm nullable concurrent results are handled.
7. Confirm structured Agent results have both a schema and a matching type.
8. Confirm `phase()` is not called inside concurrent branches.
9. Confirm the sandbox and working directory match the task.
10. If working in this repository, run `bun run check`.
