# Blog Writer 示例

[English](./README.md) | [简体中文](./README.zh-CN.md)

这个 Workflow 使用确定性的编辑阶段组织 Agent 的主观判断：

```text
大纲 → Pipeline（起草 → 审校）→ 汇编
```

通过 CLI 运行：

```bash
deer-workflow run ./src/examples/blog-writer/workflow.ts \
  --input '{"topic":"为什么 Dynamic Workflow 可以与 Agent Skills 共生","audience":"Agent Builder"}'
```

也可以通过 `WorkflowRunner` 在程序中运行：

```typescript
import { WorkflowRunner } from "@deer-flow/workflow/runner";

const runner = new WorkflowRunner();

try {
  const article = await runner.run("./src/examples/blog-writer/workflow.ts", {
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
