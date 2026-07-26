# Blog Writer 示例

[English](./README.md) | [简体中文](./README.zh-CN.md)

这个 Workflow 使用确定性的编辑阶段组织 Agent 的主观判断：

```text
大纲 → Pipeline（起草 → 审校）→ 汇编
```

安装 CLI 后，在仓库根目录运行：

```bash
deer-workflow run ./examples/blog-writer/workflow.ts \
  --input '{"topic":"为什么 Dynamic Workflow 可以与 Agent Skills 共生","audience":"Agent Builder"}'
```

服务端及 CI/CD、任务队列、进程管道等自动化流程应使用 `--print` 或 `-p`，
让 stdout 输出 JSONL Event Stream：

```bash
deer-workflow run ./examples/blog-writer/workflow.ts -p \
  --input '{"topic":"为什么 Dynamic Workflow 可以与 Agent Skills 共生","audience":"Agent Builder"}' \
  > blog-events.jsonl
```

Print Mode 会禁用 TUI 并抑制单独的文章返回值，保证 stdout 每行都是一个
Workflow 事件；CLI 诊断仍写入 stderr。

也可以通过 `WorkflowRunner` 在程序中运行：

```typescript
import { WorkflowRunner } from "@deerwork-ai/deer-workflow/runner";

const runner = new WorkflowRunner();

try {
  const article = await runner.run("./examples/blog-writer/workflow.ts", {
    topic: "为什么 Dynamic Workflow 可以与 Agent Skills 共生",
    audience: "Agent Builder",
    tone: "有观点且务实",
    keywords: ["ReAct Loop", "确定性编排"],
  });
} finally {
  runner.dispose();
}
```

每个章节独立地从起草阶段进入编辑审校阶段。单个章节失败不会取消 Pipeline 中的
其他章节。
