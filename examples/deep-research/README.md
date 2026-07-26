# Deep Research example

[English](./README.md) | [简体中文](./README.zh-CN.md)

See a sample of the generated output:
[Understanding China's Neo Labs](./example-reports/understanding-chinas-neo-labs.html).

This Workflow separates subjective research work from deterministic
orchestration:

```text
Discovery Search → Plan → Parallel Research → Synthesis → Present
```

The discovery pass performs a lightweight search before planning. It identifies
the subject, current context, seed sources, and important ambiguities so the
Planner does not design research angles from an uninformed prompt.

After installing the CLI, run it from the repository root:

```bash
deer-workflow run ./examples/deep-research/workflow.ts \
  --input '{"question":"How are Agent Skills and Dynamic Workflows evolving?","outputPath":"./report.html"}'
open report.html
```

The final Present phase asks the operating system to open the report
automatically. The explicit `open` command above is only a convenient fallback.

For servers and automation such as CI/CD, task queues, and process pipelines,
use `--print` or `-p`:

```bash
deer-workflow run ./examples/deep-research/workflow.ts -p \
  --input '{"question":"How are Agent Skills and Dynamic Workflows evolving?","outputPath":"./report.html"}' \
  > research-events.jsonl
```

The HTML artifact is still written and presented by the Workflow. Print Mode
suppresses only the separate result record; stdout remains one JSON Workflow
event per line and stderr is reserved for diagnostics.

Or run it programmatically through `WorkflowRunner`:

```typescript
import { WorkflowRunner } from "@deerwork-ai/deer-workflow/runner";

const runner = new WorkflowRunner();

try {
  const result = await runner.run<{ outputPath: string }>(
    "./examples/deep-research/workflow.ts",
    {
      question: "How are Agent Skills and Dynamic Workflows evolving?",
      outputPath: "./report.html",
    },
  );
  console.log(result.outputPath);
} finally {
  runner.dispose();
}
```

During Plan, the Agent proposes a descriptive HTML filename. An explicit
`outputPath` overrides that proposal. Existing files are never overwritten:
collisions become `report-2.html`, `report-3.html`, and so on. The research
Agents return source-backed structured findings. Failed parallel branches
become `null`; the synthesis stage receives only completed findings and
designs the report's editorial sections dynamically from the evidence.
The generated artifact is a polished, self-contained HTML report with embedded
CSS and JavaScript, searchable sections, collapsible sources, theme switching,
and print styles. It needs no external assets and can be opened directly. The
Workflow returns compact metadata containing the absolute file path and whether
automatic presentation succeeded, rather than printing raw HTML.
