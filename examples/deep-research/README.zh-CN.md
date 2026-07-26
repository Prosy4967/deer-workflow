# Deep Research 示例

[English](./README.md) | [简体中文](./README.zh-CN.md)

查看生成产物示例：[如何看待中国的 Neo Labs](./example-reports/understanding-chinas-neo-labs.zh-CN.html)。

这个 Workflow 把需要主观判断的研究任务与确定性编排分开：

```text
探索搜索 → 规划 → 并行研究 → 汇编 → 展示
```

探索阶段会在规划前进行一次轻量搜索，先识别研究对象、当前背景、种子来源与关键
歧义，避免 Planner 在不了解对象的情况下直接设计研究角度。

安装 CLI 后，在仓库根目录运行：

```bash
deer-workflow run ./examples/deep-research/workflow.ts \
  --input '{"question":"Agent Skills 与 Dynamic Workflows 正在如何演进？","outputPath":"./report.html"}'
open report.html
```

最后的 Present 阶段会请求操作系统自动打开报告；上面的显式 `open` 命令只是
方便用户在自动打开失败时手动执行。

服务端以及 CI/CD、任务队列、进程管道等自动化流程应使用 `--print` 或 `-p`：

```bash
deer-workflow run ./examples/deep-research/workflow.ts -p \
  --input '{"question":"Agent Skills 与 Dynamic Workflows 正在如何演进？","outputPath":"./report.html"}' \
  > research-events.jsonl
```

Workflow 仍会写入并展示 HTML 文件。Print Mode 仅抑制单独的返回值，stdout
保持每行一个 JSON Workflow 事件，stderr 仅用于诊断。

也可以通过 `WorkflowRunner` 在程序中运行：

```typescript
import { WorkflowRunner } from "@deerwork-ai/deer-workflow/runner";

const runner = new WorkflowRunner();

try {
  const result = await runner.run<{ outputPath: string }>(
    "./examples/deep-research/workflow.ts",
    {
      question: "Agent Skills 与 Dynamic Workflows 正在如何演进？",
      outputPath: "./report.html",
    },
  );
  console.log(result.outputPath);
} finally {
  runner.dispose();
}
```

Plan 阶段会提出一个描述性的 HTML 文件名；显式传入的 `outputPath` 会覆盖该
建议。已有文件绝不会被覆盖：重名时依次写为 `report-2.html`、
`report-3.html`。研究 Agent 返回带来源的结构化发现。失败的并行分支会变成
`null`，汇编阶段只会接收成功完成的研究结果，并根据证据动态设计报告的栏目与
顺序，不套用固定文章大纲。生成产物是精美的自包含 HTML 报告，内嵌 CSS 与
JavaScript，支持发现筛选、来源折叠、主题切换和打印样式，无需任何外部资源。
Workflow 最终只返回包含绝对文件地址和自动展示状态的简洁元数据，不会向终端
打印原始 HTML。
