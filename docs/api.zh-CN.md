# API Reference

[English: README](../README.md) ·
[Guide](./index.md) ·
[API](./api.md) |
[简体中文：README](../README.zh-CN.md) ·
[快速入门](./index.zh-CN.md) ·
[API](./api.zh-CN.md)

所有公开 API 都可以从包根路径导入，也可以使用对应的子路径：

```typescript
import {
  agent,
  log,
  parallel,
  phase,
  pipeline,
  workflow,
  WorkflowEventEmitter,
  WorkflowRunner,
} from "@deer-flow/workflow";
```

也可以使用等价的子路径：

```typescript
import { agent } from "@deer-flow/workflow/agents";
import { parallel, phase, pipeline, workflow } from "@deer-flow/workflow/flow";
import { WorkflowEventEmitter } from "@deer-flow/workflow/events";
import { log } from "@deer-flow/workflow/logging";
import { WorkflowRunner } from "@deer-flow/workflow/runner";
```

## Workflow 模块契约

一个可运行的 Workflow 模块使用显式 ESM import，并通过 `default` 或具名的
`run` 导出 Handler。

### `meta`

Workflow 可以通过静态的 `meta` 导出描述自身：

```typescript
export const meta = {
  name: "workflow-name",
  description: "One-line description.",
  phases: [{ title: "Plan" }, { title: "Execute" }],
};
```

- `name` 是稳定的 kebab-case 标识符。
- `description` 是一行 Workflow 简介。
- `phases` 是按执行顺序排列的 `{ title }` 列表，其标题应与 Workflow 中的
  `phase()` 调用完全一致。

`meta` 必须能被静态读取：只使用字面量、数组和对象，不要使用变量、函数调用、
spread、计算属性或模板字符串。`meta` 目前是面向未来的编写契约：Runner 允许
存在该导出，但尚不会读取、校验它，也不会将其写入事件。

### Handler 参数

```typescript
type WorkflowHandler<TArgs, TOutput> = (
  args: TArgs,
  context: Readonly<WorkflowExecutionContext<TArgs>>,
) => TOutput | PromiseLike<TOutput>;
```

`args` 是调用方传入的数据，应作为 Handler 的第一个参数。它不是
`globalThis.args` 之类的 JavaScript 全局变量。CLI 未提供输入时，其值为
`undefined`。

第二个参数 `context` 是当前执行上下文，其中包含 Runner、生命周期、Phase、事件
与日志能力。Workflow 不使用这些信息时，无须声明该参数。

### Runtime 上下文与 Imports

Workflow API 需要从 `@deer-flow/workflow` 显式导入。CLI 不会把 `agent`、
`parallel`、`pipeline`、`phase`、`workflow` 或 `log` 注入为全局变量。Runner
会在调用 Handler 前建立异步执行上下文，使这些已导入的 API 能安全访问当前
Workflow 的生命周期。

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
直接调用失败时 Promise 会被 reject；`agent()` 本身不会把错误转换成 `null`。

### `defaultAgent`

```typescript
const defaultAgent: CodexAgent;
```

导出的 `agent()` 函数所使用的共享 `CodexAgent` 实例。

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

无法解析配置的可执行文件时，`run()` 会在创建临时文件或启动进程之前抛出
`CodexCliNotFoundError`。错误信息包含官方 npm 安装命令、登录和版本检查，并
明确说明 Codex CLI 与 Codex Desktop 需要分别安装。

## Flow

### `parallel()`

```typescript
function parallel<const TTasks extends readonly ParallelTask[]>(
  tasks: TTasks,
): Promise<ParallelResults<TTasks>>;
```

同时启动所有惰性任务，并等待它们全部完成。结果顺序与任务顺序一致。单个任务
抛出异常或 Promise rejection 时，对应结果为 `null`，不会取消其他任务。

当前实现会立即启动传入的全部任务，没有对外承诺并发数或条目数上限。

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

第一个阶段收到的 `value` 就是原始输入，并不是 `undefined`。
单个输入失败后会跳过它的剩余阶段，并在原位置返回 `null`。其他输入继续执行。
类型推断覆盖最多五个阶段。

### `phase()`

```typescript
function phase(title: string): void;
```

设置当前 Workflow 的活动阶段。进入新阶段时自动发出上一阶段的
`workflow:phase:end`，然后发出新阶段的 `workflow:phase:start`。在 Workflow
之外调用会抛出 `PhaseContextError`。应在进入 `parallel()` 或 `pipeline()`
之前设置阶段；从并发分支中修改共享阶段会产生竞态。

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
超过嵌套限制时抛出 `WorkflowNestingError`。调用方没有提供 Input 时，Handler
收到的 `args` 为 `undefined`。

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

### CLI

通过默认的 Codex Agent 运行一次任务：

```text
deer-workflow agent "Inspect this repository"
echo "Inspect this repository" | deer-workflow agent
```

Agent 的最终响应写入 stdout。用法错误和 Agent 错误写入 stderr，并返回非零
退出码。

通过内置 Workflow Creator Skill 生成 Workflow：

```text
deer-workflow create "Describe the Workflow"
echo "Describe the Workflow" | deer-workflow create
```

`create` 从已安装的包中定位内置 Skill，让 Codex 读取它及其要求的 references，
然后追加用户 Prompt。Codex 使用只读 Sandbox，并允许在 Git 仓库外运行。命令
会移除包裹完整响应的一层 Markdown 源码围栏，因此 stdout 可以直接重定向到
`.ts` 或 `.js` 文件。生成的 Workflow 不会自动执行。

运行 Workflow 模块：

```text
deer-workflow run <workflow>
deer-workflow run <workflow> --input '<json>'
deer-workflow run <workflow> --input-file <path>
echo '<json>' | deer-workflow run <workflow>
```

`run` 不允许同时使用 `--input` 与 `--input-file`。Input 的读取顺序为
`--input`、`--input-file`、非空 stdin；显式参数优先于 stdin。JSON 无法解析、
Workflow 无法加载或执行失败时，命令返回非零退出码。

CLI 会创建 `WorkflowRunner`，并把 JSONL 事件写入 stderr。字符串结果直接写入
stdout，其他可 JSON 序列化的值写成紧凑 JSON，返回 `undefined` 时不输出结果行。

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

运行 Workflow，并把生命周期、阶段和日志转换为统一事件流。独立使用 Runner
时，默认将每个事件作为一行 JSON 输出到 stdout；CLI 会改用 stderr Writer。
同一个 Runner 可以被复用或用于并发执行，所有运行共享一个递增事件序列，
异步上下文保持隔离。

```typescript
interface WorkflowRunnerOptions {
  readonly logWriter?: (line: string) => void;
  readonly emitter?: WorkflowEventEmitter;
}
```

`dispose()` 会移除构造函数安装的 JSON Writer，保留外部注册到 Emitter 的
Listener。释放后的 Runner 不能启动新的 Workflow。

## 示例

- [Deep Research](../examples/deep-research/README.zh-CN.md)：组合使用
  `agent()`、`phase()`、`parallel()`、`log()` 和 `WorkflowRunner`。
- [Blog Writer](../examples/blog-writer/README.zh-CN.md)：组合使用
  `agent()`、`phase()`、`pipeline()`、`log()` 和 `WorkflowRunner`。
