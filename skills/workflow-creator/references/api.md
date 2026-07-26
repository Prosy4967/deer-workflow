# Deer Workflow API

This reference describes the currently implemented public contract. Do not add
capabilities merely because they appear in another Dynamic Workflow runtime.

## Module contract

A runnable module exports either a default handler or a named `run` handler:

```ts
type WorkflowHandler<TArgs, TOutput> = (
  args: TArgs,
  context: Readonly<WorkflowExecutionContext<TArgs>>,
) => TOutput | PromiseLike<TOutput>;
```

The Workflow Creator also emits a pure-literal metadata export:

```ts
export const meta = {
  name: "workflow-name",
  description: "One-line description.",
  phases: [{ title: "Plan" }, { title: "Execute" }],
};
```

The current runtime tolerates this export but does not yet read it or include
it in events. Keep the object literal static for forward compatibility.

The CLI loads it with:

```sh
deer-workflow run ./workflow.ts --input '{"key":"value"}'
```

Input may instead come from `--input-file` or JSON on stdin. `--input` and
`--input-file` cannot be combined; explicit input takes precedence over stdin.
The final returned value is written to stdout. Workflow events and logs are
JSON Lines on stderr.

There is no global API injection. Caller input is the Handler's first
parameter, conventionally named `args`; it is not a `globalThis` property.

The CLI can ask the default Codex Agent to apply this bundled Skill and emit a
new module as raw source:

```sh
deer-workflow create "Describe the Workflow" > workflow.ts
```

`create` generates the module but does not execute it.

## Imports

Prefer the package root for generated modules:

```ts
import {
  agent,
  log,
  parallel,
  phase,
  pipeline,
  workflow,
} from "@deer-work/workflow";
```

Focused exports are also available from `/agents`, `/flow`, and `/logging`.

## `agent()`

```ts
function agent<TOutput = string>(
  prompt: string,
  options?: AgentOptions,
): Promise<TOutput>;
```

`agent()` runs a complete Coding Agent loop. Without a schema it returns text.
With a schema, Codex CLI validates the final response and Deer Workflow parses
the JSON.

```ts
interface AgentOptions {
  cwd?: string;
  model?: string;
  schema?: JsonSchema;
  sandbox?: "read-only" | "workspace-write" | "danger-full-access";
  additionalWritableDirectories?: string[];
  env?: Record<string, string | undefined>;
  signal?: AbortSignal;
}
```

There are no `label`, `phase`, `isolation`, retry, or token-budget fields in
`AgentOptions`. `phase()` is a separate Flow API. Direct Agent failures throw
rather than returning `null`.

## `parallel()`

```ts
function parallel<const TTasks extends readonly ParallelTask[]>(
  tasks: TTasks,
): Promise<ParallelResults<TTasks>>;
```

Every task must be a zero-argument lazy function. All tasks start concurrently
and results remain in input order. A thrown or rejected task produces `null`
without cancelling siblings.

```ts
const results = await parallel([
  () => agent("Inspect authentication.", { sandbox: "read-only" }),
  () => agent("Inspect authorization.", { sandbox: "read-only" }),
]);
```

The runtime does not currently impose a documented concurrency or item limit.

## `pipeline()`

```ts
function pipeline<TOriginal>(
  items: readonly TOriginal[],
  ...stages: Array<PipelineStage<unknown, TOriginal, unknown>>
): Promise<Array<unknown | null>>;
```

Each item advances through its stages independently. Every stage receives:

```ts
(currentValue, originalItem, originalIndex);
```

The first stage's `currentValue` is the original item, not `undefined`. A failed
stage makes that item's final result `null` and skips its remaining stages.

```ts
const articles = await pipeline(
  topics,
  (topic) => agent(`Draft: ${topic}`),
  (draft, topic) => agent(`Edit the draft for ${topic}:\n${draft}`),
);
```

## `phase()`

```ts
function phase(title: string): void;
```

`phase()` changes the current Workflow phase and emits phase lifecycle events.
Calling it outside an active Workflow throws. Set it before concurrent work,
not from within concurrent branches.

## `log()`

```ts
function log(message: string): void;
```

Inside a `WorkflowRunner`, `log()` emits a typed `log` event. Its phase is read
from the active Workflow context. Outside a Runner it writes to stderr. A
standalone Runner writes JSON events through `console.log` by default; the CLI
overrides its writer so events go to stderr.

## `workflow()`

```ts
function workflow<TOutput = unknown, TArgs = unknown>(
  target: string | { scriptPath: string },
  args?: TArgs,
): Promise<TOutput>;
```

Nested relative paths resolve from the parent Workflow module. One nested level
is supported. A child receives its own handler arguments and execution context.

## Execution context

The optional second handler parameter contains:

```ts
interface WorkflowExecutionContext<TArgs = unknown> {
  readonly id: string;
  readonly parentId?: string;
  readonly depth: number;
  readonly scriptPath: string;
  readonly args: TArgs;
  phase?: string;
}
```

Most Workflows need only their first `args` parameter.
