# Blog Writer example

[English](./README.md) | [简体中文](./README.zh-CN.md)

This Workflow combines deterministic editorial stages with Agent judgment:

```text
Outline → Pipeline(Draft → Review) → Assembly
```

Run it through `WorkflowRunner`:

```typescript
import { WorkflowRunner } from "@deer-flow/workflow/runner";

const runner = new WorkflowRunner();

try {
  const article = await runner.run("./src/examples/blog-writer/workflow.ts", {
    topic: "Why Dynamic Workflows complement Agent Skills",
    audience: "Agent builders",
    tone: "opinionated and practical",
    keywords: ["ReAct Loop", "deterministic orchestration"],
  });
} finally {
  runner.dispose();
}
```

Each section advances independently from drafting to editorial review. A failed
section does not cancel the rest of the article Pipeline.
