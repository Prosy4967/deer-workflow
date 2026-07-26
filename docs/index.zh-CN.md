# Deer Workflow

[English: README](../README.md) ·
[Guide](./index.md) ·
[API](./api.md) |
[简体中文：README](../README.zh-CN.md) ·
[快速入门](./index.zh-CN.md) ·
[API](./api.zh-CN.md)

Deer Workflow 是 DeerFlow 3.0（DeerWork）的试点项目。它用 TypeScript
承载稳定、可重复的控制流，把需要理解语义和作出判断的工作交给可替换的
Coding Agent。

项目目前提供四组核心能力：

- `agent()`：运行完整的 Agent Loop，默认使用 Codex CLI。
- `parallel()` 与 `pipeline()`：组织并发任务和流式处理阶段。
- `workflow()`、`phase()` 与 `log()`：加载 Workflow 模块并报告执行进度。
- `WorkflowRunner`：把执行过程转换成可供 CLI、UI 或 Journal 消费的 JSON
  事件流。

完整的函数和类型签名参见 [API Reference](./api.zh-CN.md)。

## 安装

项目使用 Bun：

```bash
bun install
```

默认的 Agent 实现还要求系统中已安装并登录 Codex CLI：

```bash
curl -fsSL https://chatgpt.com/codex/install.sh | sh
codex login
codex --version
```

Codex CLI 只是默认实现。其他 Coding Agent 可以通过实现 `Agent` 接口接入。

## 编写第一个 Workflow

Workflow 是一个导出 `default` 函数或 `run()` 函数的 TypeScript 模块：

```typescript
// workflows/research.ts
import { agent } from "@deer-flow/workflow/agents";
import { parallel, phase } from "@deer-flow/workflow/flow";
import { log } from "@deer-flow/workflow/logging";

interface ResearchInput {
  topics: string[];
}

export default async function research(args: ResearchInput) {
  phase("Research");
  log(`Researching ${args.topics.length} topics`);

  const findings = await parallel(
    args.topics.map(
      (topic) => () =>
        agent(`Research this topic and summarize the findings: ${topic}`),
    ),
  );

  phase("Synthesis");
  return agent(
    `Synthesize these findings into a concise report:\n${JSON.stringify(
      findings,
    )}`,
  );
}
```

`phase()` 用来标记一段可观察的工作阶段。切换到新阶段时，运行时会自动结束
上一阶段；Workflow 成功或失败时，仍处于活动状态的阶段也会自动结束。

## 运行 Workflow

推荐通过 `WorkflowRunner` 从宿主程序启动 Workflow：

```typescript
import { WorkflowRunner } from "@deer-flow/workflow/runner";

const runner = new WorkflowRunner();

try {
  const report = await runner.run<string>("./workflows/research.ts", {
    topics: ["Agent Skills", "Dynamic Workflow"],
  });
} finally {
  runner.dispose();
}
```

默认情况下，Runner 会通过 `console.log()` 向 stdout 输出 JSON Lines。每一行
都是一个完整事件：

```json
{"type":"workflow:start","workflowId":"…","depth":0,"scriptPath":"/project/workflows/research.ts","sequence":1,"timestamp":"2026-07-26T08:00:00.000Z"}
{"type":"workflow:phase:start","workflowId":"…","depth":0,"scriptPath":"/project/workflows/research.ts","phase":"Research","sequence":2,"timestamp":"2026-07-26T08:00:00.010Z"}
{"type":"log","workflowId":"…","depth":0,"scriptPath":"/project/workflows/research.ts","phase":"Research","message":"Researching 2 topics","sequence":3,"timestamp":"2026-07-26T08:00:00.020Z"}
```

可用的事件包括：

- `workflow:start`
- `workflow:end`
- `workflow:error`
- `workflow:phase:start`
- `workflow:phase:end`
- `log`

事件默认不携带 Workflow 参数和返回值，避免将大对象或敏感业务数据意外写入
日志。

## 接入自己的输出

`logWriter` 每次接收一行已经序列化好的 JSON：

```typescript
const lines: string[] = [];
const runner = new WorkflowRunner({
  logWriter: (line) => lines.push(line),
});
```

需要直接处理强类型事件时，可以订阅 Runner：

```typescript
const unsubscribe = runner.on((event) => {
  progressView.update(event);
});

await runner.run("./workflows/research.ts");
unsubscribe();
runner.dispose();
```

同一个 Runner 可以并发执行多个 Workflow。每次执行的异步上下文彼此隔离，
事件则共享一个递增的 `sequence`，宿主可以据此还原实际发生顺序。

## 示例

- [Deep Research](../src/examples/deep-research/README.zh-CN.md)：使用
  `parallel()` 并行研究多个独立角度，再进行结构化汇编。
- [Blog Writer](../src/examples/blog-writer/README.zh-CN.md)：使用 `pipeline()`
  让每个章节独立通过起草和审校阶段。

## 开发门禁

`bun install` 会运行 `prepare` 脚本并安装 Husky pre-commit Hook。每次提交时，
先由 `lint-staged` 对 Git 暂存文件执行 ESLint 和 Prettier，再对完整 TypeScript
项目执行类型检查。Lint-staged 保留默认的临时 stash 和失败回滚机制，避免破坏
部分暂存的工作区。

## 项目命令

| 命令                    | 用途                           |
| ----------------------- | ------------------------------ |
| `bun run dev -- <args>` | 直接运行 CLI。                 |
| `bun run lint`          | 使用 ESLint 检查代码。         |
| `bun run lint:fix`      | 应用 ESLint 自动修复。         |
| `bun run format`        | 使用 Prettier 格式化文件。     |
| `bun run format:check`  | 检查格式但不修改文件。         |
| `bun run lint:staged`   | 检查并格式化 Git 暂存文件。    |
| `bun run prepare`       | 安装仓库管理的 Husky Hooks。   |
| `bun test`              | 运行 `tests/` 下的全部测试。   |
| `bun run typecheck`     | 执行 TypeScript 类型检查。     |
| `bun run check`         | 运行全部类型、风格与测试检查。 |
