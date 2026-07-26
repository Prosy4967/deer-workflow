# Blog Writer example

[English](./README.md) | [简体中文](./README.zh-CN.md)

This Workflow combines deterministic editorial stages with Agent judgment:

```text
Outline → Pipeline(Draft → Review) → Assembly
```

After installing the CLI, run it from the repository root:

```bash
deer-workflow run ./examples/blog-writer/workflow.ts \
  --input '{"topic":"Why Dynamic Workflows complement Agent Skills","audience":"Agent builders"}'
```

For servers and automated workflows—including CI/CD, task queues, and process
pipelines—use `--print` or `-p` to expose a JSONL Event Stream on stdout:

```bash
deer-workflow run ./examples/blog-writer/workflow.ts -p \
  --input '{"topic":"Why Dynamic Workflows complement Agent Skills","audience":"Agent builders"}' \
  > blog-events.jsonl
```

Print Mode disables the TUI and suppresses the separate article result so every
stdout line is one Workflow event. CLI diagnostics remain on stderr.

Or run it programmatically through `WorkflowRunner`:

```typescript
import { WorkflowRunner } from "@deerwork-ai/deer-workflow/runner";

const runner = new WorkflowRunner();

try {
  const article = await runner.run("./examples/blog-writer/workflow.ts", {
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
