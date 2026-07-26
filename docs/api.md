# API Reference

[English: README](../README.md) ·
[Guide](./index.md) ·
[API](./api.md) |
[简体中文：README](../README.zh-CN.md) ·
[快速入门](./index.zh-CN.md) ·
[API](./api.zh-CN.md)

Public APIs are available from the package root and from focused subpath
exports:

```typescript
import { agent } from "@deer-flow/workflow/agents";
import { parallel, pipeline, workflow } from "@deer-flow/workflow/flow";
import { WorkflowEventEmitter } from "@deer-flow/workflow/events";
import { log } from "@deer-flow/workflow/logging";
import { WorkflowRunner } from "@deer-flow/workflow/runner";
```

## Agents

### `agent()`

```typescript
function agent<TOutput = string>(
  prompt: string,
  options?: AgentOptions,
): Promise<TOutput>;
```

Runs a complete Codex CLI Agent Loop through the default `CodexAgent`. It
returns text when no `schema` is provided and parses the structured final
response when a JSON Schema is present.

```typescript
const result = await agent<{
  ok: boolean;
  issues: string[];
}>("Run all repository checks.", {
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

### `AgentOptions`

```typescript
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

The schema constrains only the final response. It does not reduce the Agent
Loop to a single model completion.

### `Agent`

```typescript
interface Agent {
  run<TOutput = string>(
    prompt: string,
    options?: AgentOptions,
  ): Promise<TOutput>;
}
```

This is the vendor-neutral contract for adding another Coding Agent runtime.

### `CodexAgent`

```typescript
class CodexAgent implements Agent {
  constructor(config?: CodexAgentConfig);

  run<TOutput = string>(
    prompt: string,
    options?: AgentOptions,
  ): Promise<TOutput>;
}
```

The default runtime uses non-interactive `codex exec`. Prompts are sent over
stdin, sessions are ephemeral by default, and temporary schema and result files
are removed after each call.

```typescript
interface CodexAgentConfig {
  command?: string;
  commandArgs?: string[];
  cwd?: string;
  model?: string;
  sandbox?: AgentSandbox;
  ephemeral?: boolean;
  skipGitRepositoryCheck?: boolean;
  extraArgs?: string[];
  env?: Record<string, string | undefined>;
}
```

Failures and invalid schema-backed responses throw `CodexAgentError`, which
retains `exitCode`, `stdout`, and `stderr` for diagnostics.

## Flow

### `parallel()`

```typescript
function parallel<const TTasks extends readonly ParallelTask[]>(
  tasks: TTasks,
): Promise<ParallelResults<TTasks>>;
```

Starts all lazy tasks concurrently and waits for them to settle. Results retain
input order. A rejected or synchronously thrown task becomes `null` without
cancelling its siblings.

```typescript
const [lint, typecheck, tests] = await parallel([
  () => runLint(),
  () => runTypecheck(),
  () => runTests(),
]);
```

### `pipeline()`

```typescript
function pipeline<TOriginal>(
  items: readonly TOriginal[],
  ...stages: Array<PipelineStage<unknown, TOriginal, unknown>>
): Promise<Array<unknown | null>>;
```

Moves each input independently through an ordered list of stages. An item can
enter its next stage immediately; it does not wait for a global stage barrier.

```typescript
const results = await pipeline(
  documents,
  (document) => extract(document),
  (content, original, index) => review(content, original, index),
  (review) => format(review),
);
```

Each stage receives the current value, original item, and original index:

```typescript
type PipelineStage<TValue, TOriginal, TNext> = (
  value: TValue,
  original: TOriginal,
  index: number,
) => TNext | PromiseLike<TNext>;
```

When one item fails, its remaining stages are skipped and its final value is
`null`. Other items continue. Type inference is preserved for up to five
stages.

### `phase()`

```typescript
function phase(title: string): void;
```

Sets the active Workflow phase. A transition emits
`workflow:phase:end` for the previous phase followed by
`workflow:phase:start` for the new phase. Calling it outside a Workflow throws
`PhaseContextError`.

### `getCurrentPhase()`

```typescript
function getCurrentPhase(): string | undefined;
```

Returns the active phase, or `undefined` outside a Workflow and before the
first `phase()` call.

### `workflow()`

```typescript
function workflow<TOutput = unknown, TArgs = unknown>(
  target: string | { scriptPath: string },
  args?: TArgs,
): Promise<TOutput>;
```

Loads and runs a Workflow module. The target must export a default function or
a named `run()` function:

```typescript
type WorkflowHandler<TArgs, TOutput> = (
  args: TArgs,
  context: Readonly<WorkflowExecutionContext<TArgs>>,
) => TOutput | PromiseLike<TOutput>;
```

