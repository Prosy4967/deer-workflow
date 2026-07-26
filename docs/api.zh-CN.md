# API Reference

[English: README](../README.md) ·
[Guide](./index.md) ·
[API](./api.md) |
[简体中文：README](../README.zh-CN.md) ·
[快速入门](./index.zh-CN.md) ·
[API](./api.zh-CN.md)

所有公开 API 都可以从包根路径导入，也可以使用对应的子路径：

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

通过默认的 `CodexAgent` 运行一次完整的 Codex CLI Agent Loop。没有提供
`schema` 时返回文本；提供 JSON Schema 时读取并解析 Codex 的结构化最终响应。

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

`schema` 只约束 Agent 的最终响应，并不会把 Agent Loop 降级成一次普通模型调用。

### `Agent`

```typescript
interface Agent {
  run<TOutput = string>(
    prompt: string,
    options?: AgentOptions,
  ): Promise<TOutput>;
}
```

实现其他 Coding Agent 集成时应遵循的运行时接口。

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

基于非交互式 `codex exec` 的默认实现。Prompt 通过 stdin 发送；默认使用临时
会话，并在调用结束后删除 Schema 和结果临时文件。

`CodexAgentConfig` 支持：

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

运行失败或 Schema 响应无法解析时抛出 `CodexAgentError`。错误对象保留
`exitCode`、`stdout` 和 `stderr`，便于宿主诊断。

## Flow

### `parallel()`

```typescript
function parallel<const TTasks extends readonly ParallelTask[]>(
  tasks: TTasks,
): Promise<ParallelResults<TTasks>>;
```

同时启动所有惰性任务，并等待它们全部完成。结果顺序与任务顺序一致。单个任务
抛出异常或 Promise rejection 时，对应结果为 `null`，不会取消其他任务。

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

让每个输入独立通过一系列有序阶段。某个输入完成当前阶段后可以立即进入下一
阶段，不需要等待其他输入形成全局 Barrier。

```typescript
const results = await pipeline(
  documents,
  (document) => extract(document),
  (content, original, index) => review(content, original, index),
  (review) => format(review),
);
```

阶段函数接收当前值、原始输入和原始索引：

```typescript
type PipelineStage<TValue, TOriginal, TNext> = (
  value: TValue,
  original: TOriginal,
  index: number,
) => TNext | PromiseLike<TNext>;
```

单个输入失败后会跳过它的剩余阶段，并在原位置返回 `null`。其他输入继续执行。
类型推断覆盖最多五个阶段。

### `phase()`

```typescript
function phase(title: string): void;
```

设置当前 Workflow 的活动阶段。进入新阶段时自动发出上一阶段的
`workflow:phase:end`，然后发出新阶段的 `workflow:phase:start`。在 Workflow
之外调用会抛出 `PhaseContextError`。

### `getCurrentPhase()`

```typescript
function getCurrentPhase(): string | undefined;
```

返回当前阶段名称。Workflow 外部或尚未调用 `phase()` 时返回 `undefined`。

### `workflow()`

```typescript
function workflow<TOutput = unknown, TArgs = unknown>(
  target: string | { scriptPath: string },
  args?: TArgs,
): Promise<TOutput>;
```

加载并运行一个 Workflow 模块。目标模块必须导出 `default` 函数或具名的
`run()` 函数：

```typescript
type WorkflowHandler<TArgs, TOutput> = (
  args: TArgs,
  context: Readonly<WorkflowExecutionContext<TArgs>>,
) => TOutput | PromiseLike<TOutput>;
```

宿主启动的 Workflow 深度为 `0`。嵌套路径相对于父 Workflow 文件解析，目前
最多支持一层嵌套。模块无法加载或没有有效入口时抛出 `WorkflowLoadError`；
超过嵌套限制时抛出 `WorkflowNestingError`。

### `getWorkflowContext()`

```typescript
function getWorkflowContext<TArgs = unknown>():
  WorkflowExecutionContext<TArgs> | undefined;
```

读取当前异步调用链中的 Workflow 上下文：

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

发送一条进度消息。直接使用时默认写入 stderr；在
`WorkflowRunner.run()` 内调用时会转换成 `log` 事件并交给 Runner 的 JSON
Writer。

### `withLogSink()`

```typescript
function withLogSink<TOutput>(
  sink: (message: string) => void,
  callback: () => TOutput,
): TOutput;
```

在一个异步调用链中临时安装自定义 Log Sink。嵌套和并发调用通过
`AsyncLocalStorage` 隔离，回调结束后自动恢复上层 Sink。

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

所有事件都包含：

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

事件特有字段：

| Event                  | Additional fields           |
| ---------------------- | --------------------------- |
| `workflow:start`       | 无                          |
| `workflow:end`         | `durationMs`                |
| `workflow:error`       | `durationMs`, `error`       |
| `workflow:phase:start` | `phase`                     |
| `workflow:phase:end`   | `phase`, `durationMs`       |
| `log`                  | `message`, optional `phase` |

`workflow:error` 中的错误是可以安全序列化的对象：

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

同步、强类型的事件发射器。`emit()` 自动添加递增的 `sequence` 和 ISO-8601
格式的 `timestamp`。Listener 按订阅顺序同步执行。

### `createJsonEventWriter()`

```typescript
function createJsonEventWriter(
  logWriter?: (line: string) => void,
): WorkflowEventListener;
```

创建一个把事件序列化成紧凑 JSON 的 Listener。每个事件调用 Writer 一次，
传入内容不带结尾换行。默认 Writer 为 `console.log`。

### `serializeWorkflowError()`

```typescript
function serializeWorkflowError(error: unknown): SerializedWorkflowError;
```

把任意抛出值转换为包含 `name`、`message` 和可选 `stack` 的 JSON-safe 对象。

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

运行 Workflow，并把生命周期、阶段和日志转换为统一事件流。默认将每个事件
作为一行 JSON 输出到 stdout。同一个 Runner 可以被复用或用于并发执行；
所有运行共享一个递增事件序列，异步上下文保持隔离。

```typescript
interface WorkflowRunnerOptions {
  readonly logWriter?: (line: string) => void;
  readonly emitter?: WorkflowEventEmitter;
}
```

`dispose()` 会移除构造函数安装的 JSON Writer，保留外部注册到 Emitter 的
Listener。释放后的 Runner 不能启动新的 Workflow。

## 示例

- [Deep Research](../src/examples/deep-research/README.zh-CN.md)：组合使用
  `agent()`、`phase()`、`parallel()`、`log()` 和 `WorkflowRunner`。
- [Blog Writer](../src/examples/blog-writer/README.zh-CN.md)：组合使用
  `agent()`、`phase()`、`pipeline()`、`log()` 和 `WorkflowRunner`。
