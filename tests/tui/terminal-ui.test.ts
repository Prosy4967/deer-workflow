import { describe, expect, test } from "bun:test";

import type { WorkflowEvent } from "@deerwork-ai/deer-workflow/events";

import { TerminalUI } from "../../src/tui";

class MemoryTerminal {
  readonly chunks: string[] = [];

  constructor(
    readonly isTTY: boolean,
    readonly columns = 100,
    readonly rows = 24,
  ) {}

  write(chunk: string): void {
    this.chunks.push(chunk);
  }
}

describe("TerminalUI", () => {
  test("renders a complete interactive task and next command", () => {
    const stream = new MemoryTerminal(true);
    const task = new TerminalUI({
      stream,
      environment: { TERM: "xterm-256color" },
    }).startTask({
      activity: "Generating a Workflow with Codex",
      estimate: "Usually takes 1–5 minutes",
      successMessage: "Workflow generated",
      failureMessage: "Workflow generation failed",
      nextSteps: [
        {
          label: "Run the generated Workflow",
          command: "deer-workflow run ./workflow.ts",
        },
      ],
    });

    task.succeed();

    const output = stream.chunks.join("");
    expect(output).toContain("🦌");
    expect(output).toContain("Deer Workflow");
    expect(output).toContain("Generating a Workflow with Codex");
    expect(output).toContain("Usually takes 1–5 minutes");
    expect(output).toContain("⠋");
    expect(output).toContain("✓");
    expect(output).toContain("Workflow generated");
    expect(output).toContain("Next");
    expect(output).toContain("Run the generated Workflow");
    expect(output).toContain("deer-workflow run ./workflow.ts");
  });

  test("renders next steps discovered while the task is running", () => {
    const stream = new MemoryTerminal(true);
    const task = new TerminalUI({
      stream,
      environment: { TERM: "xterm-256color", NO_COLOR: "" },
    }).startTask({
      activity: "Generating a Workflow with Codex",
      estimate: "Usually takes 1–5 minutes",
      successMessage: "Workflow generated",
      failureMessage: "Workflow generation failed",
    });

    task.succeed({
      nextSteps: [
        {
          label: "Run the generated Workflow",
          command: `deer-workflow run ./workflow.ts --input '{"topic":"Your topic"}'`,
        },
      ],
    });

    expect(stream.chunks.join("")).toContain(
      `--input '{"topic":"Your topic"}'`,
    );
  });

  test("renders a failure state once", () => {
    const stream = new MemoryTerminal(true);
    const task = new TerminalUI({
      stream,
      environment: { TERM: "xterm-256color" },
    }).startTask({
      activity: "Running the Workflow",
      estimate: "Usually takes a few seconds to several minutes",
      successMessage: "Workflow completed",
      failureMessage: "Workflow failed",
    });

    task.fail();
    task.fail();
    task.succeed();

    const output = stream.chunks.join("");
    expect(output).toContain("✗");
    expect(output).toContain("Workflow failed");
    expect(output).not.toContain("Workflow completed");
  });

  test("preserves event lines without TUI output outside a TTY", () => {
    const stream = new MemoryTerminal(false);
    const task = new TerminalUI({ stream }).startTask({
      activity: "Running the Workflow",
      estimate: "Usually takes a few seconds to several minutes",
      successMessage: "Workflow completed",
      failureMessage: "Workflow failed",
    });

    task.writeLine('{"type":"workflow:start"}');
    task.succeed();

    expect(stream.chunks.join("")).toBe('{"type":"workflow:start"}\n');
  });

  test("disables visual output for a dumb terminal", () => {
    const stream = new MemoryTerminal(true);
    const task = new TerminalUI({
      stream,
      environment: { TERM: "dumb" },
    }).startTask({
      activity: "Running the Workflow",
      estimate: "Usually takes a few seconds to several minutes",
      successMessage: "Workflow completed",
      failureMessage: "Workflow failed",
    });

    task.writeLine('{"type":"workflow:start"}');
    task.succeed();

    expect(stream.chunks.join("")).toBe('{"type":"workflow:start"}\n');
  });

  test("respects NO_COLOR while retaining the animation", () => {
    const stream = new MemoryTerminal(true);
    const task = new TerminalUI({
      stream,
      environment: { TERM: "xterm", NO_COLOR: "" },
    }).startTask({
      activity: "Running the Workflow",
      estimate: "Usually takes a few seconds to several minutes",
      successMessage: "Workflow completed",
      failureMessage: "Workflow failed",
    });

    task.succeed();

    const output = stream.chunks.join("");
    expect(output).toContain("⠋");
    expect(output).not.toContain("\u001B[36m");
    expect(output).not.toContain("\u001B[32m");
  });

  test("clears and redraws around event lines", () => {
    const stream = new MemoryTerminal(true);
    const task = new TerminalUI({
      stream,
      environment: { TERM: "xterm-256color" },
    }).startTask({
      activity: "Running the Workflow",
      estimate: "Usually takes a few seconds to several minutes",
      successMessage: "Workflow completed",
      failureMessage: "Workflow failed",
    });

    task.writeLine('{"type":"workflow:start"}');
    task.dispose();

    const output = stream.chunks.join("");
    const eventIndex = output.indexOf('{"type":"workflow:start"}\n');
    expect(eventIndex).toBeGreaterThan(-1);
    expect(output.slice(eventIndex)).toContain("⠙");
    expect(output.slice(eventIndex)).toContain("Running the Workflow");
  });

  test("updates the active description without starting another task", () => {
    const stream = new MemoryTerminal(true);
    const task = new TerminalUI({
      stream,
      environment: { TERM: "xterm-256color" },
    }).startTask({
      activity: "Running the Workflow",
      estimate: "Usually takes a few seconds to several minutes",
      successMessage: "Workflow completed",
      failureMessage: "Workflow failed",
    });

    task.updateActivity("Running phase: Research");
    task.succeed();

    expect(stream.chunks.join("")).toContain("Running phase: Research");
  });

  test("rejects overlapping tasks and permits a later task", () => {
    const stream = new MemoryTerminal(true);
    const ui = new TerminalUI({
      stream,
      environment: { TERM: "xterm-256color" },
    });
    const options = {
      activity: "Running the Workflow",
      estimate: "Usually takes a few seconds to several minutes",
      successMessage: "Workflow completed",
      failureMessage: "Workflow failed",
    };
    const firstTask = ui.startTask(options);

    expect(() => ui.startTask(options)).toThrow(
      "The terminal UI already has an active task.",
    );

    firstTask.succeed();
    const secondTask = ui.startTask(options);
    secondTask.succeed();
  });

  test("renders Workflow phases and Markdown logs in two columns", () => {
    const stream = new MemoryTerminal(true, 100, 24);
    const task = new TerminalUI({
      stream,
      environment: { TERM: "xterm-256color", NO_COLOR: "" },
    }).startWorkflowTask({
      workingDirectory: "/tmp",
      activity: "Running the Workflow",
      estimate: "Usually takes a few seconds to several minutes",
      successMessage: "Workflow completed",
      failureMessage: "Workflow failed",
    });

    task.handleEvent(event({ type: "workflow:start" }));
    task.handleEvent(
      event({
        type: "workflow:meta",
        meta: {
          name: "research",
          description: "Researches and synthesizes evidence.",
          phases: [{ title: "Plan" }, { title: "Research" }],
        },
      }),
    );
    task.handleEvent(event({ type: "workflow:phase:start", phase: "Plan" }));
    task.handleEvent(
      event({
        type: "log",
        phase: "Plan",
        message:
          "## Plan ready\n- **Three** research angles\n- 正在核验公开履历时间线，并对比多个独立来源，确认相关字段何时发生变化。",
      }),
    );
    task.handleEvent(
      event({
        type: "workflow:phase:end",
        phase: "Plan",
        durationMs: 2_400,
      }),
    );
    task.handleEvent(
      event({ type: "workflow:phase:start", phase: "Research" }),
    );
    task.succeed();

    const output = stream.chunks.join("");
    expect(output).toContain("🦌 Deer Workflow");
    expect(output).toContain("Workflow   research");
    expect(output).toContain("File       ./workflow.ts");
    expect(output).toContain("Directory  /tmp");
    expect(output).toContain("Phases");
    expect(output).toContain("Logs");
    expect(output).toContain("✓ Plan · 2s");
    expect(output).toMatch(/[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏] Research · \d+s/);
    expect(output).toContain("Plan ready");
    expect(output).toContain("• Three research angles");
    const finalFrame = output.slice(output.lastIndexOf("\u001B[J") + 4);
    for (const line of finalFrame.split("\n")) {
      expect(Bun.stringWidth(line)).toBeLessThanOrEqual(stream.columns);
    }
    expect(output).toContain("Press Ctrl+C to stop");
    const renderedLines = output.split("\n");
    const tableHeaderIndex = renderedLines.findIndex(
      (line) => line.includes("│ Phases") && line.includes("│ Logs"),
    );
    expect(tableHeaderIndex).toBeGreaterThan(-1);
    expect(renderedLines[tableHeaderIndex + 1]?.replaceAll(/[│ ]/g, "")).toBe(
      "",
    );
  });

  test("keeps Workflow JSONL intact when the dashboard is not interactive", () => {
    const stream = new MemoryTerminal(false);
    const task = new TerminalUI({ stream }).startWorkflowTask({
      workingDirectory: "/tmp",
      activity: "Running the Workflow",
      estimate: "Usually takes a few seconds to several minutes",
      successMessage: "Workflow completed",
      failureMessage: "Workflow failed",
    });

    task.writeLine('{"type":"workflow:start"}');
    task.succeed();

    expect(stream.chunks.join("")).toBe('{"type":"workflow:start"}\n');
  });

  test("sweeps a bright highlight across the active phase", () => {
    const stream = new MemoryTerminal(true, 100, 24);
    const task = new TerminalUI({
      stream,
      environment: { TERM: "xterm-256color" },
    }).startWorkflowTask({
      workingDirectory: "/tmp",
      activity: "Running the Workflow",
      estimate: "Usually takes a few seconds to several minutes",
      successMessage: "Workflow completed",
      failureMessage: "Workflow failed",
    });

    task.handleEvent(event({ type: "workflow:start" }));
    task.handleEvent(
      event({
        type: "workflow:meta",
        meta: {
          name: "research",
          description: "Researches evidence.",
          phases: [{ title: "Plan" }],
        },
      }),
    );
    task.handleEvent(event({ type: "workflow:phase:start", phase: "Plan" }));
    task.dispose();

    const output = stream.chunks.join("");
    expect(output).toContain("\u001B[1;97mP\u001B[0m");
    expect(output).toContain("\u001B[96ml\u001B[0m");
  });
});

function event(
  input:
    | { readonly type: "workflow:start" }
    | {
        readonly type: "workflow:meta";
        readonly meta: {
          readonly name: string;
          readonly description: string;
          readonly phases: readonly { readonly title: string }[];
        };
      }
    | { readonly type: "workflow:phase:start"; readonly phase: string }
    | {
        readonly type: "workflow:phase:end";
        readonly phase: string;
        readonly durationMs: number;
      }
    | {
        readonly type: "log";
        readonly message: string;
        readonly phase?: string;
      },
): WorkflowEvent {
  return {
    ...input,
    workflowId: "workflow-1",
    depth: 0,
    scriptPath: "/tmp/workflow.ts",
    sequence: 1,
    timestamp: "2026-07-26T00:00:00.000Z",
  };
}
