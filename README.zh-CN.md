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

一个开源的 Dynamic Workflow Runtime：用 TypeScript 承载确定性编排，把需要
语义理解和判断的工作交给可替换的 Agent Runtime。

默认的 `agent()` 实现会运行一次完整的 Codex CLI Agent Loop。

## 目录

- [与 DeerFlow 的关系](#与-deerflow-的关系)
- [前置条件](#前置条件)
- [项目命令](#项目命令)
- [Flow Controls](#flow-controls)
- [Workflow Events 与 Runner](#workflow-events-与-runner)
- [Logging](#logging)
- [JSON Schema 输出](#json-schema-输出)
- [接入其他 Coding Agent](#接入其他-coding-agent)

## 与 DeerFlow 的关系

`deer-workflow` 是 **DeerFlow 3.0**（即 **DeerWork**）的试点项目。

它源自拥有约 78,000 GitHub Stars 的开源 SuperAgent Harness
[DeerFlow](https://github.com/bytedance/deer-flow)。DeerFlow 提供长时间运行
Agent、Skills、Tools、Memory、Sandbox 和 Sub-agents 等完整能力；本项目从
下一代架构中抽出 Dynamic Workflow，通过一个小而专注的代码库验证：
TypeScript 确定性控制流与可替换 Agent Runtime 能否自然协作。

项目仍处于实验阶段，API 和运行时行为可能发生变化。

## 前置条件

项目使用 Bun。默认 Agent Runtime 还要求系统中存在 `codex` 命令：

```bash
curl -fsSL https://chatgpt.com/codex/install.sh | sh
codex login
codex --version
```

安装项目依赖：

```bash
bun install
```

运行 CLI：

```bash
bun run dev -- agent "分析这个仓库并概述它的结构。"
```

## 项目命令

| 命令 | 用途 |
| --- | --- |
| `bun run dev -- <args>` | 直接运行 `src/cli.ts` 并转发参数。 |
| `bun test` | 运行 `tests/` 下的全部测试。 |
| `bun run typecheck` | 执行 TypeScript 类型检查，不生成构建文件。 |
| `bun run check` | 依次运行类型检查和完整测试。 |

提交 Pull Request 前请运行：

```bash
bun run check
```

## Flow Controls

`parallel()` 同时启动一组任务，并在 Barrier 等待它们全部完成。
`pipeline()` 则允许每个输入独立进入下一处理阶段。单个任务失败会变成
`null`，不会取消其他任务。

```typescript
import {
  parallel,
  pipeline,
} from "deer-workflow/flow";

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

`workflow()` 加载 Workflow 模块并注入参数和执行上下文，`phase()` 标记当前
进度阶段。Workflow 模块可以导出 `default` 函数或具名 `run()` 函数：

```typescript
// workflows/release.ts
import {
  parallel,
  phase,
} from "deer-workflow/flow";

export default async function release(args: { version: string }) {
  phase("Build");
  return parallel([
    () => build("macos", args.version),
    () => build("linux", args.version),
    () => build("windows", args.version),
  ]);
}
```

从宿主程序或另一个 Workflow 中运行它：

```typescript
import { workflow } from "deer-workflow/flow";

const artifacts = await workflow(
  { scriptPath: "./workflows/release.ts" },
  { version: "3.0.0" },
);
```

嵌套路径相对于父 Workflow 模块解析，目前支持一层 Workflow 嵌套。

## Workflow Events 与 Runner

`WorkflowRunner` 把执行进度暴露为强类型事件流。默认 Writer 使用
`console.log()`，每次向 stdout 输出一行紧凑 JSON：

```typescript
import { WorkflowRunner } from "deer-workflow/runner";

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

事件协议包括：

| 事件 | 含义 |
| --- | --- |
| `workflow:start` | Workflow 即将加载并执行。 |
| `workflow:end` | Workflow 成功完成。 |
| `workflow:error` | Workflow 失败，包含可序列化的错误信息。 |
| `workflow:phase:start` | `phase()` 进入一个新阶段。 |
| `workflow:phase:end` | 阶段完成或因切换而关闭。 |
| `log` | `log()` 发出一条进度消息。 |

每个事件都包含 `sequence`、`timestamp`、`workflowId`、`depth` 和
`scriptPath`。嵌套 Workflow 还包含 `parentWorkflowId`。参数与返回值默认
不会写入事件，避免意外暴露大量数据或敏感业务信息。

传入自定义 `logWriter` 可以把 JSON Lines 发送到文件、Socket、UI 或
Journal：

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

直接调用 `log()` 时，消息默认进入 stderr，不会污染 stdout 上的结构化结果：

```typescript
import { log } from "deer-workflow/logging";

log("Running repository checks");
```

在 `WorkflowRunner.run()` 内部调用时，Runner 会把它转换成 JSON `log`
事件。宿主也可以通过 `withLogSink()` 安装自定义的异步局部 Log Sink。

## JSON Schema 输出

```typescript
import { agent } from "deer-workflow/agents";

const result = await agent<{
  ok: boolean;
  issues: string[];
}>("运行仓库检查并报告失败项。", {
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

Schema 只约束 Agent 的最终响应。`agent()` 仍然代表包含工具调用和推理过程的
完整 Agent Loop，而不是一次普通的 Prompt 调用。

## 接入其他 Coding Agent

Codex CLI 是默认实现，但不是架构上的硬依赖。`Agent` 接口与具体厂商无关，
其他 Coding Agent 可以在不修改 Workflow Runtime 的前提下接入。

欢迎贡献 Claude Code、Gemini CLI、OpenCode 或其他 Coding Agent Adapter。
请在 `src/agents` 中添加实现，同时为文本输出和 JSON Schema 输出补充测试。
