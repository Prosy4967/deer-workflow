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
- `deer-workflow create`：让 Codex 根据用户的编排需求执行内置 Workflow
  Creator Skill。

完整的函数和类型签名参见 [API Reference](./api.zh-CN.md)。
[Workflow Creator Skill](../skills/workflow-creator/SKILL.md) 可以指导 Coding
Agent 按照当前已经实现的 API 契约生成 Workflow 模块。

## 安装命令行

安装 Bun，以及默认 Agent Runtime 使用的 Codex CLI：

```bash
npm install -g @openai/codex
codex login
codex --version
```

Codex CLI 与 Codex Desktop 是两个独立安装。Desktop 应用不会提供默认 Agent
Runtime 所需的 `codex` 可执行文件。检测不到命令时，Deer Workflow 会在启动
任何 Agent 进程前输出上述安装步骤。

在首个 npm 版本发布前，直接从 GitHub 全局安装 `deer-workflow`：

```bash
bun install --global git+https://github.com/deer-flow/deer-workflow.git
deer-workflow --help
```

`@deer-flow/workflow` 发布到 npm 后，使用下面的命令安装正式版本：

```bash
bun install --global @deer-flow/workflow
```

不带 `--global` 的 `bun install` 不会全局安装 CLI；它只在当前项目中安装本地
依赖，属于下文的开发环境初始化步骤。

Codex CLI 只是默认实现。其他 Coding Agent 可以通过实现 `Agent` 接口接入。

## 编写第一个 Workflow

Workflow 是一个导出 `default` 函数或 `run()` 函数的 TypeScript 模块。API
通过普通 ESM import 引入；Runtime 不会向 Handler 注入 `agent()`、`parallel()`
等函数：

```typescript
// workflows/research.ts
import { agent, log, parallel, phase } from "@deer-flow/workflow";

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

`phase()` 用来标记一段可观察的工作阶段。切换到新阶段时，运行时会自动结束
上一阶段；Workflow 成功或失败时，仍处于活动状态的阶段也会自动结束。

`meta` 为生成的 Workflow 提供稳定的名称、描述和阶段声明，其中的阶段标题应与
`phase()` 调用完全一致。当前 Runner 接受但尚未消费这个 Export。

## 创建 Workflow

描述希望得到的编排方式并生成模块：

```bash
deer-workflow create \
  "并行研究多个独立角度，验证关键结论，最后汇编成报告" \
  > workflow.ts
```

`create` 会显式指向内置的 `skills/workflow-creator/SKILL.md`，在后面追加用户
Prompt，并把原始源码写入 stdout。它也支持从 stdin 读取 Prompt，但不会自动
执行生成的 Workflow。

## 运行 Workflow

从 Shell 启动 Workflow 时可以使用 CLI：

```bash
deer-workflow run ./examples/deep-research/workflow.ts \
  --input '{"question":"Agent Skills 与 Dynamic Workflows 正在如何演进？"}'
```

最终结果写入 stdout，Workflow 事件以 JSON Lines 写入 stderr。较长的 JSON
Input 可以使用 `--input-file` 或 stdin。`--input` 和 `--input-file` 都优先于
stdin，且两者不能同时使用。

从宿主程序启动同一个 Workflow 时使用 `WorkflowRunner`：

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

独立使用 Runner 时，默认通过 `console.log()` 向 stdout 输出 JSON Lines。
CLI 会把这个输出目标覆盖为 stderr，从而让 stdout 只保留最终结果：

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

- [Deep Research](../examples/deep-research/README.zh-CN.md)：使用
  `parallel()` 并行研究多个独立角度，再进行结构化汇编。
- [Blog Writer](../examples/blog-writer/README.zh-CN.md)：使用 `pipeline()`
  让每个章节独立通过起草和审校阶段。

## 开发门禁

克隆仓库并在仓库中运行 `bun install`。它会安装本地开发依赖、执行 `prepare`
脚本，并安装 Husky pre-commit Hook：

```bash
git clone https://github.com/deer-flow/deer-workflow.git
cd deer-workflow
bun install
```

每次提交时，先由 `lint-staged` 对 Git 暂存文件执行 ESLint 和 Prettier，再对
完整 TypeScript 项目执行类型检查。Lint-staged 保留默认的临时 stash 和失败
回滚机制，避免破坏部分暂存的工作区。

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
