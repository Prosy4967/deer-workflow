# Deep Research 示例

[English](./README.md) | [简体中文](./README.zh-CN.md)

这个 Workflow 把需要主观判断的研究任务与确定性编排分开：

```text
规划 → 并行研究 → 汇编
```

通过 `WorkflowRunner` 运行：

```typescript
import { WorkflowRunner } from "@deer-flow/workflow/runner";

const runner = new WorkflowRunner();

try {
  const report = await runner.run("./src/examples/deep-research/workflow.ts", {
    question: "Agent Skills 与 Dynamic Workflows 正在如何演进？",
  });
} finally {
  runner.dispose();
}
```

研究 Agent 返回带来源的结构化发现。失败的并行分支会变成 `null`，汇编阶段只会
接收成功完成的研究结果。