A host-started Workflow has depth `0`. Nested paths resolve relative to the
parent Workflow file, and one nested level is currently supported. Invalid
modules throw `WorkflowLoadError`; exceeding the nesting limit throws
`WorkflowNestingError`.

### `getWorkflowContext()`

```typescript
function getWorkflowContext<TArgs = unknown>():
  WorkflowExecutionContext<TArgs> | undefined;
```

Returns the Workflow context for the current async call chain:

```typescript
interface WorkflowExecutionContext<TArgs = unknown> {
  readonly id: string;
  readonly parentId?: string;
  readonly depth: number;
  readonly scriptPath: string;
  readonly args: TArgs;
  phase?: string;
}
```

## Logging

### `log()`

```typescript
function log(message: string): void;
```

Emits progress. Direct calls use stderr by default. Inside
`WorkflowRunner.run()`, each call becomes a `log` event handled by the Runner's
JSON writer.

### `withLogSink()`

```typescript
function withLogSink<TOutput>(
  sink: (message: string) => void,
  callback: () => TOutput,
): TOutput;
```

Installs a Log Sink for one async call chain. Nested and concurrent scopes are
isolated with `AsyncLocalStorage`, and the parent sink is restored
automatically.

## Events

### Event protocol

```typescript
type WorkflowEventType =
  | "workflow:start"
  | "workflow:end"
  | "workflow:error"
  | "workflow:phase:start"
  | "workflow:phase:end"
  | "log";
```

Every event contains context and envelope fields:

```typescript
interface WorkflowEventContext {
  readonly workflowId: string;
  readonly parentWorkflowId?: string;
  readonly depth: number;
  readonly scriptPath: string;
}

interface WorkflowEventEnvelope {
  readonly sequence: number;
  readonly timestamp: string;
}
```

Event-specific fields:

| Event                  | Additional fields           |
| ---------------------- | --------------------------- |
| `workflow:start`       | None                        |
| `workflow:end`         | `durationMs`                |
| `workflow:error`       | `durationMs`, `error`       |
| `workflow:phase:start` | `phase`                     |
| `workflow:phase:end`   | `phase`, `durationMs`       |
| `log`                  | `message`, optional `phase` |

Errors are represented as JSON-safe objects:

```typescript
interface SerializedWorkflowError {
  readonly name: string;
  readonly message: string;
  readonly stack?: string;
}
```

### `WorkflowEventEmitter`

```typescript
class WorkflowEventEmitter {
  on(listener: WorkflowEventListener): () => void;
  off(listener: WorkflowEventListener): boolean;
  emit(input: WorkflowEventInput): WorkflowEvent;
  clear(): void;
  get listenerCount(): number;
}
```

A synchronous, typed Event Emitter. `emit()` adds a monotonically increasing
`sequence` and an ISO-8601 `timestamp`. Listeners run synchronously in
subscription order.

### `createJsonEventWriter()`

```typescript
function createJsonEventWriter(
  logWriter?: (line: string) => void,
): WorkflowEventListener;
```

Creates a listener that serializes each event as compact JSON. The writer is
called once per event without a trailing newline and defaults to `console.log`.

### `serializeWorkflowError()`

```typescript
function serializeWorkflowError(error: unknown): SerializedWorkflowError;
```

Converts any thrown value into a JSON-safe object containing `name`, `message`,
and an optional `stack`.

## Runner

### `WorkflowRunner`

```typescript
class WorkflowRunner {
  readonly events: WorkflowEventEmitter;

  constructor(options?: WorkflowRunnerOptions);

  run<TOutput = unknown, TArgs = unknown>(
    target: WorkflowTarget,
    args?: TArgs,
  ): Promise<TOutput>;

  on(listener: WorkflowEventListener): () => void;
  dispose(): void;
}
```

Runs Workflows and exposes lifecycle, phase, and log events through one stream.
By default, each event is written to stdout as one JSON line. A Runner can be
reused and can execute Workflows concurrently; its async contexts remain
isolated while all events share one increasing sequence.

```typescript
interface WorkflowRunnerOptions {
  readonly logWriter?: (line: string) => void;
  readonly emitter?: WorkflowEventEmitter;
}
```

`dispose()` removes the JSON writer installed by the constructor without
clearing external Emitter listeners. A disposed Runner cannot start new
executions.

## Examples

- [Deep Research](../src/examples/deep-research/README.md) combines `agent()`,
  `phase()`, `parallel()`, `log()`, and `WorkflowRunner`.
- [Blog Writer](../src/examples/blog-writer/README.md) combines `agent()`,
  `phase()`, `pipeline()`, `log()`, and `WorkflowRunner`.
