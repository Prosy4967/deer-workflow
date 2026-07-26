# Deep Research example

[English](./README.md) | [简体中文](./README.zh-CN.md)

This Workflow separates subjective research work from deterministic
orchestration:

```text
Plan → Parallel Research → Synthesis
```

Run it from the CLI:

```bash
deer-workflow run ./src/examples/deep-research/workflow.ts \
  --input '{"question":"How are Agent Skills and Dynamic Workflows evolving?"}'
```

Or run it programmatically through `WorkflowRunner`:

```typescript
import { WorkflowRunner } from "@deer-flow/workflow/runner";

const runner = new WorkflowRunner();

try {
  const report = await runner.run("./src/examples/deep-research/workflow.ts", {
    question: "How are Agent Skills and Dynamic Workflows evolving?",
  });
} finally {
  runner.dispose();
}
```

The research Agents return source-backed structured findings. Failed parallel
branches become `null`; the synthesis stage receives only completed findings.
